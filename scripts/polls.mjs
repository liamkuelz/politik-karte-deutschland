// Polls pipeline: dawum.de API -> public/data/polls.json (PollSeries[]) and meta.json stand.polls.
// Source: https://api.dawum.de/ (dawum.de, ODC-ODbL). Cached under scripts/.cache/polls/ (.part + rename).
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeParty } from '../src/parties.ts';
import { fetchText } from './lib/http.mjs';
import { averageInstitutes, WINDOW_DAYS } from './lib/poll-merge.mjs';
import { todayIso, updateMeta } from './lib/meta.mjs';

const URL_API = 'https://api.dawum.de/';
const UA = 'politik-karte-datenskript/1.0 (static data pipeline; non-commercial)';
const CACHE_DIR = fileURLToPath(new URL('./.cache/polls/', import.meta.url));
const CACHE_FILE = `${CACHE_DIR}dawum.json`;
const CACHE_MAX_AGE_MS = 6 * 3600 * 1000; // polls change daily, unlike the AW cache
const OUT = fileURLToPath(new URL('../public/data/polls.json', import.meta.url));

// dawum parliament Shortcut -> areaId (Bundestag = DE, Landtage = Laenderkuerzel of laender.json); EU etc. ignored
const AREA = {
  Bundestag: 'DE',
  'Baden-Württemberg': 'BW',
  Bayern: 'BY',
  Berlin: 'BE',
  Brandenburg: 'BB',
  Bremen: 'HB',
  Hamburg: 'HH',
  Hessen: 'HE',
  'Mecklenburg-Vorpommern': 'MV',
  Niedersachsen: 'NI',
  'Nordrhein-Westfalen (NRW)': 'NW',
  'Rheinland-Pfalz': 'RP',
  Saarland: 'SL',
  Sachsen: 'SN',
  'Sachsen-Anhalt': 'ST',
  'Schleswig-Holstein': 'SH',
  Thüringen: 'TH',
};

async function loadDawum() {
  if (existsSync(CACHE_FILE) && Date.now() - statSync(CACHE_FILE).mtimeMs < CACHE_MAX_AGE_MS) {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  }
  // 30 s timeout, bounded retries on network errors/timeouts/429/5xx (lib/http.mjs)
  const text = await fetchText(URL_API, { headers: { 'User-Agent': UA, Accept: 'application/json' }, label: 'dawum API' });
  const json = JSON.parse(text); // validates
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(`${CACHE_FILE}.part`, text);
  renameSync(`${CACHE_FILE}.part`, CACHE_FILE);
  return json;
}

/** Date `months` before an ISO date (UTC), as ISO date. */
function monthsBefore(iso, months) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** One survey's dawum results -> PartyId values. CDU+CSU listed separately are summed to union;
 *  only dawum's own "Sonstige" row becomes `sonstige` (other small parties are left out, not invented). */
function surveyValues(results, parties) {
  const values = {};
  for (const [pid, pct] of Object.entries(results)) {
    const short = parties[pid]?.Shortcut;
    if (!short) throw new Error(`Unknown dawum party id ${pid}`);
    const id = normalizeParty(short);
    if (id === 'sonstige' && short !== 'Sonstige') continue;
    values[id] = (values[id] ?? 0) + pct; // union: CDU + CSU
  }
  return values;
}

const db = await loadDawum();
const today = todayIso();
const cutoff = monthsBefore(today, 12);
// surveys up to WINDOW_DAYS before the cutoff still count for the first points of the window
const windowStart = new Date(Date.parse(`${cutoff}T00:00:00Z`) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

const perArea = new Map();
for (const s of Object.values(db.Surveys)) {
  const parl = db.Parliaments[s.Parliament_ID];
  if (!parl) throw new Error(`Unknown dawum parliament ${s.Parliament_ID}`);
  const areaId = AREA[parl.Shortcut];
  if (!areaId) continue; // Europawahl etc.
  if (s.Date < windowStart || s.Date > today) continue;
  if (!perArea.has(areaId)) perArea.set(areaId, []);
  perArea.get(areaId).push({ date: s.Date, institute: s.Institute_ID, values: surveyValues(s.Results, db.Parties) });
}

const series = [...perArea.keys()]
  .sort((a, b) => (a === 'DE' ? -1 : b === 'DE' ? 1 : a.localeCompare(b)))
  // average across institutes (each institute's latest survey within 21 days), points only inside the 12 months
  .map((areaId) => ({ areaId, points: averageInstitutes(perArea.get(areaId)).filter((pt) => pt.date >= cutoff) }))
  .filter((x) => x.points.length > 0);

if (!series.some((x) => x.areaId === 'DE')) throw new Error('No Bundestag polls in the last 12 months');

writeFileSync(`${OUT}.part`, JSON.stringify(series, null, 1) + '\n');
renameSync(`${OUT}.part`, OUT);

// meta.stand.polls = date of the newest poll in the data (not the build date), so the footer's
// stale-poll warning reflects how old the data is.
const newest = series.flatMap((x) => x.points.map((p) => p.date)).sort().at(-1);
updateMeta({ polls: newest });
const missing = Object.values(AREA).filter((a) => !series.some((x) => x.areaId === a));
console.log(`polls.json: ${series.length} areas (${series.map((x) => x.areaId).join(' ')}); newest poll ${newest}; no polls: ${missing.join(' ') || '-'}`);
