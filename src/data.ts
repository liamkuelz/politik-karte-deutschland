import type { CandidatesFile, PartyProfile } from './content-types.ts';
import type { AreaResult, Land, Meta, Person, PollSeries, Vote, Wahlkreis } from './types.ts';

export interface AppData {
  geo: any; // TopoJSON (objects: laender, wahlkreise)
  wahlkreise: Wahlkreis[];
  laender: Land[];
  bund: AreaResult;
  people: Person[];
  polls: PollSeries[];
  meta: Meta;
  /** Parteiprofile mit Kernpunkten aus den Bundestagswahlprogrammen 2025 */
  parteien: PartyProfile[];
  /** Hauptkandidaten Bund und Laender */
  kandidaten: CandidatesFile;
}

const url = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

async function fetchRequired<T>(file: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url(file));
  } catch (e) {
    throw new Error(`Datei ${file} konnte nicht geladen werden: ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`Datei ${file} konnte nicht geladen werden (HTTP ${res.status})`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Datei ${file} enthaelt ungueltiges JSON`);
  }
}

export async function loadAll(): Promise<AppData> {
  const [geo, wahlkreise, laender, bund, people, polls, meta, parteien, kandidaten] = await Promise.all([
    fetchRequired<any>('geo.topo.json'),
    fetchRequired<Wahlkreis[]>('wahlkreise.json'),
    fetchRequired<Land[]>('laender.json'),
    fetchRequired<AreaResult>('bund.json'),
    fetchRequired<Person[]>('people.json'),
    fetchRequired<PollSeries[]>('polls.json'),
    fetchRequired<Meta>('meta.json'),
    fetchRequired<PartyProfile[]>('parteien.json'),
    fetchRequired<CandidatesFile>('kandidaten.json'),
  ]);
  return { geo, wahlkreise, laender, bund, people, polls, meta, parteien, kandidaten };
}

export async function loadVotes(mdbId: number): Promise<Vote[]> {
  try {
    const res = await fetch(url(`votes/${mdbId}.json`));
    if (!res.ok) return [];
    const json: unknown = await res.json();
    return Array.isArray(json) ? (json as Vote[]) : [];
  } catch {
    return [];
  }
}
