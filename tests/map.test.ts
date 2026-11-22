import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '../src/data.ts';
import { createMap, fillFor } from '../src/map.ts';
import type { NavState } from '../src/nav.ts';
import { partyColor } from '../src/parties.ts';
import { fixtureData } from './fixtures.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.id = 'map';
  document.body.appendChild(svg);
  return svg;
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function expectNoNaN(svg: SVGSVGElement) {
  for (const el of svg.querySelectorAll('*')) {
    for (const a of ['d', 'transform', 'cx', 'cy', 'r']) {
      const v = el.getAttribute(a);
      if (v !== null) expect(v, `${el.tagName}.${a}`).not.toMatch(/NaN|Infinity/);
    }
  }
}

const ZOOM_WAIT = 900; // > 700 ms Zoom, > 300 ms Fade

// Gesteuerte Animationsuhr: d3-timer liest die Zeit ueber performance.now(), daher wird diese Methode
// ersetzt und nur ueber advance() vorgestellt. Echte Frames laufen weiter, sehen aber nur die
// gesteuerte Zeit, sodass der Animationsstand nicht von der Rechnerlast abhaengt.
let fakeNow = 0;
const nextFrame = () => new Promise<void>((r) => {
  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => r());
  else setTimeout(r, 17);
});
async function frames(n = 3) {
  for (let i = 0; i < n; i++) await nextFrame();
}
function installClock() {
  fakeNow = performance.now();
  vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);
}
/** Stellt die Uhr in Schritten < 1 s vor (d3-timer wertet groessere Spruenge als Uhrversatz). */
async function advance(ms: number) {
  await frames();
  while (ms > 0) {
    const step = Math.min(ms, 400);
    fakeNow += step;
    ms -= step;
    await frames();
  }
}

function cameraScale(svg: SVGSVGElement): number {
  const t = svg.querySelector('g.camera')!.getAttribute('transform') ?? '';
  const m = /scale\(([^)]+)\)/.exec(t);
  return m ? Number(m[1]) : 1;
}

