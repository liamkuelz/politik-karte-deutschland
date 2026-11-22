// @vitest-environment node
import { describe, expect, it } from 'vitest';
// @ts-expect-error reines JS-Modul ohne Typdeklaration
import { checkDist } from '../scripts/smoke-dist.mjs';

const GOOD_JS = 'Hn.prototype.interrupt=Ca,Hn.prototype.transition=Mo;var e=e=>`/politik-karte/data/${e}`;';
const GOOD_HTML = '<html><head><link rel="stylesheet" href="/assets/a.css"></head><body></body></html>';
const GOOD_CSS = 'body{background:#000;font-family:system-ui,sans-serif}';

const run = (over: Partial<{ html: string; js: string[]; css: string[] }> = {}): string[] =>
  checkDist({ html: GOOD_HTML, js: [GOOD_JS], css: [GOOD_CSS], ...over });

describe('checkDist', () => {
  it('meldet keine Fehler fuer ein gesundes Bundle', () => {
    expect(run()).toEqual([]);
  });

  it('meldet fehlenden d3-transition-Patch', () => {
    const problems = run({ js: ['Hn.prototype.interrupt=Ca;var e=e=>`/data/${e}`;'] });
    expect(problems.join('\n')).toMatch(/transition/);
  });

  it('akzeptiert den Patch auch ueber mehrere Bundles verteilt', () => {
    expect(run({ js: ['Hn.prototype.transition=Mo;', 'var e=e=>`/data/${e}`;'] })).toEqual([]);
  });

  it('meldet fehlenden Datenpfad', () => {
    const problems = run({ js: ['Hn.prototype.transition=Mo;'] });
    expect(problems.join('\n')).toMatch(/data/);
  });

  it('meldet Fremdhosts in index.html und CSS', () => {
    const html = run({ html: '<link href="https://fonts.googleapis.com/css2?family=Inter">' });
    expect(html.join('\n')).toMatch(/index\.html.*fonts\.googleapis\.com/);
    const css = run({ css: ["@import url('https://cdn.example.org/x.css');"] });
    expect(css.join('\n')).toMatch(/CSS.*cdn\.example\.org/);
  });

  it('meldet protokollrelative Fremdhosts', () => {
    expect(run({ html: '<script src="//cdn.example.org/a.js"></script>' }).join('\n')).toMatch(/cdn\.example\.org/);
  });
});
