export interface NavState {
  level: 'de' | 'land' | 'wk';
  landId?: string;
  wkId?: number;
  details: boolean;
}

export const LAND_IDS = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];

const DE: NavState = { level: 'de', details: false };

export function parseHash(hash: string): NavState {
  const m = /^#\/(.*)$/.exec(hash);
  if (!m) return { ...DE };
  let segs = m[1].split('/');
  if (segs.length === 1 && segs[0] === '') return { ...DE };
  let details = false;
  if (segs[segs.length - 1] === 'details') {
    details = true;
    segs = segs.slice(0, -1);
  }
  if (segs.length === 0) return { level: 'de', details };
  const landId = segs[0].toUpperCase();
  if (!LAND_IDS.includes(landId)) return { ...DE };
  if (segs.length === 1) return { level: 'land', landId, details };
  if (segs.length === 2 && /^[0-9]+$/.test(segs[1])) {
    const wkId = Number(segs[1]);
    if (wkId >= 1 && wkId <= 299) return { level: 'wk', landId, wkId, details };
  }
  return { ...DE };
}

export function formatHash(s: NavState): string {
  const parts: string[] = [];
  if (s.level !== 'de' && s.landId) {
    parts.push(s.landId.toLowerCase());
    if (s.level === 'wk' && s.wkId !== undefined) parts.push(String(s.wkId));
  }
  if (s.details) parts.push('details');
  return parts.length ? '#/' + parts.join('/') : '';
}
