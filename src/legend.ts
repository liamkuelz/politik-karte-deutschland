import type { AppData } from './data.ts';
import type { NavState } from './nav.ts';
import { PARTIES, partyLabel, strongestParty } from './parties.ts';
import { resolve } from './resolve.ts';
import type { PartyId } from './types.ts';
import { h } from './ui/dom.ts';
import { partyDot } from './ui/tiles.ts';

const ORDER = Object.keys(PARTIES) as PartyId[];

/**
 * Legende der Karte: nennt die Einfaerbungsregel der aktuellen Ebene und die Farben der Parteien,
 * die in der Ansicht tatsaechlich vorkommen (plus „Sonstige“).
 */
export function renderLegend(el: HTMLElement, state: NavState, data: AppData): void {
  const r = resolve(state, data);
  const landId = r.land?.id;
  const present = new Set<PartyId>(
    landId
      ? data.wahlkreise.filter((w) => w.landId === landId).map((w) => w.winner.party)
      : data.laender.map((l) => strongestParty(l.bundestag.second)),
  );
  present.add('sonstige');
  const rule = landId ? 'Wahlkreise: Gewinner der Erststimmen' : 'Länder: stärkste Partei nach Zweitstimmen';

  const list = h('ul', 'legend-list');
  list.setAttribute('aria-label', 'Parteifarben');
  for (const p of ORDER.filter((id) => present.has(id))) {
    const li = h('li', 'legend-item');
    li.append(partyDot(p), h('span', undefined, partyLabel(p, landId)));
    list.append(li);
  }
  el.replaceChildren(h('p', 'legend-rule', rule), list);
}
