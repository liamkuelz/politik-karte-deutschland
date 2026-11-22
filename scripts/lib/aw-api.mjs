// Shared Abgeordnetenwatch API v2 client for the data scripts (people.mjs, votes.mjs).
// Responses are cached on disk (`<cacheDir>/<name>.json`, written as .part then renamed), paced politely,
// fetched with a 30 s timeout and retried with back-off on network errors/timeouts/429/5xx (lib/http.mjs),
// and only ever parsed as JSON. Everything fails loudly.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchText } from './http.mjs';

export const API = 'https://www.abgeordnetenwatch.de/api/v2';
const UA = 'politik-karte-datenskript/1.0 (static data pipeline; non-commercial)';
const PAGE = 100;
const PAUSE_MS = 400; // polite pacing between uncached requests

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createApi(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });

  /** GET json from the API; cached on disk, polite pacing, timeout + bounded retries, fails loudly. */
  async function api(path, cacheName) {
    const file = join(cacheDir, `${cacheName}.json`);
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
    await sleep(PAUSE_MS);
    const text = await fetchText(`${API}/${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      label: `Abgeordnetenwatch API ${path}`,
    });
    const json = JSON.parse(text); // validates
    const tmp = `${file}.part`;
    writeFileSync(tmp, text);
    renameSync(tmp, file);
    return json;
  }

  /** All pages of a list endpoint; throws if the collected count differs from meta.result.total. */
  async function fetchAll(query, name) {
    const all = [];
    let total = null;
    for (let start = 0; ; start += PAGE) {
      const j = await api(`${query}&range_start=${start}&range_end=${PAGE}`, `${name}-${start}`);
      total = j.meta.result.total;
      all.push(...j.data);
      if (j.data.length < PAGE || all.length >= total) break;
    }
    if (all.length !== total) throw new Error(`Truncated pagination for ${query}: got ${all.length} of ${total}`);
    return all;
  }

  return { api, fetchAll };
}
