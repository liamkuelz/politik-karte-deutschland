import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavState } from '../src/nav.ts';
import type { Vote } from '../src/types.ts';
import { fixtureData, fixtureVotes } from './fixtures.ts';

/*
 * Die Seite fuehrt nirgends weg: keine Links nach aussen, kein neuer Tab, kein window.open.
 * Die Abstimmungen im Fixture tragen echte https-Adressen; sie duerfen trotzdem nie als Link erscheinen.
 */

const loadVotesMock = vi.fn<(id: number) => Promise<Vote[]>>();
vi.mock('../src/data.ts', () => ({ loadVotes: (id: number) => loadVotesMock(id) }));

const { renderPanel } = await import('../src/panel.ts');
const { renderDashboard } = await import('../src/dashboard.ts');
const { renderCard } = await import('../src/cards.ts');
const { renderFooter } = await import('../src/footer.ts');
const { renderLegend } = await import('../src/legend.ts');

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const nav = () => {};

const VIEWS: NavState[] = [
  { level: 'de', details: false },
  { level: 'land', landId: 'BY', details: false },
  { level: 'land', landId: 'BW', details: false },
  { level: 'wk', landId: 'BY', wkId: 220, details: false },
  { level: 'wk', landId: 'BW', wkId: 260, details: false },
];

function expectNoLinks(where: string) {
  expect(document.querySelectorAll('a[href]').length, `${where}: a[href]`).toBe(0);
  expect(document.querySelectorAll('a').length, `${where}: a`).toBe(0);
  expect(document.querySelectorAll('[target="_blank"], [target]').length, `${where}: target`).toBe(0);
  expect(document.querySelectorAll('[href]').length, `${where}: href`).toBe(0);
}

function slot(tag: keyof HTMLElementTagNameMap): HTMLElement {
  const el = document.createElement(tag);
  document.body.append(el);
  return el;
}

beforeEach(() => {
  loadVotesMock.mockReset();
  loadVotesMock.mockResolvedValue(fixtureVotes);
});
afterEach(() => { document.body.innerHTML = ''; });

describe('no external links in rendered views', () => {
  it.each(VIEWS)('panel, legend and dashboard (details on and off): %j', async (view) => {
    renderPanel(slot('aside'), view, fixtureData, nav);
    renderLegend(slot('div'), view, fixtureData, nav);
    await renderDashboard(slot('main'), { ...view, details: true }, fixtureData, nav);
    await flush();
    expectNoLinks(JSON.stringify(view));
  });

  it('votes are actually rendered in panel and dashboard (the audit sees them)', async () => {
    const view: NavState = { level: 'wk', landId: 'BY', wkId: 220, details: true };
    renderPanel(slot('aside'), view, fixtureData, nav);
    await renderDashboard(slot('main'), view, fixtureData, nav);
    await flush();
    expect(document.querySelectorAll('li.vote').length).toBe(5 + fixtureVotes.length);
    expectNoLinks('votes');
  });

  it.each([
    { level: 'de', details: false, card: { kind: 'party', id: 'union' } },
    { level: 'land', landId: 'BY', details: false, card: { kind: 'party', id: 'spd' } },
    { level: 'wk', landId: 'BY', wkId: 220, details: true, card: { kind: 'party', id: 'afd' } },
    { level: 'de', details: false, card: { kind: 'person', id: '1002' } },
    { level: 'land', landId: 'BY', details: false, card: { kind: 'person', id: '1001' } },
    { level: 'land', landId: 'BY', details: false, card: { kind: 'person', id: 'c-joerg-ueberall' } },
    { level: 'de', details: false, card: { kind: 'person', id: 'c-erika-vorsitz' } },
  ] as NavState[])('card %j', async (state) => {
    const root = slot('div');
    renderCard(root, state, fixtureData, nav);
    await flush();
    expect(root.querySelector('[role="dialog"]')).not.toBeNull();
    expectNoLinks(JSON.stringify(state.card));
  });

  it('person card of a member of the Bundestag lists votes without links', async () => {
    const root = slot('div');
    renderCard(root, { level: 'de', details: false, card: { kind: 'person', id: '1002' } }, fixtureData, nav);
    await flush();
    expect(root.querySelectorAll('li.vote')).toHaveLength(fixtureVotes.length);
    expectNoLinks('person votes');
  });

  it('footer (expanded)', () => {
    const el = slot('footer');
    renderFooter(el, fixtureData.meta, new Date('2026-11-22T00:00:00Z'));
    el.querySelector('details')!.open = true;
    expect(el.textContent).toContain('https://');
    expectNoLinks('footer');
  });
});

describe('no external links in the source', () => {
  // jsdom-Umgebung: import.meta.url ist keine file-URL, daher relativ zum Projektordner (Vitest-Wurzel)
  const root = join(process.cwd(), 'src');
  const files = (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ f, text: readFileSync(join(root, f), 'utf8') }));

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each([
    ['extLink', /extLink/],
    ['safeHttps', /safeHttps/],
    ['window.open', /window\.open/],
    ['.href =', /\.href\s*=/],
    ["target = '_blank'", /target\s*=\s*['"]_blank/],
    ['_blank', /_blank/],
    ["h('a'", /\bh\(\s*['"]a['"]/],
    ["createElement('a')", /createElement\(\s*['"]a['"]/],
    ['<a ', /<a\s/],
  ])('no %s in src/**/*.ts', (_label, re) => {
    const hits = files.filter(({ text }) => re.test(text)).map(({ f }) => f);
    expect(hits).toEqual([]);
  });
});
