import type { AppData } from './data.ts';
import type { NavState } from './nav.ts';
import { resolve } from './resolve.ts';

/**
 * Zustand gegen die Daten pruefen: unbekanntes Land -> Deutschland, Wahlkreis ausserhalb des Landes
 * -> Land. Der Details-Modus bleibt erhalten; Felder, die zur Ebene nicht passen, entfallen.
 */
export function validateState(state: NavState, data: AppData): NavState {
  const r = resolve(state, data);
  const { details } = state;
  if (r.level === 'wk') return { level: 'wk', landId: r.land!.id, wkId: r.wk!.id, details };
  if (r.level === 'land') return { level: 'land', landId: r.land!.id, details };
  return { level: 'de', details };
}

export const sameState = (a: NavState, b: NavState) =>
  a.level === b.level && a.landId === b.landId && a.wkId === b.wkId && a.details === b.details;
