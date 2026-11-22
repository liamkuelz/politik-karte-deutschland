# Personen, Parteien und Hauptkandidaten – Erweiterung

Stand: 2026-11-22 · Status: vom Besitzer im Gespräch freigegeben · ergänzt `2026-11-21-politik-karte-design.md`

## Anliegen des Besitzers (Wortlaut sinngemäß)

1. Auf Bundes- und Länderebene müssen die Hauptkandidaten zu sehen sein.
2. Fotos überall – **später** (ausdrücklich zurückgestellt; Initialen im Parteifarbkreis bleiben).
3. Nichts darf auf eine andere Seite weiterleiten; alles ist direkt auf der Website zu sehen.
4. Parteien sind auf Bund-, Land- (und später Kommunal-)Ebene anklickbar und zeigen stilvoll Infos und die wichtigsten Punkte.

## Entscheidungen (vom Besitzer bestätigt)

- **Hauptkandidaten Bund:** Spitzen-/Kanzlerkandidat je Partei, die bei der Bundestagswahl 2025 in den Bundestag eingezogen ist (je Partei genau eine Person, Gleichbehandlung).
- **Hauptkandidaten Länder:** Ministerpräsident/in plus Spitzenkandidat/in je Partei, die bei der letzten Landtagswahl in den Landtag eingezogen ist. Listen von Hand gepflegt, jeder Eintrag mit Quelle; was nicht belegbar ist, wird weggelassen (nicht geraten).
- **Personenkarte:** Klick auf eine Person öffnet eine Karte **in der Seite** (Name, Partei, Amt, Land/Wahlkreis, bei Abgeordneten die Abstimmungsliste). Keine Fotos in dieser Version.
- **Keine Weiterleitungen:** Alle Links nach außen entfallen (Profile, Abstimmungsseiten, Quellen). Die Fußzeile nennt Quellen und Lizenzen als **Text mit Adresse zum Abtippen**, nicht als Link.
- **Parteikarte:** Klick auf eine Partei (Balken, Legende, Tabellenzeilen, Kandidatenzeilen) öffnet eine Karte in der Seite: Name, Farbe, Grunddaten (Gründungsjahr, aktuelle Vorsitzende, Wahlprogramm mit Jahr), Ergebnisse der aktuellen Ebene, und **5–8 Kernpunkte** aus dem Bundestagswahlprogramm 2025 (je Punkt Thema, kurzer neutraler Satz, Quellenangabe Programm + Seite). Auf Landesebene zeigt dieselbe Karte zusätzlich das Landesergebnis der Partei und weist die Kernpunkte klar als „Bundesprogramm“ aus.
- Phasen: Jetzt Bundesprogramme (Parteien: Union, AfD, SPD, Grüne, Linke, FDP, BSW, Freie Wähler, SSW). Landesprogramme und Kommunalebene später.
- Ausgelassen: Ausschüsse, „Fragen an Abgeordnete“ (keine einbettbaren Daten).

## Ziele

- Jede Partei und jede Person ist von jeder Stelle, an der sie erscheint, anklickbar und öffnet eine stilvolle Karte in der Seite.
- Hauptkandidaten sind im Panel und im Dashboard von Bund- und Landebene sichtbar.
- Inhalte (Kernpunkte, Kandidaten) sind belegt, neutral, gleich umfangreich pro Partei.
- Keine Navigation weg von der Seite; Zurück-Taste schließt die Karte.

## Nicht-Ziele / Anti-Ziele

- Keine Fotos jetzt. Keine Wertungen, keine Gegenüberstellung „besser/schlechter“, keine Rangfolge der Kernpunkte nach Meinung.
- Kein Raten von Namen oder Programminhalten; unbelegte Angaben fehlen lieber.
- Kein ungleicher Umfang (z. B. 8 Kernpunkte für eine Partei, 3 für eine andere). Ausnahme nur, wenn das Programm es nicht hergibt – dann sichtbar vermerkt.
- Keine Landesprogramme in dieser Phase.

## Inhalte und Datenmodell

- `public/data/parteien.json`: `PartyProfile[]` — `{ id: PartyId, name, longName, founded: number, chairs: {name, role}[], program: { title, year, sourceText }, keyPoints: { topic, text, source }[], stand: ISO-Datum }`.
- `public/data/kandidaten.json`: `{ bund: Candidate[], laender: Record<LandId, Candidate[]>, stand }` — `Candidate = { name, party: PartyId, role, note?, source }`; `role` z. B. „Spitzenkandidat Bundestagswahl 2025“, „Ministerpräsident“, „Spitzenkandidatin Landtagswahl 2024“.
- Navigation: Hash erweitert um eine Karte: `#/by/219/partei/union`, `#/partei/afd`, `#/person/12345` (bzw. Kandidatenschlüssel); Zurück schließt die Karte; ungültige Karten-Ziele werden verworfen.
- Personen ohne Eintrag in `people.json` (Kandidaten ohne Mandat) bekommen eine einfache Karte ohne Abstimmungen.

## Quellen und Lizenzen

Wahlprogramme der Parteien (öffentlich); eigene kurze Zusammenfassungen in eigenen Worten, kein Volltext. Kandidaten- und Amtsdaten aus belegten öffentlichen Quellen (Parteien, Landesregierungen, Wahlleiter, Wikipedia mit CC BY-SA Nennung). Alles in `scripts/SOURCES.md` und im Fußzeilentext.

## Was dem Builder überlassen bleibt

Gestaltung der Karten (Overlay vs. Seitenpanel, Animationen im bestehenden Stil), Dateiaufteilung, Tests, Umgang mit Tastatur/Fokus.
