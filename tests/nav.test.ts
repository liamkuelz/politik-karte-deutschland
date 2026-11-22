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
      '#/by/219/foo', '#/by/219/details/x', '#/by/details/x', '#/details/x', 'garbage', '#/by//',
      '#/partei', '#/person', '#/xx/partei/union', '#/by/300/partei/union', '#/partei/union/details',
      '#/partei/union/partei/spd']) {
      expect(parseHash(h), h).toEqual(de);
    }
  });
  it('formats de without details as empty string', () => {
    expect(formatHash({ level: 'de', details: false })).toBe('');
    expect(formatHash({ level: 'land', landId: 'NW', details: false })).toBe('#/nw');
  });
});

describe('nav: cards', () => {
  it('round-trips canonical hashes with a card as the last segment pair', () => {
    for (const h of ['#/partei/union', '#/partei/afd', '#/person/123', '#/person/c-joerg-ueberall',
      '#/by/partei/spd', '#/by/219/partei/union', '#/by/219/person/123', '#/details/partei/gruene',
      '#/by/details/person/c-markus-soeder', '#/by/219/details/partei/union']) {
      expect(formatHash(parseHash(h)), h).toBe(h);
    }
  });
  it('parses card states (level de for bare cards)', () => {
    expect(parseHash('#/partei/union')).toEqual({ level: 'de', details: false, card: { kind: 'party', id: 'union' } });
    expect(parseHash('#/person/123')).toEqual({ level: 'de', details: false, card: { kind: 'person', id: '123' } });
    expect(parseHash('#/by/219/details/partei/union')).toEqual({
      level: 'wk', landId: 'BY', wkId: 219, details: true, card: { kind: 'party', id: 'union' },
    });
    expect(parseHash('#/BY/person/c-a-b')).toEqual({ level: 'land', landId: 'BY', details: false, card: { kind: 'person', id: 'c-a-b' } });
  });
  it('drops a malformed card but keeps the rest of the state', () => {
    expect(parseHash('#/partei/cdu')).toEqual({ level: 'de', details: false });
    expect(parseHash('#/by/partei/UNION')).toEqual({ level: 'land', landId: 'BY', details: false });
    expect(parseHash('#/by/219/details/person/abc')).toEqual({ level: 'wk', landId: 'BY', wkId: 219, details: true });
    for (const bad of ['12a', '-1', 'c-', 'c-Abc', 'c--x', 'c-x-', '1234567890123', '%3Cb%3E', '']) {
      expect(parseHash(`#/by/person/${bad}`), bad).toEqual({ level: 'land', landId: 'BY', details: false });
    }
  });
  it('formatHash ignores a malformed card', () => {
    expect(formatHash({ level: 'land', landId: 'BY', details: false, card: { kind: 'party', id: 'cdu' } })).toBe('#/by');
    expect(formatHash({ level: 'de', details: false, card: { kind: 'person', id: '../x' } })).toBe('');
  });
});
