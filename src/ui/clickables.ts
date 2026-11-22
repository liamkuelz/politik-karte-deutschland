import type { AppData } from '../data.ts';
import type { NavState } from '../nav.ts';
import type { PartyId } from '../types.ts';
import { h } from './dom.ts';

type Navigate = (s: NavState) => void;

export interface ClickableOptions {
  /** zusaetzliche Klassen (neben `link-btn`) */
  className?: string;
}

/**
 * Was Ansichten brauchen, um Parteien und Personen als Karten-Knoepfe zu zeichnen: der aktuelle Zustand
 * (die Karte oeffnet sich darueber), der Navigations-Callback und die Parteien, die ein Profil haben
 * (nur sie oeffnen eine Karte; z. B. „Sonstige“ bleibt Text, statt eines Knopfs ohne Ziel).
 */
export interface CardContext {
  state: NavState;
  onNavigate: Navigate;
  profiles: ReadonlySet<string>;
}

export function cardContext(state: NavState, data: Pick<AppData, 'parteien'>, onNavigate: Navigate): CardContext {
  return { state, onNavigate, profiles: new Set((data.parteien ?? []).map((p) => p.id)) };
}

/**
 * Gemeinsamer Knopf, der eine Karte oeffnet. `data-card-trigger` markiert ihn als Ausloeser: die Karte
 * merkt sich das fokussierte Element und gibt den Fokus beim Schliessen dorthin zurueck.
 */
function cardButton(label: string, opts: ClickableOptions | undefined, onClick: () => void): HTMLButtonElement {
  const btn = h('button', opts?.className ? `link-btn ${opts.className}` : 'link-btn', label);
  btn.type = 'button';
  btn.dataset.cardTrigger = '';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // z. B. in klickbaren Tabellenzeilen: nur die Karte oeffnen
    onClick();
  });
  return btn;
}

/** Parteiname als Knopf: oeffnet die Parteikarte ueber der aktuellen Ansicht. */
export function partyButton(party: PartyId, label: string, state: NavState, onNavigate: Navigate,
  opts?: ClickableOptions): HTMLButtonElement {
  const btn = cardButton(label, opts, () => onNavigate({ ...state, card: { kind: 'party', id: party } }));
  btn.dataset.party = party;
  return btn;
}

/** Personenname als Knopf: `personId` ist eine Ziffern-id oder ein Kandidatenschluessel (`c-...`). */
export function personButton(label: string, personId: string, state: NavState, onNavigate: Navigate,
  opts?: ClickableOptions): HTMLButtonElement {
  const btn = cardButton(label, opts, () => onNavigate({ ...state, card: { kind: 'person', id: personId } }));
  btn.dataset.person = personId;
  return btn;
}

/**
 * Parteiname: Knopf zur Parteikarte, wenn ein Kontext da ist und die Partei ein Profil hat, sonst Text
 * (`span` mit derselben Klasse).
 */
export function partyName(party: PartyId, label: string, ctx: CardContext | undefined, cls?: string): HTMLElement {
  if (!ctx || !ctx.profiles.has(party)) return h('span', cls, label);
  return partyButton(party, label, ctx.state, ctx.onNavigate, { className: cls });
}

/** Personenname: Knopf zur Personenkarte, wenn Kontext und id da sind, sonst Text. */
export function personName(label: string, personId: string | undefined, ctx: CardContext | undefined, cls?: string): HTMLElement {
  if (!ctx || !personId) return h('span', cls, label);
  return personButton(label, personId, ctx.state, ctx.onNavigate, { className: cls });
}
