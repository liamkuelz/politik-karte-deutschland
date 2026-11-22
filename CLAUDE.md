# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, dark, interactive map of German politics (Bund → Länder → the 299 Bundestagswahlkreise), built with
Vite + TypeScript + D3. It is a neutral explorer: no voting recommendation, no evaluation of parties. It has
**no outbound links of any kind** (no `<a href>` to other sites, no `target=_blank`) and **no photos** (people
are shown with initials on a party-coloured circle) — both are deliberate product constraints, not omissions.
All content is either generated data (`public/data/*.json`, produced by Node scripts) or hand-maintained content
(party profiles, main candidates) with evidence files for every claim.

Design and plan documents (read before changing behaviour, not just code) live in
`docs/superpowers/specs/` and `docs/superpowers/plans/`. `README.md` has the user-facing explanation of data
sources, licences, known data limitations, and the publishing workflow — keep it in sync with real behaviour.

## Commands

Node >= 24 is required (scripts import `.ts` files directly via Node's type stripping — see Architecture).
On Windows PowerShell, `npm` may be blocked by the execution policy; use `npm.cmd` / `npx.cmd` instead, or run
from `cmd.exe`.

```
npm ci                                       # install
npm run dev                                  # dev server (Vite)
npm test                                     # full Vitest suite
npm test -- tests/map.test.ts                # a single test file
npx vitest run tests/map.test.ts -t "name"   # a single test by name
npx tsc --noEmit                             # type-check only
npm run build                                # type-check + production build to dist/
npm run smoke                                # checks dist/ after a build (see below)
npm run smoke -- --build                     # build then smoke-check in one step
```

Data pipeline (`scripts/*.mjs`, writes `public/data/*.json`):

```
npm run build:data                               # all steps, in order
npm run build:data -- --fresh                    # also clear the people/votes API caches first
npm run build:data -- --dry-run                  # print the steps without running them
npm run build:data -- --only people,votes,polls  # run only these steps (still in canonical order)
```

Steps are `geo`, `elections`, `people`, `votes`, `polls` (`scripts/lib/build-steps.mjs`), always run in that
order regardless of `--only`. `geo`/`elections` are run by hand only (they depend on live Wikipedia and
one-off official downloads); the daily CI job runs `--only people,votes,polls`. `people.mjs` recomputes
`winner.mdbId`/`winner.seated` and `Land.officials` from the existing JSON, so it works correctly even without
`elections.mjs` running first in the same invocation. A failing step aborts the whole run rather than writing
partial data.

`npm run smoke` exists because of a real incident: tree-shaking once dropped d3's `selection.transition()` from
the production bundle, silently breaking every animation while unit tests stayed green. It checks the built
`dist/` for the d3-transition patch, the data fetch path, and the absence of third-party hosts (no CDN fonts/
external links) in the HTML/CSS. Don't remove the `import 'd3-transition'` side-effect import in `src/map.ts`.

For a sub-path deployment (e.g. GitHub Pages project site) set `VITE_BASE`, e.g. `VITE_BASE=/politik-karte/ npm run build`. The `deploy.yml` workflow always uses `/<repo-name>/`; a `<user>.github.io` repo or a custom domain needs `VITE_BASE: /` there.

## Architecture

### Data flow: generated vs. hand-maintained content

- **Generated** (`public/data/geo.topo.json`, `wahlkreise.json`, `laender.json`, `bund.json`, `people.json`,
  `polls.json`, `votes/<mdbId>.json`, `meta.json`): produced by `scripts/*.mjs` from public sources
  (Bundeswahlleiterin, Abgeordnetenwatch, dawum.de, German Wikipedia). `scripts/lib/aw-api.mjs` / `http.mjs`
  centralise the Abgeordnetenwatch fetch client (descriptive User-Agent — plain requests get HTTP 403 — plus
  timeout/retry). `scripts/lib/meta.mjs` updates `meta.json`'s per-data-kind "Stand" dates **only when content
  actually changed**, not on every run — don't make a script stamp "today" unconditionally again.
- **Hand-maintained** (`public/data/parteien.json` — party profiles with exactly seven key points per party, same
  topics/order for every party, each point sourced from that party's own Bundestagswahlprogramm 2025 in the
  author's own words; `public/data/kandidaten.json` — main candidates for Bund and each Land; `scripts/officials.json`
  — heads of government): edited directly, each backed by an evidence file under `scripts/sources/` (exact
  quotes/URLs for a reviewer to check). An unverifiable entry is **omitted**, never guessed. `tests/content-*.test.ts`
  and `tests/content-integrity.test.ts` enforce the shape and cross-references (e.g. every winner's `mdbId` that
  claims a seat must resolve in `people.json`).
- `scripts/SOURCES.md` is the canonical list of sources/licences; the in-app footer (`src/footer.ts`) must match
  it, as plain text (no links — see "No outbound links" below).

### Front-end: one render funnel driven by NavState

`src/nav.ts` defines `NavState { level: 'de'|'land'|'wk', landId?, wkId?, details, card? }` and the URL hash
codec (`parseHash`/`formatHash`), canonical order `<land>/<wk>/details/<partei|person>/<id>`. `src/validate.ts`
drops anything the loaded data can't actually resolve (unknown Land, Wahlkreis not in that Land, a card whose
party/person doesn't exist) while keeping the rest of the state — never trust the hash as fact. `src/app.ts`
(`startApp`) is the single place that: loads data (`src/data.ts: loadAll`), owns `history.pushState`/`popstate`
handling with a "same view vs. same state" distinction (opening/closing an overlay card doesn't replay the
panel's enter animation or steal focus — see `sameView`/`sameState` in `src/validate.ts`), and funnels every
state change through one `render()` that updates the map, panel, crumbs, dashboard, legend and the overlay
card. Any error anywhere in that funnel surfaces as a visible error box with a retry button — never a blank
page (see `guard`/`fail` in `src/app.ts`); keep that invariant when touching rendering code.

- `src/map.ts` — the D3/SVG map (zoom/pan between Bund → Land → Wahlkreis, colouring by strongest party).
- `src/panel.ts` / `src/dashboard.ts` — the two main content views (inline panel vs. full "Details" view).
- `src/cards.ts` — overlay dialogs for a party profile or a person, opened via `NavState.card`.
- `src/legend.ts`, `src/footer.ts`, `src/leads.ts` (main-candidate lists) — smaller, focused render modules.
- `src/ui/*` — shared, mostly pure rendering helpers (`bars.ts`, `tiles.ts`, `people.ts`, `sparkline.ts`,
  `clickables.ts` for the party/person buttons that open cards, `dom.ts`, `format.ts`, `table.ts`, `votes.ts`).
- `src/content.ts` — lookup helpers bridging the three "is this a person" id spaces: a numeric `people.json`
  id, a numeric `Land.officials[].id`, or a synthetic `c-<slug>` key (`candidateKey`) for a main candidate with
  no other id. `findPerson`/`findCandidate`/`findParty` are the only places that should need to know this.

### No outbound links, no photos

These are enforced, not just conventions: `tests/no-external-links.test.ts` renders every view (panel,
dashboard, cards, footer, legend) and asserts there is no `a[href]` and nothing with `target=_blank`; there is
also a source-level grep test against patterns like `window.open`/`.href =`. If a future change needs to show a
citation or a source address, render it as plain text (as the footer already does: source name + licence +
address as copyable text), never as a clickable link. `src/ui/dom.ts`'s `h()` helper builds elements via
`textContent`/`setAttribute` only — never use `innerHTML` with any data that ultimately comes from scraped or
hand-entered external content (names, vote titles, programme text).

### Erasable TypeScript syntax (Node scripts import `src/` directly)

`scripts/*.mjs` import modules like `../src/parties.ts` directly, relying on Node 24's native TypeScript type
stripping — there is no separate compile step for them. Anything under `src/` that a script might import
(`types.ts`, `parties.ts`, `content-types.ts`, `content.ts`, ...) must stay erasable-TypeScript-only: no enums,
no namespaces, no parameter-property constructor shorthand, and relative imports must keep the explicit `.ts`
extension (`vite.config.ts`'s `allowImportingTsExtensions` plus `erasableSyntaxOnly` in `tsconfig.json` is what
makes this consistent between the app build and the Node scripts).

### No UTF-8 BOM

`tests/no-bom.test.ts` fails the build if any tracked source/config/data file starts with a BOM (a recurring
problem from PowerShell's default `Set-Content -Encoding utf8` / `Out-File`). When writing files from a shell on
Windows, use `[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))` or an
editor/tool that defaults to BOM-less UTF-8.

### CI (`.github/workflows/`)

`deploy.yml` runs on every push to `main`: test → build (with `VITE_BASE=/<repo>/`) → smoke → publish to GitHub
Pages. `update-data.yml` runs daily (`--only people,votes,polls --fresh`), runs the test suite, and only commits
`public/data/` if something actually changed; because it uses the default `GITHUB_TOKEN`, its commit would not
itself trigger `deploy.yml`, so it explicitly dispatches that workflow afterwards. Both jobs have per-step
timeouts and the HTTP client retries transient failures — a data-pipeline test or threshold should stay robust
to normal data drift (e.g. member counts, vote-file sizes) so this job doesn't start failing on a routine day.
