import type { NavState } from '../nav.ts';
import type { PartyId } from '../types.ts';
import { h } from './dom.ts';

type Navigate = (s: NavState) => void;

export interface ClickableOptions {
  /** zusaetzliche Klassen (neben `link-btn`) */
  className?: string;
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
