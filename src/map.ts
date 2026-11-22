import { easeCubicInOut, geoArea, geoConicConformal, geoPath, interpolateZoom, select } from 'd3';
import type { Selection } from 'd3';
// Seiteneffekt-Import: haengt selection.transition() an. Ueber 'd3' allein entfernt der Produktions-Build
// ihn (d3 hat "sideEffects": false), dann fehlt transition() und jede Animation wirft.
import 'd3-transition';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { AppData } from './data.ts';
import type { NavState } from './nav.ts';
import { partyColor, strongestParty } from './parties.ts';
import type { PartyId } from './types.ts';

type LandFeature = Feature<Geometry, { id: string; name: string }>;
type WkFeature = Feature<Geometry, { id: number; name: string; landId: string }>;
interface Camera { k: number; tx: number; ty: number }

export interface MapApi {
  /** immediate: ohne Kamerafahrt (z. B. erste Ansicht eines Deep Links) */
  update(state: NavState, immediate?: boolean): void;
  resize(): void;
}

const ZOOM_MS = 700;
const DETAILS_MS = 600; // Wechsel Karte <-> Dashboard, gleich lang wie die CSS-Transition
/** Dashboard-Modus (breite Bildschirme): die Karte belegt nur den linken Anteil, rechts liegt das Dashboard. */
export const DETAILS_MAP_SHARE = 0.4;
const FADE_MS = 300;
const FADED = 0.15;
const HIT_RADIUS = 14;
const HIT_LANDS = ['BE', 'HH', 'HB'];
const PANEL_SPACE = 380; // schwebendes Panel rechts (Desktop)
const PANEL_MIN_WIDTH = 900;
// Schmal: Panel als Bottom-Sheet (CSS: height 55vh, bottom 16px); die Karte endet darueber
const SHEET_SHARE = 0.55;
const SHEET_GAP = 16;
const PAD = 24;
const TOP_PAD = 64; // Platz fuer die Brotkrumen
const MAX_ZOOM = 40;
const WK_FILL = 0.45; // Anteil des freien Bereichs, den ein gewaehlter Wahlkreis fuellt
const WK_MAX_REL = 6; // hoechstens 6-fach naeher als die Landansicht, damit Kontext bleibt
const DEFAULT_W = 800;
const DEFAULT_H = 1000;

export function partyFor(level: 'land' | 'wk', areaId: string | number, data: AppData): PartyId {
  if (level === 'land') {
    const land = data.laender.find((l) => l.id === areaId);
    return land ? strongestParty(land.bundestag.second) : 'sonstige';
  }
  const wk = data.wahlkreise.find((w) => w.id === Number(areaId));
  return wk ? wk.winner.party : 'sonstige';
}

export function fillFor(level: 'land' | 'wk', areaId: string | number, data: AppData): string {
  return partyColor(partyFor(level, areaId, data));
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Bei reduzierter Bewegung wird sofort gesetzt, sonst animiert (gleiche attr/style/remove-API). */
function animate<E extends Element, D>(sel: Selection<E, D, any, any>, ms: number, name?: string): Selection<E, D, any, any> {
  if (reducedMotion()) return sel.interrupt(name);
  return sel.transition(name).duration(ms).ease(easeCubicInOut) as unknown as Selection<E, D, any, any>;
}

/** Groesster Teilpolygon-Schwerpunkt, damit z. B. Bremen nicht zwischen Bremen und Bremerhaven landet. */
function mainPart(f: Feature<Geometry>): Feature<Geometry> {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const parts = (f.geometry as MultiPolygon).coordinates.map(
    (coordinates): Feature<Polygon> => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }),
  );
  return parts.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
}

