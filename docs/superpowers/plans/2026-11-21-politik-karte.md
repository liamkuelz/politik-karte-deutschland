# Politik-Karte Deutschland Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine statische, dunkle, animierte Deutschlandkarte, auf der man von Bund über Land zum Bundestagswahlkreis klickt und Parteien, Ergebnisse, Politiker, Abstimmungsverhalten und Umfragen sieht.

**Architecture:** Node-Skripte (`scripts/`) holen öffentliche Daten und schreiben JSON/TopoJSON nach `public/data/`. Die Seite (Vite, TypeScript, D3, SVG) lädt nur diese Dateien. Navigation ist ein Zustand (`NavState`), der in der URL-Hash gespiegelt wird; Karte, Panel und Dashboard sind drei Module, die diesen Zustand lesen.

**Tech Stack:** Vite, TypeScript, D3 (`d3-geo`, `d3-zoom`, `d3-transition`), `topojson-client`/`topojson-server`, `mapshaper` (Vereinfachung), Vitest, jsdom.

**Spec:** `docs/superpowers/specs/2026-11-21-politik-karte-design.md`

## Global Constraints

- Oberfläche auf Deutsch; Hintergrund fast schwarz; Parteifarben sind die einzigen kräftigen Farben.
- Union (CDU und CSU) heißt auf Bund- und Länderebene „Union“, helles Grau; in Bayern wird „CSU“ genannt.
- Eigene Farbe haben: Union, AfD, SPD, Grüne, Linke, FDP, BSW, Freie Wähler, SSW; alles andere ist „Sonstige“ (dunkelgrau).
- Wahlkreise sind nach Erststimmen-Gewinner gefärbt, Länder nach stärkster Partei bei den Zweitstimmen; die Legende nennt die Regel.
- Nur Bundestagswahl 2025 für Wahlkreise; Länder-Panel zeigt Bundestagsergebnis im Land und letzte Landtagswahl, beschriftet.
- Keine Politikerfotos (Initialen im Parteifarbkreis); keine Wertungen.
- Abstimmungsverhalten pro Bundestagsabgeordnetem (Ja/Nein/Enthaltung/abwesend) ist Teil von Version 1, Landtage danach.
- Umfragen: Verlauf der letzten 12 Monate, Durchschnitt wie dawum ihn liefert; im Wahlkreis wird die Landesumfrage gezeigt und so beschriftet.
- Fußzeile mit Quellen, Lizenzen und Stand je Datenart; Warnhinweis, wenn Umfragen älter als 7 Tage sind.
- Ziel: aktuelle Desktop-Browser, erste Ansicht unter ca. 3 s, SVG mit D3. Kein Server, keine Konten.

## Review Focus

- Bremen, Hamburg, Berlin sind winzig: müssen anklickbar sein (Mindest-Trefferfläche) und ohne Sonderweg zu ihren Wahlkreisen führen.
- Wahlkreis mit parteilosem Gewinner oder Erststimmen-Gewinner, der nicht in `PartyId` fällt: Farbe „Sonstige“, Name bleibt sichtbar.
- Land ohne Umfragen oder ohne Landtagsdaten: Kachel zeigt „Keine Umfragen verfügbar“ statt zu brechen.
- Abgeordneter ohne Abstimmungen oder fehlende `votes/{id}.json`: leerer Zustand statt Fehler.
- Browser-Zurück, Seiten-Neuladen und geteilter Link mit `#/by/219/details` landen im selben Zustand.
- Nutzer mit „reduzierte Bewegung“ (`prefers-reduced-motion`): keine Zoom- und Slide-Animation, sofortiger Wechsel.
- Fenster wird verkleinert/vergrößert: Karte skaliert neu, nichts läuft aus dem Bild.
- Wahlkreis, bei dem Erst- und Zweitstimmen-Sieger verschieden sind: Panel zeigt beide, Karte nutzt Erststimmen.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html
src/types.ts            Datenmodell (alle Interfaces unten)
src/parties.ts          Parteien, Farben, Normalisierung, stärkste Partei
src/nav.ts              NavState, parseHash, formatHash
src/data.ts             loadAll(), loadVotes(id) – lädt public/data
src/map.ts              SVG-Karte, Zoom, Färbung
src/panel.ts            schwebendes Glas-Panel je Ebene
src/dashboard.ts        Details-Modus mit Kacheln
src/footer.ts           Quellen, Stand, Umfrage-Warnung
src/main.ts             verdrahtet alles
src/styles.css          Look, Animationen
scripts/geo.mjs         Grenzen → public/data/geo.topo.json
scripts/elections.mjs   Ergebnisse → wahlkreise.json, laender.json
scripts/people.mjs      Abgeordnete → people.json
scripts/votes.mjs       Abstimmungen → votes/{mdbId}.json
scripts/polls.mjs       dawum → polls.json
scripts/build-data.mjs  führt alle Skripte aus, schreibt meta.json
tests/                  Vitest-Tests je Modul
```

---

### Task 1: Projekt-Gerüst, Datenmodell, Parteien

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/types.ts`, `src/parties.ts`, `src/styles.css`
- Test: `tests/parties.test.ts`

