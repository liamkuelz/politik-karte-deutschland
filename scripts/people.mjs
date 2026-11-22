// Politician pipeline -> public/data/people.json, plus winner.mdbId in wahlkreise.json and officials in laender.json
// Usage: node scripts/people.mjs   (read-modify-write of wahlkreise.json/laender.json: recomputes winner.mdbId,
// winner.seated and officials from scratch, so it works with or without scripts/elections.mjs run before it)
// Sources / licences: see scripts/SOURCES.md. Downloaded files are only parsed as data, never executed.
//
// ID SCHEME: Person.id = Abgeordnetenwatch *politician* id (https://www.abgeordnetenwatch.de/api/v2/politicians/<id>).
// It is stable across Wahlperioden; the votes API (`votes?mandate=<mandate id>`) needs the *mandate* id, which is
// not stored in Person - Task 5 re-derives it via `candidacies-mandates?parliament_period=161&politician=<id>`.
//  - Bundestag members: Wahlperiode 21 = Abgeordnetenwatch parliament-period 161 ("Bundestag 2025 - 2029"), type=mandate.
//  - Winner.mdbId: politician id of the direct-mandate winner. Where the winner holds a seat it is a member of
//    people.json; the 23 Wahlkreissieger without a seat (Zweitstimmendeckung) and winners who left the Bundestag
//    are looked up among the 2025 candidacies (period 160) and are NOT in people.json.
//  - Winner.seated: true only if mdbId is a current member in people.json. winner.directMandate (seat won in
//    2025) is written by elections.mjs and left untouched here.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeParty } from '../src/parties.ts';
import { createApi } from './lib/aw-api.mjs';
import { bumpStandIfChanged, contentHash } from './lib/meta.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(root, 'scripts', '.cache', 'people');
const outDir = join(root, 'public', 'data');

const PERIOD_BT = 161; // Bundestag 2025 - 2029
const PERIOD_BT_ELECTION = 160; // Bundestag Wahl 2025 (candidacies)

const { fetchAll, api } = createApi(cache);

const clean = (s) => s.replace(/­/g, '').trim();
const constituencyNo = (c) => {
  const m = c && clean(c.label).match(/^(\d{1,3}) - /);
  return m ? Number(m[1]) : null;
};
const currentFraction = (m) =>
  (m.fraction_membership ?? []).filter((f) => !f.valid_until).map((f) => clean(f.fraction.label).replace(/\s*\(.*\)$/, ''))[0];

/** lowercase, no diacritics/titles/punctuation -> name tokens */
function tokens(name) {
  return clean(name)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(dr|prof|h\s?c|mult|med|jur|ing|dipl|mdb)\b\.?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
const sameName = (a, b) => {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return false;
  return x.join(' ') === y.join(' ') || (x[0] === y[0] && x[x.length - 1] === y[y.length - 1]);
};
const lastNameOnly = (a, b) => {
  const x = tokens(a), y = tokens(b);
  return x.length > 0 && y.length > 0 && x[x.length - 1] === y[y.length - 1];
};
/** same first name, family names differ by at most one letter (the Bundeswahlleiterin XML has e.g. "Stegeman") */
const nearName = (a, b) => {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length || x[0] !== y[0]) return false;
  const p = x[x.length - 1], q = y[y.length - 1];
  if (Math.abs(p.length - q.length) > 1) return false;
  let i = 0;
  while (i < p.length && i < q.length && p[i] === q[i]) i++;
  const rest = (s, k) => s.slice(k);
  return rest(p, i + 1) === rest(q, i) || rest(p, i) === rest(q, i + 1) || rest(p, i + 1) === rest(q, i + 1);
};

// ---------------------------------------------------------------- Bundestag members
const mandates = await fetchAll(`candidacies-mandates?parliament_period=${PERIOD_BT}&type=mandate`, 'mandates-161');
if (mandates.length < 600) throw new Error(`Only ${mandates.length} Bundestag mandates fetched`);

const people = [];
const seen = new Set();
for (const m of mandates) {
  const pol = m.politician;
  if (seen.has(pol.id)) throw new Error(`Duplicate politician ${pol.id}`);
  seen.add(pol.id);
  const fraction = currentFraction(m);
  let party;
  if (!fraction || /fraktionslos/i.test(fraction)) {
    // Fraktion-less: use the party on the politician profile (cached), unknown -> sonstige
    const prof = await api(`politicians/${pol.id}`, `politician-${pol.id}`);
    party = normalizeParty(clean(prof.data.party?.label ?? ''));
  } else {
    party = normalizeParty(fraction);
  }
  const person = { id: pol.id, name: clean(pol.label), party, role: 'Abgeordnete/r', profileUrl: pol.abgeordnetenwatch_url };
  // Direktmandat only (list members also carry the Wahlkreis they ran in)
  const wk = m.electoral_data?.mandate_won === 'constituency' ? constituencyNo(m.electoral_data.constituency) : null;
  if (wk !== null) person.wahlkreisId = wk;
  people.push(person);
}
people.sort((a, b) => a.id - b.id);

