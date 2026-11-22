import type { CandidatesFile, KeyPoint, PartyProfile } from '../src/content-types.ts';
import type { AppData } from '../src/data.ts';
import type { AreaResult, Land, Person, PollSeries, Vote, Wahlkreis } from '../src/types.ts';

/*
 * Kleiner, handgebauter Datensatz fuer Tests.
 * Geometrie (Laenge/Breite, Ringe im Uhrzeigersinn wie d3-geo es erwartet):
 *   BW: 8..10 E, 48..49 N  -> enthaelt Wahlkreis 260 (deckungsgleich)
 *   BY: 10..12 E, 48..49 N -> enthaelt Wahlkreise 220 (West) und 221 (Ost)
 */

const rect = (x0: number, y0: number, x1: number, y1: number): number[][] => [
  [x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0],
];

export const fixtureGeo = {
  type: 'Topology',
  // ohne transform: Arcs sind absolute Koordinaten
  arcs: [
    rect(8, 48, 10, 49), // 0: BW / WK 260
    rect(10, 48, 12, 49), // 1: BY
    rect(10, 48, 11, 49), // 2: WK 220
    rect(11, 48, 12, 49), // 3: WK 221
  ],
  objects: {
    laender: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], properties: { id: 'BW', name: 'Baden-Württemberg' } },
        { type: 'Polygon', arcs: [[1]], properties: { id: 'BY', name: 'Bayern' } },
      ],
    },
    wahlkreise: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[2]], properties: { id: 220, name: 'München-West', landId: 'BY' } },
        { type: 'Polygon', arcs: [[3]], properties: { id: 221, name: 'München-Ost', landId: 'BY' } },
        { type: 'Polygon', arcs: [[0]], properties: { id: 260, name: 'Stuttgart I', landId: 'BW' } },
      ],
    },
  },
};

const bt = (second: AreaResult['second'], turnout = 82): AreaResult => ({
  electionType: 'bundestag', year: 2025, turnout, second,
});

export const fixturePeople: Person[] = [
  { id: 1001, name: 'Anna Beispiel', party: 'union', role: 'Ministerpräsidentin', profileUrl: 'https://www.abgeordnetenwatch.de/profile/anna-beispiel' },
  { id: 1002, name: 'Bernd Muster', party: 'gruene', role: 'Abgeordnete/r', profileUrl: 'https://www.abgeordnetenwatch.de/profile/bernd-muster', wahlkreisId: 220 },
  { id: 1003, name: 'Clara Probe', party: 'spd', role: 'Abgeordnete/r', profileUrl: 'https://www.abgeordnetenwatch.de/profile/clara-probe', wahlkreisId: 221 },
  { id: 1004, name: 'Dieter Test', party: 'union', role: 'Abgeordnete/r', profileUrl: 'https://www.abgeordnetenwatch.de/profile/dieter-test', wahlkreisId: 260 },
];

export const fixtureLaender: Land[] = [
  {
    id: 'BW',
    name: 'Baden-Württemberg',
    bundestag: bt([
      { party: 'union', share: 31.6 }, { party: 'afd', share: 19.8 }, { party: 'gruene', share: 13.6 },
      { party: 'spd', share: 14.2 }, { party: 'sonstige', share: 20.8 },
    ]),
    landtag: { electionType: 'landtag', year: 2021, turnout: 63.8, second: [
      { party: 'gruene', share: 32.6 }, { party: 'union', share: 24.1 }, { party: 'sonstige', share: 43.3 },
    ] },
    officials: [],
  },
  {
    id: 'BY',
    name: 'Bayern',
    // bewusst AfD vorn, damit Land- und Wahlkreisfarbe unterscheidbar sind
    bundestag: bt([
      { party: 'union', share: 30.1 }, { party: 'afd', share: 34.5 }, { party: 'spd', share: 11.6 },
      { party: 'sonstige', share: 23.8 },
    ]),
    landtag: null,
    officials: [fixturePeople[0]],
  },
];

export const fixtureWahlkreise: Wahlkreis[] = [
  {
    id: 220, name: 'München-West', landId: 'BY', turnout: 84.2,
    first: [{ party: 'gruene', share: 35.1 }, { party: 'union', share: 30.2 }, { party: 'sonstige', share: 34.7 }],
    second: [{ party: 'union', share: 28.0 }, { party: 'gruene', share: 25.0 }, { party: 'sonstige', share: 47.0 }],
    winner: { name: 'Bernd Muster', party: 'gruene', mdbId: 1002, directMandate: true, seated: true },
  },
  {
    id: 221, name: 'München-Ost', landId: 'BY', turnout: 80.1,
    first: [{ party: 'spd', share: 33.0 }, { party: 'union', share: 32.0 }, { party: 'sonstige', share: 35.0 }],
    second: [{ party: 'union', share: 30.0 }, { party: 'spd', share: 20.0 }, { party: 'sonstige', share: 50.0 }],
    winner: { name: 'Clara Probe', party: 'spd', mdbId: 1003, directMandate: true, seated: true },
  },
  {
    id: 260, name: 'Stuttgart I', landId: 'BW', turnout: 83.0,
    first: [{ party: 'union', share: 36.0 }, { party: 'gruene', share: 28.0 }, { party: 'sonstige', share: 36.0 }],
    second: [{ party: 'union', share: 29.0 }, { party: 'gruene', share: 24.0 }, { party: 'sonstige', share: 47.0 }],
    winner: { name: 'Dieter Test', party: 'union', mdbId: 1004, directMandate: true, seated: true },
  },
];

