import { findCandidate, findParty, findPerson } from './content.ts';
import type { AppData } from './data.ts';
import type { Card, NavState } from './nav.ts';
import { isCardId } from './nav.ts';
import { resolve } from './resolve.ts';

/** Gibt es das Ziel der Karte in den Daten? (Partei mit Profil; Person in people.json, laender.json oder kandidaten.json) */
export function cardExists(card: Card, data: AppData): boolean {
  if (!isCardId(card.kind, card.id)) return false;
  if (card.kind === 'party') return !!findParty(data, card.id);
  return card.id.startsWith('c-') ? !!findCandidate(data, card.id) : !!findPerson(data, card.id);
}

/**
 * Zustand gegen die Daten pruefen: unbekanntes Land -> Deutschland, Wahlkreis ausserhalb des Landes
 * -> Land. Der Details-Modus bleibt erhalten; Felder, die zur Ebene nicht passen, entfallen.
 * Eine Karte mit unbekanntem Ziel (z. B. alter Link) wird verworfen, der Rest des Zustands bleibt.
 */
export function validateState(state: NavState, data: AppData): NavState {
  const r = resolve(state, data);
  const { details } = state;
  const card = state.card && cardExists(state.card, data) ? { card: { kind: state.card.kind, id: state.card.id } } : {};
  if (r.level === 'wk') return { level: 'wk', landId: r.land!.id, wkId: r.wk!.id, details, ...card };
  if (r.level === 'land') return { level: 'land', landId: r.land!.id, details, ...card };
  return { level: 'de', details, ...card };
}

/** Gleiche Ansicht (Ebene, Land, Wahlkreis, Details), unabhaengig von einer geoeffneten Karte. */
export const sameView = (a: NavState, b: NavState) =>
  a.level === b.level && a.landId === b.landId && a.wkId === b.wkId && a.details === b.details;

export const sameCard = (a: Card | undefined, b: Card | undefined) =>
  a === b || (!!a && !!b && a.kind === b.kind && a.id === b.id);

export const sameState = (a: NavState, b: NavState) => sameView(a, b) && sameCard(a.card, b.card);