// import.meta.url ist unter jsdom keine Datei-URL, daher relativ zum Projektordner
const read = (f: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public/data', f), 'utf8'));

beforeEach(() => stubReducedMotion(true));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('fillFor', () => {
  it('colours a Wahlkreis by its Erststimmen winner', () => {
    expect(fillFor('wk', 220, fixtureData)).toBe(partyColor('gruene'));
    expect(fillFor('wk', 221, fixtureData)).toBe(partyColor('spd'));
  });
  it('colours a Land by the strongest Zweitstimmen party', () => {
    expect(fillFor('land', 'BY', fixtureData)).toBe(partyColor('afd'));
    expect(fillFor('land', 'BW', fixtureData)).toBe(partyColor('union'));
  });
  it('falls back to Sonstige for unknown areas', () => {
    expect(fillFor('land', 'XX', fixtureData)).toBe(partyColor('sonstige'));
    expect(fillFor('wk', 999, fixtureData)).toBe(partyColor('sonstige'));
  });
});

describe('createMap (fixture)', () => {
  it('renders one path.land per Land with fill, aria-label, role and tabindex', () => {
    const svg = makeSvg();
    createMap(svg, fixtureData, () => {});
    const lands = svg.querySelectorAll('path.land');
    expect(lands).toHaveLength(2);
    const by = svg.querySelector('path.land[data-id="BY"]')!;
    expect(by.getAttribute('aria-label')).toBe('Bayern');
    expect(by.getAttribute('role')).toBe('button');
    expect(by.getAttribute('tabindex')).toBe('0');
    expect(by.getAttribute('fill')).toBe(partyColor('afd'));
    expect(svg.querySelectorAll('path.wk')).toHaveLength(0);
    expectNoNaN(svg);
  });

  it('click on a Land navigates to it', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    createMap(svg, fixtureData, nav);
    svg.querySelector('path.land[data-id="BW"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenCalledWith({ level: 'land', landId: 'BW', details: false });
  });

  it('Enter and Space on a focused Land navigate', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    createMap(svg, fixtureData, nav);
    const by = svg.querySelector('path.land[data-id="BY"]')!;
    by.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    by.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    by.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(nav).toHaveBeenCalledTimes(2);
    expect(nav).toHaveBeenCalledWith({ level: 'land', landId: 'BY', details: false });
  });

  it('land level shows exactly the Wahlkreise of that Land and fades the others', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, fixtureData, nav);
    map.update({ level: 'land', landId: 'BY', details: false });
    const wks = [...svg.querySelectorAll('path.wk')];
    expect(wks.map((p) => p.getAttribute('data-id')).sort()).toEqual(['220', '221']);
    const w220 = svg.querySelector('path.wk[data-id="220"]')!;
    expect(w220.getAttribute('aria-label')).toBe('Wahlkreis 220 München-West');
    expect(w220.getAttribute('fill')).toBe(partyColor('gruene'));
    expect(w220.getAttribute('tabindex')).toBe('0');
    const bw = svg.querySelector('path.land[data-id="BW"]') as SVGPathElement;
    expect(bw.style.opacity).toBe('0.15');
    expect(bw.getAttribute('tabindex')).toBe('-1');
    // Land-Klick ist auf Land-Ebene abgeschaltet
    bw.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).not.toHaveBeenCalled();
    expect(svg.querySelector('g.camera')!.getAttribute('transform')).not.toBe('translate(0,0) scale(1)');
    expectNoNaN(svg);
  });

  it('click on a Wahlkreis navigates to wk level', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, fixtureData, nav);
    map.update({ level: 'land', landId: 'BY', details: false });
    svg.querySelector('path.wk[data-id="221"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenCalledWith({ level: 'wk', landId: 'BY', wkId: 221, details: false });
  });

  it('wk level marks the selected Wahlkreis and keeps the rest of the Land clickable', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, fixtureData, nav);
    map.update({ level: 'wk', landId: 'BY', wkId: 220, details: false });
    expect(svg.querySelectorAll('path.wk')).toHaveLength(2);
    expect(svg.querySelector('path.wk[data-id="220"]')!.classList.contains('selected')).toBe(true);
    expect(svg.querySelector('path.wk[data-id="221"]')!.classList.contains('selected')).toBe(false);
    svg.querySelector('path.wk[data-id="221"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenCalledWith({ level: 'wk', landId: 'BY', wkId: 221, details: false });
    nav.mockClear();
    svg.querySelector('path.wk[data-id="220"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).not.toHaveBeenCalled();
    expectNoNaN(svg);
  });

  it('returning to de level removes Wahlkreise and restores Länder', () => {
    const svg = makeSvg();
    const map = createMap(svg, fixtureData, () => {});
    map.update({ level: 'land', landId: 'BY', details: false });
    map.update({ level: 'de', details: false });
    expect(svg.querySelectorAll('path.wk')).toHaveLength(0);
    const bw = svg.querySelector('path.land[data-id="BW"]') as SVGPathElement;
    expect(bw.style.opacity).toBe('1');
    expect(bw.getAttribute('tabindex')).toBe('0');
    expect(svg.querySelector('g.camera')!.getAttribute('transform')).toBe('translate(0,0) scale(1)');
  });

  it('resize() works with a zero-size svg and produces no NaN', () => {
    const svg = makeSvg();
    const map = createMap(svg, fixtureData, () => {});
    map.update({ level: 'wk', landId: 'BY', wkId: 221, details: false });
    map.resize();
    expect(svg.getAttribute('viewBox')).toBe('0 0 800 1000');
    expectNoNaN(svg);
  });

  it('details mode fits the map into the left 40 % on wide screens and back', () => {
    const svg = makeSvg();
    svg.setAttribute('viewBox', '0 0 1280 800'); // jsdom kennt kein Layout: Groesse ueber viewBox
    const map = createMap(svg, fixtureData, () => {});
    map.update({ level: 'de', details: true });
    const t = svg.querySelector('g.camera')!.getAttribute('transform')!;
    const [, tx, , k] = /translate\(([^,]+),([^)]+)\) scale\(([^)]+)\)/.exec(t)!.map(Number);
    expect(k).toBeLessThan(1); // Deutschland schrumpft in den linken Streifen
    // rechter Rand des Bundesgebiets (x-Werte der Pfade) liegt links von 40 % der Breite
    const xs = [...svg.querySelectorAll('path.land')]
      .flatMap((p) => (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?(?=,)/g) ?? []).map(Number);
    expect(Math.max(...xs) * k + tx).toBeLessThanOrEqual(1280 * 0.4 + 0.5);
    map.update({ level: 'de', details: false });
    expect(svg.querySelector('g.camera')!.getAttribute('transform')).toBe('translate(0,0) scale(1)');
    map.update({ level: 'land', landId: 'BY', details: true });
    expectNoNaN(svg);
  });

  it('clicks on the map keep the details mode', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, fixtureData, nav);
    map.update({ level: 'de', details: true });
    svg.querySelector('path.land[data-id="BY"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenLastCalledWith({ level: 'land', landId: 'BY', details: true });
    map.update({ level: 'land', landId: 'BY', details: true });
    svg.querySelector('path.wk[data-id="221"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenLastCalledWith({ level: 'wk', landId: 'BY', wkId: 221, details: true });
  });

  it('does not crash without matchMedia (animated path)', () => {
    vi.unstubAllGlobals();
    const mm = window.matchMedia;
    // jsdom kennt matchMedia nicht
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    try {
      const svg = makeSvg();
      const map = createMap(svg, fixtureData, () => {});
      expect(() => map.update({ level: 'land', landId: 'BW', details: false })).not.toThrow();
      expect(svg.querySelectorAll('path.wk')).toHaveLength(1);
    } finally {
      (window as { matchMedia?: unknown }).matchMedia = mm;
    }
  });
});

