import { describe, expect, it, vi } from 'vitest';
import { renderLegend } from '../src/legend.ts';
import type { NavState } from '../src/nav.ts';
import { partyColor } from '../src/parties.ts';
import { fixtureData } from './fixtures.ts';

function legend(state: NavState): HTMLElement {
  const el = document.createElement('div');
  renderLegend(el, state, fixtureData);
  return el;
}
const labels = (el: HTMLElement) => [...el.querySelectorAll('.legend-item')].map((li) => li.textContent);

describe('renderLegend', () => {
  it('de level: Länder rule with the strongest parties of all Länder plus Sonstige', () => {
    const el = legend({ level: 'de', details: false });
    expect(el.querySelector('.legend-rule')!.textContent).toBe('Länder: stärkste Partei nach Zweitstimmen');
    // BW: Union vorn, BY (Fixture): AfD vorn
    expect(labels(el)).toEqual(['Union', 'AfD', 'Sonstige']);
    const dots = [...el.querySelectorAll<HTMLElement>('.legend-item .dot')];
    expect(dots[1].style.backgroundColor).toBe(hexToRgb(partyColor('afd')));
  });

  it('land level: Wahlkreis rule with the winners of that Land, Union named CSU in Bayern', () => {
    const el = legend({ level: 'land', landId: 'BY', details: false });
    expect(el.querySelector('.legend-rule')!.textContent).toBe('Wahlkreise: Gewinner der Erststimmen');
    expect(labels(el)).toEqual(['SPD', 'Grüne', 'Sonstige']);
    const bw = legend({ level: 'wk', landId: 'BW', wkId: 260, details: false });
    expect(labels(bw)).toEqual(['Union', 'Sonstige']);
  });

  it('labels the union as CSU in Bayern', () => {
    const data = { ...fixtureData, wahlkreise: fixtureData.wahlkreise.map((w) => ({ ...w, winner: { ...w.winner, party: 'union' as const } })) };
    const el = document.createElement('div');
    renderLegend(el, { level: 'land', landId: 'BY', details: false }, data);
    expect(labels(el)).toEqual(['CSU', 'Sonstige']);
  });

  it('with onNavigate the party names are party buttons (Sonstige stays text); without it all text', () => {
    const nav = vi.fn();
    const el = document.createElement('div');
    const s: NavState = { level: 'land', landId: 'BY', details: false };
    renderLegend(el, s, fixtureData, nav);
    const btn = el.querySelector<HTMLButtonElement>('.legend-item button[data-party="spd"]')!;
    expect(btn.textContent).toBe('SPD');
    expect(btn.hasAttribute('data-card-trigger')).toBe(true);
    btn.click();
    expect(nav).toHaveBeenCalledWith({ ...s, card: { kind: 'party', id: 'spd' } });
    expect(el.querySelector('[data-party="sonstige"]')).toBeNull();
    expect(labels(el)).toEqual(['SPD', 'Grüne', 'Sonstige']);
    const de = document.createElement('div');
    renderLegend(de, { level: 'de', details: false }, fixtureData, nav);
    expect([...de.querySelectorAll('button[data-party]')].map((b) => b.textContent)).toEqual(['Union', 'AfD']);
    expect(legend({ level: 'de', details: false }).querySelector('button')).toBeNull();
  });

  it('unknown Land falls back to the Länder rule and re-render replaces content', () => {
    const el = legend({ level: 'land', landId: 'ZZ', details: false });
    expect(el.querySelector('.legend-rule')!.textContent).toBe('Länder: stärkste Partei nach Zweitstimmen');
    renderLegend(el, { level: 'land', landId: 'BW', details: false }, fixtureData);
    expect(el.querySelectorAll('.legend-rule')).toHaveLength(1);
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
