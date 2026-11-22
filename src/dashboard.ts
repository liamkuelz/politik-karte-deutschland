import type { AppData } from './data.ts';
import { loadVotes } from './data.ts';
import { LEADS_CAPTION_DE, LEADS_CAPTION_LAND, LEADS_TITLE, renderLeads, winnerPersonId } from './leads.ts';
import type { NavState } from './nav.ts';
import { partyLabel, strongestParty } from './parties.ts';
import { resolve, resolvedKey } from './resolve.ts';
import type { AreaResult, Land, Vote, Wahlkreis } from './types.ts';
import { renderBars } from './ui/bars.ts';
import type { CardContext } from './ui/clickables.ts';
import { cardContext, partyName, personName } from './ui/clickables.ts';
import { h } from './ui/dom.ts';
import { fmtPct } from './ui/format.ts';
import { renderPersonRow, winnerRole } from './ui/people.ts';
import { pollTitle, renderSparkline } from './ui/sparkline.ts';
import { renderTable } from './ui/table.ts';
import { fillVoteList, partyDot, renderStackedComparison, renderTile } from './ui/tiles.ts';

type Navigate = (s: NavState) => void;

/** Pro Dashboard-Element: zuletzt gezeigter Inhalt und Render-Zaehler (gegen veraltete Abstimmungs-Antworten). */
const memo = new WeakMap<HTMLElement, { key: string; token: number }>();

const turnoutLine = (r: AreaResult) => h('p', 'meta', `Wahlbeteiligung ${fmtPct(r.turnout)}`);
const pollOf = (data: AppData, areaId: string) => data.polls.find((p) => p.areaId === areaId);

/** Kopf mit Ueberschrift (fokussierbar) und Knopf zurueck zur grossen Karte. */
function header(kicker: string, title: string, state: NavState, onNavigate: Navigate) {
  const head = h('header', 'dash-head');
  const text = h('div', 'dash-titles');
  const heading = h('h2', 'dash-title', title);
  heading.tabIndex = -1;
  text.append(h('p', 'kicker', kicker), heading);
  const close = h('button', 'btn-details btn-close', 'Zurück zur Karte');
  close.type = 'button';
  close.dataset.action = 'close-details';
  close.addEventListener('click', () => onNavigate({ ...state, details: false }));
  head.append(text, close);
  return { head, heading };
}

function deTiles(data: AppData, onNavigate: Navigate, ctx: CardContext): HTMLElement[] {
  const { table, body } = renderTable([{ label: 'Land' }, { label: 'Stärkste Partei' }, { label: 'Wahlbeteiligung', num: true }]);
  for (const land of [...data.laender].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    const best = strongestParty(land.bundestag.second);
    const share = land.bundestag.second.find((r) => r.party === best)?.share;
    const tr = h('tr', 'row-link');
    const go = h('button', 'link-btn', land.name);
    go.type = 'button';
    const nameCell = h('td');
    nameCell.append(go);
    const partyCell = h('td', 'party-cell');
    // Der Parteiname oeffnet die Parteikarte (stoppt den Zeilenklick); der Rest der Zeile fuehrt zum Land
    partyCell.append(partyDot(best), partyName(best, partyLabel(best, land.id), ctx), ` ${fmtPct(share)}`);
    tr.append(nameCell, partyCell, h('td', 'num', fmtPct(land.bundestag.turnout)));
    // Klick irgendwo in der Zeile; der Knopf macht sie per Tastatur erreichbar (sein Klick steigt hierher auf)
    tr.addEventListener('click', () => onNavigate({ level: 'land', landId: land.id, details: true }));
    body.append(tr);
  }
  return [
    renderTile('Zweitstimmen Bund', 0, [renderBars(data.bund.second, undefined, undefined, ctx), turnoutLine(data.bund)],
      { caption: `Bundestagswahl ${data.bund.year}` }),
    renderTile(pollTitle('Bund'), 1, [renderSparkline(pollOf(data, 'DE'), ctx)]),
    renderTile(LEADS_TITLE, 2, [renderLeads(data, undefined, ctx)], { caption: LEADS_CAPTION_DE }),
    renderTile('Bundesländer', 3, [table], { wide: true, caption: `Bundestagswahl ${data.bund.year}, Zweitstimmen` }),
  ];
}

