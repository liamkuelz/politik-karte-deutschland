// Ordered pipeline steps of `npm run build:data`.
// Order matters: elections.mjs resets winner.mdbId/seated and officials, so people.mjs must run after it
// (people.mjs alone recomputes them from the existing JSON); votes.mjs needs people.json; polls.mjs runs last.
export const STEPS = ['geo', 'elections', 'people', 'votes', 'polls'].map((name) => ({
  name,
  script: `scripts/${name}.mjs`,
}));

/** Cache directories (under scripts/.cache) that `--fresh` deletes; the API cache has no expiry. */
export const FRESH_CACHE_DIRS = ['people', 'votes'];

/**
 * Steps selected by `--only a,b` (comma-separated names), always in the canonical order.
 * Without a list: all steps. Unknown or empty names throw.
 */
export function selectSteps(only) {
  if (only === undefined) return STEPS;
  const names = String(only).split(',').map((s) => s.trim()).filter(Boolean);
  const valid = STEPS.map((s) => s.name);
  const unknown = names.filter((n) => !valid.includes(n));
  if (!names.length || unknown.length) {
    throw new Error(`--only: unknown step(s) "${unknown.join(',') || only}"; valid: ${valid.join(', ')}`);
  }
  return STEPS.filter((s) => names.includes(s.name));
}
