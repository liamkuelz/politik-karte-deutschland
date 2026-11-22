import { findCandidate, findParty, findPerson } from './content.ts';
import type { PartyProfile } from './content-types.ts';
import type { AppData } from './data.ts';
import { loadVotes } from './data.ts';
import type { NavState } from './nav.ts';
import { applyPartyEdge, partyColor, partyLabel } from './parties.ts';
import { resolve } from './resolve.ts';
import type { AreaResult, PartyId, Vote } from './types.ts';
import { partyButton } from './ui/clickables.ts';
import { h } from './ui/dom.ts';
import { fmtDate, fmtPct } from './ui/format.ts';
import { renderAvatar } from './ui/people.ts';
import { fillVoteList } from './ui/tiles.ts';

/*
 * Karten (Overlay) fuer Parteien und Personen.
 * - Geoeffnet ueber `NavState.card`; Schliessen (Knopf, Escape, Klick auf den Hintergrund) navigiert zum
 *   selben Zustand ohne Karte. Browser-Zurueck schliesst sie, weil sich der Hash aendert.
 * - Fokus: beim Oeffnen auf die Ueberschrift; das ausloesende Element (`data-card-trigger`, das beim
 *   Oeffnen fokussiert war) bekommt ihn beim Schliessen zurueck, wenn es noch im Dokument steht.
 * - Alle Texte ueber h()/textContent, keine Links.
 */

type Navigate = (s: NavState) => void;

interface CardMemo {
  token: number;
  open: boolean;
  trigger: HTMLElement | null;
}

/** Pro Wurzelelement: Render-Zaehler (gegen veraltete Abstimmungs-Antworten), offen?, Ausloeser. */
const memo = new WeakMap<HTMLElement, CardMemo>();

const TITLE_ID = 'card-title';
const NOTE = 'Kernpunkte aus dem Bundestagswahlprogramm 2025 (Bundesprogramm), eigene Zusammenfassung in kurzen Worten';
const FOCUSABLE = 'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function section(title: string, cls: string, ...children: (Node | string)[]): HTMLElement {
  const s = h('section', `card-section ${cls}`);
  s.append(h('h3', 'card-section-title', title), ...children);
  return s;
}

interface CardParts {
  party: PartyId;
  kicker: string;
  title: string;
  /** Zeile(n) unter der Ueberschrift */
  sub: (Node | string)[];
  /** Avatar o. Ae. links neben der Ueberschrift */
  lead?: HTMLElement;
  body: HTMLElement[];
}

/* ---------- Parteikarte ---------- */

function shareOf(r: AreaResult, party: PartyId): string {
  return fmtPct(r.second.find((x) => x.party === party)?.share);
}

function stat(value: string, label: string): HTMLElement {
  const box = h('div', 'card-stat');
  box.append(h('span', 'card-stat-value', value), h('span', 'card-stat-label', label));
  return box;
}

function resultSection(p: PartyProfile, state: NavState, data: AppData): HTMLElement {
  const r = resolve(state, data);
  const stats = h('div', 'card-stats');
  if (r.land) {
    const { bundestag: bt, landtag: lt } = r.land;
    stats.append(stat(shareOf(bt, p.id), `Bundestagswahl ${bt.year}`));
    if (lt) stats.append(stat(shareOf(lt, p.id), `Landtagswahl ${lt.year}`));
    return section(`Ergebnis in ${r.land.name}`, 'card-results', stats, h('p', 'card-meta', 'Zweitstimmen'));
  }
  stats.append(stat(shareOf(data.bund, p.id), `Bundestagswahl ${data.bund.year}`));
  return section('Ergebnis bundesweit', 'card-results', stats, h('p', 'card-meta', 'Zweitstimmen'));
}

