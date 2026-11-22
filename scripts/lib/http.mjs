// Shared HTTP GET for the data scripts (aw-api.mjs, polls.mjs): every request has a 30 s timeout; network
// errors, timeouts, 429 and 5xx are retried with back-off (bounded number of tries); Retry-After is honoured
// but capped at 60 s. Other HTTP errors and exhausted retries throw.

export const TIMEOUT_MS = 30_000;
export const MAX_TRIES = 4;
export const RETRY_AFTER_CAP_MS = 60_000;

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Back-off before try `attempt + 1`: Retry-After (seconds, capped) if given, else 2 s, 4 s, 8 s ... */
export function retryDelay(attempt, retryAfter) {
  const s = Number(retryAfter);
  if (retryAfter != null && retryAfter !== '' && Number.isFinite(s) && s >= 0) return Math.min(s * 1000, RETRY_AFTER_CAP_MS);
  return 2000 * 2 ** (attempt - 1);
}

/**
 * GET `url` and return the body text of the first successful response.
 * @param {string} url
 * @param {{ headers?: Record<string, string>, label?: string, tries?: number, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchText(url, opts = {}) {
  const { headers = {}, label = url, tries = MAX_TRIES, sleep = defaultSleep } = opts;
  for (let attempt = 1; ; attempt++) {
    let status;
    let retryAfter = null;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return await res.text();
      status = res.status;
      retryAfter = res.headers.get('retry-after');
      if (status !== 429 && status < 500) throw Object.assign(new Error(`HTTP ${status}: ${label}`), { fatal: true });
    } catch (e) {
      if (e?.fatal) throw e;
      if (status === undefined) {
        // network error or timeout (fetch or body read)
        if (attempt >= tries) throw new Error(`${label}: ${e?.name === 'TimeoutError' ? 'timeout' : e?.message ?? e} (after ${attempt} tries)`);
        const wait = retryDelay(attempt, null);
        console.warn(`${label}: ${e?.name ?? 'error'} ${e?.message ?? ''}, retry ${attempt}/${tries - 1} in ${wait} ms`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
    if (attempt >= tries) throw new Error(`HTTP ${status}: ${label} (after ${attempt} tries)`);
    const wait = retryDelay(attempt, retryAfter);
    console.warn(`${label}: HTTP ${status}, retry ${attempt}/${tries - 1} in ${wait} ms`);
    await sleep(wait);
  }
}
