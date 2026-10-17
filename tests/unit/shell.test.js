// Checks on the shipped files themselves: version, precache list, manifest.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { VERSION } from '../../src/version.js';
import modules from '../../src/modules.js';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function filesUnder(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const p = join(dir, name);
    return statSync(join(ROOT, p)).isDirectory() ? filesUnder(p) : [p];
  });
}

const sw = read('sw.js');
const precache = [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('version', () => {
  it('sw.js carries the same version as src/version.js', () => {
    expect(sw.match(/const VERSION = '([^']+)';/)[1]).toBe(VERSION);
  });

  it('is a semantic version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('service worker precache', () => {
  it('lists every file under src/ and icons/, plus the shell files', () => {
    const shipped = [...filesUnder('src'), ...filesUnder('icons')].map((p) => relative(ROOT, join(ROOT, p)).replaceAll('\\', '/'));
    for (const file of [...shipped, 'index.html', 'style.css', 'manifest.webmanifest']) {
      expect(precache, `${file} missing from PRECACHE in sw.js`).toContain(file);
    }
  });

  it('lists only files that exist, all relative', () => {
    for (const entry of precache.filter((p) => p !== './')) {
      expect(entry.startsWith('/'), entry).toBe(false);
      expect(() => statSync(join(ROOT, entry)), entry).not.toThrow();
    }
  });
});

describe('manifest', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));

  it('is installable and relative (works under /TheHub/)', () => {
    expect(manifest.name).toBe('TheHub');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url.startsWith('./')).toBe(true);
    expect(manifest.scope).toBe('./');
    const sizes = manifest.icons.map((i) => `${i.sizes}/${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192/any', '512x512/any', '512x512/maskable']));
    for (const icon of manifest.icons) expect(() => statSync(join(ROOT, icon.src))).not.toThrow();
  });

  it('has the three shortcuts', () => {
    expect(manifest.shortcuts.map((s) => [s.name, s.url])).toEqual([
      ['Log workout', './#/gym/log'],
      ['Study', './#/istqb'],
      ['Scan item', './#/fridge/scan'],
    ]);
  });
});

describe('index.html', () => {
  it('uses only relative paths', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/(src|href)="\//);
  });
});

describe('shipped modules', () => {
  it('ships the Gym module, and never the demo module', () => {
    expect(modules.map((m) => m.id)).toEqual(['gym']);
    expect(modules.map((m) => m.id)).not.toContain('demo');
  });
});
