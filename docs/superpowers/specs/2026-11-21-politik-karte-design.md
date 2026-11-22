# Interaktive Politik-Karte Deutschland – Design

Stand: 2026-11-21 · Status: Entwurf zur Freigabe

## Intention und Warum

Eine Website, auf der man Deutschland als interaktive Karte erkundet und sich so selbst eine politische Meinung bildet. Die Seite sagt nicht, was man denken soll (kein Wahl-O-Mat, kein Test). Sie macht die politische Landschaft übersichtlich: Wer wird wo gewählt, wie stark sind die Parteien, wer sind die Politiker, wie stehen aktuelle Umfragen.

Zuerst nur für den Besitzer. Später evtl. öffentlich, also von Anfang an sauber genug gebaut, um sie zu veröffentlichen.

## Ziele

- Man klickt sich von Deutschland ins Bundesland, von dort in den Bundestagswahlkreis und sieht auf jeder Ebene Parteien, Wahlergebnisse, Politiker und Umfragen.
- Durchgehend Parteifarben für Parteien und Politiker.
- Moderner, cleaner Look: schwarzer Hintergrund, saubere Animationen, leicht zu bedienen.
- Die Karte ist geografisch genau (echte amtliche Grenzen, keine grobe Skizze).
- Die Architektur lässt später die kommunale Ebene (Kreise, Gemeinden) zu.

## Nicht-Ziele

- Keine Wahlempfehlung, kein Meinungstest, keine Bewertung von Parteien oder Politikern.
- Kommunale Ebene (rund 10.800 Gemeinden, 400 Kreise) ist **nicht** Teil der ersten Version. Möglicherweise später zuerst nur für eine Wunschregion.
- Keine Nutzerkonten, kein Server, keine Datenbank.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Die Seite wirkt parteiisch (z. B. durch Wertungen, ungleiche Darstellung von Parteien).
- Die Karte ist ruckelig oder braucht lange zum Laden.
- Die Seite ist ein Datenfriedhof: viele Zahlen, aber der erste Eindruck ist unübersichtlich.
- Veraltete Daten ohne Hinweis auf den Stand.

## Das Erlebnis

Grundaufbau (Variante „A mit Option zu C“):

1. **Start:** Vollbild-Karte von Deutschland, 16 Bundesländer, eingefärbt nach der stärksten Partei.
2. **Klick auf ein Land:** Die Kamera zoomt animiert hinein, die Bundestagswahlkreise werden sichtbar. Ein schwebendes Glas-Panel zeigt Ergebnis, Parteien und Spitzenpolitiker.
3. **Klick auf einen Wahlkreis:** Das Panel zeigt Direktmandat, Zweitstimmen, Wahlbeteiligung, zuständige Abgeordnete.
4. **Knopf „Details“ im Panel:** Die Karte rutscht animiert nach links und schrumpft, rechts erscheint ein Dashboard mit Kacheln (Ergebnis, Beteiligung, Umfragetrend, Abgeordnete). Ein Knopf bringt zurück zur großen Karte.
5. **Brotkrumen-Navigation** oben („Deutschland › Bayern › Wahlkreis 219“) zum Zurückspringen.

Optik: Hintergrund fast schwarz, halbtransparente Glas-Panels, Parteifarben als einzige kräftige Farben. Die CDU/CSU ist offiziell schwarz und auf Schwarz unsichtbar, sie wird als helles Grau dargestellt (Entscheidung des Autors, siehe „Offene Annahmen“).

## Ansätze

Drei Wege wurden betrachtet:

1. **Statische Website mit vorbereiteten Daten.** Ein Skript lädt Grenzen, Ergebnisse, Abgeordnete und Umfragen und speichert sie als Dateien. Die Seite ist reines HTML/JavaScript (D3), ohne Server. Vorteile: schnell, kostenlos zu veröffentlichen, unabhängig von fremden Schnittstellen, leicht erweiterbar. Nachteil: Daten nur so aktuell wie der letzte Skriptlauf.
2. **Website mit eigenem Server, der live abfragt.** Immer aktuell, aber Hosting, Wartung und Ausfallabhängigkeit von fremden Schnittstellen. Zu aufwendig für den aktuellen Zweck.
3. **Große Web-App (React, MapLibre/WebGL).** Weichster Zoom, aber deutlich aufwendiger und für 16 Länder und 299 Wahlkreise unnötig. Wird erst bei Gemeinde-Ebene interessant.

**Gewählt: Ansatz 1** (Entscheidung des Besitzers). Spätere Umstellung auf Ansatz 3 bleibt möglich, weil die Datendateien unabhängig von der Darstellung sind.

## Entscheidungen des Besitzers

- Starke Ausrichtung auf Erkunden statt Meinungstest.
- Start mit Bund und Ländern, Kommunen später.
- Layout A (Vollbild-Karte, schwebendes Panel) mit Umschalten auf C (Dashboard) per **Knopf**, nicht automatisch.
- Karte mit echten, genauen Grenzen.
- Statische Website mit vorbereiteten Daten.

## Daten (Quellen, laut Recherche öffentlich verfügbar)

