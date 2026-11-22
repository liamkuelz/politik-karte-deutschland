/**
 * Nachschlagen von Parteiprofilen, Personen und Hauptkandidaten fuer Karten.
 *
 * Person-ids in Karten (`NavState.card` mit kind `person`, Hash `#/person/<id>`):
 * - Ziffernfolge: `id` aus people.json (Mitglied des Bundestages) oder aus `Land.officials` in laender.json.
 * - `c-<slug>`: Hauptkandidat/in aus kandidaten.json ohne eigene id. slug = Name in Kleinbuchstaben,
 *   Umlaute umschrieben (ä→ae, ö→oe, ü→ue, ß→ss), sonstige Akzente entfernt, jede Folge anderer
 *   Zeichen als a-z/0-9 → ein `-`, ohne Bindestriche am Rand. Beispiel: „Jörg Überall“ → `c-joerg-ueberall`.
 *   Derselbe Name in Bund- und Landesliste ergibt denselben Schluessel (dieselbe Person).
 */
import type { Candidate, PartyProfile } from './content-types.ts';
import type { AppData } from './data.ts';
import type { Land, Person, Wahlkreis } from './types.ts';

const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => TRANSLIT[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function candidateKey(c: Pick<Candidate, 'name'>): string {
  return `c-${slugify(c.name)}`;
}

export interface FoundCandidate {
  candidate: Candidate;
  /** Land der Liste, in der die Person steht; fehlt fuer die Bundesliste. */
  landId?: string;
}

/**
 * Kandidat/in zum Schluessel. Steht die Person in mehreren Listen, gewinnt die Liste von `preferLand`,
 * dann die Bundesliste, dann das erste Land.
 */
export function findCandidate(data: AppData, key: string, preferLand?: string): FoundCandidate | undefined {
  const k = data.kandidaten;
  if (!k || !key.startsWith('c-')) return undefined;
  const inList = (list: Candidate[] | undefined) => list?.find((c) => candidateKey(c) === key);
  if (preferLand) {
    const c = inList(k.laender?.[preferLand]);
    if (c) return { candidate: c, landId: preferLand };
  }
  const b = inList(k.bund);
  if (b) return { candidate: b };
  for (const [landId, list] of Object.entries(k.laender ?? {})) {
    const c = inList(list);
    if (c) return { candidate: c, landId };
  }
  return undefined;
}

export interface FoundPerson {
  person: Person;
  /** steht in people.json (derzeit Mitglied des Bundestages; Abstimmungen ueber diese id) */
  mdb: boolean;
  /** Wahlkreis des Direktmandats (nur MdB mit wahlkreisId) */
  wk?: Wahlkreis;
  /** Aemter aus laender.json (Ministerpraesident/in u. a.), mit Land */
  offices: { land: Land; role: string }[];
  /** Land-Bezug: Land des Wahlkreises oder des ersten Amtes */
  land?: Land;
}

/** Person zur Ziffern-id (people.json oder Amtstraeger/in aus laender.json). */
export function findPerson(data: AppData, id: string | number): FoundPerson | undefined {
  const s = String(id);
  if (!/^[0-9]+$/.test(s)) return undefined;
  const n = Number(s);
  const mdbPerson = data.people.find((p) => p.id === n);
  const offices: FoundPerson['offices'] = [];
  let official: Person | undefined;
  for (const land of data.laender) {
    for (const o of land.officials) {
      if (o.id === n) {
        offices.push({ land, role: o.role });
        official ??= o;
      }
    }
  }
  const person = mdbPerson ?? official;
  if (!person) return undefined;
  const wk = mdbPerson?.wahlkreisId !== undefined
    ? data.wahlkreise.find((w) => w.id === mdbPerson.wahlkreisId)
    : undefined;
  const land = wk ? data.laender.find((l) => l.id === wk.landId) : offices[0]?.land;
  return { person, mdb: !!mdbPerson, wk, offices, land };
}

export function findParty(data: AppData, id: string): PartyProfile | undefined {
  return data.parteien?.find((p) => p.id === id);
}
