import { afterEach, describe, expect, it } from 'vitest';
import { pollsStale, renderFooter } from '../src/footer.ts';
import type { Meta } from '../src/types.ts';

const meta = (polls: string): Meta => ({ stand: { election: '2026-11-19', people: '2026-11-20', polls } });
const NOW = new Date('2026-11-21T10:00:00Z');
const WARN = 'Umfragedaten sind älter als 7 Tage';

function render(polls = '2026-11-21', now = NOW): HTMLElement {
  const el = document.createElement('footer');
  document.body.append(el);
  renderFooter(el, meta(polls), now);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('pollsStale', () => {
  it('compares calendar days in UTC', () => {
    expect(pollsStale('2026-11-14', NOW)).toBe(false); // genau 7 Tage
    expect(pollsStale('2026-11-13', NOW)).toBe(true); // 8 Tage
    expect(pollsStale('2026-11-13', new Date('2026-11-21T00:00:00Z'))).toBe(true);
    expect(pollsStale('2026-11-14', new Date('2026-11-21T23:59:59Z'))).toBe(false);
    expect(pollsStale('kaputt', NOW)).toBe(false);
  });
});

describe('renderFooter', () => {
  it('shows the warning when the polls are 10 days old', () => {
    const el = render('2026-11-11');
    const warn = el.querySelector('.footer-warning');
    expect(warn?.textContent).toBe(WARN);
    expect(warn?.getAttribute('role')).toBe('status');
  });

  it('shows no warning when the polls are 2 days old', () => {
    const el = render('2026-11-19');
    expect(el.querySelector('.footer-warning')).toBeNull();
    expect(el.textContent).not.toContain(WARN);
  });

  it('names all sources with their licences', () => {
    const t = render().textContent!;
    expect(t).toContain('Die Bundeswahlleiterin');
    expect(t).toContain('© Die Bundeswahlleiterin, Statistisches Bundesamt, Wiesbaden 2024, Wahlkreiskarte für die Wahl zum 21. Deutschen Bundestag');
    expect(t).toContain('Grundlage der Geoinformationen © Geobasis-DE / BKG 2024');
    expect(t).toContain('© Die Bundeswahlleiterin, Wiesbaden 2025');
    expect(t).toContain('Datenlizenz Deutschland – Namensnennung – Version 2.0');
    expect(t).toContain('Abgeordnetenwatch');
    expect(t).toContain('CC0 1.0');
    expect(t).toContain('Umfragedaten: dawum.de (ODC-ODbL)');
    expect(t).toContain('Landtagswahlergebnisse: Wikipedia, CC BY-SA 4.0; nicht gegen amtliche Quellen geprüft');
    expect(t).toContain('23 Wahlkreissieger');
    expect(t).toContain('Wahlbeteiligung der Landtagswahlen: nach den Zahlen der Landeswahlleiter');
    expect(t).not.toMatch(/Fraktionsvorsitz/);
    expect(t).toContain('Keine Wahlempfehlung. Die Karte zeigt Daten neutral.');
  });

  it('shows the Stand per data kind in German date format', () => {
    const el = render('2026-11-18');
    const stand = el.querySelector('.footer-stand')!.textContent!;
    expect(stand).toContain('Wahl 19.11.2026');
    expect(stand).toContain('Abgeordnete/Abstimmungen 20.11.2026');
    expect(stand).toContain('Umfragen 18.11.2026');
  });

  it('is a collapsible details element with a summary and safe external links', () => {
    const el = render();
    const details = el.querySelector('details')!;
    expect(details.querySelector('summary')!.textContent).toBe('Quellen & Lizenzen');
    expect(details.open).toBe(false); // eingeklappt; breit steht die Kurzfassung daneben
    expect(el.querySelector('.footer-brief')!.textContent).toContain('Stand: Wahl');
    expect(el.querySelector('.footer-brief')!.textContent).toContain('Keine Wahlempfehlung');
    // die immer sichtbare Kurzzeile nennt Wikipedia mit Lizenz
    expect(el.querySelector('.footer-brief .footer-credit')!.textContent).toContain('Wikipedia (CC BY-SA 4.0)');
    const links = [...el.querySelectorAll('a')];
    expect(links.length).toBeGreaterThanOrEqual(8);
    for (const a of links) {
      expect(a.href).toMatch(/^https:\/\//);
      expect(a.rel).toBe('noopener noreferrer');
    }
    expect(links.map((a) => a.href)).toEqual(expect.arrayContaining([
      'https://www.govdata.de/dl-de/by-2-0',
      'https://creativecommons.org/publicdomain/zero/1.0/deed.de',
      'https://opendatacommons.org/licenses/odbl/1-0/',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    ]));
    expect(el.querySelector('.footer-legend')).not.toBeNull();
  });

  it('replaces its content on re-render', () => {
    const el = render('2026-11-01');
    renderFooter(el, meta('2026-11-21'), NOW);
    expect(el.querySelectorAll('details')).toHaveLength(1);
    expect(el.querySelector('.footer-warning')).toBeNull();
  });
});
