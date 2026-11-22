import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadAll, loadVotes } from '../src/data.ts';

const base = import.meta.env.BASE_URL;
const FILES = ['geo.topo.json', 'wahlkreise.json', 'laender.json', 'bund.json', 'people.json', 'polls.json', 'meta.json'];

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('loadVotes', () => {
  it('returns [] on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as Response));
    expect(await loadVotes(1)).toEqual([]);
  });
  it('returns [] on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await loadVotes(1)).toEqual([]);
  });
  it('returns [] on invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) as unknown as Response));
    expect(await loadVotes(1)).toEqual([]);
  });
  it('returns parsed votes and uses BASE_URL', async () => {
    const votes = [{ pollId: 1, title: 't', date: '2024-01-01', answer: 'yes', url: 'u' }];
    const f = vi.fn(async () => ok(votes));
    vi.stubGlobal('fetch', f);
    expect(await loadVotes(42)).toEqual(votes);
    expect(f).toHaveBeenCalledWith(`${base}data/votes/42.json`);
  });
});

describe('loadAll', () => {
  it('loads all 7 files', async () => {
    const f = vi.fn(async (url: string) => ok({ file: url.split('/').pop() }));
    vi.stubGlobal('fetch', f);
    const d = await loadAll();
    expect(f).toHaveBeenCalledTimes(7);
    for (const n of FILES) expect(f).toHaveBeenCalledWith(`${base}data/${n}`);
    expect(d.geo).toEqual({ file: 'geo.topo.json' });
    expect(d.bund).toEqual({ file: 'bund.json' });
    expect(d.meta).toEqual({ file: 'meta.json' });
  });
  it('rejects with file name when a file fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('polls.json') ? ({ ok: false, status: 500, json: async () => ({}) }) as Response : ok({})));
    await expect(loadAll()).rejects.toThrow(/polls\.json/);
  });
  it('rejects with file name on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('meta.json')) throw new TypeError('offline');
      return ok({});
    }));
    await expect(loadAll()).rejects.toThrow(/meta\.json/);
  });
});

describe('loadVotes (shape guard)', () => {
  it('returns [] for non-array JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ votes: [] })));
    expect(await loadVotes(7)).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => ok(null)));
    expect(await loadVotes(7)).toEqual([]);
  });
});
