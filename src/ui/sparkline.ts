import { applyPartyEdge, partyInk, partyLabel, partyColor } from '../parties.ts';
import type { PartyId, PollPoint, PollSeries } from '../types.ts';
import { h } from './dom.ts';
import { fmtDate, fmtPct } from './format.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 140;
const LEFT = 38; // Platz fuer die Achsenbeschriftung
const PX = 6;
const PY = 8;
const DAY = 86_400_000;
const WINDOW_DAYS = 365;

/** Ueberschrift einer Umfragereihe, z. B. pollTitle('Bund'): die Reihen sind Durchschnitte ueber die Institute. */
export const pollTitle = (area: string) => `Umfrage ${area} (Durchschnitt der Institute)`;

const time = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Parteien des neuesten Punkts, absteigend, "Sonstige" zuletzt. */
function partiesOf(p: PollPoint): PartyId[] {
  return (Object.keys(p.values) as PartyId[])
    .filter((id) => typeof p.values[id] === 'number')
    .sort((a, b) => {
      if (a === 'sonstige' || b === 'sonstige') return a === 'sonstige' ? 1 : -1;
      return p.values[b]! - p.values[a]!;
    });
}

/**
 * Mini-Linienchart der letzten 12 Monate (relativ zum neuesten Punkt) plus aktuelle Werte.
 * Ohne Reihe oder Punkte: Hinweistext.
 */
export function renderSparkline(series: PollSeries | undefined): HTMLElement {
  const wrap = h('div', 'spark');
  const all = (series?.points ?? []).filter((p) => !Number.isNaN(time(p.date)))
    .sort((a, b) => time(a.date) - time(b.date));
  if (!series || !all.length) {
    wrap.append(h('p', 'empty', 'Keine Umfragen verfügbar'));
    return wrap;
  }
  const last = all[all.length - 1];
  const tEnd = time(last.date);
  const pts = all.filter((p) => time(p.date) >= tEnd - WINDOW_DAYS * DAY);
  const parties = partiesOf(last);
  const tStart = time(pts[0].date);
  const span = tEnd - tStart;
  let max = 0;
  for (const p of pts) for (const id of parties) max = Math.max(max, p.values[id] ?? 0);
  const yMax = Math.max(10, Math.ceil(max / 10) * 10);
  const x = (iso: string) => (span > 0 ? LEFT + ((time(iso) - tStart) / span) * (W - LEFT - PX) : (LEFT + W) / 2);
  const y = (v: number) => H - PY - (v / yMax) * (H - 2 * PY);
  const r = (n: number) => +n.toFixed(1);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'spark-chart' });
  svg.setAttribute('aria-label', `Umfrageverlauf ${fmtDate(pts[0].date)} bis ${fmtDate(last.date)}`);
  for (let v = 0; v <= yMax; v += 10) {
    svg.append(svgEl('line', { x1: LEFT - 4, x2: W, y1: r(y(v)), y2: r(y(v)), class: v === 0 ? 'spark-base' : 'spark-grid' }));
    const label = svgEl('text', { x: LEFT - 7, y: r(y(v) + 3.5), class: 'spark-axis', 'text-anchor': 'end' });
    label.textContent = `${v} %`;
    svg.append(label);
  }
  // in umgekehrter Reihenfolge zeichnen, damit die staerkste Linie oben liegt
  for (const id of [...parties].reverse()) {
    const coords = pts.filter((p) => typeof p.values[id] === 'number')
      .map((p) => `${r(x(p.date))},${r(y(p.values[id]!))}`);
    const color = partyInk(id); // Linien brauchen eine auf Dunkel sichtbare Farbe
    if (coords.length > 1) {
      svg.append(svgEl('polyline', { points: coords.join(' '), fill: 'none', stroke: color, class: 'spark-line', 'data-party': id }));
    }
    const [cx, cy] = coords[coords.length - 1].split(',');
    svg.append(svgEl('circle', { cx, cy, r: 2.6, fill: color, class: 'spark-dot' }));
  }

  const legend = h('ul', 'spark-legend');
  for (const id of parties) {
    const li = h('li');
    const dot = h('span', 'dot');
    dot.style.backgroundColor = partyColor(id);
    applyPartyEdge(dot, id);
    li.append(dot, h('span', 'spark-label', partyLabel(id, series.areaId)), h('span', 'spark-value', fmtPct(last.values[id]!, 0, 1)));
    legend.append(li);
  }
  const note = h('p', 'note', `Stand ${fmtDate(last.date)} · Verlauf seit ${fmtDate(pts[0].date)}`);
  wrap.append(svg, legend, note);
  return wrap;
}