describe('createMap (real data)', () => {
  const real: AppData = {
    ...fixtureData,
    geo: read('geo.topo.json'),
    laender: read('laender.json'),
    wahlkreise: read('wahlkreise.json'),
  };

  it('renders 16 Länder, 3 city-state hit circles, and 47 Wahlkreise for Bayern', () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, real, nav);
    expect(svg.querySelectorAll('path.land')).toHaveLength(16);
    for (const p of svg.querySelectorAll('path.land')) expect(p.getAttribute('aria-label')).toBeTruthy();
    const hits = [...svg.querySelectorAll('circle.hit')];
    expect(hits.map((c) => c.getAttribute('data-id')).sort()).toEqual(['BE', 'HB', 'HH']);
    for (const c of hits) expect(Number(c.getAttribute('r'))).toBeGreaterThanOrEqual(14);
    expect(svg.querySelector('circle.hit[data-id="HB"]')!.getAttribute('aria-label')).toBe('Bremen');
    svg.querySelector('circle.hit[data-id="HB"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenCalledWith({ level: 'land', landId: 'HB', details: false });
    expectNoNaN(svg);

    map.update({ level: 'land', landId: 'BY', details: false } satisfies NavState);
    expect(svg.querySelectorAll('path.wk')).toHaveLength(47);
    for (const p of svg.querySelectorAll('path.wk')) {
      expect(p.getAttribute('aria-label')).toMatch(/^Wahlkreis \d+ .+/);
    }
    expect(svg.querySelectorAll('circle.hit')).toHaveLength(0);
    expectNoNaN(svg);
  });

  it('hit circles keep a 14 px screen radius (r * zoom) while zooming back to de and after', async () => {
    installClock();
    await frames(); // zwischengespeicherte Echtzeit von d3-timer verfallen lassen
    const svg = makeSvg();
    const map = createMap(svg, real, () => {});
    map.update({ level: 'land', landId: 'BE', details: false });
    expect(cameraScale(svg)).toBeGreaterThan(5);
    stubReducedMotion(false); // Rueckweg animiert, Kamera ist noch eingezoomt
    map.update({ level: 'de', details: false });
    const hits = () => [...svg.querySelectorAll('circle.hit')];
    expect(hits()).toHaveLength(3);
    const screenR = (c: Element) => Number(c.getAttribute('r')) * cameraScale(svg);
    for (const c of hits()) expect(screenR(c)).toBeCloseTo(14, 1);
    await advance(300); // mitten in der Animation (700 ms)
    const midK = cameraScale(svg);
    expect(midK).toBeGreaterThan(1);
    await frames(); // ohne Zeitfortschritt bleibt die Kamera stehen
    expect(cameraScale(svg)).toBe(midK);
    for (const c of hits()) expect(screenR(c)).toBeCloseTo(14, 1);
    await advance(ZOOM_WAIT);
    expect(cameraScale(svg)).toBe(1);
    for (const c of hits()) expect(Number(c.getAttribute('r'))).toBe(14);
  });
});

