// `npm run build:data`: geo -> elections -> people -> votes -> polls (each script updates its meta.json stand).
// Flags: --fresh        delete scripts/.cache/{people,votes} first (the API cache has no expiry)
//        --only a,b,c   run only these steps (names: geo, elections, people, votes, polls), in canonical order;
//                       the daily workflow runs `--only people,votes,polls`, geo/elections are run by hand
//        --dry-run      print the steps (and deletions) in order and exit without running anything
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FRESH_CACHE_DIRS, selectSteps } from './lib/build-steps.mjs';

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const dryRun = args.includes('--dry-run');
const root = fileURLToPath(new URL('..', import.meta.url));
const cacheRoot = fileURLToPath(new URL('./.cache/', import.meta.url));

let only;
const oi = args.findIndex((a) => a === '--only' || a.startsWith('--only='));
if (oi >= 0) only = args[oi].startsWith('--only=') ? args[oi].slice('--only='.length) : (args[oi + 1] ?? '');
let steps;
try {
  steps = selectSteps(only);
} catch (e) {
  console.error(`build:data: ${e.message}`);
  process.exit(2);
}

if (fresh) {
  for (const d of FRESH_CACHE_DIRS) {
    const dir = `${cacheRoot}${d}`;
    console.log(`${dryRun ? '[dry-run] would delete' : 'deleting'} scripts/.cache/${d}`);
    if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}

for (const [i, step] of steps.entries()) {
  const label = `[${i + 1}/${steps.length}] node ${step.script}`;
  if (dryRun) {
    console.log(`[dry-run] ${label}`);
    continue;
  }
  console.log(label);
  const r = spawnSync(process.execPath, [step.script], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\nbuild:data aborted: step "${step.name}" (${step.script}) failed (${r.error?.message ?? `exit code ${r.status}`}).`);
    process.exit(1);
  }
}
// meta.json is not stamped here: elections.mjs sets stand.election, people.mjs/votes.mjs set stand.people only
// when their output changed, polls.mjs sets stand.polls to the newest poll date.