function landTiles(land: Land, data: AppData, onNavigate: Navigate, ctx: CardContext): HTMLElement[] {
  const bt = land.bundestag;
  const lt = land.landtag;
  const wkList = h('ul', 'wk-list');
  for (const wk of data.wahlkreise.filter((w) => w.landId === land.id).sort((a, b) => a.id - b.id)) {
    const li = h('li', 'wk-entry');
    const btn = h('button', 'wk-item');
    btn.type = 'button';
    btn.append(h('span', 'wk-nr', String(wk.id)), h('span', 'wk-name', wk.name));
    btn.addEventListener('click', () => onNavigate({ level: 'wk', landId: land.id, wkId: wk.id, details: true }));
    // Gewinner/in neben (nicht in) dem Wahlkreis-Knopf: Name und Partei oeffnen ihre Karten
    const winner = h('span', 'wk-winner');
    const party = h('span', 'wk-party');
    party.append('(', partyName(wk.winner.party, partyLabel(wk.winner.party, land.id), ctx), ')');
    winner.append(partyDot(wk.winner.party), personName(wk.winner.name, winnerPersonId(data, wk.winner), ctx), party);
    li.append(btn, winner);
    wkList.append(li);
  }
  return [
    renderTile(`Bundestagswahl ${bt.year}`, 0, [renderBars(bt.second, land.id, undefined, ctx), turnoutLine(bt)],
      { caption: `Zweitstimmen in ${land.name}` }),
    lt
      ? renderTile(`Landtagswahl ${lt.year}`, 1, [renderBars(lt.second, land.id, undefined, ctx), turnoutLine(lt)])
      : renderTile('Landtagswahl', 1, [h('p', 'empty', 'Keine Landtagswahl-Daten')]),
    renderTile(pollTitle(land.name), 2, [renderSparkline(pollOf(data, land.id), ctx)]),
    // Regierungschef/in (laender.json) steht in den Hauptkandidaten an erster Stelle
    renderTile(LEADS_TITLE, 3, [renderLeads(data, land.id, ctx)], { caption: LEADS_CAPTION_LAND }),
    renderTile('Wahlkreise', 4, [wkList.childElementCount ? wkList : h('p', 'empty', 'Keine Wahlkreise')],
      { wide: true, caption: 'Gewinner/in der Erststimmen je Wahlkreis' }),
  ];
}

/** votesBox nur fuer Gewinner/innen, die derzeit im Bundestag sitzen (sonst keine Abstimmungs-Kachel). */
function wkTiles(wk: Wahlkreis, land: Land, data: AppData, votesBox: HTMLElement | null, ctx: CardContext): HTMLElement[] {
  const { name, party, seated, directMandate } = wk.winner;
  const personId = winnerPersonId(data, wk.winner);
  const winner = h('div', 'winner');
  winner.append(renderPersonRow({ name, party, role: winnerRole(wk.winner), personId }, land.id, ctx));
  const turnout = h('p', 'big-number', fmtPct(wk.turnout));
  const compare = h('p', 'meta', `${land.name}: ${fmtPct(land.bundestag.turnout)} · Bund: ${fmtPct(data.bund.turnout)}`);
  const tiles = [
    renderTile(seated && directMandate ? 'Direktmandat' : 'Erststimmen-Gewinner/in', 0, [winner],
      { caption: `Bundestagswahl ${land.bundestag.year}` }),
    renderTile('Wahlbeteiligung', 1, [turnout, compare]),
    renderTile('Erst- und Zweitstimmen', 2, [renderStackedComparison(wk.first, wk.second, land.id, party, ctx)],
      { caption: 'Erststimmen: Direktkandidaten · Zweitstimmen: Parteien' }),
    renderTile(pollTitle(`Bundesland ${land.name}`), 3, [renderSparkline(pollOf(data, land.id), ctx)],
      { caption: 'Landesweite Umfragen, nicht für den Wahlkreis' }),
  ];
  if (votesBox) {
    tiles.push(renderTile('Abstimmungsverhalten', 4, [votesBox],
      { wide: true, caption: ['Namentliche Abstimmungen von ', personName(name, personId, ctx)] }));
  }
  return tiles;
}

