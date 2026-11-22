# Data sources

## Boundaries (Länder + 299 Wahlkreise) - `public/data/geo.topo.json`

- Page: https://bundeswahlleiterin.de/bundestagswahlen/2025/wahlkreiseinteilung/downloads.html
- File used (non-generalised, VG250-based, WGS84 shapefile, 5.68 MB):
  https://www.bundeswahlleiterin.de/dam/jcr/a3b60aa9-8fa5-4223-9fb4-0a3a3cebd7d1/btw25_geometrie_wahlkreise_vg250_shp_geo.zip
- Wahlkreis numbers/names CSV (for cross-checking, not used by the script):
  https://www.bundeswahlleiterin.de/dam/jcr/17e066f6-a0af-42df-a5d2-365dc87769ab/btw25_wahlkreisnamen_utf8.csv
- Licence / attribution (required wording on the download page):
  - "© Die Bundeswahlleiterin, Statistisches Bundesamt, Wiesbaden 2024, Wahlkreiskarte für die Wahl zum 21. Deutschen Bundestag"
  - "Grundlage der Geoinformationen © Geobasis-DE / BKG 2024", Datenlizenz Deutschland - Namensnennung - Version 2.0 (https://www.govdata.de/dl-de/by-2-0)
- Processing (`scripts/geo.mjs`): mapshaper `-simplify 12% keep-shapes`, Länder dissolved from the simplified Wahlkreise by Länderkürzel, TopoJSON quantization 1e5. The result is a modified derivative of the source data.

## Election results - `public/data/{wahlkreise,laender,bund}.json` (`scripts/elections.mjs`)

Bundestagswahl 2025 (Bundeswahlleiterin, endgueltiges Ergebnis, Stand 14.03.2025):
- Page: https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata.html
- Results: https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata/btw25/csv/kerg2.csv
  (Wahlkreise, Laender, Bundesergebnis; Erst-/Zweitstimmen; Bund.json = official Bundesergebnis, not summed)
- Names of directly elected candidates: https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata/btw25/daten/gewaehlte_02.xml (276 of 299)
- Official overview of the 23 Wahlkreise whose winner got no seat (party only, no names):
  https://bundeswahlleiterin.de/dam/jcr/cc1f3ef8-37a7-4e48-b766-7a7d9bacfd5b/btw25_nicht-gewaehlte-wahlkreissitze-vorlaeufig.pdf
- Licence/attribution (stated in the CSV header): "(c) Die Bundeswahlleiterin, Wiesbaden 2025", Datenlizenz Deutschland - Namensnennung - Version 2.0 (https://www.govdata.de/dl-de/by-2-0).
- Winner = highest Erststimmen count (checked against the official "Gewaehlt" column where set). CDU+CSU are summed to `union`; all other small parties incl. Einzelbewerber are summed to `sonstige`.
- Names of those 23 winners: German Wikipedia "Bundestagswahl 2025" (table of Wahlkreissieger ohne Mandat), https://de.wikipedia.org/wiki/Bundestagswahl_2025, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Each name is cross-checked against the official Erststimmen share (build fails otherwise).

Landtagswahlen (latest per Land before 2026-11-21), Zweitstimmen/Landesstimmen shares. Abgeordnetenwatch (403 bot shield) and most Landeswahlleiter pages (JavaScript apps) cannot be fetched by script, so the shares are read from the result infobox of the German Wikipedia article, which quotes the amtliches Endergebnis; text and data CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/), https://de.wikipedia.org/wiki/<article>. Spot-checked against the official pages for HH, HB, BE (match). Wahlbeteiligung is hard-coded in `scripts/elections.mjs` (`LANDTAG`) from the Landeswahlleiter figures.
| Land | Year | Wikipedia article | Official source cited there / checked |
|---|---|---|---|
| BW | 2026 | Landtagswahl in Baden-Wuerttemberg 2026 | https://wahlen.statistik-bw.de/ltw26/ |
| RP | 2026 | Landtagswahl in Rheinland-Pfalz 2026 | Statistisches Landesamt RP (23degrees results app) |
| ST | 2026 | Landtagswahl in Sachsen-Anhalt 2026 | Landeswahlleiter ST |
| MV | 2026 | Landtagswahl in Mecklenburg-Vorpommern 2026 | Landeswahlleiterin MV |
| BE | 2026 | Wahl zum Abgeordnetenhaus von Berlin 2026 | https://www.wahlen-berlin.de/wahlen/BE2026/ (checked, matches) |
| SN | 2024 | Landtagswahl in Sachsen 2024 | Statistisches Landesamt Sachsen |
| TH | 2024 | Landtagswahl in Thueringen 2024 | Landeswahlleiter TH |
| BB | 2024 | Landtagswahl in Brandenburg 2024 | https://wahlergebnisse.brandenburg.de/ |
| HB | 2023 | Buergerschaftswahl in Bremen 2023 | https://www.wahlen-bremen.de/Wahlen/2023_05_14/ergebnisse_land_04.html (checked, matches) |
| HH | 2025 | Buergerschaftswahl in Hamburg 2025 | https://www.wahlen-hamburg.de/B%C3%BCrgerschaftswahl_2025/index.html (checked, matches) |
| HE | 2023 | Landtagswahl in Hessen 2023 | Hessisches Statistisches Landesamt |
| BY | 2023 | Landtagswahl in Bayern 2023 | Bayerisches Landesamt fuer Statistik |
| NI | 2022 | Landtagswahl in Niedersachsen 2022 | Landeswahlleiterin NI |
| NW | 2022 | Landtagswahl in Nordrhein-Westfalen 2022 | https://www.wahlergebnisse.nrw/ |
| SH | 2022 | Landtagswahl in Schleswig-Holstein 2022 | https://www.landtagswahl-sh.de/ |
| SL | 2022 | Landtagswahl im Saarland 2022 | Landeswahlleiter SL |

Landtag shares are published with one decimal, so lists sum to 99.9-100.1.
## Politicians - `public/data/people.json`, `winner.mdbId`, `Land.officials` (`scripts/people.mjs`)

Source used: Abgeordnetenwatch API v2, https://www.abgeordnetenwatch.de/api/v2 (licence CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/deed.de; the API response meta states it). Reachability: plain PowerShell `Invoke-WebRequest` got 403, but Node `fetch` with a descriptive `User-Agent` (`politik-karte-datenskript/1.0`) and 400 ms pacing was answered normally (200); no evasion of bot detection was used. The Bundestag Open Data fallback was therefore NOT needed.
- Bundestag members (Wahlperiode 21): `candidacies-mandates?parliament_period=161&type=mandate` (630 current mandates). Person.id = Abgeordnetenwatch *politician* id; party = current Fraktion via `normalizeParty` (3 Fraktionslose: party from the politician profile, unknown -> `sonstige`); `wahlkreisId` only where `mandate_won = constituency`.
- Winner.mdbId: direct-mandate winner (name + Wahlkreis) matched to the sitting member, else to the 2025 candidacies (`parliament_period=160&type=candidacy`, politician id, not necessarily in people.json: 23 Wahlkreissieger without a seat and winners who left). Name normalisation drops titles/diacritics; the official XML has one misspelling ("Stegeman", WK 31) matched by a one-letter tolerance with the same first name.
- Land officials: `scripts/officials.json` (hand-maintained, every entry carries source URL + note); version 1 lists only the head of government per Land, Fraktionsvorsitzende are deliberately not included (equal treatment of parties, not verified for all Laender). Sources: German Wikipedia "Liste der Ministerpraesidenten der deutschen Laender" (page state 2026-07-28), "Landtagswahl in Mecklenburg-Vorpommern 2026", "Landtagswahl in Sachsen-Anhalt 2026", "Senat Wegner" (state 2026-10-29), text CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Ids/profile URLs of the officials come from Abgeordnetenwatch `politicians?label=` (exact name, disambiguated by party).
- Downloads are cached in `scripts/.cache/people/` (git-ignored), written as `.part` and renamed; files are only parsed as JSON.
## Votes - `public/data/votes/{politicianId}.json` (`scripts/votes.mjs`, shared client `scripts/lib/aw-api.mjs`)

Source: Abgeordnetenwatch API v2 (same API, licence CC0 1.0 - every response's `meta.abgeordnetenwatch_api.licence` states "CC0 1.0", https://creativecommons.org/publicdomain/zero/1.0/deed.de).
- Polls: `polls?field_legislature=161` (all 94 polls of the Bundestag 21st Wahlperiode; Abgeordnetenwatch records individual votes only for roll-call polls, so these are the namentliche Abstimmungen). `Vote.title` = poll `label`, `Vote.date` = `field_poll_date`, `Vote.url` = `abgeordnetenwatch_url`.
- Individual votes: `votes?poll=<id>` once per poll (630 per poll, paginated, ~59,000 votes in total), regrouped by politician. `vote.mandate` -> politician via the period-161 mandate list (`candidacies-mandates?parliament_period=161&type=mandate`, cache shared with `people.mjs`); mandates of members who have since left (not in that list) are resolved with `candidacies-mandates/<id>`. Mapping: yes/no/abstain stay, `no_show` -> `absent`; any other value fails the build.
- Files are written for members of `people.json` plus `winner.mdbId` of the Wahlkreise (includes winners who left the Bundestag); persons without votes get no file. No cutoff was needed: ~15.2 MB minified for all polls (budget 25 MB, checked in `tests/votes.test.ts`). Sorted by date descending.
- `scripts/lib/aw-api.mjs`: cached (`.part` + rename, `scripts/.cache/`, git-ignored), 400 ms pacing, requests via `scripts/lib/http.mjs` (30 s timeout per request; network errors, timeouts, 429 and 5xx retried with back-off 2/4/8 s, Retry-After honoured but capped at 60 s, 4 tries), throws if the number of collected items differs from `meta.result.total`. Politician ids are checked to be positive integers before they become file names.

## Polls - `public/data/polls.json`, `public/data/meta.json` (`scripts/polls.mjs`, `scripts/build-data.mjs`)

Source: dawum.de API, https://api.dawum.de/ (publisher dawum.de, author Dipl.-Jur. Philipp Guttmann). Licence as stated in the response's `Database.License`: "ODC Open Database License" (ODC-ODbL), https://opendatacommons.org/licenses/odbl/1-0/. ODbL requires attribution and share-alike for derived databases: the UI/footer must credit "Umfragedaten: dawum.de (ODC-ODbL)" and polls.json is a derived database under the same licence.
- Request: Node `fetch` with `User-Agent: politik-karte-datenskript/1.0` via `scripts/lib/http.mjs` (30 s timeout, bounded retries as above); response cached in `scripts/.cache/polls/dawum.json` (`.part` + rename, reused for 6 h, git-ignored).
- Parliaments: Bundestag -> `DE`; each Landtag/Buergerschaft/Abgeordnetenhaus -> its Laenderkuerzel; Europawahl ignored. Survey date = dawum `Date` (publication date). Window: last 12 months relative to the day the script runs.
- Points (`scripts/lib/poll-merge.mjs`, average across institutes): one point per date with at least one survey in the area, ascending. For each such date every institute contributes its most recent survey dated within the 21 days up to and including that date (a survey exactly 21 days older still counts; one value per institute, several same-day surveys of one institute are averaged first), so a prolific institute does not dominate. Per party: mean over the contributing surveys that list it (parties no contributing survey lists are left out), rounded to 1 decimal. Surveys from up to 21 days before the 12-month window feed its first points; points themselves stay inside the window. The UI labels the series "Umfrage … (Durchschnitt der Institute)". CDU/CSU -> `union` (CDU+CSU summed where a survey lists them separately); only dawum's own "Sonstige" row becomes `sonstige`; other small parties are left out. Areas without surveys get no series entry.
- `meta.json` `stand.polls` = date of the newest poll in the data; `stand.election` = day `elections.mjs` last ran (run by hand after a new election); `stand.people` = day `people.mjs`/`votes.mjs` last wrote changed content (sha256 of their output before/after, `scripts/lib/meta.mjs`). `build-data.mjs` stamps nothing itself.
