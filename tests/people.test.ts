// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Land, PartyId, Person, Wahlkreis } from '../src/types.ts';

const read = <T>(f: string): T =>
  JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8')) as T;

const PARTY_IDS: PartyId[] = ['union', 'afd', 'spd', 'gruene', 'linke', 'fdp', 'bsw', 'fw', 'ssw', 'sonstige'];
const people = read<Person[]>('people.json');
const wahlkreise = read<Wahlkreis[]>('wahlkreise.json');
const laender = read<Land[]>('laender.json');

// Source is Abgeordnetenwatch (profile pages). The Bundestag member pages are accepted as documented fallback.
const PROFILE = /^https:\/\/www\.(abgeordnetenwatch|bundestag)\.de\//;

describe('people.json', () => {
  it('has at least 600 Bundestag members with unique ids, valid parties and profile URLs', () => {
    expect(people.length).toBeGreaterThanOrEqual(600);
    expect(new Set(people.map((p) => p.id)).size).toBe(people.length);
    for (const p of people) {
      expect(p.name.length).toBeGreaterThan(2);
      expect(PARTY_IDS).toContain(p.party);
      expect(p.profileUrl).toMatch(PROFILE);
    }
  });

  it('sets wahlkreisId (1..299, unique) for directly elected members', () => {
    const ids = people.filter((p) => p.wahlkreisId !== undefined).map((p) => p.wahlkreisId as number);
    // 276 Wahlkreissieger got a seat in 2025; some leave during the Wahlperiode (their list successors carry no
    // wahlkreisId), so the bound leaves room for turnover instead of tracking today's count
    expect(ids.length).toBeGreaterThanOrEqual(240);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(299);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('wahlkreise.json winner.mdbId', () => {
  it('is filled for at least 95 % of the Wahlkreise', () => {
    expect(wahlkreise).toHaveLength(299);
    const filled = wahlkreise.filter((w) => w.winner.mdbId !== null).length;
    expect(filled / wahlkreise.length).toBeGreaterThanOrEqual(0.95);
  });

  it('points to the sitting member where the winner is a Bundestag member', () => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const sitting = people.filter((p) => p.wahlkreisId !== undefined);
    expect(sitting.length).toBeGreaterThan(0);
    for (const p of sitting) {
      const w = wahlkreise.find((x) => x.id === p.wahlkreisId)!;
      if (w.winner.mdbId !== null && byId.has(w.winner.mdbId)) {
        expect(w.winner.mdbId).toBe(p.id);
      }
    }
  });
});

describe('wahlkreise.json winner.seated / directMandate', () => {
  it('every seated winner is a member in people.json, every member id there is seated', () => {
    const ids = new Set(people.map((p) => p.id));
    for (const w of wahlkreise) {
      expect(typeof w.winner.seated, String(w.id)).toBe('boolean');
      expect(typeof w.winner.directMandate, String(w.id)).toBe('boolean');
      const member = w.winner.mdbId !== null && ids.has(w.winner.mdbId);
      expect(w.winner.seated, String(w.id)).toBe(member);
    }
  });

  it('a plausible number of winners hold no seat (Zweitstimmendeckung or left since)', () => {
    const unseated = wahlkreise.filter((w) => !w.winner.seated).length;
    expect(unseated).toBeGreaterThanOrEqual(1);
    expect(unseated).toBeLessThan(299 / 4);
    const withoutDirect = wahlkreise.filter((w) => !w.winner.directMandate).length;
    expect(withoutDirect).toBeGreaterThanOrEqual(1);
    expect(withoutDirect).toBeLessThan(299 / 4);
  });
});

describe('laender.json officials', () => {
  it('every Land has at least one official with a role and profile URL', () => {
    expect(laender).toHaveLength(16);
    for (const l of laender) {
      expect(l.officials.length, l.id).toBeGreaterThanOrEqual(1);
      for (const o of l.officials) {
        expect(o.role.length).toBeGreaterThan(3);
        expect(PARTY_IDS).toContain(o.party);
        expect(o.profileUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it('every Land lists its Ministerpraesident-type head of government', () => {
    for (const l of laender) {
      expect(l.officials.some((o) => /Ministerpr|Bürgermeister|Senats/.test(o.role)), l.id).toBe(true);
    }
  });

  it('lists no Fraktionsvorsitzende (version 1: heads of government only, equal treatment of parties)', () => {
    for (const l of laender) {
      for (const o of l.officials) expect(o.role, l.id + ' ' + o.name).not.toMatch(/Fraktionsvorsitz/);
    }
  });
});
