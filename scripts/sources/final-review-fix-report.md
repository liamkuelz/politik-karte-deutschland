# Report: fixes from the final review (Stand 2026-11-22)

Commits: `78178dd` (data, README, evidence) and `2cf524d` (code and tests).

## Fix 1: candidate info on MdB-matched Hauptkandidaten cards
- `src/content.ts`: there is now one matching rule, `isSamePerson(a, b)`: same party and same `slugify(name)`. Two functions use it.
  - `mdbForCandidate(data, c)` replaces the private `mdbFor` in `leads.ts`.
  - `candidateForPerson(data, personId, preferLand?)` is new. It looks only at people.json, in the same list order as `findCandidate`: the preferred Land's list, then the Bund list, then the first Land. `findCandidate` and `candidateForPerson` share one internal `searchCandidates` helper.
- `src/cards.ts` (`personInfo`, numeric id): if the person is an MdB and also a Hauptkandidat/in, the card adds three things:
  - the candidate role, followed by `(Land)` when the card is not already tied to that Land, e.g. "Spitzenkandidatin Landtagswahl 2025 (Hamburg)";
  - the `note`, shown as `.card-meta` under Funktion;
  - the `source`, shown as `.card-source`, "Quelle: …", plain text.
  
  MdBs who are not Hauptkandidaten render exactly as before.
- Tests:
  - `tests/cards.test.ts` (fixtures) covers a Bund candidate with note, source and votes; a Land candidate with the Land in brackets; and the same name in a different party, which gets no candidate details.
  - `tests/content-integrity.test.ts` (real data) covers:
    - Friedrich Merz (id read from people.json by name; today 118559): row id, "Mitglied des Bundestages", "Kanzlerkandidat Bundestagswahl 2025", source, and the "Abstimmungsverhalten" header;
    - Heidi Reichinnek's note;
    - Cansu Özdemir in HH: role, source and votes. She has no note in kandidaten.json.
    - every MdB-matched candidate shows their role, and an MdB who is not a candidate has no source line.

## Fix 2: data gaps are visible
- `CandidatesFile.omissions?: Record<LandId, string[]>` (`src/content-types.ts`). In kandidaten.json: `"SL": ["AfD: keine Spitzenkandidatur belegt. Die Partei zog ihre Landesliste zur Landtagswahl 2022 zurück und trat nur mit Kreiswahlvorschlägen an."]`. The wording follows bpb as cited in kandidaten-evidence.md.
- `leadsOf` returns `omissions`, and `renderLeads` appends one `p.leads-omission` per note below the rows. These are small, italic and dim, like the empty state. Panel and dashboard share `renderLeads`.
- Party card: an empty `chairs` now renders "Vorsitz: derzeit nicht belegt" (`.card-chairs-none`). Today only `fw` is affected.
- README "Bekannte Einschränkungen" has three new lines: the Saarland AfD gap, "derzeit nicht belegt" for party chairs, and the Bund-level Linke Doppelspitze as a deliberate exception.
- Tests:
  - `tests/panel.test.ts`: fixture omission shown under the list, and only for that Land.
  - `tests/content-integrity.test.ts`: real omissions have valid keys and contain no URLs; SL has an AfD note, and it is rendered.
  - `tests/cards.test.ts`: the old "no Vorsitz row" assertion for the fixture SPD, which has empty chairs, now expects "derzeit nicht belegt".

## Fix 3: Aiwanger
- Research on 2026-11-22 (WebSearch; stuttgarter-zeitung.de, echo24.de, infranken.de/dpa, newstime.joyn.de):
  - Aiwanger died on 04.11.2026.
  - The only interim arrangement reported: Staatssekretär Tobias Gotthardt runs the Wirtschaftsministerium for now.
  - The following were all reported as open: stellvertretender Ministerpräsident, Wirtschaftsminister, and FW Landes- and Bundesvorsitz. Fabian Mehring and Florian Streibl are named only as possible candidates.
  - The FW Bundesparteitag planned for 14.11.2026 was cancelled. Its replacement is expected in 2027.
  - A Landtag Nachrücker (Stephan Weckmann, not an FW member) is reported.
- So the case is still unresolved, and no successor name was added anywhere.
  - The BY Aiwanger entry gets the note "Laut Medienberichten am 04.11.2026 verstorben; Nachfolge zum Zeitpunkt der Datenerhebung nicht offiziell bestätigt.", and its source is extended with the dpa/infranken.de report.
  - The evidence is in `kandidaten-evidence.md` (BY section), with a re-check line in `parteien-evidence.md` (FW chairs stay empty).
  - `scripts/officials.json` does not list Aiwanger (it holds heads of government only), so it is unchanged.

## Fix 4: brittle real-data tests
- The Bayern check now compares against `laender.json` BY `officials[0]` (name and party) instead of the literal "Markus Söder".
- The Wahlkreis winners check is no longer `> 250`. It now requires `> 0` and at least 50 % of the winners that have an `mdbId`, with a comment explaining the earlier brittleness.

## Verification
- `tsc --noEmit`: clean.
- `npm test`: 27 files, 296 tests passed, no warnings.
- `npm run build`: OK.
- `npm run smoke`: "Smoke OK".
- Browser (vite on 5195):
  - `#/person/118559` (Merz) shows MdB, Wahlkreis 146, "Kanzlerkandidat Bundestagswahl 2025", the source, and the votes, which loaded.
  - `#/sl` shows the AfD note under Rehlinger and Hans at 12px.
  - `#/partei/fw` shows "Vorsitz | derzeit nicht belegt".
  - `#/hh/person/66563` (Özdemir) shows "Spitzenkandidatin Landtagswahl 2025 (Hamburg)", the source, and 94 votes.
  - `#/by/person/c-hubert-aiwanger` shows the note.
  - No console errors.
- I stopped my server. Port 5195 is no longer listening.

## Open points
- One other vite process (PID 4604, started via `node_modules\.bin\..\vite\bin\vite.js`, not on 5195) was already running and is not mine. I left it alone.
- The real-data Merz, Reichinnek and Özdemir tests return early if that person leaves people.json or kandidaten.json, so daily MdB turnover cannot break CI. The general loop test still covers every MdB-matched candidate.
- The FW chairs and the Aiwanger note need a re-check once the Freie Wähler elect a new leadership.
