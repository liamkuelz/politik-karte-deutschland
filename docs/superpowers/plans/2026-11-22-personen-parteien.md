# Personen, Parteien und Hauptkandidaten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Parteien und Personen sind überall anklickbar und öffnen eine Karte in der Seite; Hauptkandidaten erscheinen auf Bund- und Landebene; die Seite enthält keinen einzigen anklickbaren Link nach außen.

**Architecture:** Zwei neue Inhaltsdateien (`public/data/parteien.json`, `public/data/kandidaten.json`, Typen in `src/content-types.ts`) werden mit `loadAll` geladen. `NavState` bekommt ein optionales `card` (Partei oder Person); der Hash kodiert es (`#/by/219/partei/union`, `#/person/123`). Eine Overlay-Karte (`src/cards.ts`) rendert Partei- bzw. Personenkarten; alle Stellen, an denen Parteien oder Personen erscheinen, werden zu Buttons, die `card` setzen.

**Tech Stack:** wie bisher (Vite, TypeScript, D3, Vitest).

**Spec:** `docs/superpowers/specs/2026-11-22-personen-parteien-design.md` (ergänzt `2026-11-21-politik-karte-design.md`).

## Global Constraints
- Keine Fotos; Initialen im Parteifarbkreis. Union ist fast schwarz (`#1c1d21`) mit hellem Rand (`applyPartyEdge`).
- Keine anklickbaren Links nach außen: `extLink` entfällt; externe Quellen/Lizenzen erscheinen als Text mit Adresse. Keine `<a href>` auf externe Ziele, kein `target=_blank`, kein `window.open`.
- Parteikarten: je Partei genau 6 Kernpunkte mit denselben Themen in derselben Reihenfolge; neutrale Sprache; Kernpunkte als „Bundesprogramm“ gekennzeichnet; Landesebene zeigt zusätzlich das Landesergebnis der Partei.
- Hauptkandidaten: Bund = Spitzenkandidaten der 2025 im Bundestag vertretenen Parteien; Land = Ministerpräsident/in + Spitzenkandidat je Landtagspartei; nur belegte Einträge.
- Oberfläche Deutsch; kein innerHTML mit externen Daten (`h()`/textContent); relative Imports mit `.ts`; keine BOMs; Zurück-Taste schließt die Karte; `prefers-reduced-motion` respektieren; Tastaturbedienung und Fokus-Rückgabe.
- Neutral: keine Wertungen, gleicher Umfang pro Partei.

## Review Focus
- Karte zeigt unbekannte Partei-/Personen-ID (alter Link): wird verworfen, kein Absturz.
- Person ohne Eintrag in `people.json` (Kandidat ohne Mandat) und ohne Abstimmungen: einfache Karte, kein Fehler.
- Land ohne Kandidaten-Einträge: Hinweistext statt leerer Kachel.
- Partei ohne `chairs` (nicht belegt): Zeile entfällt, keine leere Überschrift.
- Browser-Zurück schließt die Karte und stellt Fokus auf das auslösende Element zurück; Neuladen mit Karten-Hash zeigt dieselbe Karte.
- Keine externen Links: ein Test durchsucht alle gerenderten Ansichten (de, land, wk, details, Karten, Fußzeile) nach `a[href]` mit `http`.

## File Structure
```
src/content-types.ts   (vorhanden)  Typen
src/nav.ts             NavState.card + Hash-Kodierung
src/validate.ts        Karten-Ziel prüfen
src/data.ts            lädt parteien.json, kandidaten.json
src/cards.ts           renderCard(): Partei- und Personenkarte (Overlay)
src/ui/clickables.ts   partyButton(), personButton(): gemeinsame klickbare Elemente
src/panel.ts, dashboard.ts, ui/bars.ts, ui/tiles.ts, ui/people.ts, legend.ts  anpassen
src/footer.ts          Quellen als Text
src/app.ts             Karte rendern/schließen, Fokus
```

