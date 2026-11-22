// Helper for public/data/meta.json: { stand: { election, people, polls } } (ISO dates).
// Who sets what: elections.mjs -> election (day it produced election data); people.mjs / votes.mjs -> people,
// but only when their output actually changed (contentHash before/after); polls.mjs -> polls (newest poll date).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const META_FILE = fileURLToPath(new URL('../../public/data/meta.json', import.meta.url));

export const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Merge `patch` into meta.stand. A missing meta.json is created with today's date for all
 * three kinds. Written without BOM via .part + rename.
 */
export function updateMeta(patch, file = META_FILE) {
  const t = todayIso();
  let stand = { election: t, people: t, polls: t };
  if (existsSync(file)) stand = { ...stand, ...JSON.parse(readFileSync(file, 'utf8')).stand };
  stand = { ...stand, ...patch };
  const meta = { stand: { election: stand.election, people: stand.people, polls: stand.polls } };
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.part`;
  writeFileSync(tmp, JSON.stringify(meta, null, 2) + '\n');
  renameSync(tmp, file);
  return meta;
}

/**
 * sha256 over the given files and directories (directory entries sorted by name; name + content each).
 * Missing paths count as empty, so "nothing there yet" differs from any written content.
 */
export function contentHash(paths) {
  const h = createHash('sha256');
  const add = (p, name) => {
    h.update(`\0${name}\0`);
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) add(join(p, f), `${name}/${f}`);
    } else {
      h.update(readFileSync(p));
    }
  };
  for (const p of paths) add(p, p);
  return h.digest('hex');
}

/**
 * Set meta.stand[kind] = `date` only if the content hash changed (`before` !== `after`).
 * Returns true if meta.json was updated; unchanged data leaves meta.json untouched.
 */
export function bumpStandIfChanged(kind, before, after, { file = META_FILE, date = todayIso() } = {}) {
  if (before === after) return false;
  updateMeta({ [kind]: date }, file);
  return true;
}
