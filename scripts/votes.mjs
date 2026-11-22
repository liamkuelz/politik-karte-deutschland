// Voting-behaviour pipeline -> public/data/votes/{politicianId}.json (Vote[], date descending)
// Usage: node scripts/votes.mjs   (run AFTER scripts/people.mjs). Sources / licences: see scripts/SOURCES.md.
// Downloaded files are only parsed as data, never executed.
//
// Scope: all Abgeordnetenwatch polls of the Bundestag period 161 (21st Wahlperiode). Abgeordnetenwatch only
// records individual votes for roll-call polls (namentliche Abstimmungen). Polls are loaded first, then each
// poll's votes once (`votes?poll=<id>`), then regrouped by politician (vote.mandate -> politician via the
// period-161 mandates list), so no request is made per Abgeordnetem.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './lib/aw-api.mjs';
import { bumpStandIfChanged, contentHash } from './lib/meta.mjs';
import { voteFileName } from './lib/vote-file.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dataDir = join(root, 'public', 'data');
const outDir = join(dataDir, 'votes');
const PERIOD_BT = 161; // Bundestag 2025 - 2029

const pollsApi = createApi(join(root, 'scripts', '.cache', 'votes'));
// the mandate list is the same request people.mjs makes: share its cache
const peopleApi = createApi(join(root, 'scripts', '.cache', 'people'));

const clean = (s) => s.replace(/­/g, '').trim();
const ANSWER = { yes: 'yes', no: 'no', abstain: 'abstain', no_show: 'absent' };

// mandate id -> politician id
const mandates = await peopleApi.fetchAll(`candidacies-mandates?parliament_period=${PERIOD_BT}&type=mandate`, 'mandates-161');
const politicianOf = new Map(mandates.map((m) => [m.id, m.politician.id]));

const polls = await pollsApi.fetchAll(`polls?field_legislature=${PERIOD_BT}`, 'polls-161');
if (polls.length < 50) throw new Error(`Only ${polls.length} polls fetched`);

const byPerson = new Map();
let voteCount = 0;
for (const poll of polls) {
  if (!poll.field_poll_date || !poll.abgeordnetenwatch_url) throw new Error(`Poll ${poll.id} lacks date/url`);
  const votes = await pollsApi.fetchAll(`votes?poll=${poll.id}`, `votes-poll-${poll.id}`);
  for (const v of votes) {
    const answer = ANSWER[v.vote];
    if (!answer) throw new Error(`Unknown vote value "${v.vote}" in vote ${v.id}`);
    let pid = politicianOf.get(v.mandate.id);
    if (pid === undefined) {
      // mandate of a member who has left the Bundestag (not in the list of current mandates): resolve individually
      const m = (await pollsApi.api(`candidacies-mandates/${v.mandate.id}`, `mandate-${v.mandate.id}`)).data;
      if (m.parliament_period?.id !== PERIOD_BT) throw new Error(`Vote ${v.id}: mandate ${m.id} is not in period ${PERIOD_BT}`);
      pid = m.politician.id;
      politicianOf.set(m.id, pid);
    }
    if (!byPerson.has(pid)) byPerson.set(pid, []);
    byPerson.get(pid).push({
      pollId: poll.id,
      title: clean(poll.label),
      date: poll.field_poll_date,
      answer,
      url: poll.abgeordnetenwatch_url,
    });
    voteCount++;
  }
}
// Only politicians the site can show: members in people.json plus Wahlkreis winners (winner.mdbId) - the latter
// includes winners who have since left the Bundestag. Other departed members' votes are not written.
const people = JSON.parse(readFileSync(join(dataDir, 'people.json'), 'utf8'));
const wahlkreise = JSON.parse(readFileSync(join(dataDir, 'wahlkreise.json'), 'utf8'));
const wanted = new Set([...people.map((p) => p.id), ...wahlkreise.map((w) => w.winner.mdbId).filter((id) => id != null)]);
const skipped = [...byPerson.keys()].filter((id) => !wanted.has(id));
for (const id of skipped) byPerson.delete(id);
if (byPerson.size < 500) throw new Error(`Votes for only ${byPerson.size} politicians`);

// every id becomes a file name: validate all of them before anything is deleted
const fileOf = new Map([...byPerson.keys()].map((pid) => [pid, voteFileName(pid)]));
const before = contentHash([outDir]);
// rewrite the output directory from scratch (stale files must not survive)
if (existsSync(outDir)) for (const f of readdirSync(outDir)) rmSync(join(outDir, f));
mkdirSync(outDir, { recursive: true });
let bytes = 0;
for (const [pid, list] of byPerson) {
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.pollId - a.pollId));
  const text = JSON.stringify(list); // minified; Vote shape is fixed
  bytes += Buffer.byteLength(text);
  writeFileSync(join(outDir, fileOf.get(pid)), text, 'utf8');
}

// meta.stand.people moves only when the vote files actually changed
if (bumpStandIfChanged('people', before, contentHash([outDir]))) console.log('meta.json: stand.people updated');

const inPeople = new Set(people.map((p) => p.id));
const extraWinnerFiles = [...byPerson.keys()].filter((id) => !inPeople.has(id)).length;
console.log(
  `polls=${polls.length} votes=${voteCount} files=${byPerson.size} (people.json: ${people.filter((p) => byPerson.has(p.id)).length}/${people.length}; ` +
    `extra winners with votes: ${extraWinnerFiles}; other departed members skipped: ${skipped.length}) bytes=${bytes}`,
);