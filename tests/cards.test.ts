import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '../src/data.ts';
import type { Card, NavState } from '../src/nav.ts';
import type { Vote } from '../src/types.ts';
import { FIXTURE_TOPICS, fixtureData, fixtureVotes } from './fixtures.ts';

const loadVotesMock = vi.fn<(id: number) => Promise<Vote[]>>();
vi.mock('../src/data.ts', () => ({ loadVotes: (id: number) => loadVotesMock(id) }));

const { renderCard } = await import('../src/cards.ts');

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const DE: NavState = { level: 'de', details: false };
const BY: NavState = { level: 'land', landId: 'BY', details: false };
const BW: NavState = { level: 'land', landId: 'BW', details: false };
const withCard = (s: NavState, card: Card): NavState => ({ ...s, card });
const party = (id: string): Card => ({ kind: 'party', id });
const person = (id: string): Card => ({ kind: 'person', id });

let root: HTMLElement;
let nav: ReturnType<typeof vi.fn<(s: NavState) => void>>;

function open(state: NavState, data: AppData = fixtureData) {
  renderCard(root, state, data, nav);
  return root.querySelector<HTMLElement>('[role="dialog"]')!;
}
const texts = (sel: string) => Array.from(root.querySelectorAll(sel), (e) => e.textContent);
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

beforeEach(() => {
  document.body.innerHTML = '<button id="trigger" data-card-trigger>Öffnen</button><div id="card-root"></div>';
  root = document.getElementById('card-root')!;
  nav = vi.fn<(s: NavState) => void>();
  loadVotesMock.mockReset();
  loadVotesMock.mockResolvedValue(fixtureVotes);
});
afterEach(() => vi.restoreAllMocks());

