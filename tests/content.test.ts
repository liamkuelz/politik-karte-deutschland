import { describe, expect, it } from 'vitest';
import { candidateKey, findCandidate, findParty, findPerson, slugify } from '../src/content.ts';
import type { AppData } from '../src/data.ts';
import { isCardId } from '../src/nav.ts';
import { fixtureData } from './fixtures.ts';

describe('candidateKey', () => {
  it('transliterates umlauts and ß, lowercases and dashes the rest', () => {
    expect(candidateKey({ name: 'Jörg Überall' })).toBe('c-joerg-ueberall');
    expect(candidateKey({ name: 'Grete Straße' })).toBe('c-grete-strasse');
    expect(candidateKey({ name: 'Dr. Änne-Marie  Müller-Lüdenscheidt' })).toBe('c-dr-aenne-marie-mueller-luedenscheidt');
    expect(candidateKey({ name: 'ÄÖÜ äöü' })).toBe('c-aeoeue-aeoeue');
    expect(candidateKey({ name: 'José Ñoño' })).toBe('c-jose-nono');
    expect(slugify('  O\'Neill (SSW) ')).toBe('o-neill-ssw');
  });
  it('produces keys the hash accepts', () => {
    for (const n of ['Jörg Überall', 'Dr. Änne-Marie Müller', 'Sahra Wagenknecht']) {
      expect(isCardId('person', candidateKey({ name: n })), n).toBe(true);
    }
  });
});

describe('findCandidate', () => {
  it('finds a candidate of the federal list', () => {
    expect(findCandidate(fixtureData, 'c-erika-vorsitz')).toMatchObject({ candidate: { name: 'Erika Vorsitz' } });
    expect(findCandidate(fixtureData, 'c-erika-vorsitz')!.landId).toBeUndefined();
  });
  it('prefers the given Land, then the federal list, then any Land', () => {
    expect(findCandidate(fixtureData, 'c-joerg-ueberall', 'BY')).toMatchObject({ landId: 'BY', candidate: { role: 'Spitzenkandidat Landtagswahl 2023' } });
    expect(findCandidate(fixtureData, 'c-joerg-ueberall')).toMatchObject({ candidate: { role: 'Kanzlerkandidat Bundestagswahl 2025' } });
    expect(findCandidate(fixtureData, 'c-grete-strasse', 'BW')).toMatchObject({ landId: 'BY' });
  });
  it('returns undefined for unknown keys and digit ids', () => {
    expect(findCandidate(fixtureData, 'c-niemand')).toBeUndefined();
    expect(findCandidate(fixtureData, '1001')).toBeUndefined();
  });
});

describe('findPerson / findParty', () => {
  it('finds members of the Bundestag with their Wahlkreis and Land', () => {
    const p = findPerson(fixtureData, '1002')!;
    expect(p.mdb).toBe(true);
    expect(p.person.name).toBe('Bernd Muster');
    expect(p.wk?.id).toBe(220);
    expect(p.land?.id).toBe('BY');
  });
  it('finds officials from laender.json (not in people.json) with their office', () => {
    const data: AppData = {
      ...fixtureData,
      laender: fixtureData.laender.map((l) => (l.id === 'BW'
        ? { ...l, officials: [{ id: 2001, name: 'Eva Amt', party: 'gruene', role: 'Ministerpräsidentin', profileUrl: '' }] } : l)),
    };
    const p = findPerson(data, 2001)!;
    expect(p.mdb).toBe(false);
    expect(p.offices.map((o) => [o.land.id, o.role])).toEqual([['BW', 'Ministerpräsidentin']]);
    expect(p.land?.id).toBe('BW');
  });
  it('returns undefined for unknown or malformed ids', () => {
    expect(findPerson(fixtureData, '999')).toBeUndefined();
    expect(findPerson(fixtureData, 'c-erika-vorsitz')).toBeUndefined();
    expect(findParty(fixtureData, 'spd')?.name).toBe('SPD');
    expect(findParty(fixtureData, 'fdp')).toBeUndefined();
  });
});
