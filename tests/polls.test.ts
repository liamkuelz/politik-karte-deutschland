// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Meta, PollSeries } from '../src/types.ts';
// @ts-expect-error plain .mjs helpers without type declarations
import { averageInstitutes } from '../scripts/lib/poll-merge.mjs';
// @ts-expect-error plain .mjs helpers without type declarations
import { selectSteps, STEPS } from '../scripts/lib/build-steps.mjs';

const dataDir = new URL('../public/data/', import.meta.url);
const read = <T>(f: string) => JSON.parse(readFileSync(new URL(f, dataDir), 'utf8')) as T;
const series = read<PollSeries[]>('polls.json');
const meta = read<Meta>('meta.json');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LAENDER = ['BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH'];

describe('polls data', () => {
  it('has a DE series and only valid areas, each at most once', () => {
    expect(series.some((s) => s.areaId === 'DE')).toBe(true);
    const ids = series.map((s) => s.areaId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(['DE', ...LAENDER]).toContain(id);
  });

  it('points are ascending, unique, span at most 12 months up to meta.stand.polls, values 0-100', () => {
    // window measured against the data itself (newest point = meta.stand.polls), not the wall clock
    const today = meta.stand.polls;
    const lo = new Date(`${today}T00:00:00Z`);
    lo.setUTCMonth(lo.getUTCMonth() - 12);
    const cutoff = lo.toISOString().slice(0, 10);
    for (const s of series) {
      expect(s.points.length).toBeGreaterThan(0);
      for (const [i, p] of s.points.entries()) {
        expect(p.date).toMatch(ISO);
        expect(p.date >= cutoff && p.date <= today).toBe(true);
        if (i > 0) expect(p.date > s.points[i - 1].date).toBe(true);
        const vals = Object.values(p.values);
        expect(vals.length).toBeGreaterThan(0);
        for (const v of vals) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('meta.json has three valid ISO dates; polls = newest poll date', () => {
    for (const k of ['election', 'people', 'polls'] as const) {
      expect(meta.stand[k]).toMatch(ISO);
      expect(Number.isNaN(Date.parse(meta.stand[k]))).toBe(false);
    }
    const newest = series.flatMap((s) => s.points.map((p) => p.date)).sort().at(-1);
    expect(meta.stand.polls).toBe(newest);
  });
});

describe('averageInstitutes', () => {
  const sv = (date: string, institute: number, values: Record<string, number>) => ({ date, institute, values });

  it("two institutes alternating: each date averages both institutes' latest surveys", () => {
    expect(averageInstitutes([
      sv('2026-05-05', 1, { union: 32 }),
      sv('2026-05-01', 1, { union: 30 }),
      sv('2026-05-03', 2, { union: 26 }),
      sv('2026-05-07', 2, { union: 28 }),
    ])).toEqual([
      { date: '2026-05-01', values: { union: 30 } },
      { date: '2026-05-03', values: { union: 28 } },
      { date: '2026-05-05', values: { union: 29 } },
      { date: '2026-05-07', values: { union: 30 } },
    ]);
  });

  it('a prolific institute counts once (its most recent survey)', () => {
    const pts = averageInstitutes([
      sv('2026-05-01', 1, { afd: 20 }), sv('2026-05-02', 1, { afd: 21 }), sv('2026-05-03', 1, { afd: 22 }),
      sv('2026-05-02', 2, { afd: 26 }),
    ]);
    expect(pts.at(-1)).toEqual({ date: '2026-05-03', values: { afd: 24 } });
  });

  it('window edge: a survey exactly 21 days older counts, 22 days older does not', () => {
    expect(averageInstitutes([sv('2026-01-01', 1, { spd: 20 }), sv('2026-01-22', 2, { spd: 30 })]).at(-1))
      .toEqual({ date: '2026-01-22', values: { spd: 25 } });
    expect(averageInstitutes([sv('2026-01-01', 1, { spd: 20 }), sv('2026-01-23', 2, { spd: 30 })]).at(-1))
      .toEqual({ date: '2026-01-23', values: { spd: 30 } });
  });

  it("one institute only: each point is that institute's survey of the day", () => {
    expect(averageInstitutes([sv('2026-03-02', 7, { union: 27, afd: 25 }), sv('2026-03-01', 7, { union: 26, afd: 24 })])).toEqual([
      { date: '2026-03-01', values: { union: 26, afd: 24 } },
      { date: '2026-03-02', values: { union: 27, afd: 25 } },
    ]);
  });

  it('a party listed by only one survey is averaged over that survey only; unlisted parties are not invented', () => {
    const [p] = averageInstitutes([sv('2026-04-01', 1, { union: 30, bsw: 4 }), sv('2026-04-01', 2, { union: 28 })]);
    expect(p.values).toEqual({ union: 29, bsw: 4 });
  });

  it('rounds to one decimal; same-day surveys of one institute are averaged first', () => {
    const [p] = averageInstitutes([sv('2026-01-01', 1, { spd: 14 }), sv('2026-01-01', 2, { spd: 15 }), sv('2026-01-01', 3, { spd: 15 })]);
    expect(p.values.spd).toBe(14.7);
    const [q] = averageInstitutes([sv('2026-01-01', 1, { spd: 10 }), sv('2026-01-01', 1, { spd: 12 }), sv('2026-01-01', 2, { spd: 20 })]);
    expect(q.values.spd).toBe(15.5);
  });
});

describe('build-data', () => {
  it('runs geo, elections, people, votes, polls in this order', () => {
    expect(STEPS.map((s: { name: string }) => s.name)).toEqual(['geo', 'elections', 'people', 'votes', 'polls']);
  });
  it('--dry-run prints the steps in order and runs nothing', () => {
    const r = spawnSync(process.execPath, ['scripts/build-data.mjs', '--dry-run', '--fresh'], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    const idx = ['geo', 'elections', 'people', 'votes', 'polls'].map((n) => r.stdout.indexOf(`scripts/${n}.mjs`));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(r.stdout).toContain('would delete scripts/.cache/people');
  });
  it('selectSteps keeps the canonical order and rejects unknown names', () => {
    expect(selectSteps(undefined)).toBe(STEPS);
    expect(selectSteps('polls,people, votes').map((s: { name: string }) => s.name)).toEqual(['people', 'votes', 'polls']);
    expect(() => selectSteps('people,geoo')).toThrow(/unknown step\(s\) "geoo"/);
    expect(() => selectSteps('')).toThrow(/valid: geo, elections, people, votes, polls/);
  });
  it('--dry-run --only people,votes,polls lists just these steps; an unknown name fails clearly', () => {
    const run = (...a: string[]) => spawnSync(process.execPath, ['scripts/build-data.mjs', '--dry-run', ...a], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    });
    const r = run('--only', 'polls,votes,people');
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split('\n');
    expect(lines).toEqual([
      '[dry-run] [1/3] node scripts/people.mjs',
      '[dry-run] [2/3] node scripts/votes.mjs',
      '[dry-run] [3/3] node scripts/polls.mjs',
    ]);
    const bad = run('--only', 'people,wahlen');
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('unknown step(s) "wahlen"');
    expect(bad.stdout).not.toContain('node scripts/');
  });
});
