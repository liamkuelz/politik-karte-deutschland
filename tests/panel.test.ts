import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '../src/data.ts';
import { loadVotes } from '../src/data.ts';
import type { NavState } from '../src/nav.ts';
import { renderCrumbs, renderPanel } from '../src/panel.ts';
import { partyColor } from '../src/parties.ts';
import type { Vote, Wahlkreis } from '../src/types.ts';
import { initials } from '../src/ui/people.ts';
import { fixtureData, fixtureVotes } from './fixtures.ts';

vi.mock('../src/data.ts', () => ({ loadVotes: vi.fn() }));
const loadVotesMock = vi.mocked(loadVotes);

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function makePanel(): HTMLElement {
  const el = document.createElement('aside');
  el.id = 'panel';
  document.body.appendChild(el);
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const land = (landId: string): NavState => ({ level: 'land', landId, details: false });
const wk = (landId: string, wkId: number): NavState => ({ level: 'wk', landId, wkId, details: false });

/** Fixture mit zusaetzlichen Wahlkreisen fuer Sonderfaelle (ohne Geometrie, fuer das Panel reicht das). */
function withWks(...extra: Wahlkreis[]): AppData {
  return { ...fixtureData, wahlkreise: [...fixtureData.wahlkreise, ...extra] };
}
const baseWk: Wahlkreis = {
  id: 230, name: 'Sonderfall', landId: 'BY', turnout: 37.2,
  first: [{ party: 'sonstige', share: 40.0 }, { party: 'union', share: 30.0 }],
  second: [{ party: 'union', share: 35.0 }, { party: 'sonstige', share: 20.0 }],
  winner: { name: 'Erika Parteilos', party: 'sonstige', mdbId: null, directMandate: true, seated: true },
};
/** Erststimmen gewonnen, aber kein Sitz (Zweitstimmendeckung); mdbId zeigt auf eine Kandidatur */
const unseatedWk: Wahlkreis = {
  ...baseWk, id: 232, name: 'Ohne Mandat',
  winner: { name: 'Gustav Ohnesitz', party: 'union', mdbId: 8888, directMandate: false, seated: false },
};
const NO_SEAT = 'Erststimmen-Gewinner/in – kein Bundestagsmandat (Zweitstimmendeckung)';

beforeEach(() => {
  stubReducedMotion(true);
  loadVotesMock.mockReset();
  loadVotesMock.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('renderPanel: Land', () => {
  it('shows CSU (not Union) in Bayern and the Bundestagswahl caption', () => {
    const el = makePanel();
    renderPanel(el, land('BY'), fixtureData, () => {});
    expect(el.textContent).toContain('Bayern');
    expect(el.textContent).toContain('CSU');
    expect(el.textContent).not.toContain('Union');
    expect(el.textContent).toContain('Bundestagswahl 2025');
  });

  it('shows "Keine Landtagswahl-Daten" without landtag and the Landtag year otherwise', () => {
    const el = makePanel();
    renderPanel(el, land('BY'), fixtureData, () => {});
    expect(el.textContent).toContain('Keine Landtagswahl-Daten');
    renderPanel(el, land('BW'), fixtureData, () => {});
    expect(el.textContent).toContain('Landtagswahl 2021');
    expect(el.textContent).not.toContain('Keine Landtagswahl-Daten');
  });

  it('shows "Keine Umfragen verfügbar" for a Land without poll series', () => {
    const el = makePanel();
    renderPanel(el, land('BW'), fixtureData, () => {});
    expect(el.textContent).toContain('Umfrage Baden-Württemberg (Durchschnitt der Institute)');
    expect(el.textContent).toContain('Keine Umfragen verfügbar');
  });

  it('lists officials with initials in party colour and role', () => {
    const el = makePanel();
    renderPanel(el, land('BY'), fixtureData, () => {});
    const row = el.querySelector('.person')!;
    expect(row.textContent).toContain('Anna Beispiel');
    expect(row.textContent).toContain('Ministerpräsidentin');
    const avatar = row.querySelector('.avatar') as HTMLElement;
    expect(avatar.textContent).toBe('AB');
    expect(avatar.style.backgroundColor).toBe('rgb(28, 29, 33)'); // Union #1c1d21 (fast schwarz)
  });

  it('bars get their final width (reduced motion) in party colour', () => {
    const el = makePanel();
    renderPanel(el, land('BY'), fixtureData, () => {});
    const fills = [...el.querySelectorAll<HTMLElement>('.bars')][0].querySelectorAll<HTMLElement>('.bar-fill');
    // groesster Wert (AfD 34,5) fuellt die Spur
    expect(fills[0].style.width).toBe('100%');
    expect(fills[0].style.backgroundColor).toBe('rgb(0, 158, 224)');
  });
});

describe('renderPanel: Deutschland', () => {
  it('shows the Bundes ranking and the federal poll with current values', () => {
    const el = makePanel();
    renderPanel(el, { level: 'de', details: false }, fixtureData, () => {});
    expect(el.textContent).toContain('Deutschland');
    expect(el.textContent).toContain('Bundestagswahl 2025');
    expect(el.textContent).toContain('Union');
    expect(el.querySelector('.spark svg')).not.toBeNull();
    expect(el.querySelectorAll('.spark polyline').length).toBeGreaterThan(0);
    expect(el.querySelector('.spark-legend')!.textContent).toContain('27 %');
    expect(el.textContent).toContain('Umfrage Bund (Durchschnitt der Institute)');
  });
});

describe('renderPanel: Wahlkreis', () => {
  it('shows winner, Direktmandat, turnout with German decimal comma', () => {
    const el = makePanel();
    renderPanel(el, wk('BY', 230), withWks(baseWk), () => {});
    expect(el.textContent).toContain('Erika Parteilos');
    expect(el.textContent).toContain('Direktmandat');
    expect(el.textContent).toContain('Wahlbeteiligung 37,2 %');
  });

  it('winner without a seat: neutral caption instead of Direktmandat, no votes section, name stays text', async () => {
    loadVotesMock.mockResolvedValue(fixtureVotes);
    const el = makePanel();
    renderPanel(el, wk('BY', 232), withWks(unseatedWk), () => {});
    await flush();
    expect(el.querySelector('.winner')!.textContent).toContain('Gustav Ohnesitz');
    expect(el.querySelector('.winner')!.textContent).toContain(NO_SEAT);
    expect(el.textContent).not.toContain('Direktmandat');
    expect(el.textContent).not.toContain('Letzte Abstimmungen');
    expect(el.querySelector('.votes')).toBeNull();
    expect(el.querySelector('.winner [data-person]')).toBeNull();
    expect(loadVotesMock).not.toHaveBeenCalled();
  });

  it('winner who has left the Bundestag: "ausgeschieden" caption, no votes, name stays text', async () => {
    const left: Wahlkreis = { ...unseatedWk, id: 233, winner: { ...unseatedWk.winner, mdbId: 1002, directMandate: true } };
    const el = makePanel();
    renderPanel(el, wk('BY', 233), withWks(left), () => {});
    await flush();
    expect(el.querySelector('.winner')!.textContent).toContain('Erststimmen-Gewinner/in – inzwischen aus dem Bundestag ausgeschieden');
    expect(el.textContent).not.toContain('Letzte Abstimmungen');
    expect(el.querySelector('.winner [data-person]')).toBeNull(); // auch wenn die id in people.json stuende
    expect(loadVotesMock).not.toHaveBeenCalled();
  });

  it('a tie in the Erststimmen lists the winner party first', () => {
    const tie: Wahlkreis = {
      ...baseWk, id: 234,
      first: [{ party: 'union', share: 28.33 }, { party: 'gruene', share: 28.33 }, { party: 'sonstige', share: 43.34 }],
      winner: { ...baseWk.winner, party: 'gruene' },
    };
    const el = makePanel();
    renderPanel(el, wk('BY', 234), withWks(tie), () => {});
    const labels = [...el.querySelectorAll('.bars')][0].querySelectorAll('.bar-label');
    expect([...labels].map((l) => l.textContent)).toEqual(['Grüne', 'CSU', 'Sonstige']);
  });

  it('winner without mdbId: name shown as text, no vote list', async () => {
    const el = makePanel();
    renderPanel(el, wk('BY', 230), withWks(baseWk), () => {});
    await flush();
    expect(el.textContent).toContain('Erika Parteilos');
    expect(el.querySelector('.votes')).toBeNull();
    expect(el.querySelector('.winner [data-person]')).toBeNull();
    expect(loadVotesMock).not.toHaveBeenCalled();
  });

  it('winner party "sonstige" renders the Sonstige label and grey', () => {
    const el = makePanel();
    renderPanel(el, wk('BY', 230), withWks(baseWk), () => {});
    const avatar = el.querySelector('.winner .avatar') as HTMLElement;
    expect(avatar.style.backgroundColor).toBe('rgb(58, 61, 68)'); // #3a3d44
    expect(el.querySelector('.winner')!.textContent).toContain('Sonstige');
    expect(partyColor('sonstige')).toBe('#3a3d44');
  });

  it('Erst- und Zweitstimmen-Sieger differ: both lists visible with their leaders', () => {
    const el = makePanel();
    renderPanel(el, wk('BY', 220), fixtureData, () => {});
    const lists = [...el.querySelectorAll('.bars')];
    expect(lists).toHaveLength(2);
    expect(el.textContent).toContain('Erststimmen');
    expect(el.textContent).toContain('Zweitstimmen');
    expect(lists[0].querySelector('.bar-label')!.textContent).toBe('Grüne');
    expect(lists[1].querySelector('.bar-label')!.textContent).toBe('CSU');
  });

  it('shows the Land poll labelled as Bundesland', () => {
    const el = makePanel();
    renderPanel(el, wk('BY', 220), fixtureData, () => {});
    expect(el.textContent).toContain('Umfrage Bundesland Bayern (Durchschnitt der Institute)');
  });

  it('loads and lists up to 5 votes of the winner with neutral chips, without links', async () => {
    loadVotesMock.mockResolvedValue(fixtureVotes);
    const el = makePanel();
    renderPanel(el, wk('BY', 220), fixtureData, () => {});
    expect(loadVotesMock).toHaveBeenCalledWith(1002);
    await flush();
    const rows = el.querySelectorAll('.votes li.vote');
    expect(rows).toHaveLength(5);
    // neueste zuerst
    expect(rows[0].textContent).toContain('Abstimmung 6');
    expect(rows[0].textContent).toContain('13.11.2026');
    const chips = [...el.querySelectorAll('.votes .chip')].map((c) => c.textContent);
    expect(chips).toEqual(['Ja', 'Nein', 'Enthalten', 'Abwesend', 'Ja']);
    expect(rows[0].querySelector('.vote-title')!.tagName).toBe('SPAN');
    expect(el.querySelector('a')).toBeNull();
  });

  it('empty vote list shows "Keine Abstimmungen verfügbar"', async () => {
    const el = makePanel();
    renderPanel(el, wk('BY', 221), fixtureData, () => {});
    await flush();
    expect(el.querySelector('.votes')!.textContent).toContain('Keine Abstimmungen verfügbar');
  });

  it('seated winner whose Person is missing: name as text, but votes', async () => {
    loadVotesMock.mockResolvedValue(fixtureVotes.slice(0, 2));
    const el = makePanel();
    const later: Wahlkreis = {
      ...baseWk, id: 231, winner: { name: 'Fritz Nachgerueckt', party: 'spd', mdbId: 9999, directMandate: false, seated: true },
    };
    renderPanel(el, wk('BY', 231), withWks(later), () => {});
    await flush();
    expect(el.textContent).toContain('Fritz Nachgerueckt');
    expect(el.textContent).toContain('2025 ohne Direktmandat, inzwischen Mitglied des Bundestages');
    expect(el.querySelector('.winner [data-person]')).toBeNull(); // nicht aufloesbar: kein Knopf ohne Ziel
    expect(loadVotesMock).toHaveBeenCalledWith(9999);
    expect(el.querySelectorAll('.votes li.vote')).toHaveLength(2);
  });

  it('vote and profile URLs from the data never become links', async () => {
    loadVotesMock.mockResolvedValue([{ ...fixtureVotes[0], url: 'javascript:alert(1)' }]);
    const data: AppData = {
      ...fixtureData,
      people: fixtureData.people.map((p) => (p.id === 1002 ? { ...p, profileUrl: 'data:text/html,<b>x</b>' } : p)),
    };
    const el = makePanel();
    renderPanel(el, wk('BY', 220), data, () => {});
    await flush();
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('.winner .person-name')!.textContent).toBe('Bernd Muster');
    const row = el.querySelector('.votes li.vote')!;
    expect(row.querySelector('a')).toBeNull();
    expect(row.querySelector('.vote-title')!.textContent).toBe('Abstimmung 2');
    expect(el.querySelector('[href^="javascript:"], [href^="data:"]')).toBeNull();
  });

  // Hinweis: Jeder Render baut neue Knoten, ein veralteter Schreibzugriff traefe nur abgehaengte Knoten.
  // Der Test sichert das sichtbare Verhalten ab, unabhaengig vom Mechanismus.
  it('a stale vote promise does not overwrite the newer panel', async () => {
    let resolveA!: (v: Vote[]) => void;
    loadVotesMock.mockImplementationOnce(() => new Promise<Vote[]>((r) => { resolveA = r; }));
    loadVotesMock.mockImplementationOnce(async () => []);
    const el = makePanel();
    renderPanel(el, wk('BY', 220), fixtureData, () => {});
    renderPanel(el, wk('BY', 221), fixtureData, () => {});
    await flush();
    resolveA(fixtureVotes);
    await flush();
    expect(el.textContent).toContain('Clara Probe');
    expect(el.querySelectorAll('.votes li.vote')).toHaveLength(0);
    expect(el.querySelector('.votes')!.textContent).toContain('Keine Abstimmungen verfügbar');
  });
});

describe('renderPanel: Karten-Knoepfe (Parteien und Personen)', () => {
  const DE: NavState = { level: 'de', details: false };

  it('de: party names in bars and poll legend open the party card; parties without profile stay text', () => {
    const el = makePanel();
    const nav = vi.fn();
    renderPanel(el, DE, fixtureData, nav);
    const bars = el.querySelector('.bars')!;
    const union = bars.querySelector<HTMLButtonElement>('[data-party="union"] button.bar-label')!;
    expect(union.textContent).toBe('Union');
    expect(union.hasAttribute('data-card-trigger')).toBe(true);
    union.click();
    expect(nav).toHaveBeenCalledWith({ ...DE, card: { kind: 'party', id: 'union' } });
    expect(bars.querySelector('[data-party="sonstige"] .bar-label')!.tagName).toBe('SPAN');
    const legend = el.querySelector('.spark-legend')!;
    legend.querySelector<HTMLButtonElement>('button[data-party="afd"]')!.click();
    expect(nav).toHaveBeenLastCalledWith({ ...DE, card: { kind: 'party', id: 'afd' } });
    // Gruene/Linke haben im Fixture kein Profil: Text statt Knopf ohne Ziel
    expect(legend.querySelector('[data-party="gruene"]')).toBeNull();
    expect(legend.textContent).toContain('Grüne');
  });

  it('de: Hauptkandidaten from kandidaten.bund in Bundesergebnis order, names and parties are buttons', () => {
    const el = makePanel();
    const nav = vi.fn();
    renderPanel(el, DE, fixtureData, nav);
    const sec = [...el.querySelectorAll('.panel-section')].find((s) => s.querySelector('h3')!.textContent === 'Hauptkandidaten')!;
    expect(sec.textContent).toContain('Spitzenkandidaten der Parteien im Bundestag (Bundestagswahl 2025)');
    const people = [...sec.querySelectorAll<HTMLButtonElement>('button[data-person]')];
    expect(people.map((b) => b.textContent)).toEqual(['Erika Vorsitz', 'Jörg Überall']);
    expect(sec.querySelector('.avatar')!.textContent).toBe('EV');
    expect(sec.textContent).toContain('Kanzlerkandidatin Bundestagswahl 2025');
    people[1].click();
    expect(nav).toHaveBeenCalledWith({ ...DE, card: { kind: 'person', id: 'c-joerg-ueberall' } });
    sec.querySelector<HTMLButtonElement>('button[data-party="spd"]')!.click();
    expect(nav).toHaveBeenLastCalledWith({ ...DE, card: { kind: 'party', id: 'spd' } });
  });

  it('land: head of government first (official id), then candidates by result; bars use CSU buttons', () => {
    const el = makePanel();
    const nav = vi.fn();
    renderPanel(el, land('BY'), fixtureData, nav);
    expect(el.textContent).not.toContain('Spitzenpolitik');
    const sec = [...el.querySelectorAll('.panel-section')].find((s) => s.querySelector('h3')!.textContent === 'Hauptkandidaten')!;
    expect(sec.textContent).toContain('Ministerpräsident/in und Spitzenkandidaten der Landtagsparteien');
    const people = [...sec.querySelectorAll<HTMLButtonElement>('button[data-person]')];
    // BY ohne Landtag im Fixture: Reihenfolge nach Bundestagsergebnis (AfD vor SPD)
    expect(people.map((b) => [b.textContent, b.dataset.person])).toEqual([
      ['Anna Beispiel', '1001'], ['Grete Straße', 'c-grete-strasse'], ['Jörg Überall', 'c-joerg-ueberall'],
    ]);
    expect(sec.querySelector('.empty')).toBeNull();
    people[0].click();
    expect(nav).toHaveBeenCalledWith({ ...land('BY'), card: { kind: 'person', id: '1001' } });
    const csu = el.querySelector<HTMLButtonElement>('.bars [data-party="union"] button')!;
    expect(csu.textContent).toBe('CSU');
    csu.click();
    expect(nav).toHaveBeenLastCalledWith({ ...land('BY'), card: { kind: 'party', id: 'union' } });
  });

  it('land without entries shows the neutral empty text', () => {
    const el = makePanel();
    renderPanel(el, land('BW'), fixtureData, () => {});
    const sec = [...el.querySelectorAll('.panel-section')].find((s) => s.querySelector('h3')!.textContent === 'Hauptkandidaten')!;
    expect(sec.querySelector('.empty')!.textContent).toBe('Für diese Ebene liegen keine belegten Angaben zu Hauptkandidaten vor.');
    expect(sec.querySelectorAll('.person')).toHaveLength(0);
  });

  it('land: documented gaps (kandidaten.omissions) appear as small notes below the list, only for that Land', () => {
    const data = {
      ...fixtureData,
      kandidaten: { ...fixtureData.kandidaten, omissions: { BY: ['FW: keine Spitzenkandidatur belegt.'] } },
    };
    const leadsSec = (el: HTMLElement) =>
      [...el.querySelectorAll('.panel-section')].find((s) => s.querySelector('h3')!.textContent === 'Hauptkandidaten')!;
    const el = makePanel();
    renderPanel(el, land('BY'), data, () => {});
    const notes = [...leadsSec(el).querySelectorAll('.leads-omission')];
    expect(notes.map((n) => n.textContent)).toEqual(['FW: keine Spitzenkandidatur belegt.']);
    // steht unter den Zeilen
    expect(leadsSec(el).querySelector('.leads')!.lastElementChild).toBe(notes[0]);

    const bw = makePanel();
    renderPanel(bw, land('BW'), data, () => {});
    expect(leadsSec(bw).querySelector('.leads-omission')).toBeNull();
  });

  it('wk: winner name opens the person card, bars open party cards, no candidate list', async () => {
    const el = makePanel();
    const nav = vi.fn();
    renderPanel(el, wk('BY', 220), fixtureData, nav);
    await flush();
    expect(el.textContent).not.toContain('Hauptkandidaten');
    const name = el.querySelector<HTMLButtonElement>('.winner button[data-person]')!;
    expect(name.textContent).toBe('Bernd Muster');
    name.click();
    expect(nav).toHaveBeenCalledWith({ ...wk('BY', 220), card: { kind: 'person', id: '1002' } });
    // Ueberschrift der Abstimmungen nennt die Person ebenfalls als Knopf
    expect([...el.querySelectorAll('h3 button[data-person="1002"]')]).toHaveLength(1);
    const lists = el.querySelectorAll('.bars');
    lists[0].querySelector<HTMLButtonElement>('button[data-party="union"]')!.click();
    expect(nav).toHaveBeenLastCalledWith({ ...wk('BY', 220), card: { kind: 'party', id: 'union' } });
  });
});

describe('renderPanel: Details und Fokus', () => {
  it('the Details button calls onNavigate with details:true on every level', () => {
    const el = makePanel();
    for (const s of [{ level: 'de', details: false } as NavState, land('BY'), wk('BY', 220)]) {
      const nav = vi.fn();
      renderPanel(el, s, fixtureData, nav);
      const btn = el.querySelector<HTMLButtonElement>('[data-action="details"]')!;
      expect(btn.textContent).toBe('Details');
      btn.click();
      expect(nav).toHaveBeenCalledWith({ ...s, details: true });
    }
  });

  it('focuses the heading after navigation, but not on first render', () => {
    const el = makePanel();
    renderPanel(el, land('BY'), fixtureData, () => {});
    const h1 = el.querySelector('h2')!;
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).not.toBe(h1);
    renderPanel(el, wk('BY', 220), fixtureData, () => {});
    expect(document.activeElement).toBe(el.querySelector('h2'));
  });
});

describe('renderCrumbs', () => {
  it('wk level: Deutschland › Land › Wahlkreis, Deutschland navigates to de', () => {
    const el = document.createElement('nav');
    document.body.appendChild(el);
    const nav = vi.fn();
    renderCrumbs(el, wk('BY', 220), fixtureData, nav);
    expect(el.textContent).toContain('Deutschland');
    expect(el.textContent).toContain('Bayern');
    expect(el.textContent).toContain('München-West');
    const buttons = [...el.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Deutschland', 'Bayern']);
    expect(el.querySelector('[aria-current="page"]')!.textContent).toContain('München-West');
    buttons[0].click();
    expect(nav).toHaveBeenCalledWith({ level: 'de', details: false });
    buttons[1].click();
    expect(nav).toHaveBeenCalledWith({ level: 'land', landId: 'BY', details: false });
  });

  it('de level: only Deutschland, as current page', () => {
    const el = document.createElement('nav');
    renderCrumbs(el, { level: 'de', details: false }, fixtureData, () => {});
    expect(el.querySelectorAll('button')).toHaveLength(0);
    expect(el.querySelector('[aria-current="page"]')!.textContent).toBe('Deutschland');
  });
});

describe('initials', () => {
  it('takes first and last name, skipping titles', () => {
    expect(initials('Markus Söder')).toBe('MS');
    expect(initials('Dr. Anna-Lena Beispiel')).toBe('AB');
    expect(initials('Cem Özdemir')).toBe('CÖ');
    expect(initials('Madonna')).toBe('M');
    expect(initials('  ')).toBe('?');
  });
});