**Interfaces:**
- Produces (`src/types.ts`):
  - `type PartyId = 'union'|'afd'|'spd'|'gruene'|'linke'|'fdp'|'bsw'|'fw'|'ssw'|'sonstige'`
  - `interface PartyResult { party: PartyId; share: number }` (share in Prozent, 0–100)
  - `interface Person { id: number; name: string; party: PartyId; role: string; profileUrl: string; wahlkreisId?: number }`
  - `interface Wahlkreis { id: number; name: string; landId: string; turnout: number; first: PartyResult[]; second: PartyResult[]; winner: { name: string; party: PartyId; mdbId: number|null } }`
  - `interface AreaResult { electionType: 'bundestag'|'landtag'; year: number; turnout: number; second: PartyResult[] }`
  - `interface Land { id: string; name: string; bundestag: AreaResult; landtag: AreaResult|null; officials: Person[] }` (`id` = Kürzel wie `BY`)
  - `interface PollPoint { date: string; values: Partial<Record<PartyId, number>> }`; `interface PollSeries { areaId: string; points: PollPoint[] }` (`areaId` = `DE` oder Land-Kürzel)
  - `interface Vote { pollId: number; title: string; date: string; answer: 'yes'|'no'|'abstain'|'absent'; url: string }`
  - `interface Meta { stand: { election: string; people: string; polls: string } }` (ISO-Datum)
- Produces (`src/parties.ts`):
  - `PARTIES: Record<PartyId, { name: string; color: string }>`
  - `partyColor(id: PartyId): string`
  - `normalizeParty(raw: string): PartyId` – „CDU“, „CSU“, „CDU/CSU“ → `union`; „GRÜNE“, „Bündnis 90/Die Grünen“ → `gruene`; „DIE LINKE“ → `linke`; unbekannt oder „parteilos“ → `sonstige`
  - `strongestParty(results: PartyResult[]): PartyId` (bei leerer Liste `sonstige`)
  - `partyLabel(id: PartyId, landId?: string): string` – `union` in `BY` → „CSU“, sonst „Union“

