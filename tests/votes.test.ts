// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Person, Vote } from '../src/types.ts';
// @ts-expect-error plain .mjs helper without type declarations
import { voteFileName } from '../scripts/lib/vote-file.mjs';

const dataDir = new URL('../public/data/', import.meta.url);
const people = JSON.parse(readFileSync(new URL('people.json', dataDir), 'utf8')) as Person[];
const votesDir = new URL('votes/', dataDir);
const readVotes = (id: number) => JSON.parse(readFileSync(new URL(`${id}.json`, votesDir), 'utf8')) as Vote[];

const ANSWERS = ['yes', 'no', 'abstain', 'absent'];
const files = existsSync(votesDir) ? readdirSync(votesDir).filter((f) => f.endsWith('.json')) : [];
// deterministic sample: the first 5 persons (people.json is sorted by id) that have a votes file
const sample = people.filter((p) => files.includes(`${p.id}.json`)).slice(0, 5);

describe('votes data', () => {
  it('has vote files for (almost) all members and a sample of 5 persons', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(sample).toHaveLength(5);
  });

  it('every entry has the Vote shape with one of the four answers', () => {
    for (const p of sample) {
      const votes = readVotes(p.id);
      expect(votes.length).toBeGreaterThan(0);
      for (const v of votes) {
        expect(Object.keys(v).sort()).toEqual(['answer', 'date', 'pollId', 'title', 'url']);
        expect(Number.isInteger(v.pollId)).toBe(true);
        expect(v.title.length).toBeGreaterThan(0);
        expect(v.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(ANSWERS).toContain(v.answer);
        expect(v.url).toMatch(/^https:\/\/www\.abgeordnetenwatch\.de\/bundestag\//);
      }
    }
  });

  it('is sorted by date descending with unique polls', () => {
    for (const p of sample) {
      const votes = readVotes(p.id);
      for (let i = 1; i < votes.length; i++) expect(votes[i - 1].date >= votes[i].date).toBe(true);
      expect(new Set(votes.map((v) => v.pollId)).size).toBe(votes.length);
    }
  });

  // The site is static-hosted (GitHub Pages, repository size limits): keep the files well below that, with
  // room for the Wahlperiode to grow (about 15 MB in November 2026).
  it('stays below 60 MB in total', () => {
    const bytes = files.reduce((n, f) => n + statSync(new URL(f, votesDir)).size, 0);
    expect(bytes).toBeLessThan(60 * 1024 * 1024);
  });
});

describe('voteFileName (scripts/lib/vote-file.mjs)', () => {
  it('accepts positive integer ids only (no path traversal)', () => {
    expect(voteFileName(182899)).toBe('182899.json');
    for (const bad of [0, -1, 1.5, NaN, '12', '../x', '1/../../etc', null, undefined]) {
      expect(() => voteFileName(bad), String(bad)).toThrow(/Invalid politician id/);
    }
  });
});
