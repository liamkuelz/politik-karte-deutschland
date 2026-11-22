import type { AppData } from './data.ts';
import type { NavState } from './nav.ts';
import type { Land, Wahlkreis } from './types.ts';

export interface Resolved { level: NavState['level']; land?: Land; wk?: Wahlkreis }

/** Zustand -> Datenobjekte. Unbekannte IDs fallen auf die naechsthoehere Ebene zurueck. */
export function resolve(state: NavState, data: AppData): Resolved {
  const land = state.level !== 'de' ? data.laender.find((l) => l.id === state.landId) : undefined;
  if (!land) return { level: 'de' };
  const wk = state.level === 'wk'
    ? data.wahlkreise.find((w) => w.id === state.wkId && w.landId === land.id)
    : undefined;
  return wk ? { level: 'wk', land, wk } : { level: 'land', land };
}

/** Kurzer Schluessel des aufgeloesten Zustands (ohne Details-Modus). */
export const resolvedKey = (r: Resolved) => `${r.level}/${r.land?.id ?? ''}/${r.wk?.id ?? ''}`;
