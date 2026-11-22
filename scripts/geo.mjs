// Boundary pipeline: Bundeswahlleiterin Wahlkreis geometry (BTW 2025) -> public/data/geo.topo.json
// Usage: node scripts/geo.mjs [simplifyPercent]   (default 12)
// Source/licence: see scripts/SOURCES.md. Downloaded files are only read as data, never executed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = join(root, 'scripts', '.cache', 'geo');
const out = join(root, 'public', 'data', 'geo.topo.json');
const percent = process.argv[2] ?? '12';

// Non-generalised VG250-based Wahlkreise, WGS84 (EPSG:4326) shapefile.
const URL_SHP =
  'https://www.bundeswahlleiterin.de/dam/jcr/a3b60aa9-8fa5-4223-9fb4-0a3a3cebd7d1/btw25_geometrie_wahlkreise_vg250_shp_geo.zip';

// Official Länder numbers (Amtlicher Gemeindeschlüssel) -> Länderkürzel.
const LAND = {
  '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH',
};

mkdirSync(cache, { recursive: true });
const zip = join(cache, 'wahlkreise.zip');
const dir = join(cache, 'shp');
if (!existsSync(zip)) {
  const res = await fetch(URL_SHP);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${URL_SHP}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
}
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
  execFileSync('tar', ['-xf', zip, '-C', dir]); // bsdtar/GNU tar extract only; nothing is executed
}
const shp = readdirSync(dir).find((f) => f.endsWith('.shp'));
if (!shp) throw new Error('No .shp found in archive');

const cmd = [
  `-i "${join(dir, shp)}" name=wahlkreise encoding=utf8`,
  `-each 'id=+WKR_NR; name=String(WKR_NAME).trim(); landId=${JSON.stringify(LAND)}[LAND_NR]; landName=LAND_NAME'`,
  `-filter-fields id,name,landId,landName`,
  `-simplify ${percent}% keep-shapes`,
  // Länder derived from the already simplified Wahlkreise so shared borders stay identical.
  `-dissolve landId copy-fields=landName + name=laender`,
  `-each 'id=landId; name=landName'`,
  `-filter-fields id,name`,
  `-target wahlkreise -filter-fields id,name,landId`,
  `-o target=wahlkreise,laender format=topojson quantization=100000 "${out}"`,
].join(' ');

mkdirSync(join(root, 'public', 'data'), { recursive: true });
await mapshaper.runCommands(cmd);
console.log(`Wrote ${out} (${(statSync(out).size / 1024).toFixed(0)} kB, simplify ${percent}%)`);
