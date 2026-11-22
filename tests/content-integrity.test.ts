import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatesFile, PartyProfile } from '../src/content-types.ts';
import type { AppData } from '../src/data.ts';
import type { NavState } from '../src/nav.ts';
import type { AreaResult, Land, Person, Wahlkreis } from '../src/types.ts';

/*
 * Zusammenspiel der ECHTEN Inhaltsdateien mit der Oberflaeche: jede Kandidaten-Partei hat ein Profil,
 * jeder Kandidatenschluessel loest auf, jede Partei- und Kandidatenkarte rendert ohne Fehler.
 */

vi.mock('../src/data.ts', () => ({ loadVotes: async () => [] }));

const { candidateKey, findCandidate } = await import('../src/content.ts');
const { renderCard } = await import('../src/cards.ts');
const { leadsOf, renderLeads, winnerPersonId } = await import('../src/leads.ts');
const { PARTIES } = await import('../src/parties.ts');
const { cardExists, validateState } = await import('../src/validate.ts');

// jsdom-Umgebung: import.meta.url ist keine file-URL, daher relativ zum Projektordner (Vitest-Wurzel)
const dir = join(process.cwd(), 'public', 'data');
const read = <T>(f: string): T => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T;

const data: AppData = {
  geo: {},
  wahlkreise: read<Wahlkreis[]>('wahlkreise.json'),
  laender: read<Land[]>('laender.json'),
  bund: read<AreaResult>('bund.json'),
  people: read<Person[]>('people.json'),
  polls: [],
  meta: { stand: { election: '2025-02-23', people: '2026-11-22', polls: '2026-11-22' } },
  parteien: read<PartyProfile[]>('parteien.json'),
  kandidaten: read<CandidatesFile>('kandidaten.json'),
};

const lists: [string | undefined, CandidatesFile['bund']][] = [
  [undefined, data.kandidaten.bund],
  ...Object.entries(data.kandidaten.laender),
];
const nav = () => {};

afterEach(() => { document.body.innerHTML = ''; });

function open(state: NavState): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  renderCard(root, state, data, nav);
  return root;
}

describe('kandidaten.json against the app', () => {
  it('every Land key is a Land of laender.json', () => {
    const ids = new Set(data.laender.map((l) => l.id));
    for (const landId of Object.keys(data.kandidaten.laender)) expect(ids.has(landId), landId).toBe(true);
  });

  it('every candidate party is a known party id with a profile (the party button has a target)', () => {
    const profiles = new Set(data.parteien.map((p) => p.id));
    for (const [landId, list] of lists) {
      for (const c of list) {
        expect(Object.keys(PARTIES), `${landId ?? 'Bund'} ${c.name}`).toContain(c.party);
        expect(profiles.has(c.party), `${landId ?? 'Bund'} ${c.name}: ${c.party}`).toBe(true);
      }
    }
  });

  it('every candidate key resolves via findCandidate to that candidate and survives validateState', () => {
    for (const [landId, list] of lists) {
      for (const c of list) {
        const key = candidateKey(c);
        const found = findCandidate(data, key, landId);
        expect(found?.candidate, `${landId ?? 'Bund'} ${key}`).toBe(c);
        const state: NavState = landId
          ? { level: 'land', landId, details: false, card: { kind: 'person', id: key } }
          : { level: 'de', details: false, card: { kind: 'person', id: key } };
        expect(validateState(state, data).card, key).toEqual({ kind: 'person', id: key });
      }
    }
  });

  it('every candidate renders a person card with name, role and source', () => {
    for (const [landId, list] of lists) {
      for (const c of list) {
        const state: NavState = landId
          ? { level: 'land', landId, details: false, card: { kind: 'person', id: candidateKey(c) } }
          : { level: 'de', details: false, card: { kind: 'person', id: candidateKey(c) } };
        const root = open(state);
        expect(root.querySelector('.card-title')!.textContent).toBe(c.name);
        expect(root.textContent).toContain(c.role);
        expect(root.querySelector('a')).toBeNull();
        root.remove();
      }
    }
  });

  it('Hauptkandidaten rows of Bund and every Land resolve to cards; the head of government comes first', () => {
    const check = (landId?: string) => {
      const { rows } = leadsOf(data, landId);
      for (const r of rows) {
        expect(r.personId, `${landId} ${r.name}`).toBeDefined();
        expect(cardExists({ kind: 'person', id: r.personId! }, data), `${landId} ${r.name}`).toBe(true);
      }
      return rows;
    };
    expect(check().length).toBe(data.kandidaten.bund.length);
    for (const land of data.laender) {
      const rows = check(land.id);
      const head = land.officials[0];
      if (head) expect(rows[0].name, land.id).toBe(head.name);
    }
    // Stichprobe Bayern, aus den Daten abgeleitet (kein fester Name, damit Amtswechsel den Test nicht brechen)
    const by = data.laender.find((l) => l.id === 'BY')!.officials[0];
    expect(leadsOf(data, 'BY').rows[0]).toMatchObject({ name: by.name, party: by.party });
  });

  it('documented omissions: valid Land keys, short neutral text, rendered below the Hauptkandidaten', () => {
    const omissions = data.kandidaten.omissions ?? {};
    const ids = new Set(data.laender.map((l) => l.id));
    for (const [landId, notes] of Object.entries(omissions)) {
      expect(ids.has(landId), landId).toBe(true);
      for (const n of notes) {
        expect(n.trim(), landId).not.toBe('');
        expect(n, landId).not.toMatch(/http|www\./i);
        expect(leadsOf(data, landId).omissions).toContain(n);
      }
    }
    // Saarland: AfD sitzt im Landtag, Spitzenkandidatur nicht belegt
    expect(omissions.SL?.some((n) => n.startsWith('AfD:'))).toBe(true);
    const box = renderLeads(data, 'SL', { state: { level: 'land', landId: 'SL', details: false }, onNavigate: nav, profiles: new Set() });
    expect([...box.querySelectorAll('.leads-omission')].map((p) => p.textContent)).toEqual(omissions.SL);
  });
});

