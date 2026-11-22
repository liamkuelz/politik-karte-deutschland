// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function trackedFiles(): string[] | null {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\0').filter(Boolean);
  } catch {
    return null; // git nicht verfuegbar oder kein Repository
  }
}

function startsWithBom(path: string): boolean {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(3);
    const n = readSync(fd, buf, 0, 3, 0);
    return n === 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  } finally {
    closeSync(fd);
  }
}

describe('keine UTF-8-BOMs', () => {
  it('keine getrackte Text-, Konfigurations- oder Datendatei beginnt mit EF BB BF', () => {
    const files = trackedFiles();
    if (!files) return; // ohne git ueberspringen
    // .gitignore mitpruefen; geloeschte, aber noch getrackte Dateien ueberspringen
    const textFiles = files.filter((f) => (/\.(ts|mjs|json|css|html|md|yml|yaml)$/.test(f) || f === '.gitignore') && existsSync(f));
    const withBom = textFiles.filter(startsWithBom);
    expect(withBom).toEqual([]);
  });
});
