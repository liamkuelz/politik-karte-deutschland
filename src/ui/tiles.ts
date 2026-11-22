import { applyPartyEdge, partyColor, partyLabel } from '../parties.ts';
import type { PartyId, PartyResult, Vote } from '../types.ts';
import { sortResults } from './bars.ts';
import { h } from './dom.ts';
import { fmtPct } from './format.ts';
import { renderTable } from './table.ts';
import { ANSWER_LABEL, ANSWERS, renderVoteRow, sortVotes } from './votes.ts';

const MAX_STAGGER = 10;

export interface TileOptions {
  /** ganze Zeile des Rasters */
  wide?: boolean;
  /** Untertitel unter der Kachelueberschrift */
  caption?: string;
}

/** Glas-Kachel mit Ueberschrift; die Position im Raster steuert die gestaffelte Einblendung (--i). */
export function renderTile(title: string, index: number, children: (Node | string)[], opts: TileOptions = {}): HTMLElement {
  const tile = h('section', `tile glass${opts.wide ? ' tile-wide' : ''}`);
  tile.style.setProperty('--i', String(Math.min(index, MAX_STAGGER)));
  tile.append(h('h3', 'tile-title', title));
  if (opts.caption) tile.append(h('p', 'tile-caption', opts.caption));
  tile.append(...children);
  return tile;
}

export function partyDot(party: PartyId): HTMLElement {
  const dot = h('span', 'dot');
  dot.setAttribute('aria-hidden', 'true');
  dot.style.backgroundColor = partyColor(party);
  applyPartyEdge(dot, party);
  return dot;
}

const safeShare = (s: number) => (Number.isFinite(s) ? Math.min(100, Math.max(0, s)) : 0);

/** Ein gestapelter Balken (100 %) aus Parteianteilen, mit Textalternative. */
function stack(label: string, results: PartyResult[], landId?: string, leader?: PartyId): HTMLElement {
  const row = h('div', 'stack-row');
  const bar = h('div', 'stack');
  const sorted = sortResults(results, leader);
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${label}: ${sorted.map((r) => `${partyLabel(r.party, landId)} ${fmtPct(r.share)}`).join(', ')}`);
  for (const r of sorted) {
    const seg = h('span', 'stack-seg');
    seg.style.width = `${+safeShare(r.share).toFixed(2)}%`;
    seg.style.backgroundColor = partyColor(r.party);
    applyPartyEdge(seg, r.party);
    seg.title = `${partyLabel(r.party, landId)} ${fmtPct(r.share)}`;
    bar.append(seg);
  }
  row.append(h('span', 'stack-label', label), bar);
  return row;
}

/** Erst- und Zweitstimmen als zwei gestapelte Balken plus Tabelle der Anteile; `leader` gewinnt Gleichstaende der Erststimmen. */
export function renderStackedComparison(first: PartyResult[], second: PartyResult[], landId?: string, leader?: PartyId): HTMLElement {
  const wrap = h('div', 'stack-compare');
  wrap.append(stack('Erststimmen', first, landId, leader), stack('Zweitstimmen', second, landId));
  const share = (list: PartyResult[], p: PartyId) => list.find((r) => r.party === p)?.share;
  // Reihenfolge nach Zweitstimmen, Parteien nur mit Erststimmen danach
  const parties = sortResults([...second, ...first.filter((f) => !second.some((s) => s.party === f.party))])
    .map((r) => r.party);
  const { table, body } = renderTable([{ label: 'Partei' }, { label: 'Erst', num: true }, { label: 'Zweit', num: true }], 'dash-table compact');
  for (const p of parties) {
    const tr = h('tr');
    const name = h('td', 'party-cell');
    name.append(partyDot(p), h('span', undefined, partyLabel(p, landId)));
    tr.append(name, h('td', 'num', fmtPct(share(first, p))), h('td', 'num', fmtPct(share(second, p))));
    body.append(tr);
  }
  wrap.append(table);
  return wrap;
}

type Filter = 'all' | Vote['answer'];

/** Vollstaendige Abstimmungsliste mit Filterknoepfen (clientseitig) in einem intern scrollenden Kasten. */
export function fillVoteList(box: HTMLElement, votes: Vote[]): void {
  if (!votes.length) {
    box.replaceChildren(h('p', 'empty', 'Keine Abstimmungen verfügbar'));
    return;
  }
  const sorted = sortVotes(votes);
  const count = (f: Filter) => (f === 'all' ? sorted.length : sorted.filter((v) => v.answer === f).length);
  const bar = h('div', 'vote-filter');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Abstimmungen nach Stimme filtern');
  const status = h('p', 'vote-count');
  status.setAttribute('aria-live', 'polite');
  const list = h('ul', 'vote-list vote-scroll');
  list.tabIndex = 0; // scrollbarer Bereich auch per Tastatur
  list.setAttribute('aria-label', 'Abstimmungen');
  const rows = sorted.map((v) => renderVoteRow(v));
  list.append(...rows);

  const buttons: HTMLButtonElement[] = [];
  const apply = (f: Filter) => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.filter === f));
    for (const li of rows) li.hidden = f !== 'all' && li.dataset.answer !== f;
    status.textContent = `${count(f)} von ${sorted.length} Abstimmungen`;
  };
  for (const f of ['all', ...ANSWERS] as Filter[]) {
    const b = h('button', 'filter-btn');
    b.type = 'button';
    b.dataset.filter = f;
    b.append(h('span', undefined, f === 'all' ? 'Alle' : ANSWER_LABEL[f]), ' ', h('span', 'filter-count', String(count(f))));
    b.addEventListener('click', () => apply(f));
    buttons.push(b);
    bar.append(b);
  }
  apply('all');
  box.replaceChildren(bar, status, list);
}
