// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PartyProfile } from '../src/content-types.ts';

const IDS = ['union', 'afd', 'spd', 'gruene', 'linke', 'fdp', 'bsw', 'fw', 'ssw'];
const TOPICS = [
  'Wirtschaft & Steuern',
  'Soziales & Rente',
  'Migration & Integration',
  'Klima & Energie',
  'Sicherheit & Außenpolitik',
  'Bildung & Gesundheit',
  'Wohnen & Bauen',
];
// Wertende Woerter, die in neutralen Zusammenfassungen nicht vorkommen sollen.
const STOP_WORDS = [
  'leider',
  'endlich',
  'zum glück',
  'gefährlich',
  'radikal',
  'populistisch',
  'unseriös',
  'katastrophal',
  'vernünftig',
  'unrealistisch',
  'absurd',
  'mutig',
  'extrem',
  'hetze',
  'verfehlt',
];

const profiles = JSON.parse(readFileSync('public/data/parteien.json', 'utf8')) as PartyProfile[];

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

describe('parteien.json', () => {
  it('enthaelt genau die 9 Parteien', () => {
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.map((p) => p.id).sort()).toEqual([...IDS].sort());
  });

  it('jedes Profil hat die Form von PartyProfile', () => {
    for (const p of profiles) {
      expect(typeof p.name, p.id).toBe('string');
      expect(p.name.length, p.id).toBeGreaterThan(0);
      expect(typeof p.longName, p.id).toBe('string');
      expect(p.longName.length, p.id).toBeGreaterThan(0);
      expect(Number.isInteger(p.founded), p.id).toBe(true);
      expect(p.founded, p.id).toBeGreaterThan(1850);
      expect(p.founded, p.id).toBeLessThanOrEqual(2026);
      expect(Array.isArray(p.chairs), p.id).toBe(true);
      for (const c of p.chairs) {
        expect(typeof c.name, p.id).toBe('string');
        expect(c.name.trim().length, p.id).toBeGreaterThan(0);
        expect(typeof c.role, p.id).toBe('string');
        expect(c.role.trim().length, p.id).toBeGreaterThan(0);
      }
      expect(typeof p.program.title, p.id).toBe('string');
      expect(p.program.title.length, p.id).toBeGreaterThan(0);
      expect(Number.isInteger(p.program.year), p.id).toBe(true);
      expect(p.stand, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(p.stand)), p.id).toBe(false);
      expect(Array.isArray(p.keyPoints), p.id).toBe(true);
    }
  });

  it('jede Partei hat dieselben 7 Themen in derselben Reihenfolge', () => {
    for (const p of profiles) {
      expect(p.keyPoints.map((k) => k.topic), p.id).toEqual(TOPICS);
    }
  });

  it('Texte und Quellen sind nicht leer, kurz und ohne URL', () => {
    for (const p of profiles) {
      for (const k of p.keyPoints) {
        const label = `${p.id} / ${k.topic}`;
        expect(typeof k.text, label).toBe('string');
        expect(k.text.trim().length, label).toBeGreaterThan(0);
        expect(wordCount(k.text), label).toBeLessThanOrEqual(45);
        expect(k.text, label).not.toMatch(/https?:|www\./i);
        expect(typeof k.source, label).toBe('string');
        expect(k.source.trim().length, label).toBeGreaterThan(0);
        expect(k.source, label).not.toMatch(/http|www\./i);
        if (k.notCovered !== undefined) expect(typeof k.notCovered, label).toBe('boolean');
      }
    }
  });

  it('keine wertenden Woerter in den Texten', () => {
    for (const p of profiles) {
      for (const k of p.keyPoints) {
        const lower = k.text.toLowerCase();
        for (const w of STOP_WORDS) {
          expect(lower.includes(w), `${p.id} / ${k.topic}: "${w}"`).toBe(false);
        }
      }
    }
  });
});