// ---------------------------------------------------------------- winner.mdbId
const wahlkreise = JSON.parse(readFileSync(join(outDir, 'wahlkreise.json'), 'utf8'));
const candidacies = await fetchAll(`candidacies-mandates?parliament_period=${PERIOD_BT_ELECTION}&type=candidacy`, 'candidacies-160');

const sitting = new Map(people.filter((p) => p.wahlkreisId !== undefined).map((p) => [p.wahlkreisId, p]));
const candByWk = new Map();
for (const c of candidacies) {
  const n = constituencyNo(c.electoral_data?.constituency);
  if (n === null) continue;
  if (!candByWk.has(n)) candByWk.set(n, []);
  candByWk.get(n).push({ id: c.politician.id, name: clean(c.politician.label) });
}

let bySitting = 0, byCandidacy = 0;
const unmatched = [];
const memberIds = new Set(people.map((p) => p.id));
for (const w of wahlkreise) {
  if (typeof w.winner.directMandate !== 'boolean') {
    throw new Error(`wahlkreise.json ${w.id}: winner.directMandate missing - run scripts/elections.mjs once`);
  }
  const name = w.winner.name;
  let id = null;
  const s = sitting.get(w.id);
  if (s && sameName(s.name, name)) { id = s.id; bySitting++; }
  if (id === null) {
    const cands = candByWk.get(w.id) ?? [];
    const exact = cands.filter((c) => sameName(c.name, name));
    let loose = exact.length ? exact : cands.filter((c) => lastNameOnly(c.name, name));
    if (!loose.length) loose = cands.filter((c) => nearName(c.name, name));
    if (loose.length === 1) { id = loose[0].id; byCandidacy++; }
  }
  w.winner.mdbId = id;
  w.winner.seated = id !== null && memberIds.has(id);
  if (id === null) unmatched.push(`${w.id} ${w.name}: ${name}`);
}

// ---------------------------------------------------------------- Landes-Amtstraeger
const { officials: handOfficials } = JSON.parse(readFileSync(join(root, 'scripts', 'officials.json'), 'utf8'));
const laender = JSON.parse(readFileSync(join(outDir, 'laender.json'), 'utf8'));
for (const l of laender) l.officials = [];
for (const o of handOfficials) {
  if (!o.source || !o.note) throw new Error(`officials.json: ${o.name} needs source + note`);
  const land = laender.find((l) => l.id === o.land);
  if (!land) throw new Error(`officials.json: unknown Land ${o.land}`);
  const hits = (await api(`politicians?label=${encodeURIComponent(o.name)}`, `official-${o.land}-${tokens(o.name).join('-')}`)).data
    .filter((p) => clean(p.label) === o.name);
  const byParty = hits.filter((p) => normalizeParty(clean(p.party?.label ?? '')) === o.party);
  const pick = hits.length === 1 ? hits[0] : byParty.length === 1 ? byParty[0] : null;
  if (!pick) throw new Error(`officials.json: cannot resolve ${o.name} (${hits.length} hits) - add an explicit "id"/"profileUrl"`);
  land.officials.push({
    id: o.id ?? pick.id,
    name: o.name,
    party: o.party,
    role: o.role,
    profileUrl: o.profileUrl ?? pick.abgeordnetenwatch_url,
  });
}
const missing = laender.filter((l) => l.officials.length === 0).map((l) => l.id);
if (missing.length) throw new Error(`Laender without officials: ${missing.join(',')}`);

const outputs = ['people.json', 'wahlkreise.json', 'laender.json'].map((f) => join(outDir, f));
const before = contentHash(outputs);
const write = (f, data) => writeFileSync(join(outDir, f), JSON.stringify(data, null, 1) + '\n', 'utf8');
write('people.json', people);
write('wahlkreise.json', wahlkreise);
write('laender.json', laender);
// meta.stand.people moves only when the written person data actually changed
if (bumpStandIfChanged('people', before, contentHash(outputs))) console.log('meta.json: stand.people updated');
console.log(
  `people=${people.length} direct=${people.filter((p) => p.wahlkreisId !== undefined).length} ` +
    `winner.mdbId: ${bySitting} via sitting MdB + ${byCandidacy} via 2025 candidacy, ${unmatched.length} unmatched; ` +
    `winners without seat: ${wahlkreise.filter((w) => !w.winner.seated).length}; ` +
    `officials=${laender.reduce((n, l) => n + l.officials.length, 0)}`,
);
for (const u of unmatched) console.log('  unmatched', u);
