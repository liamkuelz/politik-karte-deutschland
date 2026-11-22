import type { PartyId } from './types.ts';

/** Ein Kernpunkt aus dem Wahlprogramm einer Partei (eigene kurze Zusammenfassung, belegt). */
export interface KeyPoint {
  /** Gleiche Themenueberschriften fuer alle Parteien (Vergleichbarkeit, Gleichbehandlung). */
  topic: string;
  /** Neutral, beschreibend ("Die Partei fordert/plant ..."), eigene Worte, hoechstens ca. 35 Woerter. */
  text: string;
  /** Beleg als Text: Programmtitel, Jahr, Seite oder Kapitel. Keine URL. */
  source: string;
  /** true, wenn das Programm das Thema nicht als Schwerpunkt behandelt (dann erklaert `text` das neutral). */
  notCovered?: boolean;
}

export interface PartyChair {
  name: string;
  /** z. B. "Parteivorsitzender", "Co-Vorsitzende". */
  role: string;
}

export interface PartyProfile {
  id: PartyId;
  name: string;
  longName: string;
  founded: number;
  chairs: PartyChair[];
  program: { title: string; year: number };
  keyPoints: KeyPoint[];
  /** ISO-Datum, an dem die Angaben geprueft wurden. */
  stand: string;
}

/** Kurzer, neutraler Steckbrief; nur Felder mit belegten Angaben gesetzt. */
export interface Bio {
  /** Geburtsjahr, keine genaue Adresse/Ort-Pflicht. */
  birthYear?: number;
  /** Beruf vor der Politik, in eigenen kurzen Worten. */
  profession?: string;
  /** Politischer Werdegang in ein bis zwei Saetzen, neutral beschreibend. */
  career?: string;
  /** Beleg als Text (Biografie-Seite/Dokument), keine URL. */
  source: string;
}

export interface Candidate {
  name: string;
  party: PartyId;
  /** z. B. "Spitzenkandidat Bundestagswahl 2025", "Ministerpraesidentin". */
  role: string;
  note?: string;
  /** Beleg als Text (Seite/Dokument), keine URL. */
  source: string;
  bio?: Bio;
}

export interface CandidatesFile {
  bund: Candidate[];
  /** Schluessel = Laenderkuerzel (BW, BY, ...). */
  laender: Record<string, Candidate[]>;
  /**
   * Bekannte Luecken je Land (Schluessel = Laenderkuerzel): kurze, neutrale Hinweise, z. B. eine
   * Landtagspartei ohne belegte Spitzenkandidatur. Werden unter den Hauptkandidaten angezeigt.
   */
  omissions?: Record<string, string[]>;
  stand: string;
}