describe('party card', () => {
  it('renders a modal dialog labelled by its heading', () => {
    const dialog = open(withCard(DE, party('union')));
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const heading = root.querySelector('#' + dialog.getAttribute('aria-labelledby'))!;
    expect(heading.tagName).toBe('H2');
    expect(heading.textContent).toBe('CDU/CSU');
    expect(root.querySelector('.card-sub')!.textContent).toBe('Christlich Demokratische Union / Christlich-Soziale Union');
  });

  it('shows the 6 key points in order with topic, text and source as text', () => {
    open(withCard(DE, party('spd')));
    expect(texts('.kp .kp-topic')).toEqual(FIXTURE_TOPICS);
    expect(texts('.kp .kp-text')[0]).toBe('SPD Punkt 1 zu Wirtschaft & Steuern.');
    expect(texts('.kp .kp-source')).toEqual(FIXTURE_TOPICS.map((_, i) => `Quelle: SPD Programm 2025, S. ${10 + i}`));
    expect(root.querySelector('.card-note')!.textContent)
      .toBe('Kernpunkte aus dem Bundestagswahlprogramm 2025 (Bundesprogramm), eigene Zusammenfassung in kurzen Worten');
    expect(root.querySelector('.card-stand')!.textContent).toBe('Stand 20.11.2026');
    expect(root.querySelector('a, a[href]')).toBeNull();
  });

  it('lists founding year, program and chairs; empty chairs say "derzeit nicht belegt" instead of vanishing', () => {
    open(withCard(DE, party('union')));
    expect(texts('.card-facts dt')).toEqual(['Gegründet', 'Vorsitz', 'Wahlprogramm']);
    expect(texts('.card-facts dd')[0]).toBe('1945');
    expect(texts('.card-facts dd')[2]).toBe('Union Programm (2025)');
    expect(texts('.card-chairs li')).toEqual(['Erika VorsitzParteivorsitzende (CDU)', 'Max VorstandParteivorsitzender (CSU)']);
    expect(root.querySelector('.card-chairs-none')).toBeNull();

    open(withCard(DE, party('spd'))); // Fixture-Partei mit leerem `chairs`
    expect(texts('.card-facts dt')).toEqual(['Gegründet', 'Vorsitz', 'Wahlprogramm']);
    expect(texts('.card-facts dd')[1]).toBe('derzeit nicht belegt');
    expect(root.querySelector('.card-chairs')).toBeNull();
  });

  it('marks key points that are not covered by the program', () => {
    open(withCard(DE, party('afd')));
    const items = root.querySelectorAll('.kp');
    expect(items).toHaveLength(6);
    const marked = Array.from(items).map((li) => li.classList.contains('kp-not-covered'));
    expect(marked).toEqual([false, false, false, true, false, false]);
    expect(items[3].querySelector('.kp-flag')!.textContent).toBe('Kein Schwerpunkt im Programm');
    expect(root.querySelectorAll('.kp-flag')).toHaveLength(1);
  });

  it('shows the federal result at level de', () => {
    open(withCard(DE, party('spd')));
    const res = root.querySelector('.card-results')!;
    expect(res.querySelector('h3')!.textContent).toBe('Ergebnis bundesweit');
    expect(Array.from(res.querySelectorAll('.card-stat'), (s) => s.textContent)).toEqual(['16,4 %Bundestagswahl 2025']);
  });

  it('shows the Land result (Bundestag and Landtag if present, – if not listed) at level land and wk', () => {
    open(withCard(BW, party('spd')));
    let res = root.querySelector('.card-results')!;
    expect(res.querySelector('h3')!.textContent).toBe('Ergebnis in Baden-Württemberg');
    expect(Array.from(res.querySelectorAll('.card-stat'), (s) => s.textContent))
      .toEqual(['14,2 %Bundestagswahl 2025', '–Landtagswahl 2021']);

    // Bayern: keine Landtagsdaten, Union heisst dort CSU
    open(withCard({ level: 'wk', landId: 'BY', wkId: 220, details: false }, party('union')));
    res = root.querySelector('.card-results')!;
    expect(res.querySelector('h3')!.textContent).toBe('Ergebnis in Bayern');
    expect(Array.from(res.querySelectorAll('.card-stat'), (s) => s.textContent)).toEqual(['30,1 %Bundestagswahl 2025']);
    expect(root.querySelector('.card-title')!.textContent).toBe('CSU');
  });

  it('colours the accent bar in the party colour (Union with a light edge)', () => {
    open(withCard(DE, party('union')));
    const accent = root.querySelector<HTMLElement>('.card-accent')!;
    expect(accent.style.backgroundColor).toBe('rgb(28, 29, 33)');
    expect(accent.style.boxShadow).toContain('inset');
  });
});

