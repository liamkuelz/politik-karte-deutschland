// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain .mjs helpers without type declarations
import { fetchText, MAX_TRIES, retryDelay, TIMEOUT_MS } from '../scripts/lib/http.mjs';

const ok = (body: string) => new Response(body, { status: 200 });
const status = (code: number, headers: Record<string, string> = {}) => new Response('x', { status: code, headers });
const timeoutError = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchText (scripts/lib/http.mjs)', () => {
  it('passes a 30 s timeout signal and the headers', async () => {
    fetchMock.mockResolvedValueOnce(ok('{}'));
    await expect(fetchText('https://example.org/a', { headers: { 'User-Agent': 'x' } })).resolves.toBe('{}');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({ 'User-Agent': 'x' });
    expect(TIMEOUT_MS).toBe(30_000);
  });

  it('429 then 200: retries after the back-off (fake timers, no real sleep)', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok('done'));
    const p = fetchText('https://example.org/b');
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('done');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('thrown network error then 200: retried', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(ok('net'));
    await expect(fetchText('https://example.org/c', { sleep })).resolves.toBe('net');
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('timeout error then 200: retried', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    fetchMock.mockRejectedValueOnce(timeoutError()).mockResolvedValueOnce(ok('late'));
    await expect(fetchText('https://example.org/d', { sleep })).resolves.toBe('late');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('5xx and errors up to the limit: throws after MAX_TRIES with exponential back-off', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    fetchMock
      .mockResolvedValueOnce(status(503))
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(status(502))
      .mockResolvedValueOnce(status(500));
    await expect(fetchText('https://example.org/e', { sleep, label: 'E' })).rejects.toThrow(/HTTP 500: E/);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TRIES);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000, 8000]);
  });

  it('exhausted retries on network errors throw too', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchText('https://example.org/f', { sleep, label: 'F' })).rejects.toThrow(/F: fetch failed/);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TRIES);
  });

  it('4xx other than 429 is not retried', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    fetchMock.mockResolvedValueOnce(status(403));
    await expect(fetchText('https://example.org/g', { sleep, label: 'G' })).rejects.toThrow(/HTTP 403: G/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('honours Retry-After but caps it at 60 s', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(status(429, { 'Retry-After': '3600' })).mockResolvedValueOnce(ok('capped'));
    const p = fetchText('https://example.org/h');
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('capped');
    expect(retryDelay(1, '5')).toBe(5000);
    expect(retryDelay(2, null)).toBe(4000);
    expect(retryDelay(1, 'Wed, 21 Oct 2026 07:28:00 GMT')).toBe(2000); // HTTP-Datum: normale Wartezeit
  });
});