- [ ] **Step 1: Failing tests schreiben** in `tests/parties.test.ts`: `normalizeParty('CSU') === 'union'`, `normalizeParty('Bündnis 90/Die Grünen') === 'gruene'`, `normalizeParty('parteilos') === 'sonstige'`, `strongestParty([])` ist `'sonstige'`, `strongestParty([{party:'spd',share:20},{party:'afd',share:21}]) === 'afd'`, `partyLabel('union','BY') === 'CSU'`, `partyLabel('union','NW') === 'Union'`, jede `PartyId` hat eine Farbe im Format `#rrggbb`, und `PARTIES.union.color` ist nicht `#000000` (Kontrast auf Schwarz).
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/parties.test.ts`
- [ ] **Step 3: Projekt aufsetzen** (`git init`, Vite-Vanilla-TS, Abhängigkeiten laut Tech Stack, `vitest` mit `environment: 'jsdom'`) und `src/types.ts`, `src/parties.ts` implementieren. Farben: Union `#9aa0a6`, AfD `#009EE0`, SPD `#E3000F`, Grüne `#46962B`, Linke `#BE3075`, FDP `#FFED00`, BSW `#7A1F5C` (aufgehellt auf `#C0568F` falls Kontrast zu schwach), FW `#F7A800`, SSW `#2D5BA8`, Sonstige `#3a3d44`.
- [ ] **Step 4: Test ausführen**, erwartet PASS: `npx vitest run tests/parties.test.ts`
- [ ] **Step 5: `src/styles.css`** mit Basis: `body` Hintergrund `#07080a`, Schrift Inter/system-ui, CSS-Variablen für Glas-Panel. `index.html` mit `<svg id="map">`, `<aside id="panel">`, `<main id="dashboard">`, `<footer id="footer">`, `<nav id="crumbs">`.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: project scaffold, data model, party helpers"`

---

### Task 2: Grenzen-Pipeline (Länder + 299 Wahlkreise)

**Files:**
- Create: `scripts/geo.mjs`
- Output: `public/data/geo.topo.json`
- Test: `tests/geo.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `geo.topo.json` (TopoJSON) mit zwei Objekten: `laender` (16 Geometrien, `properties: { id: string; name: string }`, `id` = Länderkürzel) und `wahlkreise` (299 Geometrien, `properties: { id: number; name: string; landId: string }`, `id` = Wahlkreisnummer 1–299).

- [ ] **Step 1: Failing test** in `tests/geo.test.ts`: Datei lesen; `laender` hat 16 Geometrien mit eindeutigen `id`; `wahlkreise` hat 299 mit `id`s 1..299 lückenlos; jedes `landId` eines Wahlkreises existiert in `laender`; Dateigröße < 1,5 MB.
- [ ] **Step 2: Test ausführen**, erwartet FAIL (Datei fehlt): `npx vitest run tests/geo.test.ts`
- [ ] **Step 3: `scripts/geo.mjs` implementieren:** Wahlkreis-Geometrien der Bundestagswahl 2025 von der Bundeswahlleiterin (Seite „Geometrie der Wahlkreise“, Builder sucht den aktuellen Link) laden, nach WGS84 umprojizieren, mit `mapshaper` vereinfachen (Start `-simplify 8% keep-shapes`; Prozentsatz so wählen, dass Küsten, Stadtstaaten und Inseln erkennbar bleiben und die Größenvorgabe hält), Länder aus den Wahlkreisen per Dissolve nach `landId` ableiten, als TopoJSON schreiben.
- [ ] **Step 4: Skript ausführen und Test erneut laufen lassen**, erwartet PASS: `node scripts/geo.mjs; npx vitest run tests/geo.test.ts`
- [ ] **Step 5: Commit** `git add scripts/geo.mjs public/data/geo.topo.json tests/geo.test.ts && git commit -m "feat: boundary pipeline for Länder and Wahlkreise"`

---

### Task 3: Wahlergebnis-Pipeline

**Files:**
- Create: `scripts/elections.mjs`
- Output: `public/data/wahlkreise.json` (`Wahlkreis[]`), `public/data/laender.json` (`Land[]` ohne `officials`, diese kommen aus Task 4)
- Test: `tests/elections.test.ts`

**Interfaces:**
- Consumes: `normalizeParty`, Typen aus Task 1; `geo.topo.json` (Wahlkreis-/Land-IDs).
- Produces: `wahlkreise.json` mit 299 Einträgen; `laender.json` mit 16 Einträgen. `Land.landtag` ist die jeweils letzte Landtagswahl (`null` nur, wenn nicht ermittelbar). Kleine Parteien werden zu `sonstige` zusammengefasst, Anteile je Liste summieren sich auf ≈ 100.

- [ ] **Step 1: Failing test:** 299 Wahlkreise, jede `id` existiert in `geo.topo.json`; `first` und `second` summieren je auf 99,5–100,5; `turnout` zwischen 40 und 100; jedes `Land` hat `bundestag.year === 2025`; mindestens 14 Länder haben `landtag !== null`; `winner.party` ist ein gültiger `PartyId`.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/elections.test.ts`
- [ ] **Step 3: `scripts/elections.mjs` implementieren:** Bundestagswahl 2025 Wahlkreis-Ergebnisse (CSV der Bundeswahlleiterin, „kerg2“) parsen; Gewinner = höchste Erststimmenzahl; Land-Ergebnisse aus den Zweitstimmen; letzte Landtagswahl je Land aus den Quellen der Landeswahlleiter bzw. Abgeordnetenwatch-Parlamentsdaten (Builder wählt je Land die leichteste verlässliche Quelle und vermerkt sie in `scripts/SOURCES.md`).
- [ ] **Step 4: Ausführen und Test erneut laufen lassen**, erwartet PASS: `node scripts/elections.mjs; npx vitest run tests/elections.test.ts`
- [ ] **Step 5: Commit** `git add scripts/elections.mjs scripts/SOURCES.md public/data tests/elections.test.ts && git commit -m "feat: election results pipeline"`