export const fixturePolls: PollSeries[] = [
  {
    areaId: 'DE',
    points: [
      { date: '2026-10-01', values: { union: 26, afd: 26, spd: 15, gruene: 11, linke: 10 } },
      { date: '2026-11-01', values: { union: 25, afd: 27, spd: 14, gruene: 12, linke: 10 } },
    ],
  },
];

export const FIXTURE_TOPICS = [
  'Wirtschaft & Steuern', 'Soziales & Rente', 'Migration & Integration',
  'Klima & Energie', 'Sicherheit & Außenpolitik', 'Bildung & Gesundheit',
];

const keyPoints = (party: string, notCoveredAt = -1): KeyPoint[] => FIXTURE_TOPICS.map((topic, i) => ({
  topic,
  text: `${party} Punkt ${i + 1} zu ${topic}.`,
  source: `${party} Programm 2025, S. ${10 + i}`,
  ...(i === notCoveredAt ? { notCovered: true } : {}),
}));

/** Drei Parteiprofile: Union (mit Vorsitz), SPD (ohne Vorsitz-Angabe), AfD (ein Thema kein Schwerpunkt). */
export const fixtureParteien: PartyProfile[] = [
  {
    id: 'union', name: 'CDU/CSU', longName: 'Christlich Demokratische Union / Christlich-Soziale Union',
    founded: 1945, chairs: [{ name: 'Erika Vorsitz', role: 'Parteivorsitzende (CDU)' }, { name: 'Max Vorstand', role: 'Parteivorsitzender (CSU)' }],
    program: { title: 'Union Programm', year: 2025 }, keyPoints: keyPoints('Union'), stand: '2026-11-20',
  },
  {
    id: 'spd', name: 'SPD', longName: 'Sozialdemokratische Partei Deutschlands',
    founded: 1863, chairs: [],
    program: { title: 'SPD Programm', year: 2025 }, keyPoints: keyPoints('SPD'), stand: '2026-11-20',
  },
  {
    id: 'afd', name: 'AfD', longName: 'Alternative für Deutschland',
    founded: 2013, chairs: [{ name: 'Otto Spitze', role: 'Bundessprecher' }],
    program: { title: 'AfD Programm', year: 2025 }, keyPoints: keyPoints('AfD', 3), stand: '2026-11-20',
  },
];

/** Hauptkandidaten: zwei im Bund, eine/r in Bayern (auch im Bund), Baden-Württemberg ohne Eintraege. */
export const fixtureKandidaten: CandidatesFile = {
  bund: [
    { name: 'Erika Vorsitz', party: 'union', role: 'Kanzlerkandidatin Bundestagswahl 2025', source: 'Union, Beschluss 2024' },
    { name: 'Jörg Überall', party: 'spd', role: 'Kanzlerkandidat Bundestagswahl 2025', note: 'Bundesliste', source: 'SPD, Parteitag 2025' },
  ],
  laender: {
    BY: [
      { name: 'Jörg Überall', party: 'spd', role: 'Spitzenkandidat Landtagswahl 2023', source: 'SPD Bayern, Liste 2023' },
      { name: 'Grete Straße', party: 'afd', role: 'Spitzenkandidatin Landtagswahl 2023', source: 'Landeswahlleiter Bayern 2023' },
    ],
    BW: [],
  },
  stand: '2026-11-21',
};

export const fixtureData: AppData = {
  geo: fixtureGeo,
  wahlkreise: fixtureWahlkreise,
  laender: fixtureLaender,
  bund: bt([
    { party: 'union', share: 28.5 }, { party: 'afd', share: 20.8 }, { party: 'spd', share: 16.4 },
    { party: 'sonstige', share: 34.3 },
  ], 82.5),
  people: fixturePeople,
  polls: fixturePolls,
  meta: { stand: { election: '2025-02-23', people: '2026-11-21', polls: '2026-11-21' } },
  parteien: fixtureParteien,
  kandidaten: fixtureKandidaten,
};

const vote = (pollId: number, date: string, answer: Vote['answer']): Vote => ({
  pollId, title: `Abstimmung ${pollId}`, date, answer,
  url: `https://www.abgeordnetenwatch.de/bundestag/21/abstimmungen/${pollId}`,
});

/** Abstimmungen eines Abgeordneten, bewusst nicht nach Datum sortiert. */
export const fixtureVotes: Vote[] = [
  vote(2, '2026-10-01', 'yes'),
  vote(6, '2026-11-13', 'yes'),
  vote(1, '2026-09-10', 'no'),
  vote(4, '2026-10-30', 'abstain'),
  vote(3, '2026-10-15', 'absent'),
  vote(5, '2026-11-06', 'no'),
];
