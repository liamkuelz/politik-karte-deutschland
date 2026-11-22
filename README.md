# Politik-Karte Deutschland

Eine dunkle, interaktive Karte zur deutschen Politik: Bund, Länder und die 299 Bundestagswahlkreise mit
Wahlergebnissen, Abgeordneten, namentlichen Abstimmungen und Umfragen. Die Seite ist ein neutraler Explorer.
Sie gibt keine Wahlempfehlung und wertet keine Parteien. Sie zeigt nur öffentliche Daten und nennt ihre Quellen.

Die Seite ist komplett statisch (Vite, TypeScript, D3). Die Daten liegen als JSON in `public/data/`.

## Entwickeln

Voraussetzung: Node.js ab Version 24.

```
npm ci            # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver
npm test          # Tests (Vitest)
npm run build     # Typprüfung und Produktions-Build nach dist/
npm run smoke     # Rauchtest für dist/ (nach npm run build)
```

`npm run smoke` prüft das fertige Bundle: Ist der d3-Transition-Patch enthalten (der Produktions-Build hat ihn
einmal weg-optimiert, alle Animationen scheiterten), stimmt der Datenpfad, und gibt es keine Fremdhosts
(keine CDN-Schriften) in `index.html` und CSS? Mit `npm run smoke -- --build` baut er vorher selbst.

Für einen Unterpfad (z. B. GitHub Pages) setzt man `VITE_BASE`, etwa `VITE_BASE=/politik-karte/ npm run build`.
Der Deploy-Workflow setzt immer `/<Repo-Name>/`; für ein Repository `<user>.github.io` oder eine eigene Domain
(Seite im Wurzelpfad) muss dort `VITE_BASE: /` stehen.

## Daten aktualisieren

```
npm run build:data                # alle Daten neu holen und bauen
npm run build:data -- --fresh     # vorher die API-Caches löschen
npm run build:data -- --dry-run   # nur die Schritte anzeigen
npm run build:data -- --only people,votes,polls   # nur diese Schritte (Reihenfolge bleibt fest)
```

Die Schritte heißen `geo`, `elections`, `people`, `votes` und `polls`. Der tägliche Workflow führt nur
`--fresh --only people,votes,polls` aus. geo/elections werden von Hand ausgeführt, wenn eine neue Wahl stattgefunden
hat; sie hängen von Live-Wikipedia und einmaligen amtlichen Downloads ab. `people` funktioniert auch ohne
`elections` davor (es berechnet `winner.mdbId`, `winner.seated` und die Amtsträger aus den vorhandenen JSON-Dateien neu).

Das dauert eine Weile, weil viele API-Aufrufe nötig sind (Abgeordnete, über 58.000 Einzelstimmen). Node >= 24 ist
Pflicht. Die Skripte setzen einen beschreibenden User-Agent, weil Abgeordnetenwatch Anfragen ohne einen solchen mit
403 beantworten kann. Schlägt ein Schritt fehl, bricht der Lauf ab, statt unvollständige Daten zu schreiben.

## Datenquellen und Lizenzen

Details, URLs und Verarbeitungsschritte stehen in [`scripts/SOURCES.md`](scripts/SOURCES.md). Kurzfassung:

| Daten | Quelle | Lizenz |
|---|---|---|
| Wahlkreisgrenzen, Bundestagswahl 2025 | Die Bundeswahlleiterin, Geobasis-DE / BKG | Datenlizenz Deutschland, Namensnennung 2.0 (dl-de/by-2.0) |
| Abgeordnete, Abstimmungen | Abgeordnetenwatch API | CC0 1.0 |
| Umfragen | dawum.de | Open Data Commons Open Database License (ODC-ODbL) |
| Landtagswahlen, Namen von 23 Wahlkreissiegern ohne Mandat, Regierungschefs der Länder | deutschsprachige Wikipedia | CC BY-SA 4.0 |
| Wahlbeteiligung der Landtagswahlen | Zahlen der Landeswahlleiter, von Hand übernommen | – |

Die Grenzen sind vereinfacht (modifizierte Ableitung der Originaldaten). Die Fußzeile der Seite nennt die Quellen
ebenfalls.

## Bekannte Einschränkungen der Daten

- Umfragen sind ein Durchschnitt der Institute: Für jedes Datum zählt je Institut dessen neueste Umfrage der
  letzten 21 Tage (einschließlich des Tages), daraus der Mittelwert je Partei. Die Linien sind dadurch glatter
  als einzelne Institutsreihen.
- Die Landtagsergebnisse stammen aus Wikipedia und sind nicht vollständig gegen amtliche Quellen geprüft
  (Hamburg, Bremen und Berlin wurden stichprobenartig verglichen).
- Je Land steht nur der Ministerpräsident bzw. die Landesregierungschefin in der Liste. Fraktionsvorsitzende sind in
  Version 1 bewusst nicht enthalten (Gleichbehandlung der Parteien; sie waren nicht für alle Länder geprüft).
- Amtsinhaber in Berlin und Sachsen-Anhalt sollten nochmals kontrolliert werden (`scripts/officials.json`).
- Die Stände in `public/data/meta.json` bewegen sich nur bei echten Änderungen: „Wahl“ setzt `elections.mjs`
  am Tag seines Laufs, „Abgeordnete/Abstimmungen“ setzen `people.mjs`/`votes.mjs` nur, wenn sich ihre Dateien
  inhaltlich geändert haben, „Umfragen“ ist das Datum der neuesten Umfrage.

## Veröffentlichen (GitHub Pages)

1. Ein GitHub-Repository anlegen und dieses Repository dorthin pushen (Branch `main`).
2. Unter Settings, Pages, als Quelle "GitHub Actions" wählen.
3. Der Workflow `.github/workflows/deploy.yml` testet, baut (mit `VITE_BASE=/<Repo-Name>/`), führt den Rauchtest aus
   und veröffentlicht `dist/` bei jedem Push auf `main`.
4. Der Workflow `.github/workflows/update-data.yml` läuft täglich um 05:00 UTC (und manuell): Abgeordnete,
   Abstimmungen und Umfragen neu holen (`--only people,votes,polls`), Tests laufen lassen und nur bei Änderungen
   `public/data/` auf `main` committen (nur auf `main`, vorher `git pull --rebase`). Danach startet er den Deploy
   ausdrücklich, weil Pushes mit dem Standard-Token keine weiteren Workflows auslösen. Anfragen haben 30 s Timeout
   mit wenigen Wiederholungen, der Job höchstens 45 Minuten.

Die Workflows wurden lokal nur auf gültiges YAML geprüft, nicht auf GitHub ausgeführt.

## Ausblick

- Kommunale Ebene
- Abstimmungen der Landtage
