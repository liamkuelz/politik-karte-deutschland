// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Candidate, CandidatesFile } from '../src/content-types.ts';

const LAENDER_IDS = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const PARTY_IDS = ['union', 'afd', 'spd', 'gruene', 'linke', 'fdp', 'bsw', 'fw', 'ssw', 'sonstige'];
/** Mehrere Spitzenkandidaten einer Partei nur, wenn die Partei eine Doppelspitze/ein Team benannt hat (dann vermerkt). */
const TEAM_NOTE = /Doppelspitze|Spitzenteam/;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

interface LandData { id: string; landtag: { year: number; second: { party: string; share: number }[] } }
interface Official { land: string; name: string; party: string; role: string }

const data = readJson<CandidatesFile>('public/data/kandidaten.json');
const laender = readJson<LandData[]>('public/data/laender.json');
const officials = readJson<{ officials: Official[] }>('scripts/officials.json').officials;

function allEntries(): { where: string; c: Candidate }[] {
  const out = data.bund.map((c) => ({ where: 'bund', c }));
  for (const [land, list] of Object.entries(data.laender)) for (const c of list) out.push({ where: land, c });
  return out;
}

function checkSpitzenCount(list: Candidate[], isSpitzen: (c: Candidate) => boolean, where: string): void {
  const byParty = new Map<string, Candidate[]>();
  for (const c of list.filter(isSpitzen)) byParty.set(c.party, [...(byParty.get(c.party) ?? []), c]);
  for (const [party, cs] of byParty) {
    if (cs.length === 1) continue;
    const team = cs.every((c) => TEAM_NOTE.test(c.note ?? '')) && cs.length <= 3;
    expect(team, `${where}: mehrere Spitzenkandidaten fuer ${party} ohne Team-Vermerk`).toBe(true);
  }
}

describe('kandidaten.json', () => {
  it('hat alle 16 Laender und ein ISO-Stand-Datum', () => {
    expect(Object.keys(data.laender).sort()).toEqual([...LAENDER_IDS].sort());
    expect(data.stand).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(data.stand))).toBe(false);
  });

  it('jeder Eintrag ist vollstaendig, ohne URL, mit gueltiger Partei', () => {
    for (const { where, c } of allEntries()) {
      const label = `${where}: ${c.name}`;
      expect(c.name.trim(), label).not.toBe('');
      expect(c.role.trim(), label).not.toBe('');
      expect(c.source.trim(), label).not.toBe('');
      expect(PARTY_IDS, label).toContain(c.party);
      expect(c.party, label).not.toBe('sonstige');
      expect(c.source, label).not.toMatch(/http|www\./i);
      expect(c.name, label).not.toMatch(/\d|http|www\./i);
      if (c.note !== undefined) {
        expect(c.note.trim(), label).not.toBe('');
        expect(c.note, label).not.toMatch(/http|www\./i);
      }
      if (c.bio !== undefined) {
        expect(c.bio.source.trim(), label).not.toBe('');
        expect(c.bio.source, label).not.toMatch(/http|www\./i);
        if (c.bio.birthYear !== undefined) expect(c.bio.birthYear, label).toBeGreaterThan(1900);
        if (c.bio.profession !== undefined) expect(c.bio.profession.trim(), label).not.toBe('');
        if (c.bio.career !== undefined) expect(c.bio.career.trim(), label).not.toBe('');
      }
    }
  });

  it('keine doppelten (Partei, Name) im Bund oder innerhalb eines Landes', () => {
    const groups: [string, Candidate[]][] = [['bund', data.bund], ...Object.entries(data.laender)];
    for (const [where, list] of groups) {
      const keys = list.map((c) => `${c.party}|${c.name}`);
      expect(new Set(keys).size, where).toBe(keys.length);
    }
  });

  it('Bund: nur Bundestagsparteien 2025, mindestens 5 Parteien, einheitliche Rollen', () => {
    const parties = new Set(data.bund.map((c) => c.party));
    expect(parties.has('bsw')).toBe(false);
    expect(parties.has('fdp')).toBe(false);
    expect(parties.size).toBeGreaterThanOrEqual(5);
    for (const c of data.bund) expect(c.role, c.name).toMatch(/^(Kanzler|Spitzen)kandidat(in)? Bundestagswahl 2025$/);
    checkSpitzenCount(data.bund, () => true, 'bund');
  });

  for (const id of LAENDER_IDS) {
    it(`${id}: Regierungschef enthalten, Parteien im Landtag, hoechstens ein Spitzenkandidat je Partei`, () => {
      const list = data.laender[id];
      expect(list.length).toBeGreaterThanOrEqual(1);
      const land = laender.find((l) => l.id === id);
      expect(land, id).toBeDefined();
      const year = land!.landtag.year;
      const head = officials.find((o) => o.land === id);
      expect(head, id).toBeDefined();

      const headEntry = list.find((c) => c.name === head!.name);
      expect(headEntry, `${id}: Regierungschef ${head!.name} fehlt`).toBeDefined();
      expect(headEntry!.party).toBe(head!.party);
      const combined = new RegExp(`^${head!.role.replace(/[()]/g, '\\$&')} und Spitzenkandidat(in)? Landtagswahl ${year}$`);
      expect(headEntry!.role === head!.role || combined.test(headEntry!.role), `${id}: Rolle ${headEntry!.role}`).toBe(true);

      const spitzen = new RegExp(`^Spitzenkandidat(in)? Landtagswahl ${year}$`);
      for (const c of list) {
        if (c === headEntry) continue;
        expect(c.role, `${id}: ${c.name}`).toMatch(spitzen);
      }

      const inLandtag = new Set(land!.landtag.second.map((r) => r.party).filter((p) => p !== 'sonstige'));
      for (const c of list) {
        const ok = inLandtag.has(c.party) || (c === headEntry && c.party === head!.party);
        expect(ok, `${id}: ${c.name} (${c.party}) nicht im Landtag`).toBe(true);
      }

      const isSpitzen = (c: Candidate): boolean => /Spitzenkandidat/.test(c.role);
      checkSpitzenCount(list, isSpitzen, id);
    });
  }
});
