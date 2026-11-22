// Pure helpers for polls.mjs: average across institutes.

const round1 = (x) => Math.round(x * 10) / 10;
const DAY = 86_400_000;
const day = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY;

/** Days a survey may lie before a point's date and still count (a survey exactly 21 days older counts). */
export const WINDOW_DAYS = 21;

/**
 * Average across institutes: one point per date on which at least one survey was published, ascending.
 * For each such date D every institute contributes its MOST RECENT survey dated D-21 days ... D (one survey per
 * institute, so a prolific institute does not dominate; several surveys of one institute on that same day are
 * averaged first). Each party's value is the mean over the contributing surveys that list it (parties no
 * contributing survey lists are left out), rounded to one decimal.
 * @param {{date: string, institute: string|number, values: Record<string, number>}[]} surveys
 * @param {number} [windowDays]
 * @returns {{date: string, values: Record<string, number>}[]}
 */
export function averageInstitutes(surveys, windowDays = WINDOW_DAYS) {
  const byInstitute = new Map(); // institute -> surveys ascending by date
  for (const s of surveys) {
    const k = String(s.institute);
    if (!byInstitute.has(k)) byInstitute.set(k, []);
    byInstitute.get(k).push(s);
  }
  for (const list of byInstitute.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const dates = [...new Set(surveys.map((s) => s.date))].sort();
  return dates.map((date) => {
    const d = day(date);
    const parties = new Map(); // party -> { sum, n } over institutes
    for (const list of byInstitute.values()) {
      // newest survey date of this institute within the window
      let latest = null;
      for (const s of list) {
        const age = d - day(s.date);
        if (age >= 0 && age <= windowDays) latest = s.date;
      }
      if (latest === null) continue;
      const same = list.filter((s) => s.date === latest);
      const inst = new Map(); // this institute's value per party (mean over its same-day surveys)
      for (const s of same) {
        for (const [party, v] of Object.entries(s.values)) {
          const acc = inst.get(party) ?? { sum: 0, n: 0 };
          acc.sum += v;
          acc.n += 1;
          inst.set(party, acc);
        }
      }
      for (const [party, { sum, n }] of inst) {
        const acc = parties.get(party) ?? { sum: 0, n: 0 };
        acc.sum += sum / n;
        acc.n += 1;
        parties.set(party, acc);
      }
    }
    const values = {};
    for (const [party, { sum, n }] of parties) values[party] = round1(sum / n);
    return { date, values };
  });
}
