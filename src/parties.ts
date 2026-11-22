import type { PartyId, PartyResult } from './types.ts';

// `ink`: nur wo die Fuellfarbe auf dem dunklen Hintergrund zu schwach waere (Union ist schwarz).
// Dort zeichnen Linien in `ink` und Flaechen bekommen einen 1px-Rand in `ink`.
export const PARTIES: Record<PartyId, { name: string; color: string; ink?: string }> = {
  union: { name: 'Union', color: '#1c1d21', ink: '#9aa0a6' },
  afd: { name: 'AfD', color: '#009EE0' },
  spd: { name: 'SPD', color: '#E3000F' },
  gruene: { name: 'Grüne', color: '#46962B' },
  linke: { name: 'Die Linke', color: '#BE3075' },
  fdp: { name: 'FDP', color: '#FFED00' },
  bsw: { name: 'BSW', color: '#C0568F' },
  fw: { name: 'Freie Wähler', color: '#F7A800' },
  ssw: { name: 'SSW', color: '#2D5BA8' },
  sonstige: { name: 'Sonstige', color: '#3a3d44' },
};

export function partyColor(id: PartyId): string {
  return PARTIES[id].color;
}

/** Sichtbare Farbe fuer Linien auf dunklem Grund (bei Union heller als die Fuellfarbe). */
export function partyInk(id: PartyId): string {
  return PARTIES[id].ink ?? PARTIES[id].color;
}

/** Flaechen in Parteifarbe: bei sehr dunklen Farben einen hellen 1px-Rand ergaenzen. */
export function applyPartyEdge(el: HTMLElement, id: PartyId): void {
  if (PARTIES[id].ink) el.style.boxShadow = `inset 0 0 0 1px ${PARTIES[id].ink}`;
}

export function normalizeParty(raw: string): PartyId {
  const s = raw.trim().toLowerCase();
  if (s === 'cdu' || s === 'csu' || s === 'cdu/csu' || s === 'union') return 'union';
  if (s === 'afd') return 'afd';
  if (s === 'spd') return 'spd';
  if (s.includes('grüne') || s.includes('gruene')) return 'gruene';
  if (s.includes('linke')) return 'linke';
  if (s === 'fdp') return 'fdp';
  if (s.startsWith('bsw') || s.startsWith('bündnis sahra')) return 'bsw';
  if (s === 'fw' || s === 'freie wähler' || s === 'freie waehler') return 'fw';
  if (s === 'ssw') return 'ssw';
  return 'sonstige';
}

export function strongestParty(results: PartyResult[]): PartyId {
  let best: PartyResult | undefined;
  for (const r of results) if (!best || r.share > best.share) best = r;
  return best ? best.party : 'sonstige';
}

export function partyLabel(id: PartyId, landId?: string): string {
  if (id === 'union' && landId === 'BY') return 'CSU';
  return PARTIES[id].name;
}
