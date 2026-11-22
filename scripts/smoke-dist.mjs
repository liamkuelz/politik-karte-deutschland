// Rauchtest fuer den Produktions-Build (dist/). Laeuft nach `npm run build`.
//
// Hintergrund: Der Produktions-Build hat einmal d3-transitions Prototyp-Patch weggeoptimiert (d3 hat
// "sideEffects": false), sodass jede Animation mit "transition is not a function" scheiterte, waehrend
// alle Unit-Tests gruen waren. Dieser Test prueft das fertige Bundle, nicht den Quelltext.
//
// Marker-Wahl: d3-transition endet mit `selection.prototype.interrupt = ...; selection.prototype.transition = ...;`.
// Der Minifier benennt die Variable um, behaelt aber die Eigenschaftsnamen:
//   `Hn.prototype.interrupt=Ca,Hn.prototype.transition=Mo`
// Das Muster `.prototype.transition =` kommt sonst nirgends im Code vor (Anwendungscode ruft nur
// `.transition()` auf), ist also genau dann vorhanden, wenn das Modul im Bundle gelandet ist.
// Datenpfad: data.ts baut die URL als `${BASE_URL}data/${datei}`; im Bundle bleibt `/data/${x}` stehen
// (mit Unterpfad z. B. `/politik-karte/data/${x}`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRANSITION_MARKER = /\.prototype\.transition\s*=/;
const DATA_PATH_MARKER = /\/data\/\$\{\w+\}/;
// absolute http(s)-URLs und protokollrelative //host-Verweise
const FOREIGN_HOST = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)+[a-z]{2,}[^\s"'`)]*/gi;

/**
 * Prueft den Inhalt eines Builds. Gibt eine Liste von Fehlermeldungen zurueck (leer = alles in Ordnung).
 * @param {{ html: string, js: string[], css: string[] }} dist
 * @returns {string[]}
 */
export function checkDist({ html, js, css }) {
  const problems = [];
  const allJs = js.join('\n');
  if (!TRANSITION_MARKER.test(allJs)) {
    problems.push(
      'Im JS-Bundle fehlt der d3-transition-Patch (`.prototype.transition =`): selection.transition() waere im Build undefiniert. ' +
        "Pruefen, ob `import 'd3-transition'` in src/map.ts noch vorhanden ist.",
    );
  }
  if (!DATA_PATH_MARKER.test(allJs)) {
    problems.push('Im JS-Bundle fehlt der Datenpfad (`/data/${...}`): Datei-URLs werden nicht aus BASE_URL gebildet.');
  }
  const scan = (label, text) => {
    for (const m of text.matchAll(FOREIGN_HOST)) problems.push(`${label} verweist auf einen fremden Host: ${m[0]}`);
  };
  scan('index.html', html);
  css.forEach((c, i) => scan(`CSS-Datei ${i + 1}`, c));
  return problems;
}

function readDist(distDir) {
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`${indexPath} fehlt - zuerst "npm run build" ausfuehren (oder "npm run smoke -- --build").`);
  const html = readFileSync(indexPath, 'utf8');
  const assets = join(distDir, 'assets');
  const files = existsSync(assets) ? readdirSync(assets) : [];
  const read = (ext) => files.filter((f) => f.endsWith(ext)).map((f) => readFileSync(join(assets, f), 'utf8'));
  const js = read('.js');
  if (js.length === 0) throw new Error(`Keine JS-Bundles in ${assets} gefunden.`);
  // in index.html referenzierte Bundles muessen existieren
  for (const m of html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+)"/g)) {
    if (!files.includes(m[1])) throw new Error(`index.html verweist auf ${m[1]}, die Datei fehlt in ${assets}.`);
  }
  return { html, js, css: read('.css') };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv.includes('--build')) {
    const r = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });
    if (r.status !== 0) {
      console.error('Smoke: Build fehlgeschlagen.');
      process.exit(1);
    }
  }
  let problems;
  try {
    problems = checkDist(readDist(join(root, 'dist')));
  } catch (e) {
    problems = [e.message];
  }
  if (problems.length > 0) {
    console.error('SMOKE FEHLGESCHLAGEN:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('Smoke OK: d3-transition-Patch und Datenpfad im Bundle, keine Fremdhosts in index.html/CSS.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
