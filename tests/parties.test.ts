import { describe, it, expect } from 'vitest';
import { PARTIES, partyColor, normalizeParty, strongestParty, partyLabel } from '../src/parties.ts';
import type { PartyId } from '../src/types.ts';

describe('parties', () => {
  it('normalizes party names', () => {
    expect(normalizeParty('CSU')).toBe('union');
    expect(normalizeParty('CDU')).toBe('union');
    expect(normalizeParty('CDU/CSU')).toBe('union');
    expect(normalizeParty('Bündnis 90/Die Grünen')).toBe('gruene');
    expect(normalizeParty('GRÜNE')).toBe('gruene');
    expect(normalizeParty('DIE LINKE')).toBe('linke');
    expect(normalizeParty('parteilos')).toBe('sonstige');
    expect(normalizeParty('AfD')).toBe('afd');
    expect(normalizeParty('SPD')).toBe('spd');
    expect(normalizeParty('FDP')).toBe('fdp');
    expect(normalizeParty('BSW')).toBe('bsw');
    expect(normalizeParty('Bündnis Sahra Wagenknecht')).toBe('bsw');
    expect(normalizeParty('Freie Wähler')).toBe('fw');
    expect(normalizeParty('FREIE WÄHLER')).toBe('fw');
    expect(normalizeParty('SSW')).toBe('ssw');
    expect(normalizeParty('Irgendwas')).toBe('sonstige');
  });
  it('finds strongest party', () => {
    expect(strongestParty([])).toBe('sonstige');
    expect(strongestParty([{ party: 'spd', share: 20 }, { party: 'afd', share: 21 }])).toBe('afd');
  });
  it('labels union per Land', () => {
    expect(partyLabel('union', 'BY')).toBe('CSU');
    expect(partyLabel('union', 'NW')).toBe('Union');
    expect(partyLabel('union')).toBe('Union');
  });
  it('has hex colors for every party', () => {
    for (const id of Object.keys(PARTIES) as PartyId[]) {
      expect(partyColor(id)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(PARTIES.union.color).not.toBe('#000000');
  });
});
