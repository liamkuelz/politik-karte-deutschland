import type { PartyId } from './types.ts';

/**
 * Geoeffnete Karte (Overlay) ueber der aktuellen Ansicht.
 * - `party`: id ist eine PartyId.
 * - `person`: id ist entweder eine Ziffernfolge (Person-id aus people.json bzw. Amtstraeger-id aus
 *   laender.json) oder ein Kandidatenschluessel `c-<slug>` (siehe `candidateKey` in content.ts).
 */
export interface Card { kind: 'party' | 'person'; id: string }

export interface NavState {
  level: 'de' | 'land' | 'wk';
  landId?: string;
  wkId?: number;
  details: boolean;
  card?: Card;
}

export const LAND_IDS = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];

export const PARTY_IDS: PartyId[] = ['union', 'afd', 'spd', 'gruene', 'linke', 'fdp', 'bsw', 'fw', 'ssw', 'sonstige'];

/** Person-ids: Ziffern (hoechstens 12) oder Kandidatenschluessel `c-` + Kleinbuchstaben/Ziffern mit Bindestrichen. */
const PERSON_ID = /^(?:[0-9]{1,12}|c-[a-z0-9]+(?:-[a-z0-9]+)*)$/;

const CARD_SEG: Record<string, Card['kind']> = { partei: 'party', person: 'person' };
const CARD_SEG_OF: Record<Card['kind'], string> = { party: 'partei', person: 'person' };

/** Formal gueltige Karte? (Ob es die Partei/Person in den Daten gibt, prueft validateState.) */
export function isCardId(kind: Card['kind'], id: string): boolean {
  return kind === 'party' ? (PARTY_IDS as string[]).includes(id) : PERSON_ID.test(id);
}

const DE: NavState = { level: 'de', details: false };

/**
 * Hash -> Zustand. Kanonische Reihenfolge: Ebene (`<land>` bzw. `<land>/<wk>`), dann optional
 * `details`, dann optional die Karte (`partei/<id>` oder `person/<id>`), z. B.
 * `#/by/219/details/partei/union`, `#/partei/afd`, `#/person/123`.
 * Eine formal ungueltige Karte (unbekannte Partei, falsches id-Format) wird verworfen, der Rest bleibt;
 * ein ungueltiger Ebenenteil fuehrt wie bisher zu Deutschland (ohne Karte).
 */
export function parseHash(hash: string): NavState {
  const m = /^#\/(.*)$/.exec(hash);
  if (!m) return { ...DE };
  let segs = m[1].split('/');
  if (segs.length === 1 && segs[0] === '') return { ...DE };
  let card: Card | undefined;
  if (segs.length >= 2 && CARD_SEG[segs[segs.length - 2]]) {
    const kind = CARD_SEG[segs[segs.length - 2]];
    const id = segs[segs.length - 1];
    if (isCardId(kind, id)) card = { kind, id };
    segs = segs.slice(0, -2);
  }
  const withCard = (s: NavState): NavState => (card ? { ...s, card } : s);
  let details = false;
  if (segs[segs.length - 1] === 'details') {
    details = true;
    segs = segs.slice(0, -1);
  }
  if (segs.length === 0) return withCard({ level: 'de', details });
  const landId = segs[0].toUpperCase();
  if (!LAND_IDS.includes(landId)) return { ...DE };
  if (segs.length === 1) return withCard({ level: 'land', landId, details });
  if (segs.length === 2 && /^[0-9]+$/.test(segs[1])) {
    const wkId = Number(segs[1]);
    if (wkId >= 1 && wkId <= 299) return withCard({ level: 'wk', landId, wkId, details });
  }
  return { ...DE };
}

export function formatHash(s: NavState): string {
  const parts: string[] = [];
  if (s.level !== 'de' && s.landId) {
    parts.push(s.landId.toLowerCase());
    if (s.level === 'wk' && s.wkId !== undefined) parts.push(String(s.wkId));
  }
  if (s.details) parts.push('details');
  if (s.card && isCardId(s.card.kind, s.card.id)) parts.push(CARD_SEG_OF[s.card.kind], s.card.id);
  return parts.length ? '#/' + parts.join('/') : '';
}
