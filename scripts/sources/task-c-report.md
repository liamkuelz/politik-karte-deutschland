# Task C report: Datenmodell, Navigation, Karten

Status: DONE_WITH_CONCERNS (only concern: the real content files were still missing when this was written, see "Open")

## Commits
- db45765 feat: card state in navigation, content lookup and loading
- 3b83834 feat: party and person cards as overlay, card trigger buttons
- edb923f feat: render cards in the app funnel with history support
- 069a1df fix: card accents use the visible party ink (Union light grey)

## What was built
- `src/nav.ts`: `Card { kind: 'party' | 'person'; id }`, `NavState.card?`, `PARTY_IDS`, `isCardId()`.
  **Canonical hash order:** level segments, then optional `details`, then optional card as the LAST pair:
  `#/partei/union`, `#/person/123`, `#/by/partei/spd`, `#/by/219/person/c-joerg-ueberall`, `#/by/219/details/partei/union`.
  A card with a bad format (unknown PartyId, bad person id) is **dropped and the rest of the state kept**.
  A bad level part still gives `de` without a card (same as before). `formatHash` leaves out malformed cards.
- `src/content.ts`: `slugify`, `candidateKey(c)` = `c-<slug>` (lowercase; ä→ae, ö→oe, ü→ue, ß→ss; other accents removed;
  every run of non-[a-z0-9] → `-`; no dashes at the ends). Example: "Jörg Überall" → `c-joerg-ueberall`.
  `findCandidate(data, key, preferLand?)` (picks the given Land's list first, then the federal list, then the first Land),
  `findPerson(data, id)` (people.json = MdB plus offices from `Land.officials`, which do have numeric `id`s; officials-only
  persons found too; returns wk/land context), `findParty`.
  Person card ids are digits (max 12) or `c-...` keys.
- `src/data.ts`: `AppData.parteien`, `AppData.kandidaten`; `loadAll` fetches `parteien.json`, `kandidaten.json` with the same
  error messages ("Datei kandidaten.json konnte nicht geladen werden (HTTP 404)").
- `src/validate.ts`: `cardExists`; `validateState` drops cards with unknown targets (party without profile, unknown person/key),
  keeps the rest; `sameView` (no card) and `sameState` (with card), `sameCard`.
- `src/cards.ts` `renderCard(el, state, data, onNavigate)`: overlay in `#card-root` (added to index.html), backdrop
  (click closes), centred glass card max 560 px, bottom sheet under 900 px, `role=dialog aria-modal aria-labelledby`,
  "Schließen" (`data-action="close-card"`), Escape, focus trap, focus to the heading on open, back to the remembered
  `[data-card-trigger]` element on close (also when closed by history Back), fade/scale 200 ms only on opening (not on
  card-to-card switches), none under prefers-reduced-motion.
  - Party card: party colour accent bar (Union dark with light edge), name (CSU in BY), longName, facts (Gegründet,
    Vorsitz only if chairs non-empty, Wahlprogramm title (year)), result block ("Ergebnis in {Land}" with Bundestag and
    Landtag share, "–" if not listed; "Ergebnis bundesweit" at level de), 6 key points (topic small caps, text,
    "Quelle: …" muted; notCovered → "Kein Schwerpunkt im Programm" badge), neutral note, "Stand dd.mm.yyyy".
  - Person card: initials avatar, name, party as `partyButton` (only if the party has a profile, else plain text),
    Land/"Bund" context, roles (MdB: "Mitglied des Bundestages" + "Wahlkreis N · Name", plus offices from laender.json;
    officials: role; candidates: role + note + "Quelle: …"). Votes only for MdB via `loadVotes` with a render token; the
    fill looks up `.card-votes` in the root at resolve time, so the token check is what protects a newer card (tested).
    Vote lists use `fillVoteList(box, votes, { links: false })`; I added that optional flag to `src/ui/tiles.ts` /
    `renderVoteRow(v, { link: false })` in `src/ui/votes.ts` (defaults unchanged; Task D can delete it with extLink).
- `src/ui/clickables.ts`: `partyButton`, `personButton` (button, `link-btn`, `data-card-trigger`, `aria-haspopup=dialog`,
  `data-party`/`data-person`, optional extra class). Click does `stopPropagation` so a button inside a clickable table row
  only opens the card. CSS: `.link-btn[data-card-trigger]` inherits font/colour, underline on hover/focus, existing focus ring.
- `src/app.ts`: `renderCard` in the render funnel. When only the card changes, map/panel/crumbs/dashboard are NOT
  re-rendered (no panel animation, no focus theft, trigger stays in the DOM). Map, panel, dashboard and crumbs are rendered
  with the state WITHOUT card (`viewOf`), so their buttons (crumbs, map clicks, Details, ...) navigate without a card:
  **navigating via crumbs or the map closes the card** (comment + test). History: opening pushes an entry whose
  `history.state.cardDepth` counts card entries over the same view; closing such a card does `history.go(-depth)` instead
  of pushing (so Back after closing does not reopen it); a deep-linked card closes with a normal push.

## Browser check (temporary Vite on 5198, temporary placeholder JSON marked PLATZHALTER-TASK-C, both deleted)
- `#/partei/union` 1280 px: centred card over the dimmed map, facts grid, "Ergebnis bundesweit 28,5 %", key point boxes.
  The Union accent bar and key point bars were nearly invisible (party colour #1c1d21) → fixed by using `partyInk`
  (light grey) for line accents (commit 069a1df).
- `#/by/partei/spd` 1280 px: red accent, "Ergebnis in Bayern" 11,6 % / 8,4 % (Landtag 2023), looks clean.
- `#/person/28896` (Inge Gräßle): dark avatar with light edge, Union party button, Baden-Württemberg, Wahlkreis 269,
  94 votes with filter chips, 0 links; focus on heading; Escape closed it and the hash went back to "".
- 400 px: bottom sheet over the full width with rounded top; party and person cards readable. (One capture taken during
  the 200 ms entrance animation showed the panel through the card; the settled state is opaque.)
- Dev server stopped; nothing listens on 5198, no node process with 5198 left. `.claude/launch.json` (ignored) removed.
- Side note: a first deep-link reload kept stale JSON once (placeholder was rewritten while the page was open); later reloads fine.

## Tests
- `tsc --noEmit` clean, `npm run build` ok.
- `npm test`: 23 files / 220 tests pass. 2 suites fail only because the content data does not exist yet:
  `tests/content-parteien.test.ts`, `tests/content-kandidaten.test.ts` (ENOENT on public/data/*.json; other agents' files).
- New/extended: nav (round trips with cards, malformed cards), content (transliteration, findCandidate/findPerson),
  validate (keep/drop cards, officials count as persons, sameState/sameView), data (9 files, missing content file named),
  cards (20 tests incl. stale votes, focus, trap, close paths, no links, text-only), clickables, app (deep link, unknown
  card dropped, open/Back without re-rendering panel + focus back, close → history.go, crumbs/map close the card,
  Details after closing has no card).

## Open
- Until `public/data/parteien.json` and `kandidaten.json` exist, the real app fails to load (error box naming the file).
- Nothing opens cards in the UI yet except deep links and the party button inside the person card (Task D).
- Candidate cards do not link to an MdB entry of the same person; Task D may pass the MdB id to `personButton` instead
  of the candidate key when a person is both.