export function createMap(svg: SVGSVGElement, data: AppData, onNavigate: (s: NavState) => void): MapApi {
  const lands = (feature(data.geo, data.geo.objects.laender) as unknown as FeatureCollection<Geometry, LandFeature['properties']>).features as LandFeature[];
  const allWks = (feature(data.geo, data.geo.objects.wahlkreise) as unknown as FeatureCollection<Geometry, WkFeature['properties']>).features as WkFeature[];
  const landName = new Map(data.laender.map((l) => [l.id, l.name]));
  const nameOf = (f: LandFeature) => landName.get(f.properties.id) ?? f.properties.name;

  const projection = geoConicConformal().parallels([48, 54]).rotate([-10.5, 0]);
  const path = geoPath(projection);
  let width = DEFAULT_W;
  let height = DEFAULT_H;
  let state: NavState = { level: 'de', details: false };
  let camera: Camera = { k: 1, tx: 0, ty: 0 };

  const root = select(svg).attr('role', 'group').attr('aria-label', 'Karte Deutschland');
  root.selectAll('*').remove();
  const cam = root.append('g').attr('class', 'camera');
  const gLand = cam.append('g').attr('class', 'laender');
  const gWk = cam.append('g').attr('class', 'wahlkreise');
  const gOverlay = cam.append('g').attr('class', 'overlay').attr('aria-hidden', 'true');
  const gHit = cam.append('g').attr('class', 'hits');
  // weisser Rand mit dunklem Saum darunter, damit er auch auf hellem Grau (Union) sichtbar ist
  const outline = (cls: string) => {
    const halo = gOverlay.append('path').attr('class', `halo ${cls}`);
    const line = gOverlay.append('path').attr('class', `outline ${cls}`);
    return (f: Feature<Geometry> | null | undefined) => {
      const d = f ? path(f) : null;
      halo.attr('d', d);
      line.attr('d', d);
    };
  };
  const setSelOutline = outline('sel');
  const showHover = outline('hover');
  const activateLand = (id: string) => {
    if (state.level === 'de') onNavigate({ level: 'land', landId: id, details: state.details });
  };
  const activateWk = (f: WkFeature) => {
    if (state.level === 'de' || f.properties.landId !== state.landId) return;
    if (state.level === 'wk' && state.wkId === f.properties.id) return;
    onNavigate({ level: 'wk', landId: f.properties.landId, wkId: f.properties.id, details: state.details });
  };
  const onKey = (act: () => void) => (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    act();
  };

  const landPaths = gLand.selectAll<SVGPathElement, LandFeature>('path.land')
    .data(lands, (d) => d.properties.id)
    .join('path')
    .attr('class', 'land')
    .attr('data-id', (d) => d.properties.id)
    .attr('fill', (d) => fillFor('land', d.properties.id, data))
    .attr('data-party', (d) => partyFor('land', d.properties.id, data))
    .attr('aria-label', nameOf)
    .attr('role', 'button')
    .attr('tabindex', 0)
    .style('opacity', 1)
    .on('click', (_e, d) => activateLand(d.properties.id))
    .on('keydown', (e: KeyboardEvent, d) => onKey(() => activateLand(d.properties.id))(e))
    .on('mouseenter focus', (_e, d) => { if (state.level === 'de') showHover(d); })
    .on('mouseleave blur', () => showHover(null));

  // ---- Kamera ----
  /** Freier Bereich neben dem Panel (breit: rechts davon frei, schmal: ueber dem Bottom-Sheet). */
  const baseFrame = () => {
    const wide = width >= PANEL_MIN_WIDTH;
    const y1 = wide ? height - PAD : height * (1 - SHEET_SHARE) - SHEET_GAP - PAD;
    return {
      x0: PAD, y0: TOP_PAD,
      x1: width - (wide ? PANEL_SPACE + PAD : PAD),
      y1: Math.max(TOP_PAD + 1, y1),
    };
  };
  const frame = () => {
    if (width >= PANEL_MIN_WIDTH && state.details) return { x0: PAD, y0: TOP_PAD, x1: width * DETAILS_MAP_SHARE - PAD, y1: height - PAD };
    return baseFrame();
  };
  const allLands: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: lands };
  const cameraFor = (f: Feature<Geometry> | FeatureCollection<Geometry> | undefined, fill = 0.92, minK = 1, maxK = MAX_ZOOM): Camera => {
    if (!f) return { k: 1, tx: 0, ty: 0 };
    const [[bx0, by0], [bx1, by1]] = path.bounds(f);
    const fr = frame();
    const fw = Math.max(1, fr.x1 - fr.x0);
    const fh = Math.max(1, fr.y1 - fr.y0);
    const fit = fill * Math.min(fw / Math.max(1e-6, bx1 - bx0), fh / Math.max(1e-6, by1 - by0));
    const k = Math.max(minK, Math.min(maxK, fit));
    return { k, tx: (fr.x0 + fr.x1) / 2 - k * (bx0 + bx1) / 2, ty: (fr.y0 + fr.y1) / 2 - k * (by0 + by1) / 2 };
  };
  const camStr = (c: Camera) => `translate(${+c.tx.toFixed(2)},${+c.ty.toFixed(2)}) scale(${+c.k.toFixed(4)})`;
  // Sicht als [ux, uy, w] relativ zur Bildmitte, damit interpolateZoom (van Wijk) weich zoomt
  const toView = (c: Camera): [number, number, number] => [(width / 2 - c.tx) / c.k, (height / 2 - c.ty) / c.k, width / c.k];
  const fromView = ([ux, uy, w]: number[]): Camera => {
    const k = width / w;
    return { k, tx: width / 2 - k * ux, ty: height / 2 - k * uy };
  };
  // Trefferkreise liegen in der skalierten Kamera: Radius gegen den Zoom rechnen, damit er 14 px bleibt
  const scaleHits = () => {
    gHit.selectAll('circle.hit').attr('r', +(HIT_RADIUS / camera.k).toFixed(4));
  };
  const moveCamera = (target: Camera, instant: boolean, ms = ZOOM_MS) => {
    if (instant || reducedMotion()) {
      cam.interrupt('camera');
      camera = target;
      cam.attr('transform', camStr(target));
      scaleHits();
      return;
    }
    const interp = interpolateZoom(toView(camera), toView(target));
    cam.transition('camera').duration(ms).ease(easeCubicInOut)
      .attrTween('transform', () => (t) => {
        camera = t >= 1 ? target : fromView(interp(t));
        scaleHits();
        return camStr(camera);
      });
  };

  // ---- Zustand anwenden ----
  const renderWks = (landId: string | undefined, selectedId: number | undefined) => {
    const wks = landId ? allWks.filter((f) => f.properties.landId === landId) : [];
    const sel = gWk.selectAll<SVGPathElement, WkFeature>('path.wk').data(wks, (d) => String(d.properties.id));
    // Ausblendende Pfade sind sofort nicht mehr bedienbar
    const exiting = sel.exit<WkFeature>()
      .attr('tabindex', -1)
      .attr('aria-hidden', 'true')
      .style('pointer-events', 'none');
    animate(exiting, FADE_MS, 'fade').style('opacity', 0).remove();
    // Pfade, die gerade ausblendeten und wieder gebraucht werden: Entfernen abbrechen, zurueckholen
    sel.interrupt('fade')
      .attr('tabindex', 0)
      .attr('aria-hidden', null)
      .style('pointer-events', null);
    animate(sel, FADE_MS, 'fade').style('opacity', 1);
    const entered = sel.enter().append('path')
      .attr('class', 'wk')
      .attr('data-id', (d) => d.properties.id)
      .attr('fill', (d) => fillFor('wk', d.properties.id, data))
      .attr('data-party', (d) => partyFor('wk', d.properties.id, data))
      .attr('aria-label', (d) => `Wahlkreis ${d.properties.id} ${d.properties.name}`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('d', path)
      .style('opacity', 0)
      .on('click', (_e, d) => activateWk(d))
      .on('keydown', (e: KeyboardEvent, d) => onKey(() => activateWk(d))(e))
      .on('mouseenter focus', (_e, d) => showHover(d))
      .on('mouseleave blur', () => showHover(null));
    animate(entered, FADE_MS, 'fade').style('opacity', 1);
    const merged = entered.merge(sel);
    merged.classed('selected', (d) => d.properties.id === selectedId)
      .attr('aria-current', (d) => (d.properties.id === selectedId ? 'true' : null));
    const selected = wks.find((f) => f.properties.id === selectedId);
    setSelOutline(selected);
    return selected;
  };

  const renderHits = (show: boolean) => {
    const hits = show ? lands.filter((f) => HIT_LANDS.includes(f.properties.id)) : [];
    gHit.selectAll<SVGCircleElement, LandFeature>('circle.hit')
      .data(hits, (d) => d.properties.id)
      .join((enter) => enter.append('circle')
        .attr('class', 'hit')
        .attr('data-id', (d) => d.properties.id)
        .attr('aria-label', nameOf)
        .attr('fill', 'transparent')
        .on('click', (_e, d) => activateLand(d.properties.id))
        .on('mouseenter', (_e, d) => showHover(d))
        .on('mouseleave', () => showHover(null)))
      .each(function (d) {
        const [cx, cy] = path.centroid(mainPart(d));
        select(this).attr('cx', +cx.toFixed(2)).attr('cy', +cy.toFixed(2));
      });
    scaleHits();
  };

  const apply = (instant: boolean, ms = ZOOM_MS) => {
    const landId = state.level === 'de' ? undefined : state.landId;
    const active = landId !== undefined;
    showHover(null);
    landPaths
      .attr('tabindex', active ? -1 : 0)
      .attr('aria-hidden', (d) => (active && d.properties.id !== landId ? 'true' : null))
      .style('pointer-events', () => (active ? 'none' : null));
    animate(landPaths, ZOOM_MS / 2, 'fade').style('opacity', (d) => (!active || d.properties.id === landId ? 1 : FADED));
    const selectedWk = renderWks(landId, state.level === 'wk' ? state.wkId : undefined);
    // Deutschland: Projektion passt schon in den Normalrahmen, im Dashboard-Modus in den linken Streifen einpassen
    const landCam = landId !== undefined ? cameraFor(lands.find((f) => f.properties.id === landId))
      : state.details && width >= PANEL_MIN_WIDTH ? cameraFor(allLands, 1, 0) : cameraFor(undefined);
    // ein Wahlkreis bekommt Umgebung mit, aber nie weniger Zoom als sein Land
    moveCamera(selectedWk ? cameraFor(selectedWk, WK_FILL, landCam.k, Math.min(MAX_ZOOM, landCam.k * WK_MAX_REL)) : landCam, instant, ms);
    renderHits(!active);
  };

  const resize = () => {
    const vb = svg.viewBox?.baseVal;
    width = svg.clientWidth || (vb && vb.width) || DEFAULT_W;
    height = svg.clientHeight || (vb && vb.height) || DEFAULT_H;
    root.attr('viewBox', `0 0 ${width} ${height}`);
    // Deutschland-Ansicht laesst wie die Landansicht Platz fuer das Panel (rechts bzw. unten)
    const fr = baseFrame();
    projection.fitExtent([[fr.x0, fr.y0], [fr.x1, fr.y1]], allLands);
    landPaths.attr('d', path);
    gWk.selectAll<SVGPathElement, WkFeature>('path.wk').attr('d', path);
    apply(true);
  };

  resize();
  return {
    update(next: NavState, immediate = false) {
      const onlyMode = next.details !== state.details && next.level === state.level
        && next.landId === state.landId && next.wkId === state.wkId;
      state = { ...next };
      apply(immediate, onlyMode ? DETAILS_MS : ZOOM_MS);
    },
    resize,
  };
}
