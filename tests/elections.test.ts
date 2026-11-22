// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AreaResult, Land, PartyId, PartyResult, Wahlkreis } from '../src/types.ts';

const read = <T>(f: string): T =>
  JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8')) as T;

const PARTY_IDS: PartyId[] = ['union', 'afd', 'spd', 'gruene', 'linke', 'fdp', 'bsw', 'fw', 'ssw', 'sonstige'];
const wahlkreise = read<Wahlkreis[]>('wahlkreise.json');
const laender = read<Land[]>('laender.json');
const bund = read<AreaResult>('bund.json');
const topo = read<{ objects: Record<string, { geometries: { properties: Record<string, unknown> }[] }> }>('geo.topo.json');

const sum = (l: PartyResult[]) => l.reduce((s, r) => s + r.share, 0);
function expectValidList(l: PartyResult[]) {
  expect(l.length).toBeGreaterThan(0);
  expect(sum(l)).toBeGreaterThanOrEqual(99.5);
  expect(sum(l)).toBeLessThanOrEqual(100.5);
  const ids = l.map((r) => r.party);
  expect(new Set(ids).size).toBe(ids.length);
  for (const r of l) {
    expect(PARTY_IDS).toContain(r.party);
    expect(r.share).toBeGreaterThanOrEqual(0);
  }
}

describe('wahlkreise.json', () => {
  it('has 299 Wahlkreise whose ids exist in geo.topo.json', () => {
    expect(wahlkreise).toHaveLength(299);
    const geoIds = new Set(topo.objects.wahlkreise.geometries.map((g) => g.properties.id));
    for (const w of wahlkreise) expect(geoIds.has(w.id)).toBe(true);
    expect(new Set(wahlkreise.map((w) => w.id)).size).toBe(299);
  });

  it('has valid first/second lists, turnout and winner', () => {
    for (const w of wahlkreise) {
      expectValidList(w.first);
      expectValidList(w.second);
      expect(w.turnout).toBeGreaterThan(40);
      expect(w.turnout).toBeLessThan(100);
      expect(PARTY_IDS).toContain(w.winner.party);
      expect(w.winner.name.length).toBeGreaterThan(3);
      // filled by scripts/people.mjs (checked in people.test.ts)
      expect(w.winner.mdbId === null || Number.isInteger(w.winner.mdbId)).toBe(true);
    }
  });
});

describe('laender.json', () => {
  it('has the 16 Länder of geo.topo.json with Bundestagswahl 2025', () => {
    expect(laender).toHaveLength(16);
    const geoIds = topo.objects.laender.geometries.map((g) => g.properties.id).sort();
    expect(laender.map((l) => l.id).sort()).toEqual(geoIds);
    for (const l of laender) {
      expect(l.bundestag.year).toBe(2025);
      expect(l.bundestag.electionType).toBe('bundestag');
      expectValidList(l.bundestag.second);
      expect(l.bundestag.turnout).toBeGreaterThan(40);
      expect(l.bundestag.turnout).toBeLessThan(100);
      expect(Array.isArray(l.officials)).toBe(true); // filled by scripts/people.mjs (checked in people.test.ts)
    }
  });

  it('has a valid latest Landtagswahl for at least 14 Länder', () => {
    const withLandtag = laender.filter((l) => l.landtag !== null);
    expect(withLandtag.length).toBeGreaterThanOrEqual(14);
    for (const l of withLandtag) {
      const lt = l.landtag as AreaResult;
      expect(lt.electionType).toBe('landtag');
      expect(lt.year).toBeGreaterThanOrEqual(2022);
      expect(lt.turnout).toBeGreaterThan(40);
      expect(lt.turnout).toBeLessThan(100);
      expectValidList(lt.second);
    }
  });

  it('every Wahlkreis refers to an existing Land', () => {
    const ids = new Set(laender.map((l) => l.id));
    for (const w of wahlkreise) expect(ids.has(w.landId)).toBe(true);
  });
});

describe('bund.json', () => {
  it('is the Bundesergebnis 2025 with Union as strongest party', () => {
    expect(bund.electionType).toBe('bundestag');
    expect(bund.year).toBe(2025);
    expect(bund.turnout).toBeGreaterThan(40);
    expect(bund.turnout).toBeLessThan(100);
    expectValidList(bund.second);
    const top = [...bund.second].sort((a, b) => b.share - a.share)[0];
    expect(top.party).toBe('union');
  });
});