describe('person card', () => {
  it('member of the Bundestag: role, Wahlkreis, Land and the vote list without links', async () => {
    open(withCard(DE, person('1003')));
    expect(root.querySelector('.card-title')!.textContent).toBe('Clara Probe');
    expect(root.querySelector('.avatar')!.textContent).toBe('CP');
    expect(texts('.card-roles li')).toEqual(['Mitglied des Bundestages', 'Wahlkreis 221 · München-Ost']);
    expect(root.querySelector('.card-sub')!.textContent).toBe('SPD · Bayern');
    expect(root.querySelector('.card-votes')!.textContent).toContain('werden geladen');
    expect(loadVotesMock).toHaveBeenCalledWith(1003);
    await flush();
    expect(root.querySelectorAll('.card-votes li.vote')).toHaveLength(6);
    expect(texts('.card-votes .vote-title')[0]).toBe('Abstimmung 6'); // neueste zuerst
    expect(root.querySelector('.vote-filter')).not.toBeNull();
    expect(root.querySelector('a, a[href]')).toBeNull();
  });

  it('empty or failing vote loads show the empty state', async () => {
    loadVotesMock.mockResolvedValueOnce([]);
    open(withCard(DE, person('1003')));
    await flush();
    expect(root.querySelector('.card-votes')!.textContent).toBe('Keine Abstimmungen verfügbar');

    loadVotesMock.mockRejectedValueOnce(new Error('offline'));
    open(withCard(DE, person('1004')));
    await flush();
    expect(root.querySelector('.card-votes')!.textContent).toBe('Keine Abstimmungen verfügbar');
  });

  it('the party is a button that switches to the party card (only parties with a profile)', () => {
    const state = withCard(BY, person('1003'));
    open(state);
    const btn = root.querySelector<HTMLButtonElement>('.card-sub button.card-party')!;
    expect(btn.textContent).toBe('SPD');
    expect(btn.hasAttribute('data-card-trigger')).toBe(true);
    btn.click();
    expect(nav).toHaveBeenCalledWith({ ...BY, card: { kind: 'party', id: 'spd' } });

    open(withCard(DE, person('1002'))); // Grüne: kein Profil in den Fixtures
    expect(root.querySelector('.card-sub button')).toBeNull();
    expect(root.querySelector('.card-sub .card-party')!.textContent).toBe('Grüne');
  });

  it('candidate without a person id: role, list, source as text, no votes', () => {
    open(withCard(BY, person('c-grete-strasse')));
    expect(root.querySelector('.card-title')!.textContent).toBe('Grete Straße');
    expect(texts('.card-roles li')).toEqual(['Spitzenkandidatin Landtagswahl 2023']);
    expect(root.querySelector('.card-sub')!.textContent).toBe('AfD · Bayern');
    expect(root.querySelector('.card-source')!.textContent).toBe('Quelle: Landeswahlleiter Bayern 2023');
    expect(root.querySelector('.card-votes')).toBeNull();
    expect(loadVotesMock).not.toHaveBeenCalled();

    // Bundesliste mit Hinweis; in Bayern die Landesliste derselben Person
    open(withCard(DE, person('c-joerg-ueberall')));
    expect(texts('.card-roles li')).toEqual(['Kanzlerkandidat Bundestagswahl 2025']);
    expect(root.querySelector('.card-sub')!.textContent).toBe('SPD · Bund');
    expect(root.querySelector('.card-funktion .card-meta')!.textContent).toBe('Bundesliste');
    open(withCard(BY, person('c-joerg-ueberall')));
    expect(texts('.card-roles li')).toEqual(['Spitzenkandidat Landtagswahl 2023']);
  });

  it('MdB who is also a Hauptkandidat/in: MdB roles and votes plus candidate role, note and source', async () => {
    // Erika Vorsitz steht in der Bundesliste der Fixtures; hier zusaetzlich als MdB in people.json
    const data: AppData = {
      ...fixtureData,
      people: [...fixtureData.people, { id: 1005, name: 'Erika Vorsitz', party: 'union', role: 'Abgeordnete/r', profileUrl: '' }],
      kandidaten: {
        ...fixtureData.kandidaten,
        bund: fixtureData.kandidaten.bund.map((c) => (c.name === 'Erika Vorsitz' ? { ...c, note: 'Teil einer Doppelspitze' } : c)),
      },
    };
    open(withCard(DE, person('1005')), data);
    expect(texts('.card-roles li')).toEqual(['Mitglied des Bundestages', 'Kanzlerkandidatin Bundestagswahl 2025']);
    expect(root.querySelector('.card-funktion .card-meta')!.textContent).toBe('Teil einer Doppelspitze');
    expect(root.querySelector('.card-source')!.textContent).toBe('Quelle: Union, Beschluss 2024');
    expect(root.querySelector('.card-votes-section h3')!.textContent).toBe('Abstimmungsverhalten');
    expect(loadVotesMock).toHaveBeenCalledWith(1005);
    await flush();
    expect(root.querySelector('a, a[href]')).toBeNull();

    // Landesliste: Land in Klammern, wenn die Karte keinen Bezug zu diesem Land hat
    const land: AppData = {
      ...fixtureData,
      people: [...fixtureData.people, { id: 1006, name: 'Grete Straße', party: 'afd', role: 'Abgeordnete/r', profileUrl: '' }],
    };
    open(withCard(DE, person('1006')), land);
    expect(texts('.card-roles li')).toEqual(['Mitglied des Bundestages', 'Spitzenkandidatin Landtagswahl 2023 (Bayern)']);
    expect(root.querySelector('.card-source')!.textContent).toBe('Quelle: Landeswahlleiter Bayern 2023');

    // gleicher Name, andere Partei: kein Kandidatenbezug
    const other: AppData = {
      ...fixtureData,
      people: [...fixtureData.people, { id: 1007, name: 'Grete Straße', party: 'spd', role: 'Abgeordnete/r', profileUrl: '' }],
    };
    open(withCard(DE, person('1007')), other);
    expect(texts('.card-roles li')).toEqual(['Mitglied des Bundestages']);
    expect(root.querySelector('.card-source')).toBeNull();
  });

  it('officials from laender.json: their office, no votes; MdB with an office shows both', () => {
    const data: AppData = {
      ...fixtureData,
      laender: fixtureData.laender.map((l) => (l.id === 'BW'
        ? { ...l, officials: [{ id: 2001, name: 'Eva Amt', party: 'gruene', role: 'Ministerpräsidentin', profileUrl: '' }] } : l)),
    };
    open(withCard(DE, person('2001')), data);
    expect(texts('.card-roles li')).toEqual(['Ministerpräsidentin']);
    expect(root.querySelector('.card-sub')!.textContent).toBe('Grüne · Baden-Württemberg');
    expect(root.querySelector('.card-votes')).toBeNull();
    expect(loadVotesMock).not.toHaveBeenCalled();

    open(withCard(DE, person('1001'))); // in people.json und Amtstraegerin in Bayern
    expect(texts('.card-roles li')).toEqual(['Mitglied des Bundestages', 'Ministerpräsidentin']);
    expect(root.querySelector('.card-sub')!.textContent).toBe('Union · Bayern');
  });

  it('a stale vote response does not write into a newer card', async () => {
    let resolveFirst!: (v: Vote[]) => void;
    const mine = (title: string): Vote[] => fixtureVotes.map((v) => ({ ...v, title: `${title} ${v.pollId}` }));
    loadVotesMock.mockImplementation((id) => (id === 1002
      ? new Promise<Vote[]>((r) => { resolveFirst = r; })
      : Promise.resolve(mine('Probe'))));
    open(withCard(DE, person('1002')));
    open(withCard(DE, person('1003')));
    await flush();
    expect(texts('.card-votes .vote-title')[0]).toBe('Probe 6');
    resolveFirst(mine('Muster'));
    await flush();
    expect(root.querySelector('.card-title')!.textContent).toBe('Clara Probe');
    expect(texts('.card-votes .vote-title').every((t) => t!.startsWith('Probe'))).toBe(true);
    expect(root.textContent).not.toContain('Muster');
  });
});

