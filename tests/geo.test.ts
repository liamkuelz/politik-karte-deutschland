// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = new URL('../public/data/geo.topo.json', import.meta.url);

interface Geom {
  type: string;
  properties: Record<string, unknown>;
}
interface Topo {
  type: string;
  objects: Record<string, { type: string; geometries: Geom[] }>;
}

const load = (): Topo => JSON.parse(readFileSync(file, 'utf8')) as Topo;

describe('geo.topo.json', () => {
  it('is smaller than 1.5 MB', () => {
    expect(statSync(file).size).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('has 16 Länder with unique two-letter ids', () => {
    const l = load().objects.laender.geometries;
    expect(l).toHaveLength(16);
    const ids = l.map((g) => g.properties.id as string);
    expect(new Set(ids).size).toBe(16);
    for (const id of ids) expect(id).toMatch(/^[A-Z]{2}$/);
    for (const g of l) expect(typeof g.properties.name).toBe('string');
  });

  it('has 299 Wahlkreise with ids 1..299 without gaps', () => {
    const w = load().objects.wahlkreise.geometries;
    expect(w).toHaveLength(299);
    const ids = w.map((g) => g.properties.id as number).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 299 }, (_, i) => i + 1));
    for (const g of w) expect(typeof g.properties.name).toBe('string');
  });

  it('matches the official 2025 Wahlkreis distribution per Land', () => {
    const expected: Record<string, number> = {
      BW: 38, BY: 47, BE: 12, BB: 10, HB: 2, HH: 6, HE: 22, MV: 6,
      NI: 30, NW: 64, RP: 15, SL: 4, SN: 16, ST: 8, SH: 11, TH: 8,
    };
    const counts: Record<string, number> = {};
    for (const g of load().objects.wahlkreise.geometries) {
      const id = g.properties.landId as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts).toEqual(expected);
  });

  it('references only existing Länder from every Wahlkreis', () => {
    const t = load();
    const landIds = new Set(t.objects.laender.geometries.map((g) => g.properties.id));
    for (const g of t.objects.wahlkreise.geometries) {
      expect(landIds.has(g.properties.landId)).toBe(true);
    }
  });
});