---

### Task 4: Politiker-Pipeline

**Files:**
- Create: `scripts/people.mjs`
- Output: `public/data/people.json` (`Person[]`), ergänzt `officials` in `laender.json`
- Test: `tests/people.test.ts`

**Interfaces:**
- Consumes: Abgeordnetenwatch-API (`https://www.abgeordnetenwatch.de/api/v2`), `normalizeParty`, `laender.json`, `wahlkreise.json`.
- Produces: `people.json` mit allen Bundestagsabgeordneten der laufenden Wahlperiode (`role`: „Abgeordnete/r“, bei Direktmandat `wahlkreisId` gesetzt); `Wahlkreis.winner.mdbId` wird per Namens-/Wahlkreis-Zuordnung gefüllt; `Land.officials` enthält Ministerpräsident und Fraktionsvorsitzende (`role` benennt Amt).

- [ ] **Step 1: Failing test:** ≥ 600 Personen; jede hat `profileUrl` beginnend mit `https://www.abgeordnetenwatch.de/`; mindestens 280 `wahlkreisId`s gesetzt und alle in 1..299; für ≥ 95 % der Wahlkreise ist `winner.mdbId !== null`; jedes Land hat ≥ 1 Eintrag in `officials`.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/people.test.ts`
- [ ] **Step 3: `scripts/people.mjs` implementieren:** API seitenweise abrufen (Rate-Limit beachten, Antworten in `scripts/.cache/` zwischenspeichern), auf `Person` abbilden. Ministerpräsident und Fraktionsvorsitzende der Landtage: aus Abgeordnetenwatch-Daten, wo vorhanden, sonst als kleine handgepflegte Datei `scripts/officials.json` (im Test mitgeprüft).
- [ ] **Step 4: Ausführen und Test erneut laufen lassen**, erwartet PASS: `node scripts/people.mjs; npx vitest run tests/people.test.ts`
- [ ] **Step 5: Commit** `git add scripts public/data tests/people.test.ts && git commit -m "feat: politicians pipeline"`

---

### Task 5: Abstimmungs-Pipeline

**Files:**
- Create: `scripts/votes.mjs`
- Output: `public/data/votes/{mdbId}.json` (`Vote[]`)
- Test: `tests/votes.test.ts`

**Interfaces:**
- Consumes: Abgeordnetenwatch-API (Abstimmungen und Stimmverhalten), `people.json`.
- Produces: pro Bundestagsabgeordnetem eine Datei, absteigend nach `date` sortiert; `Vote.url` verweist auf die Abstimmungsseite bei Abgeordnetenwatch. Umfang: alle Abstimmungen der laufenden Wahlperiode (bei zu großem Gesamtvolumen auf namentliche Abstimmungen beschränken und in `SOURCES.md` vermerken).

- [ ] **Step 1: Failing test:** für 5 zufällige Personen aus `people.json` existiert eine Datei; jeder Eintrag hat `answer` ∈ {yes,no,abstain,absent}; Daten sind absteigend sortiert; Gesamtgröße `public/data/votes` < 25 MB.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/votes.test.ts`
- [ ] **Step 3: `scripts/votes.mjs` implementieren:** je Abstimmung die Einzelstimmen abrufen und nach Abgeordneten umgruppieren (zuerst alle Abstimmungen laden, dann einmal schreiben, damit nicht pro Person gefragt werden muss); Antworten auf die vier Werte abbilden; Cache nutzen.
- [ ] **Step 4: Ausführen und Test erneut laufen lassen**, erwartet PASS: `node scripts/votes.mjs; npx vitest run tests/votes.test.ts`
- [ ] **Step 5: Commit** `git add scripts/votes.mjs public/data/votes tests/votes.test.ts && git commit -m "feat: voting behaviour pipeline"`