describe('closing, keyboard and focus', () => {
  it('the close button, Escape and the backdrop navigate to the same state without card', () => {
    const state = withCard({ level: 'wk', landId: 'BY', wkId: 220, details: true }, party('union'));
    const expected = { level: 'wk', landId: 'BY', wkId: 220, details: true, card: undefined };
    open(state);
    const close = root.querySelector<HTMLButtonElement>('[data-action="close-card"]')!;
    expect(close.textContent).toBe('Schließen');
    close.click();
    expect(nav).toHaveBeenLastCalledWith(expected);

    key(root.querySelector('.card-title')!, 'Escape');
    expect(nav).toHaveBeenCalledTimes(2);
    expect(nav).toHaveBeenLastCalledWith(expected);

    (root.querySelector('.card-backdrop') as HTMLElement).click();
    expect(nav).toHaveBeenCalledTimes(3);
    expect(nav).toHaveBeenLastCalledWith(expected);

    // Klick in die Karte selbst schliesst nicht
    (root.querySelector('.card-body') as HTMLElement).click();
    expect(nav).toHaveBeenCalledTimes(3);
  });

  it('clears the root when no card is open and ignores unknown targets', () => {
    open(withCard(DE, party('spd')));
    renderCard(root, DE, fixtureData, nav);
    expect(root.childElementCount).toBe(0);
    renderCard(root, withCard(DE, party('fdp')), fixtureData, nav);
    expect(root.childElementCount).toBe(0);
    renderCard(root, withCard(DE, person('c-niemand')), fixtureData, nav);
    expect(root.childElementCount).toBe(0);
  });

  it('moves focus to the heading and back to the trigger on close; card switches keep the trigger', () => {
    const trigger = document.getElementById('trigger')!;
    trigger.focus();
    open(withCard(DE, person('1003')));
    expect(document.activeElement).toBe(root.querySelector('.card-title'));
    // Wechsel zur Parteikarte (Ausloeser in der Karte wird nicht gemerkt)
    root.querySelector<HTMLButtonElement>('.card-party')!.focus();
    open(withCard(DE, party('spd')));
    expect(document.activeElement).toBe(root.querySelector('.card-title'));
    expect(root.querySelector('.card-title')!.textContent).toBe('SPD');
    // Schliessen (z. B. ueber Browser-Zurueck): Fokus zurueck
    renderCard(root, DE, fixtureData, nav);
    expect(document.activeElement).toBe(trigger);
  });

  it('does not restore focus to elements that are not card triggers or are gone', () => {
    const other = document.createElement('button');
    document.body.prepend(other);
    other.focus();
    open(withCard(DE, party('spd')));
    renderCard(root, DE, fixtureData, nav);
    expect(document.activeElement).not.toBe(other);

    const trigger = document.getElementById('trigger')!;
    trigger.focus();
    open(withCard(DE, party('spd')));
    trigger.remove();
    expect(() => renderCard(root, DE, fixtureData, nav)).not.toThrow();
  });

  it('traps Tab inside the card', () => {
    open(withCard(DE, person('1003')));
    const dialog = root.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = root.querySelector<HTMLButtonElement>('[data-action="close-card"]')!;
    const partyBtn = root.querySelector<HTMLButtonElement>('.card-party')!;
    // ohne Abstimmungen geladen: Parteiknopf und Schliessen sind die fokussierbaren Elemente
    const items = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
    expect(items).toEqual([partyBtn, close]);
    const last = items[items.length - 1];
    last.focus();
    expect(key(last, 'Tab')).toBe(false); // preventDefault
    expect(document.activeElement).toBe(items[0]);
    items[0].focus();
    expect(key(items[0], 'Tab', { shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(last);
    root.querySelector<HTMLElement>('.card-title')!.focus();
    key(root.querySelector('.card-title')!, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
    // nicht am Rand: Browser uebernimmt (kein preventDefault)
    items[0].focus();
    expect(key(items[0], 'Tab')).toBe(true);
  });

  it('animates only when opening, not when switching cards', () => {
    open(withCard(DE, party('spd')));
    expect(root.querySelector('.card-overlay')!.classList.contains('card-enter')).toBe(true);
    open(withCard(DE, party('union')));
    expect(root.querySelector('.card-overlay')!.classList.contains('card-enter')).toBe(false);
  });

  it('renders data as text, never as HTML', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const data: AppData = {
      ...fixtureData,
      parteien: fixtureData.parteien.map((p) => (p.id === 'spd'
        ? { ...p, name: evil, keyPoints: p.keyPoints.map((k) => ({ ...k, text: evil, source: evil })) } : p)),
    };
    open(withCard(DE, party('spd')), data);
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.card-title')!.textContent).toBe(evil);
  });
});
