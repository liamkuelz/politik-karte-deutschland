import { describe, expect, it, vi } from 'vitest';
import type { NavState } from '../src/nav.ts';
import { partyButton, personButton } from '../src/ui/clickables.ts';

const STATE: NavState = { level: 'wk', landId: 'BY', wkId: 220, details: true };

describe('partyButton', () => {
  it('is a text-like button that opens the party card over the current state', () => {
    const nav = vi.fn();
    const btn = partyButton('spd', 'SPD', STATE, nav);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.type).toBe('button');
    expect(btn.className).toBe('link-btn');
    expect(btn.textContent).toBe('SPD');
    expect(btn.hasAttribute('data-card-trigger')).toBe(true);
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    btn.click();
    expect(nav).toHaveBeenCalledWith({ ...STATE, card: { kind: 'party', id: 'spd' } });
  });

  it('accepts extra classes and keeps the click from bubbling (e.g. clickable table rows)', () => {
    const nav = vi.fn();
    const row = vi.fn();
    const btn = partyButton('union', 'CSU', STATE, nav, { className: 'bar-label' });
    expect(btn.className).toBe('link-btn bar-label');
    const wrap = document.createElement('div');
    wrap.addEventListener('click', row);
    wrap.append(btn);
    btn.click();
    expect(nav).toHaveBeenCalledTimes(1);
    expect(row).not.toHaveBeenCalled();
  });

  it('replaces an open card', () => {
    const nav = vi.fn();
    partyButton('afd', 'AfD', { ...STATE, card: { kind: 'person', id: '1' } }, nav).click();
    expect(nav).toHaveBeenCalledWith({ ...STATE, card: { kind: 'party', id: 'afd' } });
  });
});

describe('personButton', () => {
  it('opens the person card with a digit id or a candidate key', () => {
    const nav = vi.fn();
    const btn = personButton('Clara Probe', '1003', STATE, nav, { className: 'person-name' });
    expect(btn.className).toBe('link-btn person-name');
    expect(btn.type).toBe('button');
    expect(btn.hasAttribute('data-card-trigger')).toBe(true);
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    btn.click();
    expect(nav).toHaveBeenCalledWith({ ...STATE, card: { kind: 'person', id: '1003' } });
    personButton('Jörg Überall', 'c-joerg-ueberall', STATE, nav).click();
    expect(nav).toHaveBeenLastCalledWith({ ...STATE, card: { kind: 'person', id: 'c-joerg-ueberall' } });
  });

  it('renders the label as text', () => {
    const btn = personButton('<b>x</b>', '1', STATE, vi.fn());
    expect(btn.querySelector('b')).toBeNull();
    expect(btn.textContent).toBe('<b>x</b>');
  });
});