---

### Task 6: Umfragen-Pipeline und Build-Skript

**Files:**
- Create: `scripts/polls.mjs`, `scripts/build-data.mjs`
- Output: `public/data/polls.json` (`PollSeries[]`), `public/data/meta.json` (`Meta`)
- Test: `tests/polls.test.ts`

**Interfaces:**
- Consumes: dawum.de-API (`https://api.dawum.de/`), `normalizeParty`.
- Produces: `PollSeries` für `DE` und jedes Land, das Umfragen hat (kein Eintrag für Länder ohne Umfragen); Punkte der letzten 12 Monate, aufsteigend nach Datum; `build-data.mjs` führt `geo`, `elections`, `people`, `votes`, `polls` nacheinander aus und schreibt `meta.json` mit dem heutigen ISO-Datum je Datenart.

- [ ] **Step 1: Failing test:** `polls.json` enthält `areaId: 'DE'`; alle `date` liegen im Zeitfenster und sind aufsteigend; Werte liegen zwischen 0 und 100; `meta.json` hat drei gültige ISO-Daten.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/polls.test.ts`
- [ ] **Step 3: `polls.mjs` implementieren:** dawum-JSON laden, je Parlament (Bundestag, Landtage) Umfragen aller Institute nach Datum zu Punkten zusammenführen (gleiche Datumswerte über Institute mitteln), Parteien mit `normalizeParty`. `build-data.mjs` und `npm run build:data` ergänzen.
- [ ] **Step 4: Ausführen und Test erneut laufen lassen**, erwartet PASS: `node scripts/polls.mjs; npx vitest run tests/polls.test.ts`
- [ ] **Step 5: Commit** `git add scripts public/data tests/polls.test.ts package.json && git commit -m "feat: polls pipeline and build-data script"`

---

### Task 7: Navigationszustand und Datenlader

**Files:**
- Create: `src/nav.ts`, `src/data.ts`
- Test: `tests/nav.test.ts`, `tests/data.test.ts`

**Interfaces:**
- Consumes: Typen aus Task 1; Dateien aus `public/data`.
- Produces:
  - `interface NavState { level: 'de'|'land'|'wk'; landId?: string; wkId?: number; details: boolean }`
  - `parseHash(hash: string): NavState` – `''`/`#/` → de; `#/by` → land BY; `#/by/219` → wk 219 in BY; Suffix `/details` setzt `details: true`; ungültige Hashes → de
  - `formatHash(s: NavState): string` (Umkehrung von `parseHash`)
  - `interface AppData { geo: any; wahlkreise: Wahlkreis[]; laender: Land[]; people: Person[]; polls: PollSeries[]; meta: Meta }`
  - `loadAll(): Promise<AppData>`; `loadVotes(mdbId: number): Promise<Vote[]>` (liefert `[]`, wenn Datei fehlt)

