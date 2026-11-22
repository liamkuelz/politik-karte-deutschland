import { describe, expect, it } from 'vitest';
import { validateState } from '../src/validate.ts';
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

  it('drops stray fields for the de and land levels', () => {
    expect(validateState({ level: 'de', landId: 'BY', wkId: 220, details: false }, fixtureData)).toEqual({ level: 'de', details: false });
    expect(validateState({ level: 'land', landId: 'BY', wkId: 220, details: false }, fixtureData))
      .toEqual({ level: 'land', landId: 'BY', details: false });
  });
});
