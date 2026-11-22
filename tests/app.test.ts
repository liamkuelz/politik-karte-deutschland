import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureData } from './fixtures.ts';

const loadAllMock = vi.fn();
vi.mock('../src/data.ts', () => ({
  loadAll: () => loadAllMock(),
  loadVotes: async () => [],
}));

// Schalter, mit denen createMap bzw. map.update nach erfolgreichem Laden werfen
const mapFault = vi.hoisted(() => ({ create: false, update: false }));
const EVIL = '<img src=x onerror=alert(1)> kaputt';
vi.mock('../src/map.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/map.ts')>();
  return {
    ...actual,
    createMap: (...args: Parameters<typeof actual.createMap>) => {
      if (mapFault.create) throw new Error(EVIL);
      const m = actual.createMap(...args);
      return {
        ...m,
        update: (s: Parameters<typeof m.update>[0], i?: boolean) => {
          if (mapFault.update) throw new Error(EVIL);
          m.update(s, i);
        },
      };
    },
  };
});

const { startApp } = await import('../src/app.ts');

const BODY = `
  <nav id="crumbs" aria-label="Brotkrumen"></nav>
  <svg id="map"></svg>
  <aside id="panel" aria-label="Informationen"></aside>
  <main id="dashboard"></main>
  <div id="legend"></div>
  <footer id="footer"></footer>
  <div id="card-root"></div>`;

let stop: (() => void) | undefined;

function setUrl(hash: string) {
  history.replaceState(null, '', `/${hash}`);
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.innerHTML = BODY;
  document.body.className = '';
  loadAllMock.mockReset();
  mapFault.create = false;
  mapFault.update = false;
  loadAllMock.mockResolvedValue(fixtureData);
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') || q.includes('min-width'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setUrl('');
});

