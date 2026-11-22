# Report: public/data/kandidaten.json (Stand 2026-11-22)

## What was done
- RED: wrote `tests/content-kandidaten.test.ts`. It failed against the placeholder `kandidaten.json` that was already in the working tree (placeholder marked "PLATZHALTER-TASK-C", untracked); I overwrote that placeholder.
- GREEN: wrote `public/data/kandidaten.json` (no BOM). Every entry was checked against web sources on 2026-11-22; the URLs are in `scripts/sources/kandidaten-evidence.md`.
- `npm.cmd test -- tests/content-kandidaten.test.ts tests/no-bom.test.ts`: 2 files, 21 tests passed.
- No other files were touched.

## Conventions
- Bund roles: "Kanzlerkandidat(in) Bundestagswahl 2025" for Union, AfD, SPD and Grüne, because those parties used that title. "Spitzenkandidat(in) Bundestagswahl 2025" for Linke and SSW.
- Länder roles: always "Spitzenkandidat(in) Landtagswahl <Jahr>". This includes the city states, even though their elections are formally Bürgerschafts- or Abgeordnetenhauswahlen; the task asked for one uniform pattern.
- When a head of government was also their party's Spitzenkandidat, there is one combined entry: "<role from officials.json> und Spitzenkandidat(in) Landtagswahl <Jahr>". This applies in 14 Länder; it does not apply to BE or NI.
- Duos and teams: where the party officially named several people, there is one entry per person, each with the uniform note "Teil einer Doppelspitze" (or "Teil eines Spitzenteams aus drei Personen"). The test allows more than one Spitzenkandidat per party only when every one of those entries carries such a note (at most 3).
- Notes are used only for factual status changes or an unusual candidacy: Frohnmaier, Crumbach, Marzischewski-Drewes, Berger.
- For heads of government, `source` repeats the source named in officials.json (a Wikipedia list or article). The internal file path is not shown to users.
- Parties in a parliament were checked against the actual seat distribution, not against `landtag.second`. That list also contains parties under 5 %, for example BB Grüne 4.1 %, SL Grüne 5.0 % (really 4.995 %, no seat), BW Linke and FDP 4.4 %, MV CDU 4.9 %.

## Per Land (entries)
- **Bund (7):** Merz (Union), Weidel (AfD), Scholz (SPD), Habeck (Grüne), Reichinnek and van Aken (Linke, duo), Seidler (SSW).
- **BW 2026 (4):** Özdemir (MP + SK), Hagel, Frohnmaier, Stoch.
- **BY 2023 (7):** Söder (MP + SK), Aiwanger, Ebner-Steiner and Böhm (AfD duo), K. Schulze and Hartmann (Grüne duo), von Brunn.
- **BE 2026 (6):** Wegner (geschäftsführend, not the CDU Spitzenkandidat), Eralp, Evers (CDU), Brinker, Graf, Krach.
- **BB 2024 (4):** Woidke (MP + SK), Berndt, Crumbach, Redmann.
- **HB 2023 (7):** Bovenschulte (combined), Imhoff and Winter (CDU duo), Schaefer, Vogt and Bernhard (Linke duo), Schäck.
- **HH 2025 (5):** Tschentscher (combined), Thering, Fegebank, C. Özdemir, Nockemann.
- **HE 2023 (5):** Rhein (MP + SK), Lambrou, Faeser, Al-Wazir, Naas.
- **MV 2026 (4):** Schwesig (MP + SK), Holm, Oldenburg, Müller. The CDU is not in the Landtag (4.89 %).
- **NI 2022 (6):** Lies (MP), Weil (SK SPD), Althusmann, Hamburg and Meyer (Grüne duo), Marzischewski-Drewes.
- **NW 2022 (5):** Wüst (MP + SK), Kutschaty, Neubaur, Stamp, M. Wagner.
- **RP 2026 (4):** Schnieder (MP + SK), Schweitzer, Bollinger, Eder.
- **SL 2022 (2):** Rehlinger (MP + SK), Hans.
- **SN 2024 (10):** Kretschmer (MP + SK), Urban, Zimmermann, Köpping, Meier, Günther and Schubert (Grüne trio), Schaper and Hartmann (Linke duo), Berger (FW).
- **ST 2026 (7):** S. Schulze (MP + SK), Siegmund, Willingmann, Sziborra-Seidlitz, von Angern, Th. Schulze and Wittig (BSW duo).
- **SH 2022 (6):** Günther (MP + SK), Heinold and Touré (Grüne duo), Losse-Müller, Buchholz, Harms (SSW).
- **TH 2024 (5):** Voigt (MP + SK), Höcke, Wolf, Ramelow, Maier.

Total: Bund 7, Länder 87 (94 entries).

## Omissions and skips
1. **SL, AfD (omitted).** The AfD holds seats from 2022, but it ran without a Landesliste because the list was withdrawn in January 2022 (bpb). Kai Melling was the planned Spitzenkandidat before the withdrawal (lpb BW), but no source names an actual Spitzenkandidat for the election.
2. **HB, Bürger in Wut (skipped).** BIW holds seats (9.4 %) but maps to `sonstige`; Jan Timke was not verified either.

## Uncertain or worth reviewing
- **Teams versus one person per party.** These Länder have several entries for one party because the party named a duo or trio: BY (AfD, Grüne), HB (CDU, Linke), NI (Grüne), SN (Grüne trio, Linke), ST (BSW), SH (Grüne). For the Bund, the Linke has a duo. This follows the brief ("list the person(s) officially named"), but the cards will show visibly more people for these parties. The owner should confirm this is acceptable.
- **HH, Linke.** Only Cansu Özdemir (list place 1, named by ZDF) is listed. Some outlets call Özdemir and Heike Sudmann a "Spitzen-Duo", and a taz headline suggests a three-person top. The duo framing could not be confirmed from one authoritative source.
- **HB.** bpb spells the Grüne candidate "Schäfer"; the name used is "Maike Schaefer", following her own spelling and the bpb party profile. The bpb article written before the election lists the CDU duo Imhoff/Winter and the Linke duo Vogt/Bernhard.
- **BW, AfD.** Frohnmaier was the official Spitzenkandidat but was not on the Landesliste. **MV, AfD:** Holm was the Spitzenkandidat, but Enrico Schult headed the Landesliste. In both cases the party's designated Spitzenkandidat is listed.
- **BB.** Crumbach was the BSW Spitzenkandidat in 2024; he left the BSW in January 2026 (and is reported to have rejoined the SPD). He is listed as `bsw` with a note.
- **NI.** Marzischewski-Drewes: the AfD group declared him excluded in July 2026, which he disputes. The note only states the group membership ended.
- **MV seats.** wahlrecht.de shows 71 seats (preliminary), but officials.json says "39 of 68 votes". I could not check the final seat count. This does not affect which parties are in the Landtag.
- **BE head of government.** Wegner is still listed as geschäftsführend, following officials.json. The latest report found (late October 2026) shows no successor elected yet. Re-check before publishing.
- **Press sources.** Several 2026 entries rely on major media (ZDFheute, bpb, t-online, Berliner Zeitung) rather than party or Landeswahlleiter pages; no primary party page was fetched for RP or ST.

## Kurz-Biografien (pilot, 2026-11-22)
Added `bio` (Geburtsjahr, Beruf, Werdegang) for the 7 Bund-Kandidaten only, see `kandidaten-evidence.md`. The 87 Länder-Kandidaten do not have a `bio` yet — that is a separate, much larger research batch (16 Länder × several people each), left for a follow-up pass.
