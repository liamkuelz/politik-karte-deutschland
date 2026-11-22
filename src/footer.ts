import type { Meta } from './types.ts';
import { extLink, h } from './ui/dom.ts';
import { fmtDate } from './ui/format.ts';

const DAY = 86_400_000;
const MAX_POLL_AGE_DAYS = 7;

const LICENCE = {
  dlde: { href: 'https://www.govdata.de/dl-de/by-2-0', text: 'Datenlizenz Deutschland – Namensnennung – Version 2.0' },
  cc0: { href: 'https://creativecommons.org/publicdomain/zero/1.0/deed.de', text: 'CC0 1.0' },
  odbl: { href: 'https://opendatacommons.org/licenses/odbl/1-0/', text: 'ODC-ODbL' },
  ccbysa: { href: 'https://creativecommons.org/licenses/by-sa/4.0/', text: 'CC BY-SA 4.0' },
};

/** Umfragestand liegt mehr als 7 Kalendertage (UTC) vor `now`. Ungueltiges Datum: keine Warnung. */
export function pollsStale(iso: string, now: Date): boolean {
  const stand = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(stand)) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - stand) / DAY) > MAX_POLL_AGE_DAYS;
}

/** Absatz aus Text und Links. */
function line(cls: string, ...parts: (string | Node)[]): HTMLParagraphElement {
  const p = h('p', cls);
  p.append(...parts);
  return p;
}

function source(label: string, ...parts: (string | Node)[]): HTMLLIElement {
  const li = h('li', 'footer-source');
  li.append(h('span', 'footer-label', label), ' ', ...parts);
  return li;
}

/**
 * Fusszeile: Stand je Datenart, Warnhinweis bei alten Umfragen, Quellen mit Lizenzangaben
 * (Wortlaut nach scripts/SOURCES.md) und ein Platz fuer die Legende auf schmalen Bildschirmen.
 * Breit: Stand, Kurz-Namensnennung und Neutralitaetshinweis stehen dauerhaft sichtbar, die vollstaendigen
 * Lizenztexte klappen per `<details>` „Quellen & Lizenzen“ auf (ausgeklappt verdeckten sie den Westen der Karte).
 * Schmal: alles inkl. Legende in der einen Zeile „Quellen & Lizenzen“.
 */
export function renderFooter(el: HTMLElement, meta: Meta, now: Date): void {
  const { election, people, polls } = meta.stand;
  const details = h('details', 'footer-details');
  const summary = h('summary', 'footer-summary', 'Quellen & Lizenzen');

  const body = h('div', 'footer-body');
  const legendSlot = h('div', 'footer-legend');
  const stand = line('footer-stand',
    `Stand: Wahl ${fmtDate(election)} · Abgeordnete/Abstimmungen ${fmtDate(people)} · Umfragen ${fmtDate(polls)}`);
  const stale = pollsStale(polls, now);
  const warning = stale ? h('p', 'footer-warning', 'Umfragedaten sind älter als 7 Tage') : null;
  warning?.setAttribute('role', 'status');

  const link = (l: { href: string; text: string }) => extLink(l.href, l.text);
  const sources = h('ul', 'footer-sources');
  sources.append(
    source('Wahlkreisgrenzen und Bundestagswahl 2025:',
      extLink('https://www.bundeswahlleiterin.de/', 'Die Bundeswahlleiterin'), '. ',
      '© Die Bundeswahlleiterin, Statistisches Bundesamt, Wiesbaden 2024, Wahlkreiskarte für die Wahl zum 21. Deutschen Bundestag; ',
      'Grundlage der Geoinformationen © Geobasis-DE / BKG 2024; ',
      '© Die Bundeswahlleiterin, Wiesbaden 2025. ',
      link(LICENCE.dlde), '. Geometrien vereinfacht.'),
    source('Abgeordnete und Abstimmungen:',
      extLink('https://www.abgeordnetenwatch.de/', 'Abgeordnetenwatch'), ', ', link(LICENCE.cc0), '.'),
    source('Umfragedaten: dawum.de (ODC-ODbL)', '–',
      extLink('https://dawum.de/', 'dawum.de'), ', ', link(LICENCE.odbl), '.'),
    source('Landtagswahlergebnisse: Wikipedia, CC BY-SA 4.0; nicht gegen amtliche Quellen geprüft', '–',
      extLink('https://de.wikipedia.org/', 'Wikipedia'), ', ', link(LICENCE.ccbysa), '.'),
    source('Wahlbeteiligung der Landtagswahlen:',
      'nach den Zahlen der Landeswahlleiter (amtliche Ergebnisse), von Hand übernommen.'),
    source('Namen der 23 Wahlkreissieger ohne Bundestagsmandat sowie der Regierungschefs der Länder:',
      'Wikipedia, ', link(LICENCE.ccbysa), '.'),
  );
  const HINT = 'Über diese Daten: Keine Wahlempfehlung. Die Karte zeigt Daten neutral.';
  const hint = line('footer-hint', HINT);

  // Kurzfassung (nur breite Bildschirme, per CSS): immer sichtbar ohne Aufklappen
  const brief = h('div', 'footer-brief');
  brief.append(
    stand.cloneNode(true),
    line('footer-credit', 'Daten: Die Bundeswahlleiterin · © Geobasis-DE / BKG 2024 · Abgeordnetenwatch · Umfragedaten: dawum.de (ODC-ODbL) · Wikipedia (CC BY-SA 4.0)'),
    line('footer-hint', HINT),
  );
  stand.classList.add('footer-narrow');
  hint.classList.add('footer-narrow');
  body.append(legendSlot, stand, sources, hint);
  details.append(summary, body);
  // Warnung ausserhalb von <details>: bleibt auch eingeklappt sichtbar
  el.replaceChildren(...(warning ? [warning] : []), brief, details);
}
