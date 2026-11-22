export type PartyId =
  | 'union' | 'afd' | 'spd' | 'gruene' | 'linke'
  | 'fdp' | 'bsw' | 'fw' | 'ssw' | 'sonstige';

/** share in Prozent, 0-100 */
export interface PartyResult { party: PartyId; share: number }

export interface Person {
  id: number;
  name: string;
  party: PartyId;
  role: string;
  profileUrl: string;
  wahlkreisId?: number;
}

export interface Wahlkreis {
  id: number;
  name: string;
  landId: string;
  turnout: number;
  first: PartyResult[];
  second: PartyResult[];
  winner: WahlkreisWinner;
}

/** Gewinner/in der Erststimmen im Wahlkreis (Bundestagswahl 2025). */
export interface WahlkreisWinner {
  name: string;
  party: PartyId;
  mdbId: number | null;
  /** 2025 ein Direktmandat erhalten (nicht: ohne Sitz wegen fehlender Zweitstimmendeckung) */
  directMandate: boolean;
  /** derzeit Mitglied des Bundestages (mdbId steht in people.json) */
  seated: boolean;
}

export interface AreaResult {
  electionType: 'bundestag' | 'landtag';
  year: number;
  turnout: number;
  second: PartyResult[];
}

/** id = Kuerzel wie BY */
export interface Land {
  id: string;
  name: string;
  bundestag: AreaResult;
  landtag: AreaResult | null;
  officials: Person[];
}

export interface PollPoint { date: string; values: Partial<Record<PartyId, number>> }
/** areaId = DE oder Land-Kuerzel */
export interface PollSeries { areaId: string; points: PollPoint[] }

export interface Vote {
  pollId: number;
  title: string;
  date: string;
  answer: 'yes' | 'no' | 'abstain' | 'absent';
  url: string;
}

/** ISO-Datum */
export interface Meta { stand: { election: string; people: string; polls: string } }
