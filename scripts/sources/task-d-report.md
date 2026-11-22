# Task D report: clickable everywhere, Hauptkandidaten, no outbound links

Status: DONE_WITH_CONCERNS (minor, see "Open / decided differently")

## Commits
- b26e439 feat: no outbound links; sources and licences as text with addresses
- fd71769 feat: parties and persons clickable everywhere, Hauptkandidaten for Bund and Laender
- 9c7f42f test: link audit over all views and source, content integrity of real data
- 635b4ee docs: persons, parties, candidates; no outbound links; content sources

Note: b26e439 on its own does not type-check (`src/ui/people.ts` still imported `extLink` until fd71769). The tip is green.

## What changed, per item
1. **Parties clickable.** `src/ui/clickables.ts` gained `CardContext` (`state`, `onNavigate`, set of parties with a
   profile), `cardContext()`, `partyName()` and `personName()` (button when context and target exist, otherwise a
   plain `span`, so no dead buttons; e.g. "Sonstige" stays text). Optional `ctx` parameter added to `renderBars`
   (label becomes the button, `justify-self: start`; bar stays graphic), `renderStackedComparison` (party table),
   `renderSparkline` (legend), `renderPersonRow` (party in the sub line), `renderLegend(el, state, data, onNavigate?)`
   (map legend and footer legend; `app.ts` passes `navigate`). Panel and dashboard pass a context everywhere: de/land/wk
   bars, poll legends, Bundesländer table "Stärkste Partei" (button stops the row click), Erst-/Zweitstimmen table,
   Wahlkreis list winner party, Hauptkandidaten rows. Map shapes unchanged. `data-card-trigger` focus return kept
   (verified in the browser: after Escape the focus is back on the SPD bar button).
2. **Persons clickable.** Wahlkreis winner (panel + dashboard tile), vote list header ("Letzte Abstimmungen von …"
   in panel, caption "Namentliche Abstimmungen von …" in dashboard), Wahlkreis list in the Land dashboard, officials and
   candidates in Hauptkandidaten. Winner id via `winnerPersonId()` (`src/leads.ts`): mdbId as string only when
   `findPerson` resolves it and the person is not an MdB who has left (seated=false); otherwise plain text.
   Officials use `String(official.id)`, candidates `candidateKey(c)`.
   The Wahlkreis list items were restructured: the Wahlkreis button holds number + name; the winner line (person
   button, party button) sits below it, not nested.
3. **Hauptkandidaten.** `src/leads.ts` (`leadsOf`, `renderLeads`, captions and empty text as constants).
   de: `kandidaten.bund` sorted by Bundesergebnis order. land: heads of government from `Land.officials` first, merged
   with the candidate entry of the same name (then the row uses the candidate key and the combined role); then the
   remaining candidates sorted by the party order of `landtag.second` (fallback `bundestag.second`), file order within a
   party. Notes ("Teil einer Doppelspitze") shown as a small italic line. Empty candidate list → "Für diese Ebene liegen
   keine belegten Angaben zu Hauptkandidaten vor." Panel: section after the election results; dashboard: tile
   "Hauptkandidaten". Wahlkreis level: no list.
   **Decided differently:** the separate "Spitzenpolitik" (panel) / "Politiker" (dashboard) block was removed,
   because the officials are only the heads of government and they now head the Hauptkandidaten list (no duplicate).
4. **No outbound links.** `extLink`/`safeHttps` deleted; `renderVoteRow(v)` and `fillVoteList(box, votes)` lost their
   link flags (titles are spans); `profileUrl` no longer rendered (field stays in the data type). Footer: every source and
   licence as text "Name (https://…)", address in `span.footer-url` (`user-select: all`), note "Adressen zum Abtippen:
   Die Seite enthält keine Links nach außen.", new lines "Kernpunkte: …" and "Hauptkandidaten: …"; `<details>` and the
   short credit line unchanged; attribution texts verbatim. CSS for footer links, `a.person-name`, vote-title hover
   removed. README: new section "Personen, Parteien, Kandidaten", intro, source table, limitations (no more
   "Fraktionsvorsitzende / only head of government" statement), outlook (photos deferred). SOURCES.md: sections for
   `parteien.json`, `kandidaten.json`, and "No outbound links".
