import { applyPartyEdge, partyColor, partyLabel } from '../parties.ts';
import type { PartyId, WahlkreisWinner } from '../types.ts';
import { extLink, h } from './dom.ts';

/** Initialen aus erstem und letztem Namensteil, Titel wie "Dr." werden uebersprungen. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w && !w.endsWith('.'));
  if (!words.length) return '?';
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return (first + last).toUpperCase();
}

/** Dunkle oder helle Schrift je nach Helligkeit der Parteifarbe. */
export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.3 ? '#0b0c0e' : '#fff';
}

export function renderAvatar(name: string, party: PartyId): HTMLElement {
  const color = partyColor(party);
  const av = h('span', 'avatar', initials(name));
  av.setAttribute('aria-hidden', 'true');
  av.style.backgroundColor = color;
  av.style.color = inkFor(color);
  applyPartyEdge(av, party);
  return av;
}

export interface PersonRowInput {
  name: string;
  party: PartyId;
  role: string;
  /** ohne URL kein Profil-Link */
  profileUrl?: string;
}

/**
 * Rolle der Wahlkreis-Gewinnerin / des Gewinners: "Direktmandat" nur, wer 2025 den Sitz erhielt und noch
 * im Bundestag sitzt; sonst eine neutrale Beschreibung (keine Wertung).
 */
export function winnerRole(w: WahlkreisWinner): string {
  if (w.seated) return w.directMandate ? 'Direktmandat' : 'Erststimmen-Gewinner/in – 2025 ohne Direktmandat, inzwischen Mitglied des Bundestages';
  return w.directMandate
    ? 'Erststimmen-Gewinner/in – inzwischen aus dem Bundestag ausgeschieden'
    : 'Erststimmen-Gewinner/in – kein Bundestagsmandat (Zweitstimmendeckung)';
}

/** Zeile mit Initialen-Kreis in Parteifarbe, Name und "Partei · Rolle". */
export function renderPersonRow(p: PersonRowInput, landId?: string): HTMLElement {
  const row = h('div', 'person');
  const text = h('div', 'person-text');
  const name = p.profileUrl
    ? extLink(p.profileUrl, p.name, 'person-name profile-link')
    : h('span', 'person-name', p.name);
  if (name instanceof HTMLAnchorElement) name.title = 'Profil bei abgeordnetenwatch.de (neuer Tab)';
  const sub = h('span', 'person-sub', `${partyLabel(p.party, landId)} · ${p.role}`);
  text.append(name, sub);
  row.append(renderAvatar(p.name, p.party), text);
  return row;
}