### Task A–B (Inhalte, laufen bereits): `public/data/parteien.json`, `public/data/kandidaten.json` mit Tests.

### Task C: Datenmodell, Navigation, Karten
**Files:** Modify `src/data.ts`, `src/nav.ts`, `src/validate.ts`, `src/types.ts` (falls nötig), `tests/fixtures.ts`; Create `src/cards.ts`, `src/ui/clickables.ts`, CSS in `src/styles.css`; Test `tests/nav.test.ts`, `tests/cards.test.ts`, `tests/validate.test.ts`.

**Interfaces:**
- Produces: `interface Card { kind: 'party' | 'person'; id: string }`; `NavState.card?: Card`; `parseHash/formatHash` kodieren `/partei/<id>` und `/person/<id>` als letztes Segment (auch ohne Ebene: `#/partei/union`); `AppData` bekommt `parteien: PartyProfile[]`, `kandidaten: CandidatesFile`; `renderCard(el: HTMLElement, state: NavState, data: AppData, onNavigate: (s: NavState) => void): void`; `partyButton(party: PartyId, label: string, state: NavState, onNavigate): HTMLElement`; `personButton(...)` analog.
- [ ] Failing Tests: Hash-Rundreise mit Karte (`#/by/219/partei/union`, `#/partei/afd`, `#/person/123`, mit `/details`), ungültige Karte → verworfen; `validateState` verwirft unbekannte Partei/Person-IDs; Partei-Karte zeigt 6 Kernpunkte, Quellen als Text, Chairs nur wenn vorhanden, Landesergebnis wenn Ebene Land; Personenkarte für Abgeordnete mit Abstimmungen, für Kandidat ohne Mandat einfach; Schließen-Button ruft `onNavigate` ohne `card`; `Escape` schließt.
- [ ] Implementieren; alle Strings über `h()`; Karte als `role="dialog" aria-modal="true"` mit Fokusfalle und Fokus-Rückgabe an das auslösende Element (`data-card-trigger` merken).
- [ ] Tests grün, Commit.

### Task D: Überall klickbar, Kandidaten-Bereiche, keine Links
**Files:** Modify `src/panel.ts`, `src/dashboard.ts`, `src/ui/bars.ts`, `src/ui/tiles.ts`, `src/ui/people.ts`, `src/legend.ts`, `src/footer.ts`, `src/app.ts`, `src/ui/dom.ts` (`extLink` entfernen), `scripts/SOURCES.md`, `README.md`; Tests anpassen/ergänzen.

**Interfaces:**
- Consumes: Task C.
- [ ] Failing Tests: (1) in Panel und Dashboard von de/land/wk sind Parteinamen/Balkenzeilen/Legendeneinträge Buttons, Klick → `card` Partei; (2) Panel und Dashboard `de` zeigen Kachel „Hauptkandidaten“ aus `kandidaten.bund`, `land` aus `kandidaten.laender[landId]`, Zeilen sind `personButton`; leere Liste → „Für dieses Land liegen keine belegten Angaben zu Hauptkandidaten vor.“; (3) Abstimmungs-Zeilen und Personen-Zeilen haben keine Links mehr; (4) Linktest: alle gerenderten Ansichten enthalten kein `a[href]` mit http(s) und kein `target=_blank`; (5) Fußzeile nennt Quellen als Text mit Adresse, ohne `<a>`.
- [ ] Implementieren, `extLink` löschen, `safeHttps` mitentfernen, Tests dazu anpassen.
- [ ] Gesamte Suite, `tsc`, `build`, `smoke`, Sichtprüfung im Browser (de, Bayern, Wahlkreis, Parteikarte, Personenkarte, Details); Commit.

## Self-Review
Spec: Hauptkandidaten (A–B Daten, D UI), Karten in der Seite (C), keine Links (D), Parteien klickbar (D), Fotos zurückgestellt (kein Task). Typen: `Card`, `PartyProfile`, `CandidatesFile` konsistent mit Task C/D.
