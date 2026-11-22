import type { AppData } from './data.ts';
import { loadVotes } from './data.ts';
import type { NavState } from './nav.ts';
import { resolve, resolvedKey } from './resolve.ts';
import type { AreaResult, Land, Vote, Wahlkreis } from './types.ts';
import { renderBars } from './ui/bars.ts';
import { h } from './ui/dom.ts';
import { fmtPct } from './ui/format.ts';
import { renderPersonRow, winnerRole } from './ui/people.ts';
import { pollTitle, renderSparkline } from './ui/sparkline.ts';
import { renderVoteRow, sortVotes } from './ui/votes.ts';

type Navigate = (s: NavState) => void;

const MAX_VOTES = 5;

/** Pro Panel-Element: zuletzt gezeigter Inhalt und Render-Zaehler (gegen veraltete Abstimmungs-Antworten). */
const memo = new WeakMap<HTMLElement, { key: string; token: number }>();

function section(title: string, ...children: (Node | string)[]): HTMLElement {
  const s = h('section', 'panel-section');
  s.append(h('h3', undefined, title), ...children);
  return s;
}

const turnoutLine = (r: AreaResult | Wahlkreis) => h('p', 'meta', `Wahlbeteiligung ${fmtPct(r.turnout)}`);

function header(kicker: string, title: string, state: NavState, onNavigate: Navigate) {
  const head = h('header', 'panel-head');
  const text = h('div', 'panel-titles');
  const heading = h('h2', 'panel-title', title);
  heading.tabIndex = -1;
  text.append(h('p', 'kicker', kicker), heading);
  const btn = h('button', 'btn-details', 'Details');
  btn.type = 'button';
  btn.dataset.action = 'details';
  btn.addEventListener('click', () => onNavigate({ ...state, details: true }));
  head.append(text, btn);
  return { head, heading };
}

function deContent(data: AppData): HTMLElement[] {
  return [
    section(`Bundestagswahl ${data.bund.year}`, h('p', 'meta', 'Zweitstimmen bundesweit'),
      renderBars(data.bund.second), turnoutLine(data.bund)),
    section(pollTitle('Bund'), renderSparkline(data.polls.find((p) => p.areaId === 'DE'))),
  ];
}

function landContent(land: Land, data: AppData): HTMLElement[] {
  const bt = land.bundestag;
  const lt = land.landtag;
  const people = h('div', 'people');
  for (const p of land.officials) people.append(renderPersonRow(p, land.id));
  return [
    section(`Bundestagswahl ${bt.year}`, h('p', 'meta', `Zweitstimmen in ${land.name}`),
      renderBars(bt.second, land.id), turnoutLine(bt)),
    lt
      ? section(`Landtagswahl ${lt.year}`, renderBars(lt.second, land.id), turnoutLine(lt))
      : section('Landtagswahl', h('p', 'empty', 'Keine Landtagswahl-Daten')),
    section('Spitzenpolitik', land.officials.length ? people : h('p', 'empty', 'Keine Angaben')),
    section(pollTitle(land.name), renderSparkline(data.polls.find((p) => p.areaId === land.id))),
  ];
}

function fillVotes(box: HTMLElement, votes: Vote[], state: NavState, onNavigate: Navigate) {
  const latest = sortVotes(votes).slice(0, MAX_VOTES);
  if (!latest.length) {
    box.replaceChildren(h('p', 'empty', 'Keine Abstimmungen verfügbar'));
    return;
  }
  const list = h('ul', 'vote-list');
  for (const v of latest) list.append(renderVoteRow(v));
  box.replaceChildren(list);
  if (votes.length > latest.length) {
    const all = h('button', 'btn-link', `Alle ${votes.length} im Dashboard ansehen`);
    all.type = 'button';
    all.addEventListener('click', () => onNavigate({ ...state, details: true }));
    box.append(all);
  }
}

