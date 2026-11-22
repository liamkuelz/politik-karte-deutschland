// Election pipeline -> public/data/{wahlkreise,laender,bund}.json
// Usage: node scripts/elections.mjs
// Sources / licences: see scripts/SOURCES.md. Downloaded files are only parsed as data, never executed.
//  - Bundestagswahl 2025: Bundeswahlleiterin kerg2.csv (endgueltig) + gewaehlte_02.xml (names of elected direct candidates)
//  - Landtagswahlen: latest election per Land (see LANDTAG below)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeParty } from '../src/parties.ts';
import { todayIso, updateMeta } from './lib/meta.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(root, 'scripts', '.cache', 'elections');
const outDir = join(root, 'public', 'data');
mkdirSync(cache, { recursive: true });
mkdirSync(outDir, { recursive: true });

const BW = 'https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata/btw25';
const URL_KERG2 = `${BW}/csv/kerg2.csv`;
const URL_GEWAEHLTE = `${BW}/daten/gewaehlte_02.xml`;
const WIKI = 'https://de.wikipedia.org/w/index.php?action=raw&title=';

// Amtlicher Laenderschluessel -> Kuerzel (same ids as geo.topo.json)
const LAND_KEY = {
  '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH',
};

// Latest Landtagswahl per Land before 2026-11-21 (verified: nothing later held). `article` = German Wikipedia
// article whose result infobox is parsed (it quotes the amtliches Endergebnis of the Landeswahlleiter);
// `turnout` = Wahlbeteiligung in % as published by the Landeswahlleiter (checked against the same articles).
const LANDTAG = {
  BW: { year: 2026, turnout: 69.6, article: 'Landtagswahl in Baden-Württemberg 2026' },
  RP: { year: 2026, turnout: 68.4, article: 'Landtagswahl in Rheinland-Pfalz 2026' },
  ST: { year: 2026, turnout: 77.8, article: 'Landtagswahl in Sachsen-Anhalt 2026' },
  MV: { year: 2026, turnout: 78.0, article: 'Landtagswahl in Mecklenburg-Vorpommern 2026' },
  BE: { year: 2026, turnout: 74.2, article: 'Wahl zum Abgeordnetenhaus von Berlin 2026' },
  SN: { year: 2024, turnout: 74.4, article: 'Landtagswahl in Sachsen 2024' },
  TH: { year: 2024, turnout: 73.6, article: 'Landtagswahl in Thüringen 2024' },
  BB: { year: 2024, turnout: 72.9, article: 'Landtagswahl in Brandenburg 2024' },
  HB: { year: 2023, turnout: 56.9, article: 'Bürgerschaftswahl in Bremen 2023' },
  HH: { year: 2025, turnout: 67.6, article: 'Bürgerschaftswahl in Hamburg 2025' },
  HE: { year: 2023, turnout: 66.0, article: 'Landtagswahl in Hessen 2023' },
  BY: { year: 2023, turnout: 73.1, article: 'Landtagswahl in Bayern 2023' },
  NI: { year: 2022, turnout: 60.3, article: 'Landtagswahl in Niedersachsen 2022' },
  NW: { year: 2022, turnout: 55.5, article: 'Landtagswahl in Nordrhein-Westfalen 2022' },
  SH: { year: 2022, turnout: 60.3, article: 'Landtagswahl in Schleswig-Holstein 2022' },
  SL: { year: 2022, turnout: 61.4, article: 'Landtagswahl im Saarland 2022' },
};