function partyParts(p: PartyProfile, state: NavState, data: AppData): CardParts {
  const landId = resolve(state, data).land?.id;
  // In Bayern tritt die Union als CSU an
  const title = p.id === 'union' && landId === 'BY' ? partyLabel(p.id, landId) : p.name;

  const facts = h('dl', 'card-facts');
  const fact = (label: string, value: Node | string) => {
    const dd = h('dd');
    dd.append(value);
    facts.append(h('dt', undefined, label), dd);
  };
  fact('Gegründet', String(p.founded));
  if (p.chairs.length) {
    const list = h('ul', 'card-chairs');
    for (const c of p.chairs) {
      const li = h('li');
      li.append(h('span', 'card-chair-name', c.name), h('span', 'card-chair-role', c.role));
      list.append(li);
    }
    fact('Vorsitz', list);
  }
  fact('Wahlprogramm', `${p.program.title} (${p.program.year})`);

  const points = h('ol', 'kp-list');
  for (const k of p.keyPoints) {
    const li = h('li', k.notCovered ? 'kp kp-not-covered' : 'kp');
    li.append(h('span', 'kp-topic', k.topic));
    if (k.notCovered) li.append(h('span', 'kp-flag', 'Kein Schwerpunkt im Programm'));
    li.append(h('p', 'kp-text', k.text), h('p', 'kp-source', `Quelle: ${k.source}`));
    points.append(li);
  }

  return {
    party: p.id,
    kicker: 'Partei',
    title,
    sub: p.longName && p.longName !== title ? [p.longName] : [],
    body: [
      facts,
      resultSection(p, state, data),
      section('Kernpunkte', 'card-points', h('p', 'card-note', NOTE), points),
      h('p', 'card-stand', `Stand ${fmtDate(p.stand)}`),
    ],
  };
}

/* ---------- Personenkarte ---------- */

interface PersonInfo {
  name: string;
  party: PartyId;
  roles: string[];
  landName?: string;
  note?: string;
  source?: string;
  /** Abstimmungen nur fuer Mitglieder des Bundestages (id aus people.json) */
  mdbId?: number;
}

function personInfo(id: string, state: NavState, data: AppData): PersonInfo | undefined {
  if (id.startsWith('c-')) {
    const found = findCandidate(data, id, state.landId);
    if (!found) return undefined;
    const { candidate: c, landId } = found;
    const land = landId ? data.laender.find((l) => l.id === landId) : undefined;
    return {
      name: c.name, party: c.party, roles: [c.role],
      landName: landId ? (land?.name ?? landId) : 'Bund',
      note: c.note, source: c.source,
    };
  }
  const found = findPerson(data, id);
  if (!found) return undefined;
  const { person, mdb, wk, offices, land } = found;
  const roles: string[] = [];
  if (mdb) roles.push('Mitglied des Bundestages');
  if (mdb && wk) roles.push(`Wahlkreis ${wk.id} · ${wk.name}`);
  for (const o of offices) roles.push(offices.length > 1 || o.land !== land ? `${o.role} (${o.land.name})` : o.role);
  if (!roles.length && person.role) roles.push(person.role);
  return { name: person.name, party: person.party, roles, landName: land?.name, mdbId: mdb ? person.id : undefined };
}

function personParts(info: PersonInfo, state: NavState, data: AppData, onNavigate: Navigate): CardParts {
  const landId = resolve(state, data).land?.id;
  const label = partyLabel(info.party, landId);
  // Nur Parteien mit Profil oeffnen eine Parteikarte
  const party = findParty(data, info.party)
    ? partyButton(info.party, label, state, onNavigate, { className: 'card-party' })
    : h('span', 'card-party', label);
  const sub: (Node | string)[] = [party];
  if (info.landName) sub.push(h('span', 'card-sub-sep', ' · '), info.landName);

  const roles = h('ul', 'card-roles');
  for (const r of info.roles) roles.append(h('li', undefined, r));
  const body: HTMLElement[] = [section('Funktion', 'card-funktion', roles)];
  if (info.note) body[0].append(h('p', 'card-meta', info.note));
  if (info.source) body.push(h('p', 'card-source', `Quelle: ${info.source}`));
  if (info.mdbId !== undefined) {
    const box = h('div', 'card-votes');
    box.append(h('p', 'card-meta', 'Abstimmungen werden geladen …'));
    body.push(section('Abstimmungsverhalten', 'card-votes-section', box,
      h('p', 'card-meta', 'Namentliche Abstimmungen im Bundestag')));
  }
  const lead = renderAvatar(info.name, info.party);
  lead.classList.add('card-avatar');
  return { party: info.party, kicker: 'Person', title: info.name, sub, lead, body };
}

/* ---------- Rahmen, Fokus, Tastatur ---------- */

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((e) => !e.hasAttribute('disabled') && !e.closest('[hidden]'));
}

