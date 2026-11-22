import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartyResult } from '../src/types.ts';
import { renderBars } from '../src/ui/bars.ts';
import { fmtPct } from '../src/ui/format.ts';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('fmtPct', () => {
  it('returns "–" for invalid values', () => {
    expect(fmtPct(Number.NaN)).toBe('–');
    expect(fmtPct(undefined)).toBe('–');
    expect(fmtPct(null)).toBe('–');
    expect(fmtPct(37.2)).toBe('37,2 %');
  });
});

describe('renderBars', () => {
  it('treats non-finite shares as 0 and clamps to 0-100', () => {
    const results = [
      { party: 'spd', share: 150 }, { party: 'afd', share: 50 },
      { party: 'gruene', share: Number.NaN }, { party: 'linke', share: -5 },
    ] as PartyResult[];
    const bars = renderBars(results);
    const width = (party: string) => (bars.querySelector(`[data-party="${party}"] .bar-fill`) as HTMLElement).style.width;
    expect(width('spd')).toBe('100%');
    expect(width('afd')).toBe('50%');
    expect(width('gruene')).toBe('0%');
    expect(width('linke')).toBe('0%');
    expect(bars.querySelector('[data-party="gruene"] .bar-value')!.textContent).toBe('–');
  });
});