/** Download to a temp name, rename on success. Cached on disk. */
async function download(url, file) {
  if (existsSync(file)) return;
  const res = await fetch(url, { headers: { 'User-Agent': 'politik-karte-build/0.1 (static data pipeline)' } });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = `${file}.part`;
  writeFileSync(tmp, buf);
  renameSync(tmp, file);
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const num = (s) => (s === '' || s === undefined ? null : Number(s.replace(',', '.')));

/** Sum shares per PartyId (CDU+CSU -> union, small parties -> sonstige), sorted descending. */
function collapse(entries) {
  const m = new Map();
  for (const { party, share } of entries) m.set(party, (m.get(party) ?? 0) + share);
  return [...m].map(([party, share]) => ({ party, share: round(share) })).sort((a, b) => b.share - a.share);
}

// ---------------------------------------------------------------- Bundestagswahl 2025
const kergFile = join(cache, 'kerg2.csv');
await download(URL_KERG2, kergFile);
const rows = readFileSync(kergFile, 'utf8')
  .replace(/^﻿/, '')
  .split(/\r?\n/)
  .map((l) => l.split(';'))
  .filter((c) => c[0] === 'BT')
  .map((c) => ({
    art: c[2], nr: c[3], name: c[4], gruppenart: c[7], gruppe: c[8], stimme: c[10],
    anzahl: num(c[11]), prozent: num(c[12]), gewaehlt: c[18] ?? '',
  }));

const byArea = new Map(); // "Land|01" -> rows
for (const r of rows) {
  const k = `${r.art}|${r.nr}`;
  if (!byArea.has(k)) byArea.set(k, []);
  byArea.get(k).push(r);
}

function partyShares(areaRows, stimme) {
  const list = [];
  for (const r of areaRows) {
    if (r.stimme !== stimme || r.prozent === null) continue;
    if (r.gruppenart === 'Partei') list.push({ party: normalizeParty(r.gruppe), share: r.prozent });
    else if (r.gruppenart === 'Einzelbewerber/Wählergruppe') list.push({ party: 'sonstige', share: r.prozent });
  }
  return collapse(list);
}
const turnoutOf = (areaRows) => round(areaRows.find((r) => r.gruppe === 'Wählende').prozent);

// Bund: official Bundesergebnis (not summed from Laender)
const bundRows = byArea.get('Bund|99');
const bund = {
  electionType: 'bundestag', year: 2025, turnout: turnoutOf(bundRows), second: partyShares(bundRows, '2'),
};

// Names of the directly elected candidates
const xmlFile = join(cache, 'gewaehlte_02.xml');
await download(URL_GEWAEHLTE, xmlFile);
const xml = readFileSync(xmlFile, 'utf8');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attr = (s, a) => { const m = s.match(new RegExp(`\\s${a}="([^"]*)"`)); return m ? decode(m[1]) : ''; };
const directNames = new Map(); // wahlkreis nr -> "Vorname Nachname"
for (const block of xml.split('<Kandidat>').slice(1)) {
  const d = block.match(/<Direkt [^>]*Gebietsnummer="(\d+)"/);
  if (!d || !/Gewaehlt="E"/.test(block)) continue;
  const p = block.match(/<Personendaten [^>]*>/)[0];
  const first = attr(p, 'Rufname') || attr(p, 'Vorname');
  directNames.set(Number(d[1]), `${first} ${attr(p, 'Name')}`.trim());
}

// The 23 Wahlkreissieger without a Bundestag seat (Zweitstimmendeckung) are not in gewaehlte_02.xml and the
// Bundeswahlleiterin publishes only their party; their names come from Wikipedia ("Bundestagswahl 2025", table of
// Wahlkreissieger ohne Mandat), cross-checked against the official Erststimmen share.
const wikiFile = join(cache, 'wiki-Bundestagswahl_2025.txt');
await download(WIKI + encodeURIComponent('Bundestagswahl_2025'), wikiFile);
const wikiLines = readFileSync(wikiFile, 'utf8').split('\n');
const wikiNames = new Map(); // nr -> { name, share }
{
  let lastNum = null;
  let lastIdx = -99;
  for (let i = 0; i < wikiLines.length; i++) {
    const l = wikiLines[i];
    const n = l.match(/style="text-align:right;?"\s*\|\s*(\d{1,3})\s*$/);
    if (n) { lastNum = Number(n[1]); lastIdx = i; continue; }
    const p = l.match(/\{\{PersonZelle\|([^|}]+)\|([^|}]+)/);
    if (p && lastNum !== null && i - lastIdx <= 4 && !wikiNames.has(lastNum)) {
      const sh = l.match(/text-align:right"?\s*\|\s*(\d+,\d)/) ?? (wikiLines[i + 1] ?? '').match(/text-align:right"?\s*\|\s*(\d+,\d)/);
      wikiNames.set(lastNum, { name: `${p[1].trim()} ${p[2].trim()}`, share: sh ? num(sh[1]) : null });
      lastNum = null;
    }
  }
}

const geo = JSON.parse(readFileSync(join(outDir, 'geo.topo.json'), 'utf8'));
const landNames = Object.fromEntries(geo.objects.laender.geometries.map((g) => [g.properties.id, g.properties.name]));
const wkMeta = geo.objects.wahlkreise.geometries.map((g) => g.properties);
if (wkMeta.length !== 299) throw new Error(`geo has ${wkMeta.length} Wahlkreise`);

const wahlkreise = wkMeta
  .map((m) => {
    const areaRows = byArea.get(`Wahlkreis|${String(m.id).padStart(3, '0')}`);
    if (!areaRows) throw new Error(`No kerg2 rows for Wahlkreis ${m.id}`);
    // winner = highest Erststimmen count
    let best = null;
    for (const r of areaRows) {
      if (r.stimme !== '1' || r.anzahl === null) continue;
      if (r.gruppenart !== 'Partei' && r.gruppenart !== 'Einzelbewerber/Wählergruppe') continue;
      if (!best || r.anzahl > best.anzahl) best = r;
    }
    const party = best.gruppenart === 'Partei' ? normalizeParty(best.gruppe) : 'sonstige';
    const official = best.gewaehlt;
    if (official && official !== '–' && normalizeParty(official) !== party) {
      throw new Error(`Wahlkreis ${m.id}: Erststimmen leader ${best.gruppe} != official winner ${official}`);
    }
    let name = directNames.get(m.id);
    if (!name) {
      const w = wikiNames.get(m.id);
      const bestShare = round(best.prozent, 1);
      if (!w || (w.share !== null && Math.abs(w.share - bestShare) > 0.06)) {
        throw new Error(`Wahlkreis ${m.id}: no verified winner name (wiki: ${JSON.stringify(w)}, official share ${bestShare})`);
      }
      name = w.name;
    }
    return {
      id: m.id,
      name: m.name,
      landId: m.landId,
      turnout: turnoutOf(areaRows),
      first: partyShares(areaRows, '1'),
      second: partyShares(areaRows, '2'),
      // directMandate: in gewaehlte_02.xml (seat won). mdbId/seated are filled by people.mjs.
      winner: { name, party, mdbId: null, directMandate: directNames.has(m.id), seated: false },
    };
  })
  .sort((a, b) => a.id - b.id);

// Laender: Bundestagswahl 2025 Zweitstimmen + latest Landtagswahl
function parseInfobox(text) {
  const start = text.indexOf('{{Wahldiagramm');
  if (start < 0) throw new Error('no Wahldiagramm infobox');
  const box = text.slice(start, text.indexOf('\n}}', start));
  const out = [];
  for (const m of box.matchAll(/\|\s*PARTEI(\d+)\s*=\s*([^\n]*)\n\|\s*ERGEBNIS(?:NEU)?\1\s*=\s*([\d.,]+)/g)) {
    const raw = m[2].trim();
    const label = /^(fw|bvb\/fw)/i.test(raw) ? 'Freie Wähler' : raw;
    out.push({ party: normalizeParty(label), share: Number(m[3].replace(',', '.')) });
  }
  return out;
}

const laender = [];
for (const [key, id] of Object.entries(LAND_KEY)) {
  const lr = byArea.get(`Land|${key}`);
  if (!lr) throw new Error(`No kerg2 rows for Land ${id}`);
  const meta = LANDTAG[id];
  let landtag = null;
  if (meta) {
    const f = join(cache, `wiki-landtag-${id}.txt`);
    await download(WIKI + encodeURIComponent(meta.article.replaceAll(' ', '_')), f);
    const second = collapse(parseInfobox(readFileSync(f, 'utf8')));
    landtag = { electionType: 'landtag', year: meta.year, turnout: meta.turnout, second };
  }
  laender.push({
    id,
    name: landNames[id],
    bundestag: { electionType: 'bundestag', year: 2025, turnout: turnoutOf(lr), second: partyShares(lr, '2') },
    landtag,
    officials: [], // filled by Task 4
  });
}
laender.sort((a, b) => a.id.localeCompare(b.id));

const write = (f, data) => writeFileSync(join(outDir, f), JSON.stringify(data, null, 1) + '\n', 'utf8');
write('wahlkreise.json', wahlkreise);
write('laender.json', laender);
write('bund.json', bund);
// meta.stand.election = the day this script produced the election data (it only runs when started by hand)
updateMeta({ election: todayIso() });
console.log(
  `wahlkreise=${wahlkreise.length} laender=${laender.length} landtag=${laender.filter((l) => l.landtag).length} ` +
    `wiki-named winners=${wahlkreise.filter((w) => !directNames.has(w.id)).length}`,
);
