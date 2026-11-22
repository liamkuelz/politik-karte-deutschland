import { applyPartyEdge, partyColor, partyLabel } from '../parties.ts';
import type { PartyId, PartyResult } from '../types.ts';
import { h, reducedMotion } from './dom.ts';
import { fmtPct } from './format.ts';

/**
 * Absteigend nach Anteil, "Sonstige" immer zuletzt. Bei gleichem Anteil steht `leader` (z. B. die Partei der
 * Wahlkreis-Gewinnerin) vorn, damit Liste und Kartenfarbe übereinstimmen; sonst bleibt die Reihenfolge stabil.
 */
export function sortResults(results: PartyResult[], leader?: PartyId): PartyResult[] {
  return [...results].sort((a, b) => {
    if (a.party === 'sonstige' || b.party === 'sonstige') return a.party === 'sonstige' ? 1 : -1;
    if (b.share !== a.share) return b.share - a.share;
    return a.party === leader ? -1 : b.party === leader ? 1 : 0;
  });
}

/**
 * Balkenliste je Partei. Breite relativ zum groessten Anteil.
 * Die Balken wachsen per CSS-Transition, sobald die Liste im Dokument steht
 * (naechster Frame); ohne requestAnimationFrame oder bei reduzierter Bewegung sofort.
 */
export function renderBars(results: PartyResult[], landId?: string, leader?: PartyId): HTMLElement {
  const list = h('ul', 'bars');
  const sorted = sortResults(results, leader);
  // ungueltige Anteile zaehlen als 0, gueltige werden auf 0-100 begrenzt
  const safe = (share: number) => (Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 0);
  const max = Math.max(1e-6, ...sorted.map((r) => safe(r.share)));
  const fills: [HTMLElement, string][] = [];
  for (const r of sorted) {
    const li = h('li', 'bar');
    li.dataset.party = r.party;
    const label = h('span', 'bar-label', partyLabel(r.party, landId));
    const value = h('span', 'bar-value', fmtPct(r.share));
    const track = h('span', 'bar-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = h('span', 'bar-fill');
    fill.style.backgroundColor = partyColor(r.party);
    applyPartyEdge(fill, r.party);
    track.append(fill);
    li.append(label, value, track);
    list.append(li);
    fills.push([fill, `${+((safe(r.share) / max) * 100).toFixed(2)}%`]);
  }
  const setFinal = () => { for (const [f, w] of fills) f.style.width = w; };
  if (typeof requestAnimationFrame !== 'function' || reducedMotion()) {
    setFinal();
  } else {
    for (const [f] of fills) f.style.width = '0%';
    requestAnimationFrame(() => {
      fills[0]?.[0].getBoundingClientRect(); // Startbreite 0 festschreiben, damit die Transition laeuft
      setFinal();
    });
  }
  return list;
}