function wkContent(wk: Wahlkreis, land: Land, data: AppData, state: NavState, onNavigate: Navigate,
  isCurrent: () => boolean): HTMLElement[] {
  const { name, party, mdbId, seated } = wk.winner;
  // Profil und Abstimmungen nur fuer Gewinner/innen, die derzeit im Bundestag sitzen
  const person = seated && mdbId !== null ? data.people.find((p) => p.id === mdbId) : undefined;
  const winner = h('div', 'winner');
  winner.append(renderPersonRow({ name, party, role: winnerRole(wk.winner), profileUrl: person?.profileUrl }, land.id));
  const out = [
    winner,
    section('Erststimmen', renderBars(wk.first, land.id, party)),
    section('Zweitstimmen', renderBars(wk.second, land.id), turnoutLine(wk)),
  ];
  if (seated && mdbId !== null) {
    const box = h('div', 'votes');
    box.append(h('p', 'meta', 'Abstimmungen werden geladen …'));
    out.push(section(`Letzte Abstimmungen von ${name}`, box));
    loadVotes(mdbId)
      .catch(() => [] as Vote[])
      .then((votes) => { if (isCurrent()) fillVotes(box, votes, state, onNavigate); });
  }
  out.push(section(pollTitle(`Bundesland ${land.name}`), renderSparkline(data.polls.find((p) => p.areaId === land.id))));
  return out;
}

export function renderPanel(el: HTMLElement, state: NavState, data: AppData, onNavigate: Navigate): void {
  const prev = memo.get(el);
  const token = (prev?.token ?? 0) + 1;
  const r = resolve(state, data);
  const key = resolvedKey(r);
  memo.set(el, { key, token });
  // Jeder Render baut neue Knoten; der Token verhindert zusaetzlich Arbeit fuer veraltete Antworten.
  const isCurrent = () => memo.get(el)?.token === token;

  const kicker = r.level === 'wk' ? `Wahlkreis ${r.wk!.id} · ${r.land!.name}` : r.level === 'land' ? 'Bundesland' : 'Bund';
  const title = r.wk?.name ?? r.land?.name ?? 'Deutschland';
  const { head, heading } = header(kicker, title, state, onNavigate);
  const body = r.level === 'wk' ? wkContent(r.wk!, r.land!, data, state, onNavigate, isCurrent)
    : r.level === 'land' ? landContent(r.land!, data)
      : deContent(data);

  const inner = h('div', 'panel-inner');
  if (!prev || prev.key !== key) inner.classList.add('panel-enter');
  inner.append(head, ...body);
  el.replaceChildren(inner);
  el.setAttribute('aria-label', `Informationen: ${title}`);
  if (prev && prev.key !== key) {
    el.scrollTop = 0; // neuer Inhalt beginnt oben
    heading.focus({ preventScroll: true });
  }
}

export function renderCrumbs(el: HTMLElement, state: NavState, data: AppData, onNavigate: Navigate): void {
  const r = resolve(state, data);
  // Brotkrumen behalten den Modus: im Dashboard fuehren sie zum Dashboard der hoeheren Ebene
  const details = state.details;
  const items: { label: string; title?: string; target?: NavState }[] = [
    { label: 'Deutschland', target: { level: 'de', details } },
  ];
  if (r.land) items.push({ label: r.land.name, target: { level: 'land', landId: r.land.id, details } });
  if (r.wk) items.push({ label: r.wk.name, title: `Wahlkreis ${r.wk.id}: ${r.wk.name}` });

  el.setAttribute('aria-label', 'Brotkrumen');
  const list = h('ol', 'crumbs');
  items.forEach((it, i) => {
    const li = h('li');
    if (i > 0) {
      const sep = h('span', 'sep', '›');
      sep.setAttribute('aria-hidden', 'true');
      li.append(sep);
    }
    if (i === items.length - 1) {
      const cur = h('span', 'crumb current', it.label);
      cur.setAttribute('aria-current', 'page');
      if (it.title) cur.title = it.title;
      li.append(cur);
    } else {
      const btn = h('button', 'crumb', it.label);
      btn.type = 'button';
      const target = it.target!;
      btn.addEventListener('click', () => onNavigate(target));
      li.append(btn);
    }
    list.append(li);
  });
  el.replaceChildren(list);
}
