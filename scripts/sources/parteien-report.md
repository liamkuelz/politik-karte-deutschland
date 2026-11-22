# Bericht: `public/data/parteien.json`

Stand: 2026-11-22

## Was gemacht wurde

1. Zuerst habe ich den Test `tests/content-parteien.test.ts` geschrieben und laufen lassen; er schlug fehl, weil die Datei noch fehlte (RED). Er prüft:
   - genau die 9 IDs,
   - die Form von `PartyProfile` und das ISO-Datum,
   - bei jeder Partei die gleichen 6 Themen in gleicher Reihenfolge,
   - Text nicht leer und höchstens 45 Wörter,
   - Quelle nicht leer und ohne `http`/`www.`,
   - keine URL im Text,
   - nicht leere Namen und Rollen bei den Vorsitzenden,
   - eine Stopp-Liste wertender Wörter (leider, endlich, zum Glück, gefährlich, radikal, populistisch, unseriös, katastrophal, vernünftig, unrealistisch, absurd, mutig, extrem, hetze, verfehlt).
2. Für alle 9 Parteien habe ich das offizielle Programm zur Bundestagswahl 2025 als PDF geladen (WebFetch), mit `pdftotext` in Text umgewandelt und die Abschnitte zu den sechs Themen im Volltext gelesen. Danach habe ich je Thema einen eigenen, neutralen Satz geschrieben, mit Programm, Kapitel und Seite als Beleg.
3. Die Vorsitzenden habe ich auf den Parteiseiten geprüft, bei Abweichungen ergänzt durch aktuelle Berichte (ZDF, dpa).
4. Die Belegdatei `scripts/sources/parteien-evidence.md` enthält je Kernpunkt ein Zitat, die URLs, die Dokumenttitel und das Abrufdatum.
5. Mit `npm.cmd test -- tests/content-parteien.test.ts tests/no-bom.test.ts` laufen 2 Testdateien und 6 Tests grün.

Die Textlänge ist bei allen Parteien ähnlich: 24 bis 33 Wörter je Kernpunkt. Kein Kernpunkt ist `notCovered`, denn jedes Programm behandelt alle sechs Themen.

## Verwendete Programme

| Partei | Dokument | Fassung | Quelle |
|---|---|---|---|
| Union | „Politikwechsel für Deutschland – Wahlprogramm von CDU und CSU“ | Vollfassung (Kurz- und Langfassung in einem PDF) | cdu.de |
| AfD | „Zeit für Deutschland“ (Programm für die Wahl zum 21. Bundestag, Riesa, Januar 2025) | Vollfassung | afd.de |
| SPD | „Mehr für Dich. Besser für Deutschland.“ – Regierungsprogramm 2025 | Vollfassung (barrierefreie Fassung) | spd.de |
| Grüne | „Zusammen wachsen“ – Regierungsprogramm 2025 | Vollfassung (digital, DIN A5) | cms.gruene.de |
| Linke | „Alle wollen regieren. Wir wollen verändern.“ | Langfassung | die-linke.de |
| FDP | „Alles lässt sich ändern“ | Vollfassung, Stand Dezember 2024 „vorbehaltlich abschließender redaktioneller Bearbeitung“ | fdp.de |
| BSW | „Unser Land verdient mehr!“ | Vollfassung | bsw-vg.de |
| Freie Wähler | „Verantwortung für Deutschland“ – Bundestagswahlprogramm 2025–2029 | Vollfassung | ni.freiewaehler.eu (Landesverband Niedersachsen) |
| SSW | „Wahlprogramm zur Bundestagswahl am 23. Februar 2025 – Deine Stimme für den Norden.“ | Vollfassung | ssw.de |

## Einschränkungen und offene Punkte