describe('createMap (animated mode)', () => {
  beforeEach(async () => {
    stubReducedMotion(false);
    installClock();
    await frames();
  });

  it('rapid de -> land -> de -> land keeps all Wahlkreise visible and interactive', async () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, fixtureData, nav);
    map.update({ level: 'land', landId: 'BY', details: false });
    await advance(ZOOM_WAIT);
    map.update({ level: 'de', details: false });
    await advance(50); // Ausblenden laeuft
    map.update({ level: 'land', landId: 'BY', details: false });
    await advance(ZOOM_WAIT);
    const wks = [...svg.querySelectorAll<SVGPathElement>('path.wk')];
    expect(wks.map((p) => p.getAttribute('data-id')).sort()).toEqual(['220', '221']);
    for (const p of wks) {
      expect(Number(p.style.opacity)).toBe(1);
      expect(p.getAttribute('tabindex')).toBe('0');
      expect(p.style.pointerEvents).toBe('');
    }
    wks[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(nav).toHaveBeenCalledTimes(1);
  });

  it('exiting Wahlkreise are neither clickable nor focusable while they fade out', async () => {
    const svg = makeSvg();
    const nav = vi.fn();
    const map = createMap(svg, fixtureData, nav);
    map.update({ level: 'land', landId: 'BY', details: false });
    await advance(ZOOM_WAIT);
    map.update({ level: 'land', landId: 'BW', details: false });
    const old = svg.querySelector<SVGPathElement>('path.wk[data-id="220"]');
    expect(old).not.toBeNull(); // noch im DOM, blendet aus
    expect(old!.getAttribute('tabindex')).toBe('-1');
    expect(old!.style.pointerEvents).toBe('none');
    old!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    old!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(nav).not.toHaveBeenCalled();
    await advance(ZOOM_WAIT);
    expect(svg.querySelector('path.wk[data-id="220"]')).toBeNull();
    expect(svg.querySelectorAll('path.wk')).toHaveLength(1);
  });
});

/** Alle y-Werte eines Pfads in Bildschirmkoordinaten (Kamera angewandt). */
function screenYs(svg: SVGSVGElement, sel: string): number[] {
  const t = svg.querySelector('g.camera')!.getAttribute('transform')!;
  const [, , ty, k] = /translate\(([^,]+),([^)]+)\) scale\(([^)]+)\)/.exec(t)!.map(Number);
  return [...svg.querySelectorAll(sel)].flatMap((p) => [...(p.getAttribute('d') ?? '').matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1]) * k + ty));
}

describe('createMap (narrow screens)', () => {
  it('keeps the map above the 55vh bottom sheet at every level', () => {
    const svg = makeSvg();
    svg.setAttribute('viewBox', '0 0 400 800'); // Telefon: Sheet beginnt bei 800 - 16 - 440 = 344
    const sheetTop = 800 - 16 - 0.55 * 800;
    const map = createMap(svg, fixtureData, () => {});
    expect(Math.max(...screenYs(svg, 'path.land'))).toBeLessThanOrEqual(sheetTop);
    map.update({ level: 'land', landId: 'BY', details: false });
    expect(Math.max(...screenYs(svg, 'path.land[data-id="BY"]'))).toBeLessThanOrEqual(sheetTop);
    map.update({ level: 'wk', landId: 'BY', wkId: 221, details: false });
    expect(Math.max(...screenYs(svg, 'path.wk[data-id="221"]'))).toBeLessThanOrEqual(sheetTop);
    expect(Math.min(...screenYs(svg, 'path.wk[data-id="221"]'))).toBeGreaterThanOrEqual(64);
  });
});

describe('createMap (immediate update)', () => {
  it('update(state, true) jumps to the target camera without animation', async () => {
    const ref = makeSvg();
    createMap(ref, fixtureData, () => {}).update({ level: 'wk', landId: 'BY', wkId: 221, details: true });
    const target = ref.querySelector('g.camera')!.getAttribute('transform');
    ref.remove();

    stubReducedMotion(false);
    installClock();
    await frames();
    const svg = makeSvg();
    const map = createMap(svg, fixtureData, () => {});
    map.update({ level: 'wk', landId: 'BY', wkId: 221, details: true }, true);
    expect(svg.querySelector('g.camera')!.getAttribute('transform')).toBe(target);
    await advance(ZOOM_WAIT);
    expect(svg.querySelector('g.camera')!.getAttribute('transform')).toBe(target);
  });
});