- [ ] **Step 1: Failing tests:** Rundreise `formatHash(parseHash(h)) === h` für `''`, `#/by`, `#/by/219`, `#/by/219/details`; `parseHash('#/xx/9999')` ergibt `{level:'de',details:false}`; `loadVotes` mit gemocktem 404 liefert `[]`.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/nav.test.ts tests/data.test.ts`
- [ ] **Step 3: Implementieren** (`fetch` relativ zu `import.meta.env.BASE_URL`, damit GitHub Pages in Unterpfad funktioniert).
- [ ] **Step 4: Tests erneut ausführen**, erwartet PASS.
- [ ] **Step 5: Commit** `git add src tests && git commit -m "feat: nav state and data loader"`

---

### Task 8: Karte mit Zoom und Färbung

**Files:**
- Create: `src/map.ts`
- Modify: `src/styles.css`
- Test: `tests/map.test.ts`

**Interfaces:**
- Consumes: `AppData`, `NavState`, `partyColor`, `strongestParty`.
- Produces:
  - `fillFor(level: 'land'|'wk', areaId: string|number, data: AppData): string` – Land: stärkste Partei der Zweitstimmen; Wahlkreis: `winner.party`
  - `createMap(svg: SVGSVGElement, data: AppData, onNavigate: (s: NavState) => void): { update(state: NavState): void; resize(): void }`

- [ ] **Step 1: Failing tests:** `fillFor('wk', 1, fixtureData)` ergibt die Farbe des Gewinners; `fillFor('land','BY', fixtureData)` ergibt die Farbe der stärksten Zweitstimmen-Partei; nach `createMap` gibt es 16 `path.land`; nach `update({level:'land',landId:'BY',details:false})` gibt es genau die Wahlkreis-Pfade von BY als `path.wk`; jeder Pfad hat `aria-label` mit Namen; Klick auf `path.land` ruft `onNavigate` mit passendem Zustand auf.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/map.test.ts`
- [ ] **Step 3: Implementieren:** `d3.geoMercator().fitSize`, Pfade aus `topojson.feature`; Zoom auf das Land per `d3.transition` (700 ms, `easeCubicInOut`) über `viewBox`/Transform; andere Länder werden ausgeblendet (Opacity 0.15), Wahlkreise des gewählten Landes eingeblendet; Hover hebt Fläche mit weißem Rand hervor; unsichtbarer Kreis-Trefferbereich (Radius ≥ 14 px) für Bremen, Hamburg, Berlin; bei `prefers-reduced-motion` Dauer 0; `resize()` berechnet Projektion neu; Tastatur: Pfade `tabindex=0`, Enter löst Navigation aus.
- [ ] **Step 4: Tests erneut ausführen**, erwartet PASS.
- [ ] **Step 5: Manuell prüfen:** `npm run dev`, Karte im Browser öffnen, Küsten und Stadtstaaten ansehen, in Bayern hinein- und herauszoomen.
- [ ] **Step 6: Commit** `git add src tests && git commit -m "feat: interactive map with zoom and party colouring"`

---

### Task 9: Glas-Panel und Brotkrumen

**Files:**
- Create: `src/panel.ts`
- Modify: `src/styles.css`
- Test: `tests/panel.test.ts`

**Interfaces:**
- Consumes: `AppData`, `NavState`, `partyLabel`, `partyColor`, `loadVotes`.
- Produces:
  - `renderPanel(el: HTMLElement, state: NavState, data: AppData, onNavigate: (s: NavState) => void): void`
  - `renderCrumbs(el: HTMLElement, state: NavState, data: AppData, onNavigate: (s: NavState) => void): void`
  - Panel-Inhalt `de`: Parteien-Ranking nach Zweitstimmen (Bundesergebnis aus Summe `laender`) plus aktuelle Bundesumfrage als Mini-Linie; `land`: Balken je Partei (Bundestagsergebnis im Land, beschriftet „Bundestagswahl 2025“), letzte Landtagswahl (beschriftet mit Jahr), Spitzenpolitiker (`officials`) als Zeilen mit Initialen-Kreis in Parteifarbe; `wk`: Gewinner (Name, Partei), Erst- und Zweitstimmen, Wahlbeteiligung, Abstimmungsliste des Gewinners (max. 5 zuletzt, „alle ansehen“ im Dashboard). Jedes Panel hat den Knopf „Details“ (`data-action="details"`), der `onNavigate({...state, details:true})` ruft.