describe('startApp', () => {
  it('deep link #/by/details renders the Bayern dashboard; popstate closes it', async () => {
    setUrl('#/by/details');
    stop = await startApp();
    expect(document.body.classList.contains('is-details')).toBe(true);
    expect(document.querySelector('#dashboard .dash-title')!.textContent).toBe('Bayern');
    expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Bayern');
    expect(document.querySelector('#crumbs')!.textContent).toContain('Bayern');
    expect(document.querySelector('#footer details')).not.toBeNull();
    expect(document.querySelector('#legend .legend-rule')!.textContent).toBe('Wahlkreise: Gewinner der Erststimmen');

    history.pushState(null, '', '/#/by');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(document.body.classList.contains('is-details')).toBe(false);
    expect(location.hash).toBe('#/by');
  });

  it('corrects invalid deep links with replaceState', async () => {
    setUrl('#/by/260');
    const replace = vi.spyOn(history, 'replaceState');
    stop = await startApp();
    expect(location.hash).toBe('#/by');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Bayern');
  });

  it('a bad link degrades to Germany and clears the hash', async () => {
    setUrl('#/zz/9999');
    stop = await startApp();
    expect(location.hash).toBe('');
    expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Deutschland');
  });

  it('navigation pushes one history entry and re-renders; equal states do not push', async () => {
    setUrl('');
    stop = await startApp();
    const push = vi.spyOn(history, 'pushState');
    document.querySelector('#map path.land[data-id="BY"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('#/by');
    expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Bayern');
    // Brotkrumen zurueck nach Deutschland: Hash wird entfernt
    (document.querySelector('#crumbs button.crumb') as HTMLButtonElement).click();
    expect(push).toHaveBeenCalledTimes(2);
    expect(location.hash).toBe('');
    // hashchange auf denselben Zustand rendert nicht neu und schreibt keine Historie
    const panelInner = document.querySelector('#panel .panel-inner');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(push).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#panel .panel-inner')).toBe(panelInner);
  });

  it('hashchange (manual URL edit) renders the new state without pushing', async () => {
    setUrl('');
    stop = await startApp();
    const push = vi.spyOn(history, 'pushState');
    history.replaceState(null, '', '/#/bw/260');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Stuttgart I');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a loading state and an error with a retry button on failure (as text)', async () => {
    let reject!: (e: Error) => void;
    loadAllMock.mockReturnValue(new Promise((_r, j) => { reject = j; }));
    const started = startApp();
    expect(document.querySelector('#app-status')!.textContent).toContain('Daten werden geladen');
    reject(new Error('<img src=x onerror=alert(1)> kaputt'));
    stop = await started;
    await flush();
    const status = document.querySelector('#app-status')!;
    expect(status.textContent).toContain('<img src=x onerror=alert(1)> kaputt');
    expect(status.querySelector('img')).toBeNull();
    const retry = status.querySelector('button')!;
    expect(retry.textContent).toBe('Erneut versuchen');
  });

  it('removes the loading state after success', async () => {
    stop = await startApp();
    expect(document.querySelector('#app-status')).toBeNull();
  });

  describe('cards', () => {
    const cardTitle = () => document.querySelector('#card-root [role="dialog"] .card-title')?.textContent;
    const popTo = (hash: string, state: unknown = null) => {
      history.pushState(state, '', `/${hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    /** wartet, bis ein (asynchrones) history.go/back sein popstate ausgeloest hat */
    const nextPop = () => new Promise<void>((r) => window.addEventListener('popstate', () => setTimeout(r, 0), { once: true }));

    it('deep link #/partei/union shows the party card over Germany; reload-style re-entry is idempotent', async () => {
      setUrl('#/partei/union');
      stop = await startApp();
      expect(location.hash).toBe('#/partei/union');
      expect(cardTitle()).toBe('CDU/CSU');
      expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Deutschland');
      expect(document.activeElement).toBe(document.querySelector('#card-root .card-title'));
      // gleicher Zustand per hashchange: kein zweiter Render
      const dialog = document.querySelector('#card-root [role="dialog"]');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(document.querySelector('#card-root [role="dialog"]')).toBe(dialog);
    });

    it('drops an unknown card from a deep link and keeps the view', async () => {
      setUrl('#/by/partei/fdp');
      stop = await startApp();
      expect(location.hash).toBe('#/by');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
      expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Bayern');
    });

    it('opening and Back only touch the card: panel, crumbs and focus target stay', async () => {
      setUrl('#/by');
      stop = await startApp();
      const panelInner = document.querySelector('#panel .panel-inner');
      const crumbList = document.querySelector('#crumbs ol');
      const trigger = document.createElement('button');
      trigger.dataset.cardTrigger = '';
      document.querySelector('#panel')!.append(trigger);
      trigger.focus();

      popTo('#/by/partei/spd', { cardDepth: 1 });
      expect(cardTitle()).toBe('SPD');
      expect(document.querySelector('.card-results h3')!.textContent).toBe('Ergebnis in Bayern');
      expect(document.querySelector('#panel .panel-inner')).toBe(panelInner);

      const back = nextPop();
      history.back();
      await back;
      expect(location.hash).toBe('#/by');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
      expect(document.querySelector('#panel .panel-inner')).toBe(panelInner);
      expect(document.querySelector('#crumbs ol')).toBe(crumbList);
      expect(document.activeElement).toBe(trigger);
    });

    it('closing a card opened by pushState goes back in history instead of pushing', async () => {
      setUrl('');
      stop = await startApp();
      popTo('#/person/1003', { cardDepth: 1 });
      expect(cardTitle()).toBe('Clara Probe');
      const push = vi.spyOn(history, 'pushState');
      // Wechsel zur Parteikarte: ein neuer Eintrag
      (document.querySelector('#card-root .card-party') as HTMLButtonElement).click();
      expect(push).toHaveBeenCalledTimes(1);
      expect(location.hash).toBe('#/partei/spd');
      expect(cardTitle()).toBe('SPD');
      // Schliessen springt ueber beide Karten zurueck
      const back = nextPop();
      (document.querySelector('[data-action="close-card"]') as HTMLButtonElement).click();
      await back;
      expect(push).toHaveBeenCalledTimes(1);
      expect(location.hash).toBe('');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
    });

    it('closing a deep-linked card pushes the state without card; Details then opens without card', async () => {
      setUrl('#/by/partei/spd');
      stop = await startApp();
      const push = vi.spyOn(history, 'pushState');
      document.querySelector('#card-root .card-title')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(push).toHaveBeenCalledTimes(1);
      expect(location.hash).toBe('#/by');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
      (document.querySelector('#panel [data-action="details"]') as HTMLButtonElement).click();
      expect(location.hash).toBe('#/by/details');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
    });

    it('navigating via crumbs or the map closes the card', async () => {
      setUrl('#/by/partei/spd');
      stop = await startApp();
      (document.querySelector('#crumbs button.crumb') as HTMLButtonElement).click();
      expect(location.hash).toBe('');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
      expect(document.querySelector('#panel .panel-title')!.textContent).toBe('Deutschland');

      popTo('#/partei/afd');
      expect(cardTitle()).toBe('AfD');
      document.querySelector('#map path.land[data-id="BW"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(location.hash).toBe('#/bw');
      expect(document.querySelector('#card-root')!.childElementCount).toBe(0);
    });
  });

  describe('errors after a successful load', () => {
    const rejections: unknown[] = [];
    const onRejection = (e: PromiseRejectionEvent) => rejections.push(e.reason);
    beforeEach(() => { rejections.length = 0; window.addEventListener('unhandledrejection', onRejection); });
    afterEach(() => window.removeEventListener('unhandledrejection', onRejection));

    function expectErrorBox() {
      const status = document.querySelector('#app-status')!;
      expect(status).not.toBeNull();
      expect(status.getAttribute('role')).toBe('alert');
      expect(status.textContent).toContain(EVIL);
      expect(status.querySelector('img')).toBeNull(); // Fehlertext ist nur Text
      expect(status.querySelector('button')!.textContent).toBe('Erneut versuchen');
    }
    const listeners = () => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const net = (type: string) => add.mock.calls.filter((c) => c[0] === type).length
        - remove.mock.calls.filter((c) => c[0] === type).length;
      return net;
    };

    it('a throw in createMap shows the error box and attaches no listeners', async () => {
      mapFault.create = true;
      const net = listeners();
      setUrl('#/by');
      stop = await startApp(); // loest ohne Ablehnung auf
      await flush();
      expectErrorBox();
      for (const t of ['popstate', 'hashchange', 'resize']) expect(net(t)).toBeLessThanOrEqual(0);
      expect(rejections).toEqual([]);
    });

    it('a throw during a later navigation render shows the error box and detaches the listeners', async () => {
      const net = listeners();
      setUrl('');
      stop = await startApp();
      expect(document.querySelector('#app-status')).toBeNull();
      mapFault.update = true;
      document.querySelector('#map path.land[data-id="BY"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expectErrorBox();
      for (const t of ['popstate', 'hashchange', 'resize']) expect(net(t)).toBe(0);
      // weitere History-Ereignisse fuehren zu keinem zweiten Kasten
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(document.querySelectorAll('#app-status')).toHaveLength(1);
      expect(rejections).toEqual([]);
    });

    it('a throw in a popstate render is caught as well', async () => {
      setUrl('');
      stop = await startApp();
      mapFault.update = true;
      history.pushState(null, '', '/#/bw');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await flush();
      expectErrorBox();
      expect(rejections).toEqual([]);
    });
  });
});