- **FDP:** Die verwendete Fassung trägt den Vermerk „vorbehaltlich abschließender redaktioneller Bearbeitung“. Eine später redigierte Endfassung habe ich nicht gefunden. Seitenzahlen und einzelne Formulierungen könnten in einer Endfassung abweichen. Einen Abgleich mit der Endfassung oder den ergänzenden Beschlüssen vom 13.01.2025 habe ich nicht gemacht.
- **Freie Wähler:** Auf der Bundesseite (freiewaehler.eu) habe ich keine direkt verlinkte PDF gefunden. Die Vollfassung stammt von der Seite des Landesverbands Niedersachsen. Titel und Deckblatt weisen sie als Bundestagswahlprogramm 2025–2029 aus.
- **AfD und Union:** Die ursprünglich verlinkten Adressen (afd.de/wahlprogramm, politikwechsel.cdu.de) zeigen heute anderes oder leiten um. Die verwendeten PDFs liegen weiterhin auf den Parteiservern (afd.de, cdu.de).
- **Seitenzahlen:** Angegeben sind die gedruckten Seitenzahlen, die ich aus Kopf- und Fußzeilen abgelesen habe. Bei CDU (PDF-Seite minus 2), FDP (minus 1) und FW (minus 2) weichen sie von der PDF-Seitennummer ab.
- **`program.year`:** Bei allen Parteien steht einheitlich 2025, das Jahr der Wahl. Union und SSW haben ihr Programm schon im Dezember 2024 verabschiedet bzw. erstellt.
- **`program`:** Ich bin dem TypeScript-Typ gefolgt und habe nur `title` und `year` gesetzt. Das in der Spezifikation erwähnte Feld `sourceText` steht nicht im Typ und fehlt deshalb.
- **Gründungsjahre:** FW (2009) und SSW (1948) sind per bpb geprüft. Die übrigen Jahre (AfD 2013, SPD 1863, Grüne 1980, Linke 2007, FDP 1948, BSW 2024, CDU 1945) sind allgemein bekannte Daten und wurden nicht einzeln online nachgeschlagen.
- **Lizenz:** Keines der Programme nennt Lizenzbedingungen. Deshalb gibt es nur eigene Zusammenfassungen und kurze Belegzitate in der Belegdatei.

## Vorsitzende: Änderungen seit 2025 und leere Felder

- **Freie Wähler: `chairs` ist leer.** Laut dpa/infranken.de vom 04.11.2026 ist der Bundesvorsitzende Hubert Aiwanger am 4. November 2026 gestorben. Die Vorstandsseite der Partei führt ihn noch als Bundesvorsitzenden, ist also nicht aktualisiert. Ein Nachfolger oder eine kommissarische Leitung ist nicht belegt; der für den 14.11. geplante Parteitag wurde laut Presse abgesagt. Deshalb steht hier kein Name.
- **SPD:** Nur Lars Klingbeil ist eingetragen. Bärbel Bas trat laut ZDF im Oktober 2026 als Co-Vorsitzende zurück, und spd.de nennt nur Klingbeil. Eine Neuwahl ist für etwa den Jahreswechsel angekündigt; danach muss der Eintrag erneuert werden.
- **FDP:** Wolfgang Kubicki ist seit dem Bundesparteitag Ende Mai 2026 Vorsitzender (nach Christian Dürr). Auf fdp.de heißt er „FDP-Chef“; eine Vorstandsseite mit dem Titel „Bundesvorsitzender“ habe ich nicht gefunden.
- **Linke:** Luigi Pantisano folgte im Juni 2026 auf Jan van Aken.
- **BSW:** Den Vorsitz haben Fabio De Masi und Amira Mohamed Ali (seit Dezember 2025). Die Partei heißt seit dem 01.10.2026 „BSW – Bündnis Soziale Gerechtigkeit und Wirtschaftliche Vernunft“. Der alte Name steht im `longName` in Klammern, weil das Programm 2025 unter diesem Namen erschien.
- **Union:** Die CSU-Vorstandsseite war nicht erreichbar (HTTP 500). Söders Vorsitz ist durch einen ZDF-Bericht über seine Wiederwahl (12.12.2025) und Berichte aus dem Oktober 2026 belegt.
- **SSW:** Als Landespartei hat der SSW keinen Bundesvorsitz. Eingetragen ist die Landesvorsitzende Sybilla Lena Nitsch (laut ssw.de/die-partei/landesvorstand); einige Drittquellen nennen veraltet noch Christian Dirschauer, der Fraktionsvorsitzender ist.

## Dateien

- `public/data/parteien.json` (neu)
- `tests/content-parteien.test.ts` (neu)
- `scripts/sources/parteien-evidence.md` (neu)
- `scripts/sources/parteien-report.md` (dieser Bericht)

Nichts committet, keine anderen Dateien verändert. Alle Dateien sind ohne BOM geschrieben.
