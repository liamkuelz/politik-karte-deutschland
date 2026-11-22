import { renderDashboard, setDetailsMode } from './dashboard.ts';
import type { AppData } from './data.ts';
import { loadAll } from './data.ts';
import { renderFooter } from './footer.ts';
import { renderLegend } from './legend.ts';
import { createMap } from './map.ts';
import type { MapApi } from './map.ts';
import { formatHash, parseHash } from './nav.ts';
import type { NavState } from './nav.ts';
import { renderCrumbs, renderPanel } from './panel.ts';
import { h } from './ui/dom.ts';
import { sameState, validateState } from './validate.ts';

const byId = (id: string) => document.getElementById(id);

/** Lade- bzw. Fehlerhinweis (nur Text, nie HTML). */
function statusBox(): HTMLElement {
  const box = h('div', 'app-status glass');
  box.id = 'app-status';
  box.setAttribute('role', 'status');
  box.append(h('p', undefined, 'Daten werden geladen …'));
  document.body.append(box);
  return box;
}

function showError(box: HTMLElement, err: unknown): void {
  box.setAttribute('role', 'alert');
  const msg = err instanceof Error ? err.message : String(err);
  const retry = h('button', 'btn-details', 'Erneut versuchen');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  box.replaceChildren(h('p', 'app-status-title', 'Die Daten konnten nicht geladen werden.'), h('p', 'app-status-msg', msg), retry);
}

/** Fehlerkasten mit „Erneut versuchen“ (vorhandenen Lade-/Fehlerkasten wiederverwenden). */
export function showFatal(err: unknown): void {
  showError(byId('app-status') ?? statusBox(), err);
}

/** URL-Wert fuer einen Zustand: Deutschland ohne Hash. */
const urlFor = (s: NavState) => formatHash(s) || `${location.pathname}${location.search}`;

/**
 * Startet die App: Daten laden, Zustand aus der URL lesen und pruefen, alles rendern und
 * Navigation/History verdrahten. Liefert eine Aufraeumfunktion (Tests).
 * Jeder Fehler (Laden, Aufbau, spaetere Renders) endet im sichtbaren Fehlerkasten statt in einer
 * leeren Seite; danach sind alle Listener wieder entfernt.
 */
export async function startApp(): Promise<() => void> {
  const status = statusBox();
  let data: AppData;
  try {
    data = await loadAll();
  } catch (e) {
    showError(status, e);
    return () => {};
  }
  status.remove();

  const root = document.documentElement;
  let map: MapApi | undefined;
  let raf = 0;
  let failed = false;
  const onPop = () => guard(() => fromUrl());
  const onResize = () => {
    if (raf || failed) return;
    raf = requestAnimationFrame(() => { raf = 0; guard(() => map?.resize()); });
  };
  const cleanup = () => {
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('hashchange', onPop);
    window.removeEventListener('resize', onResize);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    root.classList.remove('is-booting');
  };
  const fail = (e: unknown) => {
    if (failed) return;
    failed = true;
    cleanup();
    showFatal(e);
  };
  /** Fuehrt fn aus; ein Fehler zeigt den Fehlerkasten (einmalig) statt still abzubrechen. */
  function guard(fn: () => void) {
    if (failed) return;
    try { fn(); } catch (e) { fail(e); }
  }

  let current: NavState | undefined;
  let footerLegend: HTMLElement | null = null;
  const svg = byId('map') as unknown as SVGSVGElement;
  const panel = byId('panel')!;
  const crumbs = byId('crumbs')!;
  const dashboard = byId('dashboard')!;
  const legend = byId('legend');
  const footer = byId('footer')!;

  // Einziger Render-Trichter fuer Start, Navigation und History
  const render = (s: NavState, immediate = false) => {
    if (current && sameState(current, s)) return;
    current = s;
    map!.update(s, immediate);
    renderPanel(panel, s, data, navigate);
    renderCrumbs(crumbs, s, data, navigate);
    if (s.details) renderDashboard(dashboard, s, data, navigate).catch(fail);
    setDetailsMode(s.details);
    if (legend) renderLegend(legend, s, data);
    if (footerLegend) renderLegend(footerLegend, s, data);
  };

  function navigate(next: NavState) {
    guard(() => {
      const s = validateState(next, data);
      if (formatHash(s) !== location.hash) history.pushState(null, '', urlFor(s));
      render(s);
    });
  }

  /** Zustand aus der URL; ungueltige Teile werden korrigiert und per replaceState zurueckgeschrieben. */
  const fromUrl = (immediate = false) => {
    const s = validateState(parseHash(location.hash), data);
    if (formatHash(s) !== location.hash) history.replaceState(null, '', urlFor(s));
    render(s, immediate);
  };

  guard(() => {
    renderFooter(footer, data.meta, new Date());
    footerLegend = footer.querySelector<HTMLElement>('.footer-legend');
    map = createMap(svg, data, navigate);
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    window.addEventListener('resize', onResize);
    // Erste Ansicht (auch Deep Link) ohne Kamerafahrt und ohne Layout-Transition (Klasse fuer zwei Frames)
    root.classList.add('is-booting');
    fromUrl(true);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-booting')));
  });

  return cleanup;
}