- [ ] **Step 1: Failing tests:** Panel für `land BY` enthält Text „CSU“ (nicht „Union“) und „Bundestagswahl 2025“; Panel für `wk` mit Gewinner ohne `mdbId` zeigt keine Abstimmungsliste, aber den Namen; Panel für Land ohne `landtag` zeigt „Keine Landtagswahl-Daten“; Land ohne Umfrage zeigt „Keine Umfragen verfügbar“; Klick auf Details-Knopf ruft `onNavigate` mit `details:true`; Brotkrumen für `wk` enthalten „Deutschland“, Landesname, Wahlkreisname, und Klick auf „Deutschland“ liefert `{level:'de',details:false}`.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/panel.test.ts`
- [ ] **Step 3: Implementieren:** Balken mit CSS-Transition auf `width` (500 ms) beim Einblenden; Panel-Wechsel mit Fade/Slide (250 ms, respektiert `prefers-reduced-motion`); Abstimmung als Zeile mit Titel, Datum, farbigem Antwort-Chip (Ja/Nein/Enthalten/Abwesend, neutrale Farben, keine Wertung).
- [ ] **Step 4: Tests erneut ausführen**, erwartet PASS.
- [ ] **Step 5: Commit** `git add src tests && git commit -m "feat: glass panel and breadcrumbs"`

---

### Task 10: Dashboard-Modus („Details“)

**Files:**
- Create: `src/dashboard.ts`
- Modify: `src/styles.css`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `AppData`, `NavState`, `loadVotes`.
- Produces: `renderDashboard(el: HTMLElement, state: NavState, data: AppData, onNavigate: (s: NavState) => void): Promise<void>`. Kacheln je Ebene: `de` = Ranking, Bundesumfrage-Verlauf (SVG-Linien in Parteifarben), Länder-Tabelle; `land` = Bundestagsergebnis, Landtagsergebnis, Landesumfrage-Verlauf (beschriftet), Politiker-Liste, Wahlkreis-Liste (anklickbar); `wk` = Direktmandat, Erst-/Zweitstimmen als gestapelter Balken, Wahlbeteiligung, Landesumfrage (beschriftet „Umfrage Bundesland“), vollständige Abstimmungsliste des Gewinners. Jede Ebene hat einen Knopf „Zurück zur Karte“ (`data-action="close-details"`).

- [ ] **Step 1: Failing tests:** `wk`-Dashboard enthält Kachel „Umfrage Bundesland“; leere Votes liefern Text „Keine Abstimmungen verfügbar“; „Zurück zur Karte“ ruft `onNavigate` mit `details:false`; `land`-Dashboard listet alle Wahlkreise des Landes und Klick darauf navigiert zum Wahlkreis.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/dashboard.test.ts`
- [ ] **Step 3: Implementieren:** Layout-Übergang: bei `details:true` bekommt `body` die Klasse `is-details`; CSS-Transition (600 ms) verkleinert und verschiebt die Karte nach links, `#dashboard` gleitet von rechts herein, Kacheln staffeln ihre Einblendung (50 ms Versatz); `prefers-reduced-motion` schaltet das ab.
- [ ] **Step 4: Tests erneut ausführen**, erwartet PASS.
- [ ] **Step 5: Commit** `git add src tests && git commit -m "feat: details dashboard mode"`

---

### Task 11: Fußzeile, Verdrahtung, Legende

**Files:**
- Create: `src/footer.ts`, `src/main.ts`
- Modify: `index.html`, `src/styles.css`
- Test: `tests/footer.test.ts`