5. **Tests.** Updated panel/dashboard/footer/legend/dom tests (links → none; officials tile → Hauptkandidaten; Wahlkreis
   list selector). New: party/person button wiring for panel, dashboard, legend on de/land/wk; Hauptkandidaten incl.
   order, empty text, button targets; `tests/no-external-links.test.ts` (renders panel, legend, dashboard for 5 views,
   7 cards incl. MdB person card with votes, expanded footer; asserts no `a`, `a[href]`, `[href]`, `[target]`; source
   scan of `src/**/*.ts` for extLink, safeHttps, window.open, `.href =`, `_blank`, `h('a'`, `createElement('a')`, `<a `);
   `tests/content-integrity.test.ts` over the real JSON (Land keys valid, candidate parties known and with profile,
   every key resolves via `findCandidate` to the same entry and survives `validateState`, every candidate card renders,
   Hauptkandidaten rows resolve and the head of government is first (Söder in BY), every party card renders at de and in
   all 16 Länder with 6 key points, every winner id resolves).

## Browser check (temporary Vite on 5197; restarted once after an interruption, PIDs 14152 then 4076; stopped, nothing
listens on 5197, no vite node process left)
- `#/` 1280 px: Hauptkandidaten section with Merz, Weidel, Scholz, Habeck, Reichinnek, van Aken, Seidler (Bundesergebnis
  order), 23 party buttons in the panel, 4 in the map legend, 0 `a[href]`.
- `#/by` 1280 px: Hauptkandidaten: Markus Söder (CSU · Ministerpräsident und Spitzenkandidat …) first, then Aiwanger,
  Ebner-Steiner/Böhm, Schulze/Hartmann (with "Teil einer Doppelspitze"), von Brunn. SPD bar label → `#/by/partei/spd`,
  card "Ergebnis in Bayern 11,6 % / 8,4 %". Escape closed it, hash `#/by`, focus back on the SPD button. Söder → 
  `#/by/person/c-markus-soeder`; browser Back closed the card.
- `#/by/219`: winner Stephan Pilsinger as button (also in the vote header) → person card "Mitglied des Bundestages,
  Wahlkreis 219", 94 votes inline with filter chips, 0 links.
- `#/by/details`: tiles Bundestagswahl, Landtagswahl 2023, Umfrage, Hauptkandidaten, Wahlkreise; 77 party and 51 person
  buttons, no nested buttons; Wahlkreis list shows "Name (CSU)" under each Wahlkreis button, tidy.
- Footer expanded: all sources as text with addresses, 0 `a[href]`, 0 `[target]`.
- 400 px: `#/by` panel sheet readable, no horizontal overflow; CSU card from the Hauptkandidaten row as bottom sheet;
  `#/by/219/details` dashboard readable, 0 links. (In the 1280 px emulation the pane crops the right edge; that is the
  pane scaling, not the layout.)

## Results
- `tsc --noEmit` clean; `npm test` 27 files / 289 tests pass, no stderr noise; `npm run build` ok; `npm run smoke` ok.

## Open / decided differently
- Spitzenpolitik/Politiker block replaced by Hauptkandidaten (see item 3).
- Candidates always use the candidate key, even when they are also MdB (e.g. Merz, Weidel): their card shows role and
  source but no votes. Using the MdB id instead would show votes but lose the candidate role; left for the owner.
- Party chairs in the party card stay plain text (no resolvable person id).
- Footer line "Umfragedaten: dawum.de (ODC-ODbL) – dawum.de (https://dawum.de/), ODC-ODbL (…)" repeats the name because
  the required wording was kept verbatim.
- No data problems found in `public/data/*.json`.
