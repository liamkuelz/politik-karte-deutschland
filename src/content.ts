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

type Named = { name: string; party: string };

/**
 * Dieselbe Person in kandidaten.json und people.json/laender.json: gleiche Partei und gleicher Name
 * (verglichen ueber slugify). Einzige Abgleichsregel fuer Hauptkandidaten-Zeilen und Personenkarten.
 */
export function isSamePerson(a: Named, b: Named): boolean {
  return a.party === b.party && slugify(a.name) === slugify(b.name);
}

/** Mitglied des Bundestages (people.json) zu einem Kandidateneintrag, falls die Person dort steht. */
export function mdbForCandidate(data: AppData, c: Candidate): Person | undefined {
  return data.people.find((p) => isSamePerson(p, c));
}

/**
 * Erster passender Eintrag in den Kandidatenlisten. Reihenfolge: Liste von `preferLand`, dann die
 * Bundesliste, dann die Laender in Dateireihenfolge.
 */
function searchCandidates(data: AppData, match: (c: Candidate) => boolean, preferLand?: string): FoundCandidate | undefined {
  const k = data.kandidaten;
  if (!k) return undefined;
  const inList = (list: Candidate[] | undefined) => list?.find(match);
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

/**
 * Kandidat/in zum Schluessel. Steht die Person in mehreren Listen, gewinnt die Liste von `preferLand`,
 * dann die Bundesliste, dann das erste Land.
 */
export function findCandidate(data: AppData, key: string, preferLand?: string): FoundCandidate | undefined {
  if (!key.startsWith('c-')) return undefined;
  return searchCandidates(data, (c) => candidateKey(c) === key, preferLand);
}

/**
 * Hauptkandidaten-Eintrag eines Mitglieds des Bundestages (people.json-id), z. B. Kanzlerkandidat/in mit
 * Mandat. Gleiche Abgleichsregel wie die Hauptkandidaten-Zeilen (`isSamePerson`), gleiche Listen-Reihenfolge
 * wie `findCandidate`.
 */
export function candidateForPerson(data: AppData, personId: number, preferLand?: string): FoundCandidate | undefined {
  const person = data.people.find((p) => p.id === personId);
  if (!person) return undefined;
  return searchCandidates(data, (c) => isSamePerson(c, person), preferLand);
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
