import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../src/nav.ts';

describe('nav', () => {
  it('round-trips canonical hashes', () => {
    for (const h of ['', '#/by', '#/by/219', '#/by/219/details', '#/by/details', '#/details']) {
      expect(formatHash(parseHash(h))).toBe(h);
    }
  });
  it('parses states', () => {
    expect(parseHash('')).toEqual({ level: 'de', details: false });
    expect(parseHash('#/')).toEqual({ level: 'de', details: false });
    expect(parseHash('#/by')).toEqual({ level: 'land', landId: 'BY', details: false });
    expect(parseHash('#/BY/219')).toEqual({ level: 'wk', landId: 'BY', wkId: 219, details: false });
    expect(parseHash('#/by/219/details')).toEqual({ level: 'wk', landId: 'BY', wkId: 219, details: true });
    expect(parseHash('#/by/details')).toEqual({ level: 'land', landId: 'BY', details: true });
    expect(parseHash('#/details')).toEqual({ level: 'de', details: true });
  });
  it('maps invalid hashes to de', () => {
    const de = { level: 'de', details: false };
    for (const h of ['#/xx/9999', '#/xx', '#/by/0', '#/by/300', '#/by/abc', '#/by/21.5', '#/by/-3',
      '#/by/219/foo', '#/by/219/details/x', '#/by/details/x', '#/details/x', 'garbage', '#/by//']) {
      expect(parseHash(h)).toEqual(de);
    }
  });
  it('formats de without details as empty string', () => {
    expect(formatHash({ level: 'de', details: false })).toBe('');
    expect(formatHash({ level: 'land', landId: 'NW', details: false })).toBe('#/nw');
  });
});