**Interfaces:**
- Consumes: alle Module.
- Produces: `renderFooter(el: HTMLElement, meta: Meta, now: Date): void` (zeigt Quellen mit Lizenz-Hinweisen für Bundeswahlleiterin, Abgeordnetenwatch, dawum.de sowie Stand je Datenart; Warnhinweis, wenn `meta.stand.polls` mehr als 7 Tage vor `now` liegt); `main.ts` lädt `loadAll()`, liest `location.hash` mit `parseHash`, ruft `update`/`renderPanel`/`renderCrumbs`/`renderDashboard`, schreibt bei Navigation `formatHash` per `history.pushState`, reagiert auf `popstate` und `resize`. Legende unten links nennt die Einfärbungsregel der aktuellen Ebene („Stärkste Partei nach Zweitstimmen“ bzw. „Gewinner der Erststimmen“).

- [ ] **Step 1: Failing tests:** `renderFooter` mit Polls-Stand 10 Tage alt zeigt Warnhinweis, mit 2 Tagen nicht; Fußzeile nennt alle drei Quellen.
- [ ] **Step 2: Test ausführen**, erwartet FAIL: `npx vitest run tests/footer.test.ts`
- [ ] **Step 3: Implementieren** inkl. `main.ts`-Verdrahtung und Legende.
- [ ] **Step 4: Gesamte Suite und Build**, erwartet PASS und fehlerfreier Build: `npx vitest run; npm run build`
- [ ] **Step 5: Manuell prüfen** mit `npm run dev`: Deutschland → Bayern → Wahlkreis → Details → Zurück; Browser-Zurück-Taste; Link `#/by/219/details` direkt öffnen; Fenster verkleinern; erste Ansicht unter 3 s (Netzwerk-Tab).
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: footer, legend, app wiring"`

---

### Task 12: Aktualisierung und Veröffentlichung

**Files:**
- Create: `.github/workflows/update-data.yml`, `.github/workflows/deploy.yml`, `README.md`
- Modify: `vite.config.ts` (`base` aus Umgebungsvariable)

**Interfaces:**
- Produces: tägliche Aktion, die `npm run build:data` ausführt und geänderte Daten committet; Deploy-Aktion, die `npm run build` auf GitHub Pages veröffentlicht; README mit Befehlen für Daten holen, Entwickeln, Bauen.

- [ ] **Step 1: Workflows und README schreiben** (Zeitplan: täglich 05:00 UTC für Daten; Deploy bei Push auf `main`).
- [ ] **Step 2: Lokal prüfen:** `npm run build:data; npm run build; npx vite preview` – Seite läuft unter dem Vorschau-Pfad.
- [ ] **Step 3: Commit** `git add -A && git commit -m "chore: data update and deploy workflows, README"`

---

## Self-Review

- **Spec-Abdeckung:** Karte mit echten Grenzen (Task 2, 8), Navigation Bund→Land→Wahlkreis (7, 8), Panels (9), Details-Knopf und Dashboard (10), Parteifarben und Union-Regel (1), Einfärbungsregeln (8, Legende 11), Wahlergebnisse (3), Politiker (4), Abstimmungsverhalten (5, 9, 10), Umfragen (6, 9, 10), Fußzeile/Quellen/Stand/Warnung (11), Technik-Ziel (Task 8, 11 manuell), Veröffentlichung und Aktualisierung (12). Kommunen sind bewusst nicht enthalten.
- **Typen:** Alle Task-Interfaces verwenden die Namen aus Task 1 (`PartyId`, `Wahlkreis`, `Land`, `Person`, `Vote`, `PollSeries`, `Meta`) und `NavState`/`AppData` aus Task 7.
- **Review Focus:** Stadtstaaten (Task 8), parteiloser Gewinner (Task 1, 9), fehlende Umfragen/Landtagsdaten (Task 9), fehlende Votes (Task 7, 9, 10), Hash/Zurück (Task 7, 11), reduzierte Bewegung (Task 8, 9, 10), Resize (Task 8, 11), abweichende Erst-/Zweitstimmen (Task 9, 10).