/**
 * Fuellt das Dashboard fuer den Zustand. Das Promise erfuellt sich, sobald nachgeladene
 * Abstimmungen eingetragen sind (oder sofort, wenn es keine gibt).
 */
export async function renderDashboard(el: HTMLElement, state: NavState, data: AppData, onNavigate: Navigate): Promise<void> {
  const prev = memo.get(el);
  const token = (prev?.token ?? 0) + 1;
  const r = resolve(state, data);
  const key = resolvedKey(r);
  memo.set(el, { key, token });
  const isCurrent = () => memo.get(el)?.token === token;
  const ctx = cardContext(state, data, onNavigate);

  const kicker = r.level === 'wk' ? `Wahlkreis ${r.wk!.id} · ${r.land!.name}` : r.level === 'land' ? 'Bundesland' : 'Bund';
  const title = r.wk?.name ?? r.land?.name ?? 'Deutschland';
  const { head, heading } = header(kicker, title, state, onNavigate);
  let votes: Promise<Vote[]> | undefined;
  let tiles: HTMLElement[];
  if (r.level === 'wk') {
    const { mdbId, seated } = r.wk!.winner;
    let box: HTMLElement | null = null;
    if (seated) {
      box = h('div', 'dash-votes');
      if (mdbId === null) {
        box.append(h('p', 'empty', 'Keine Abstimmungen verfügbar'));
      } else {
        box.append(h('p', 'meta', 'Abstimmungen werden geladen …'));
        votes = loadVotes(mdbId).catch(() => [] as Vote[]);
      }
    }
    tiles = wkTiles(r.wk!, r.land!, data, box, ctx);
  } else {
    tiles = r.level === 'land' ? landTiles(r.land!, data, onNavigate, ctx) : deTiles(data, onNavigate, ctx);
  }

  const grid = h('div', 'dash-grid');
  grid.append(...tiles);
  const inner = h('div', 'dash-inner');
  inner.append(head, grid);
  el.replaceChildren(inner);
  el.setAttribute('aria-label', `Dashboard: ${title}`);
  if (prev && prev.key !== key) {
    el.scrollTop = 0;
    heading.focus({ preventScroll: true });
  }

  if (!votes) return;
  const list = await votes;
  // Ein spaeterer Render hat das Dashboard uebernommen: nichts mehr eintragen
  if (!isCurrent()) return;
  const box = el.querySelector<HTMLElement>('.dash-votes');
  if (box) fillVoteList(box, list);
}

/**
 * Schaltet das Layout zwischen grosser Karte und Dashboard um (Klasse `is-details` am Wurzelelement).
 * Beim Wechsel wandert der Fokus zur Dashboard-Ueberschrift bzw. zurueck zur Panel-Ueberschrift;
 * der jeweils verborgene Bereich wird inert (nicht fokussierbar).
 */
export function setDetailsMode(on: boolean, root: HTMLElement = document.body): void {
  const was = root.classList.contains('is-details');
  root.classList.toggle('is-details', on);
  const dash = root.querySelector<HTMLElement>('#dashboard');
  const panel = root.querySelector<HTMLElement>('#panel');
  dash?.toggleAttribute('inert', !on);
  panel?.toggleAttribute('inert', on);
  if (was === on) return;
  const target = on ? dash?.querySelector<HTMLElement>('.dash-title') : panel?.querySelector<HTMLElement>('.panel-title');
  target?.focus({ preventScroll: true });
}
