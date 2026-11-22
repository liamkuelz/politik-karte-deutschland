/** Kleines Element mit optionaler Klasse und Text. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Nur absolute https-URLs gelten als sicher (kein javascript:, data:, http: oder relativer Pfad). */
function safeHttps(href: string): string | null {
  try {
    const u = new URL(href); // ohne Basis: relative URLs werfen
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Externer Link, oeffnet in neuem Tab ohne Zugriff auf diese Seite.
 * Daten von aussen werden nie als Code interpretiert: ohne gueltige https-URL nur Text.
 */
export function extLink(href: string, text: string, cls?: string): HTMLAnchorElement | HTMLSpanElement {
  const safe = safeHttps(href);
  if (!safe) return h('span', cls, text);
  const a = h('a', cls, text);
  a.href = safe;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

export function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