function buildDialog(parts: CardParts, close: () => void, animate: boolean) {
  const overlay = h('div', animate ? 'card-overlay card-enter' : 'card-overlay');
  const backdrop = h('div', 'card-backdrop');
  backdrop.dataset.action = 'close-backdrop';
  backdrop.addEventListener('click', close);

  const dialog = h('section', 'card glass');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', TITLE_ID);
  dialog.tabIndex = -1; // Klicks auf Text halten den Fokus in der Karte (Escape, Tab)
  dialog.style.setProperty('--card-accent', partyColor(parts.party));

  const accent = h('div', 'card-accent');
  accent.setAttribute('aria-hidden', 'true');
  accent.style.backgroundColor = partyColor(parts.party);
  applyPartyEdge(accent, parts.party);

  const head = h('header', 'card-head');
  const titles = h('div', 'card-titles');
  const heading = h('h2', 'card-title', parts.title);
  heading.id = TITLE_ID;
  heading.tabIndex = -1;
  titles.append(h('p', 'kicker', parts.kicker), heading);
  if (parts.sub.length) {
    const sub = h('p', 'card-sub');
    sub.append(...parts.sub);
    titles.append(sub);
  }
  const closeBtn = h('button', 'btn-details card-close', 'Schließen');
  closeBtn.type = 'button';
  closeBtn.dataset.action = 'close-card';
  closeBtn.addEventListener('click', close);
  if (parts.lead) head.append(parts.lead);
  head.append(titles, closeBtn);

  const body = h('div', 'card-body');
  body.append(...parts.body);
  dialog.append(accent, head, body);
  overlay.append(backdrop, dialog);

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    // Einfache Fokusfalle: Tab kreist innerhalb der Karte
    const items = focusables(dialog);
    const active = document.activeElement;
    const inside = active instanceof Node && dialog.contains(active);
    if (!items.length) {
      e.preventDefault();
      heading.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey) {
      if (!inside || active === first || active === dialog || active === heading) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  });
  return { overlay, heading };
}

/**
 * Zeichnet die Karte zu `state.card` in `el` bzw. leert `el`, wenn keine Karte offen ist.
 * Unbekannte Ziele (sollte validateState verhindern) zeigen keine Karte.
 */
export function renderCard(el: HTMLElement, state: NavState, data: AppData, onNavigate: Navigate): void {
  const prev = memo.get(el) ?? { token: 0, open: false, trigger: null };
  const token = prev.token + 1;
  const card = state.card;

  let parts: CardParts | undefined;
  let info: PersonInfo | undefined;
  if (card?.kind === 'party') {
    const p = findParty(data, card.id);
    if (p) parts = partyParts(p, state, data);
  } else if (card?.kind === 'person') {
    info = personInfo(card.id, state, data);
    if (info) parts = personParts(info, state, data, onNavigate);
  }

  if (!parts) {
    memo.set(el, { token, open: false, trigger: null });
    el.replaceChildren();
    // Fokus zurueck zum Ausloeser (auch beim Schliessen ueber Browser-Zurueck)
    if (prev.open && prev.trigger?.isConnected) prev.trigger.focus({ preventScroll: true });
    return;
  }

  // Ausloeser nur beim Oeffnen merken; beim Wechsel Karte -> Karte bleibt der urspruengliche
  let trigger = prev.trigger;
  if (!prev.open) {
    const active = document.activeElement;
    trigger = active instanceof HTMLElement && !el.contains(active)
      ? active.closest<HTMLElement>('[data-card-trigger]')
      : null;
  }
  memo.set(el, { token, open: true, trigger });
  const isCurrent = () => memo.get(el)?.token === token;

  const close = () => onNavigate({ ...state, card: undefined });
  const { overlay, heading } = buildDialog(parts, close, !prev.open);
  el.replaceChildren(overlay);
  heading.focus({ preventScroll: true });

  if (info?.mdbId !== undefined) {
    loadVotes(info.mdbId)
      .catch(() => [] as Vote[])
      .then((votes) => {
        // Eine neuere Karte hat uebernommen: nichts mehr eintragen
        if (!isCurrent()) return;
        const box = el.querySelector<HTMLElement>('.card-votes');
        if (box) fillVoteList(box, votes, { links: false });
      });
  }
}
