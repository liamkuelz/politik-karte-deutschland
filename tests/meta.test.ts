// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helpers without type declarations
import { bumpStandIfChanged, contentHash } from '../scripts/lib/meta.mjs';

let dir: string;
let metaFile: string;
const OLD = { election: '2026-01-01', people: '2026-02-02', polls: '2026-03-03' };
const stand = () => JSON.parse(readFileSync(metaFile, 'utf8')).stand;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'meta-test-'));
  metaFile = join(dir, 'meta.json');
  writeFileSync(metaFile, JSON.stringify({ stand: OLD }));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('meta.json stand only moves on real change', () => {
  it('unchanged content: date not bumped, file untouched', () => {
    const data = join(dir, 'people.json');
    writeFileSync(data, '[1,2,3]\n');
    const before = contentHash([data]);
    writeFileSync(data, '[1,2,3]\n'); // gleicher Inhalt neu geschrieben
    const raw = readFileSync(metaFile, 'utf8');
    expect(bumpStandIfChanged('people', before, contentHash([data]), { file: metaFile, date: '2026-11-22' })).toBe(false);
    expect(readFileSync(metaFile, 'utf8')).toBe(raw);
  });

  it('changed content: only the given kind is bumped', () => {
    const data = join(dir, 'people.json');
    writeFileSync(data, '[1,2,3]\n');
    const before = contentHash([data]);
    writeFileSync(data, '[1,2,4]\n');
    expect(bumpStandIfChanged('people', before, contentHash([data]), { file: metaFile, date: '2026-11-22' })).toBe(true);
    expect(stand()).toEqual({ ...OLD, people: '2026-11-22' });
  });

  it('contentHash covers directories (names and contents) and missing paths', () => {
    const votes = join(dir, 'votes');
    const missing = contentHash([votes]);
    mkdirSync(votes);
    writeFileSync(join(votes, '1.json'), '[]');
    const one = contentHash([votes]);
    expect(one).not.toBe(missing);
    expect(contentHash([votes])).toBe(one);
    rmSync(join(votes, '1.json'));
    writeFileSync(join(votes, '2.json'), '[]'); // gleicher Inhalt, anderer Name
    expect(contentHash([votes])).not.toBe(one);
  });
});
