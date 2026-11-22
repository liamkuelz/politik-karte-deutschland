import { describe, expect, it } from 'vitest';
import type { AppData } from '../src/data.ts';
import { sameState, sameView, validateState } from '../src/validate.ts';
import { fixtureData } from './fixtures.ts';

describe('validateState', () => {
  it('keeps valid states unchanged', () => {
    expect(validateState({ level: 'de', details: true }, fixtureData)).toEqual({ level: 'de', details: true });
    expect(validateState({ level: 'land', landId: 'BY', details: false }, fixtureData))
      .toEqual({ level: 'land', landId: 'BY', details: false });
    expect(validateState({ level: 'wk', landId: 'BY', wkId: 221, details: true }, fixtureData))
      .toEqual({ level: 'wk', landId: 'BY', wkId: 221, details: true });
  });

  it('degrades a Wahlkreis of another Land to the Land', () => {
    expect(validateState({ level: 'wk', landId: 'BY', wkId: 260, details: true }, fixtureData))
      .toEqual({ level: 'land', landId: 'BY', details: true });
    expect(validateState({ level: 'wk', landId: 'BY', wkId: 1, details: false }, fixtureData))
      .toEqual({ level: 'land', landId: 'BY', details: false });
  });

  it('degrades an unknown Land to Germany', () => {
    expect(validateState({ level: 'land', landId: 'HB', details: false }, fixtureData)).toEqual({ level: 'de', details: false });
    expect(validateState({ level: 'wk', landId: 'HB', wkId: 54, details: true }, fixtureData)).toEqual({ level: 'de', details: true });
  });

  it('keeps cards whose target exists (party profile, MdB, official, candidate)', () => {
    const cases = [
      { kind: 'party', id: 'union' }, { kind: 'person', id: '1002' }, { kind: 'person', id: '1001' },
      { kind: 'person', id: 'c-joerg-ueberall' }, { kind: 'person', id: 'c-grete-strasse' },
    ] as const;
    for (const card of cases) {
      expect(validateState({ level: 'land', landId: 'BY', details: true, card }, fixtureData), card.id)
        .toEqual({ level: 'land', landId: 'BY', details: true, card });
    }
  });

  it('counts officials of laender.json as persons', () => {
    const data: AppData = {
      ...fixtureData,
      laender: fixtureData.laender.map((l) => (l.id === 'BW'
        ? { ...l, officials: [{ id: 2001, name: 'Eva Amt', party: 'gruene', role: 'Ministerpräsidentin', profileUrl: '' }] } : l)),
    };
    const card = { kind: 'person', id: '2001' } as const;
    expect(validateState({ level: 'de', details: false, card }, data)).toEqual({ level: 'de', details: false, card });
    expect(validateState({ level: 'de', details: false, card }, fixtureData)).toEqual({ level: 'de', details: false });
  });

  it('drops cards with unknown targets and keeps the rest of the state', () => {
    const bad = [
      { kind: 'party', id: 'fdp' }, // gueltige PartyId, aber kein Profil
      { kind: 'party', id: 'sonstige' },
      { kind: 'party', id: 'cdu' },
      { kind: 'person', id: '999' },
      { kind: 'person', id: 'c-niemand' },
      { kind: 'person', id: '<b>' },
    ] as const;
    for (const card of bad) {
      expect(validateState({ level: 'wk', landId: 'BY', wkId: 220, details: true, card }, fixtureData), card.id)
        .toEqual({ level: 'wk', landId: 'BY', wkId: 220, details: true });
    }
    // Karte bleibt, auch wenn die Ebene korrigiert wird
    expect(validateState({ level: 'wk', landId: 'HB', wkId: 54, details: false, card: { kind: 'party', id: 'spd' } }, fixtureData))
      .toEqual({ level: 'de', details: false, card: { kind: 'party', id: 'spd' } });
  });

  it('sameState and sameView take the card into account', () => {
    const a = { level: 'land', landId: 'BY', details: false } as const;
    const b = { ...a, card: { kind: 'party', id: 'spd' } } as const;
    expect(sameState(a, b)).toBe(false);
    expect(sameView(a, b)).toBe(true);
    expect(sameState(b, { ...a, card: { kind: 'party', id: 'spd' } })).toBe(true);
    expect(sameState(b, { ...a, card: { kind: 'person', id: 'spd' } })).toBe(false);
  });

  it('drops stray fields for the de and land levels', () => {
    expect(validateState({ level: 'de', landId: 'BY', wkId: 220, details: false }, fixtureData)).toEqual({ level: 'de', details: false });
    expect(validateState({ level: 'land', landId: 'BY', wkId: 220, details: false }, fixtureData))
      .toEqual({ level: 'land', landId: 'BY', details: false });
  });
});