describe('Hauptkandidaten who are sitting MdBs (real data)', () => {
  /** people.json-id zu einem Namen; die Daten bestimmen, wer heute im Bundestag sitzt. */
  const mdbId = (name: string) => data.people.find((p) => p.name === name)?.id;

  it('Friedrich Merz: card shows the MdB role, the candidate role and source, and the votes section', () => {
    const id = mdbId('Friedrich Merz');
    const c = data.kandidaten.bund.find((x) => x.name === 'Friedrich Merz');
    // Beide Eintraege existieren am 22.11.2026 (people.json id 118559); faellt einer weg, ist der Test gegenstandslos
    if (id === undefined || !c) return;
    const row = leadsOf(data).rows.find((r) => r.name === 'Friedrich Merz')!;
    expect(row.personId).toBe(String(id));
    const root = open({ level: 'de', details: false, card: { kind: 'person', id: String(id) } });
    const roles = [...root.querySelectorAll('.card-roles li')].map((li) => li.textContent);
    expect(roles).toContain('Mitglied des Bundestages');
    expect(roles).toContain(c.role); // "Kanzlerkandidat Bundestagswahl 2025"
    expect(root.querySelector('.card-source')!.textContent).toBe(`Quelle: ${c.source}`);
    expect(root.querySelector('.card-votes-section h3')!.textContent).toBe('Abstimmungsverhalten');
  });

  it('Heidi Reichinnek (Bund, Doppelspitze): candidate note appears on the MdB card', () => {
    const id = mdbId('Heidi Reichinnek');
    const c = data.kandidaten.bund.find((x) => x.name === 'Heidi Reichinnek');
    if (id === undefined || !c) return;
    const root = open({ level: 'de', details: false, card: { kind: 'person', id: String(id) } });
    expect(root.textContent).toContain(c.role);
    if (c.note) expect(root.querySelector('.card-funktion .card-meta')!.textContent).toBe(c.note);
  });

  it('Cansu Özdemir (Hamburg list): Land candidate role, note if any, source and votes', () => {
    const id = mdbId('Cansu Özdemir');
    const c = data.kandidaten.laender.HH?.find((x) => x.name === 'Cansu Özdemir');
    if (id === undefined || !c) return;
    const row = leadsOf(data, 'HH').rows.find((r) => r.name === 'Cansu Özdemir')!;
    expect(row.personId).toBe(String(id));
    const root = open({ level: 'land', landId: 'HH', details: false, card: { kind: 'person', id: String(id) } });
    expect(root.textContent).toContain(c.role);
    if (c.note) expect(root.textContent).toContain(c.note);
    expect(root.querySelector('.card-source')!.textContent).toBe(`Quelle: ${c.source}`);
    expect(root.querySelector('.card-votes-section')).not.toBeNull();
  });

  it('every MdB-matched Hauptkandidat/in card carries the candidate role; other MdBs get no candidate source', () => {
    for (const [landId, list] of lists) {
      for (const c of list) {
        const p = data.people.find((x) => x.party === c.party && x.name === c.name);
        if (!p) continue;
        const root = open(landId
          ? { level: 'land', landId, details: false, card: { kind: 'person', id: String(p.id) } }
          : { level: 'de', details: false, card: { kind: 'person', id: String(p.id) } });
        expect(root.textContent, `${landId ?? 'Bund'} ${c.name}`).toContain(c.role);
        root.remove();
      }
    }
    const plain = data.people.find((p) => !lists.some(([, l]) => l.some((c) => c.name === p.name)))!;
    const root = open({ level: 'de', details: false, card: { kind: 'person', id: String(plain.id) } });
    expect(root.querySelector('.card-source')).toBeNull();
  });
});

describe('parteien.json against the app', () => {
  it.each(data.parteien.map((p) => p.id))('party card %s renders at Bund level and in every Land', (id) => {
    const de = open({ level: 'de', details: false, card: { kind: 'party', id } });
    expect(de.querySelectorAll('.kp')).toHaveLength(7);
    expect(de.textContent).toContain('Ergebnis bundesweit');
    for (const land of data.laender) {
      const root = open({ level: 'land', landId: land.id, details: false, card: { kind: 'party', id } });
      expect(root.textContent, land.id).toContain(`Ergebnis in ${land.name}`);
      expect(root.querySelector('a')).toBeNull();
      root.remove();
    }
  });
});

describe('Wahlkreis winners', () => {
  it('a winner id handed to a person button always resolves to a card', () => {
    let buttons = 0;
    for (const wk of data.wahlkreise) {
      const id = winnerPersonId(data, wk.winner);
      if (!id) continue;
      buttons++;
      expect(cardExists({ kind: 'person', id }, data), `${wk.id} ${wk.winner.name}`).toBe(true);
    }
    // Frueher fest "> 250": bricht bei normalem Wechsel im Bundestag (taeglicher Datenabgleich). Jetzt relativ:
    // mindestens die Haelfte der Direktmandate mit Gewinner-id loest auf.
    const withId = data.wahlkreise.filter((wk) => wk.winner.mdbId !== null).length;
    expect(buttons).toBeGreaterThan(0);
    expect(buttons).toBeGreaterThanOrEqual(Math.floor(withId * 0.5));
  });
});
