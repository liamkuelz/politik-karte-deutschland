import { candidateKey, findPerson, slugify } from './content.ts';
import type { Candidate } from './content-types.ts';
import type { AppData } from './data.ts';
import type { PartyId, PartyResult, WahlkreisWinner } from './types.ts';
import { sortResults } from './ui/bars.ts';
import type { CardContext } from './ui/clickables.ts';
import { h } from './ui/dom.ts';
import type { PersonRowInput } from './ui/people.ts';
import { renderPersonRow } from './ui/people.ts';

/*
 * Hauptkandidaten fuer Panel und Dashboard (Bund und Land) sowie die Karten-id der Wahlkreis-Gewinner.
 * Reihenfolge: zuerst die Regierungschefin / der Regierungschef des Landes (aus laender.json, zusammengefuehrt
 * mit dem Kandidateneintrag derselben Person), danach nach dem Ergebnis der Partei bei der zugehoerigen Wahl
 * (Land: Landtagswahl, Bund: Bundestagswahl), innerhalb einer Partei in der Reihenfolge der Datei.
 */

export const LEADS_TITLE = 'Hauptkandidaten';
export const LEADS_CAPTION_DE = 'Spitzenkandidaten der Parteien im Bundestag (Bundestagswahl 2025)';
export const LEADS_CAPTION_LAND = 'Ministerpräsident/in und Spitzenkandidaten der Landtagsparteien';
export const LEADS_EMPTY = 'Für diese Ebene liegen keine belegten Angaben zu Hauptkandidaten vor.';

const candidateRow = (c: Candidate): PersonRowInput => ({
  name: c.name, party: c.party, role: c.role, note: c.note, personId: candidateKey(c),
});

/** Kandidaten nach dem Ergebnis ihrer Partei (Sonstige und nicht gelistete Parteien zuletzt), stabil. */
function byResult(list: Candidate[], results: PartyResult[]): Candidate[] {
  const order = sortResults(results).map((r) => r.party);
  const rank = (p: PartyId) => { const i = order.indexOf(p); return i < 0 ? order.length : i; };
  return [...list].sort((a, b) => rank(a.party) - rank(b.party));
}

export interface Leads {
  rows: PersonRowInput[];
  /** keine belegten Kandidaten-Eintraege fuer diese Ebene */
  empty: boolean;
}

/** Zeilen der Hauptkandidaten fuer den Bund (ohne landId) oder ein Land. */
export function leadsOf(data: AppData, landId?: string): Leads {
  if (!landId) {
    const list = data.kandidaten?.bund ?? [];
    return { rows: byResult(list, data.bund.second).map(candidateRow), empty: !list.length };
  }
  const land = data.laender.find((l) => l.id === landId);
  const list = data.kandidaten?.laender?.[landId] ?? [];
  const rows: PersonRowInput[] = [];
  const used = new Set<Candidate>();
  for (const o of land?.officials ?? []) {
    const same = list.find((c) => slugify(c.name) === slugify(o.name));
    if (same) used.add(same);
    rows.push(same ? candidateRow(same) : { name: o.name, party: o.party, role: o.role, personId: String(o.id) });
  }
  const results = land?.landtag?.second ?? land?.bundestag.second ?? [];
  rows.push(...byResult(list.filter((c) => !used.has(c)), results).map(candidateRow));
  return { rows, empty: !list.length };
}

/** Liste der Hauptkandidaten (Zeilen mit Karten-Knoepfen) plus Hinweis, wenn keine Eintraege belegt sind. */
export function renderLeads(data: AppData, landId: string | undefined, ctx: CardContext): HTMLElement {
  const { rows, empty } = leadsOf(data, landId);
  const box = h('div', 'people leads');
  for (const r of rows) box.append(renderPersonRow(r, landId, ctx));
  if (empty) box.append(h('p', 'empty', LEADS_EMPTY));
  return box;
}

/**
 * Karten-id der Wahlkreis-Gewinnerin / des Gewinners: nur wenn die Person aufloesbar ist (people.json oder
 * Amt in laender.json). Wer nicht mehr im Bundestag sitzt, bekommt keine Abgeordneten-Karte.
 */
export function winnerPersonId(data: AppData, w: WahlkreisWinner): string | undefined {
  if (w.mdbId === null) return undefined;
  const found = findPerson(data, w.mdbId);
  if (!found || (found.mdb && !w.seated)) return undefined;
  return String(w.mdbId);
}
