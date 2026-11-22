import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '../src/data.ts';
import { loadVotes } from '../src/data.ts';
import { renderDashboard, setDetailsMode } from '../src/dashboard.ts';
import type { NavState } from '../src/nav.ts';
import { renderCrumbs } from '../src/panel.ts';
import { partyColor } from '../src/parties.ts';
import type { Vote } from '../src/types.ts';
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

function makeDash(): HTMLElement {
  const el = document.createElement('main');
  el.id = 'dashboard';
  document.body.appendChild(el);
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const DE: NavState = { level: 'de', details: true };
const land = (landId: string): NavState => ({ level: 'land', landId, details: true });
const wk = (landId: string, wkId: number): NavState => ({ level: 'wk', landId, wkId, details: true });
const tileTitles = (el: HTMLElement) => [...el.querySelectorAll('.tile h3')].map((t) => t.textContent);
const tile = (el: HTMLElement, title: string) =>
  [...el.querySelectorAll<HTMLElement>('.tile')].find((t) => t.querySelector('h3')!.textContent!.startsWith(title))!;

beforeEach(() => {
  stubReducedMotion(true);
  loadVotesMock.mockReset();
  loadVotesMock.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('renderDashboard: Deutschland', () => {
  it('shows ranking, federal poll and a Länder table whose rows navigate', async () => {
    const el = makeDash();
    const nav = vi.fn();
    await renderDashboard(el, DE, fixtureData, nav);
    expect(el.querySelector('h2')!.textContent).toBe('Deutschland');
    expect(tileTitles(el)).toEqual(['Zweitstimmen Bund', 'Umfrage Bund (Durchschnitt der Institute)', 'Bundesländer']);
    expect(tile(el, 'Zweitstimmen Bund').textContent).toContain('Bundestagswahl 2025');
    expect(tile(el, 'Umfrage Bund').querySelectorAll('polyline').length).toBeGreaterThan(0);
    const rows = [...el.querySelectorAll<HTMLTableRowElement>('.tile tbody tr')];
    expect(rows).toHaveLength(2);
    const by = rows.find((r) => r.textContent!.includes('Bayern'))!;
    expect(by.textContent).toContain('AfD');
    expect(by.textContent).toContain('82,0 %');
    expect((by.querySelector('.dot') as HTMLElement).style.backgroundColor).toBe('rgb(0, 158, 224)');
    by.querySelector('button')!.click();
    expect(nav).toHaveBeenCalledTimes(1);
    expect(nav).toHaveBeenCalledWith({ level: 'land', landId: 'BY', details: true });
  });

  it('without a federal poll series shows "Keine Umfragen verfügbar"', async () => {
    const el = makeDash();
    await renderDashboard(el, DE, { ...fixtureData, polls: [] }, () => {});
    expect(tile(el, 'Umfrage Bund').textContent).toContain('Keine Umfragen verfügbar');
  });
});

describe('renderDashboard: Land', () => {
  it('lists all Wahlkreise of the Land; a click navigates to the Wahlkreis dashboard', async () => {
    const el = makeDash();
    const nav = vi.fn();
    await renderDashboard(el, land('BY'), fixtureData, nav);
    const items = [...tile(el, 'Wahlkreise').querySelectorAll<HTMLButtonElement>('button')];
    expect(items.map((b) => b.textContent)).toEqual([
      expect.stringContaining('220'), expect.stringContaining('221'),
    ]);
    expect(items[0].textContent).toContain('München-West');
    expect(items[0].textContent).toContain('Bernd Muster');
    expect(tile(el, 'Wahlkreise').textContent).not.toContain('Stuttgart');
    items[1].click();
    expect(nav).toHaveBeenCalledWith({ level: 'wk', landId: 'BY', wkId: 221, details: true });
  });

  it('shows Bundestag, Landtag (or empty), poll and officials tiles', async () => {
    const el = makeDash();
    await renderDashboard(el, land('BY'), fixtureData, () => {});
    expect(tileTitles(el)).toEqual(['Bundestagswahl 2025', 'Landtagswahl', 'Umfrage Bayern (Durchschnitt der Institute)', 'Politiker', 'Wahlkreise']);
    expect(tile(el, 'Bundestagswahl').textContent).toContain('CSU');
    expect(tile(el, 'Bundestagswahl').textContent).toContain('Wahlbeteiligung 82,0 %');
    expect(tile(el, 'Landtagswahl').textContent).toContain('Keine Landtagswahl-Daten');
    expect(tile(el, 'Umfrage Bayern').textContent).toContain('Keine Umfragen verfügbar');
    const pol = tile(el, 'Politiker');
    expect(pol.textContent).toContain('Anna Beispiel');
    expect(pol.querySelector('.avatar')!.textContent).toBe('AB');
    expect(pol.querySelector('a')!.getAttribute('href')).toBe('https://www.abgeordnetenwatch.de/profile/anna-beispiel');
    await renderDashboard(el, land('BW'), fixtureData, () => {});
    expect(tile(el, 'Landtagswahl 2021').textContent).toContain('Grüne');
  });

  it('officials link their own profileUrl (they are not in people.json), https only', async () => {
    const el = makeDash();
    await renderDashboard(el, land('BY'), { ...fixtureData, people: [] }, () => {});
    expect(tile(el, 'Politiker').querySelector('a')!.getAttribute('href')).toBe('https://www.abgeordnetenwatch.de/profile/anna-beispiel');

    const unsafe = {
      ...fixtureData,
      laender: fixtureData.laender.map((l) => (l.id === 'BY'
        ? { ...l, officials: [{ ...l.officials[0], profileUrl: 'javascript:alert(1)' }] } : l)),
    };
    await renderDashboard(el, land('BY'), unsafe, () => {});
    const pol = tile(el, 'Politiker');
    expect(pol.textContent).toContain('Anna Beispiel');
    expect(pol.querySelector('a')).toBeNull();
    expect(pol.querySelector('[href^="javascript:"]')).toBeNull();
  });
});

describe('renderDashboard: Wahlkreis', () => {
  it('contains Direktmandat, stacked Erst-/Zweitstimmen, turnout and the tile "Umfrage Bundesland"', async () => {
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    const titles = tileTitles(el);
    expect(titles).toContain('Direktmandat');
    expect(titles).toContain('Erst- und Zweitstimmen');
    expect(titles).toContain('Wahlbeteiligung');
    expect(titles).toContain('Umfrage Bundesland Bayern (Durchschnitt der Institute)');
    expect(titles).toContain('Abstimmungsverhalten');
    expect(tile(el, 'Direktmandat').textContent).toContain('Bernd Muster');
    expect(tile(el, 'Direktmandat').querySelector('a')!.getAttribute('href')).toContain('bernd-muster');
    expect(tile(el, 'Wahlbeteiligung').textContent).toContain('84,2 %');
    const stacks = tile(el, 'Erst- und Zweitstimmen').querySelectorAll('.stack');
    expect(stacks).toHaveLength(2);
    const first = stacks[0].querySelector<HTMLElement>('.stack-seg')!;
    expect(first.style.backgroundColor).toBe('rgb(70, 150, 43)'); // Grüne vorn bei den Erststimmen
    expect(first.style.width).toBe('35.1%');
    expect(stacks[0].getAttribute('aria-label')).toContain('Grüne 35,1 %');
    expect(partyColor('gruene')).toBe('#46962B');
  });

  it('lists all votes of the winner with neutral chips, newest first', async () => {
    loadVotesMock.mockResolvedValue(fixtureVotes);
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    expect(loadVotesMock).toHaveBeenCalledWith(1002);
    const rows = [...el.querySelectorAll('.dash-votes li.vote')];
    expect(rows).toHaveLength(6);
    expect(rows[0].textContent).toContain('Abstimmung 6');
    expect(rows[0].querySelector('time')!.textContent).toBe('13.11.2026');
    expect(rows.map((r) => r.querySelector('.chip')!.textContent)).toEqual(['Ja', 'Nein', 'Enthalten', 'Abwesend', 'Ja', 'Nein']);
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe('https://www.abgeordnetenwatch.de/bundestag/21/abstimmungen/6');
  });

  it('filter buttons filter the list client-side and show counts', async () => {
    loadVotesMock.mockResolvedValue(fixtureVotes);
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.vote-filter button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Alle 6', 'Ja 2', 'Nein 2', 'Enthalten 1', 'Abwesend 1']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    const visible = () => [...el.querySelectorAll<HTMLElement>('.dash-votes li.vote')].filter((li) => !li.hidden);
    buttons[2].click(); // Nein
    expect(visible().map((li) => li.querySelector('.chip')!.textContent)).toEqual(['Nein', 'Nein']);
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('.vote-count')!.textContent).toBe('2 von 6 Abstimmungen');
    buttons[0].click();
    expect(visible()).toHaveLength(6);
    expect(buttons[0].type).toBe('button');
  });

  it('empty votes show "Keine Abstimmungen verfügbar"', async () => {
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    expect(tile(el, 'Abstimmungsverhalten').textContent).toContain('Keine Abstimmungen verfügbar');
    expect(el.querySelector('.vote-filter')).toBeNull();
  });

  it('a rejected vote request shows the empty state', async () => {
    loadVotesMock.mockRejectedValue(new Error('offline'));
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    expect(tile(el, 'Abstimmungsverhalten').textContent).toContain('Keine Abstimmungen verfügbar');
  });

  it('winner without mdbId or Person: name without profile link, no vote request', async () => {
    const data: AppData = {
      ...fixtureData,
      wahlkreise: fixtureData.wahlkreise.map((w) => (w.id === 220 ? { ...w, winner: { ...w.winner, mdbId: null } } : w)),
    };
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), data, () => {});
    expect(tile(el, 'Direktmandat').textContent).toContain('Bernd Muster');
    expect(tile(el, 'Direktmandat').querySelector('a')).toBeNull();
    expect(loadVotesMock).not.toHaveBeenCalled();
    expect(tile(el, 'Abstimmungsverhalten').textContent).toContain('Keine Abstimmungen verfügbar');

    await renderDashboard(el, wk('BY', 220), { ...fixtureData, people: [] }, () => {});
    expect(tile(el, 'Direktmandat').querySelector('a')).toBeNull();
    expect(loadVotesMock).toHaveBeenCalledWith(1002);
  });

  it('winner without a seat: neutral tile and caption, no votes tile, no profile link, no vote request', async () => {
    const unseated = (directMandate: boolean): AppData => ({
      ...fixtureData,
      wahlkreise: fixtureData.wahlkreise.map((w) => (w.id === 220
        ? { ...w, winner: { ...w.winner, mdbId: 7777, directMandate, seated: false } } : w)),
    });
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), unseated(false), () => {});
    const titles = tileTitles(el);
    expect(titles).not.toContain('Direktmandat');
    expect(titles).not.toContain('Abstimmungsverhalten');
    const t = tile(el, 'Erststimmen-Gewinner/in');
    expect(t.textContent).toContain('Bernd Muster');
    expect(t.textContent).toContain('Erststimmen-Gewinner/in – kein Bundestagsmandat (Zweitstimmendeckung)');
    expect(t.querySelector('a')).toBeNull();
    expect(el.querySelector('.dash-votes')).toBeNull();
    expect(loadVotesMock).not.toHaveBeenCalled();

    await renderDashboard(el, wk('BY', 220), unseated(true), () => {});
    expect(tile(el, 'Erststimmen-Gewinner/in').textContent).toContain('inzwischen aus dem Bundestag ausgeschieden');
    expect(loadVotesMock).not.toHaveBeenCalled();
  });

  it('a tie in the Erststimmen puts the winner party first in the stacked bar', async () => {
    const data: AppData = {
      ...fixtureData,
      wahlkreise: fixtureData.wahlkreise.map((w) => (w.id === 220
        ? { ...w, first: [{ party: 'union', share: 28.33 }, { party: 'gruene', share: 28.33 }, { party: 'sonstige', share: 43.34 }] }
        : w)),
    };
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), data, () => {});
    const seg = tile(el, 'Erst- und Zweitstimmen').querySelector<HTMLElement>('.stack .stack-seg')!;
    expect(seg.style.backgroundColor).toBe('rgb(70, 150, 43)'); // Grüne (Gewinnerpartei) vor CSU
  });

  it('unsafe vote URLs render as plain text without href', async () => {
    const bad: Vote[] = [
      { ...fixtureVotes[0], title: 'Boese', url: 'javascript:alert(1)' },
      { ...fixtureVotes[1], title: 'Daten', url: 'data:text/html,x' },
      { ...fixtureVotes[2], title: '<img src=x onerror=alert(1)>', url: 'http://example.org' },
    ];
    loadVotesMock.mockResolvedValue(bad);
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    expect(el.querySelectorAll('.dash-votes li.vote')).toHaveLength(3);
    expect(el.querySelector('.dash-votes a')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('a stale vote promise does not write into the newer dashboard', async () => {
    let resolveA!: (v: Vote[]) => void;
    loadVotesMock.mockImplementationOnce(() => new Promise<Vote[]>((r) => { resolveA = r; }));
    loadVotesMock.mockImplementationOnce(() => new Promise<Vote[]>(() => {})); // B laedt noch
    const el = makeDash();
    const a = renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    void renderDashboard(el, wk('BY', 221), fixtureData, () => {});
    const before = el.querySelector('.dash-votes')!.textContent;
    expect(before).toContain('werden geladen');
    resolveA(fixtureVotes);
    await a;
    await flush();
    expect(el.querySelector('h2')!.textContent).toBe('München-Ost');
    expect(el.querySelectorAll('.dash-votes li.vote')).toHaveLength(0);
    expect(el.querySelector('.dash-votes')!.textContent).toBe(before);
  });
});

describe('renderDashboard: Steuerung', () => {
  it('"Zurück zur Karte" calls onNavigate with details:false on every level', async () => {
    const el = makeDash();
    for (const s of [DE, land('BY'), wk('BY', 220)]) {
      const nav = vi.fn();
      await renderDashboard(el, s, fixtureData, nav);
      const btn = el.querySelector<HTMLButtonElement>('[data-action="close-details"]')!;
      expect(btn.textContent).toBe('Zurück zur Karte');
      btn.click();
      expect(nav).toHaveBeenCalledWith({ ...s, details: false });
    }
  });

  it('tiles carry a stagger index --i, capped at 10', async () => {
    const el = makeDash();
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    const is = [...el.querySelectorAll<HTMLElement>('.tile')].map((t) => t.style.getPropertyValue('--i'));
    expect(is[0]).toBe('0');
    expect(is[1]).toBe('1');
    expect(Math.max(...is.map(Number))).toBeLessThanOrEqual(10);
  });

  it('focuses the new heading when navigating inside the dashboard', async () => {
    const el = makeDash();
    await renderDashboard(el, land('BY'), fixtureData, () => {});
    await renderDashboard(el, wk('BY', 220), fixtureData, () => {});
    expect(document.activeElement).toBe(el.querySelector('h2'));
    expect(el.querySelector('h2')!.getAttribute('tabindex')).toBe('-1');
  });
});

describe('setDetailsMode', () => {
  it('toggles body.is-details, focuses the dashboard heading on entry and the panel heading on exit', async () => {
    const panel = document.createElement('aside');
    panel.id = 'panel';
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.tabIndex = -1;
    panel.append(title);
    document.body.append(panel);
    const el = makeDash();
    await renderDashboard(el, land('BY'), fixtureData, () => {});
    setDetailsMode(true);
    expect(document.body.classList.contains('is-details')).toBe(true);
    expect(document.activeElement).toBe(el.querySelector('h2'));
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(el.hasAttribute('inert')).toBe(false);
    setDetailsMode(true); // unveraendert: kein erneuter Fokuswechsel noetig, kein Fehler
    setDetailsMode(false);
    expect(document.body.classList.contains('is-details')).toBe(false);
    expect(document.activeElement).toBe(title);
    expect(el.hasAttribute('inert')).toBe(true);
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('accepts another root element', () => {
    const root = document.createElement('div');
    setDetailsMode(true, root);
    expect(root.classList.contains('is-details')).toBe(true);
    expect(document.body.classList.contains('is-details')).toBe(false);
  });
});

describe('renderCrumbs in details mode', () => {
  it('crumbs keep the details mode', () => {
    const el = document.createElement('nav');
    const nav = vi.fn();
    renderCrumbs(el, wk('BY', 220), fixtureData, nav);
    const [de, by] = [...el.querySelectorAll('button')];
    de.click();
    by.click();
    expect(nav).toHaveBeenNthCalledWith(1, { level: 'de', details: true });
    expect(nav).toHaveBeenNthCalledWith(2, { level: 'land', landId: 'BY', details: true });
  });
});

describe('dashboard tables', () => {
  it('all column headers carry scope="col"', async () => {
    const el = makeDash();
    await renderDashboard(el, DE, fixtureData, () => {});
    const de = [...el.querySelectorAll('th')];
    loadVotesMock.mockResolvedValue([]);
    await renderDashboard(el, wk('BY', 221), fixtureData, () => {});
    const all = [...de, ...el.querySelectorAll('th')];
    expect(all.length).toBeGreaterThanOrEqual(6);
    for (const th of all) expect(th.getAttribute('scope')).toBe('col');
  });
});
