/** Prozentwert mit deutschem Dezimalkomma, z. B. 37.2 -> "37,2 %"; ungueltige Werte -> "–". */
export function fmtPct(value: number | null | undefined, minDigits = 1, maxDigits = minDigits): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–';
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits })} %`;
}

/** ISO-Datum (YYYY-MM-DD) als deutsches Datum, unabhaengig von der Zeitzone. */
export function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}