- Grenzen Bundesländer und 299 Bundestagswahlkreise: Bundeswahlleiterin / Bundesamt für Kartographie (vereinfacht für schnelles Laden).
- Wahlergebnisse Bund: Bundeswahlleiterin. Landtagswahlen: jeweilige Landeswahlleiter.
- Abgeordnete und Abstimmungsverhalten: Abgeordnetenwatch (offene API), Bundestag und Landtage.
- Umfragen: dawum.de (frei, Bund und Länder).

Ein Aufbereitungsskript erzeugt daraus JSON-Dateien. Jede Datei trägt ein Stand-Datum, das auf der Seite angezeigt wird.

## Was dem Builder überlassen bleibt

- Konkrete Bibliotheken über D3 hinaus, Dateistruktur, Build-Werkzeug.
- Vereinfachungsgrad der Grenzen (Ziel: flüssige Animation bei sichtbar korrekten Küsten und Stadtstaaten).
- Genaue Gestaltung der Kacheln, Typografie, Animationsdauer und -kurven.
- Responsives Verhalten auf Handy und Tablet (Desktop zuerst).
- Wie das Skript Aktualisierungen automatisiert (zum Beispiel täglich über einen geplanten Lauf).
- Barrierefreiheit im vernünftigen Rahmen (Kontraste, Tastaturbedienung).

## Präzisierungen nach Prüfer-Check (Entscheidungen des Autors)

- **Parteien und Farben:** CDU und CSU gelten auf Bundes- und Länderebene als „Union“ (helles Grau). In Bayern wird die CSU namentlich genannt. Eigene Farbe haben alle Parteien, die 2025 im Bundestag oder in einem Landtag sitzen (AfD, SPD, Grüne, Linke, FDP, BSW, Freie Wähler, SSW). Alles andere ist „Sonstige“ (dunkelgrau).
- **Einfärbung der Wahlkreise:** nach Gewinner der Erststimmen (Direktmandat). Das Panel zeigt zusätzlich die Zweitstimmen. Bundesländer sind nach stärkster Partei bei den Zweitstimmen gefärbt. Die Legende benennt die jeweilige Regel.
- **Grenzen und Wahl:** nur Wahlkreisgrenzen und Ergebnisse der Bundestagswahl 2025. Im Länder-Panel stehen Bundestagsergebnis im Land und letzte Landtagswahl, jeweils klar beschriftet.
- **Abstimmungsverhalten (Entscheidung des Besitzers: gehört in Version 1):** Pro Bundestagsabgeordnetem eine Liste von Abstimmungen mit Ja/Nein/Enthaltung/abwesend, aus Abgeordnetenwatch. Umfang (alle Abstimmungen der laufenden Wahlperiode oder eine Auswahl wichtiger) und Landtage sind Sache des Builders; Bundestag zuerst, Landtage danach. Neutral dargestellt, ohne Wertung, mit Link zur Quelle.
- **Politiker:** im Wahlkreis der Direktkandidat-Gewinner; im Land der Ministerpräsident / die Landesregierungschefin; Fraktionsvorsitzende sind für Version 1 bewusst nicht enthalten (Gleichbehandlung der Parteien, nicht für alle Länder verifiziert); keine Fotos (Initialen im Parteifarbkreis).
- **Umfragen:** Bund und Länder je ein Verlauf der letzten 12 Monate (Durchschnitt über alle Institute, wie dawum ihn liefert). Im Wahlkreis wird die Umfrage des Bundeslandes gezeigt, beschriftet als solche.
- **Details-Knopf:** gibt es auf allen Ebenen, ein gemeinsames Dashboard-Muster mit je nach Ebene anderen Kacheln.
- **Deutschland-Panel:** Parteien-Ranking nach Zweitstimmen plus aktuelle Bundesumfrage.
- **Stadtstaaten:** Berlin, Hamburg und Bremen werden ohne Sonderweg behandelt, die Wahlkreise erscheinen wie bei anderen Ländern.
- **Lizenzen:** Quellenangabe (Fußzeile mit Quellen und Lizenzen) gehört zum Umfang. Fotos entfallen auch deshalb.
- **Stand:** ein globaler Stand pro Datenart (Wahl, Abgeordnete, Umfragen) in der Fußzeile; Hinweis, wenn Umfragen älter als 7 Tage sind.
- **Technik-Ziel:** aktuelle Desktop-Browser, erste Ansicht unter etwa 3 Sekunden bei normaler Verbindung, SVG mit D3.

## Offene Annahmen (Entscheidungen des Autors, nicht des Besitzers)

- Sprache der Oberfläche: Deutsch.
- CDU/CSU als helles Grau dargestellt statt Schwarz.
- Einfärbung der Karte standardmäßig nach stärkster Partei im jeweiligen Gebiet, später umschaltbar auf einzelne Parteien.
- Das „aktuelle“ Wahlergebnis ist die jeweils letzte Wahl der betrachteten Ebene (Bundestagswahl für Wahlkreise, Landtagswahl für Länder).
- Veröffentlichung später als statische Seite (z. B. GitHub Pages).
