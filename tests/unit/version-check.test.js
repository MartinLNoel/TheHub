import { describe, expect, it } from 'vitest';
import { appFilesChanged, checkBump, readVersion } from '../../scripts/check-version-bump.mjs';

describe('version bump check (CI)', () => {
  it('treats the shell, src/, icons/ and content/ as app files, and not docs or tests', () => {
    expect(
      appFilesChanged(['index.html', 'src/core/db.js', 'icons/a.png', 'content/istqb/q.json', 'docs/BACKLOG.md', 'tests/unit/x.test.js', 'README.md']),
    ).toEqual(['index.html', 'src/core/db.js', 'icons/a.png', 'content/istqb/q.json']);
  });

  it('fails when app files changed and the version did not', () => {
    const problems = checkBump({ changedFiles: ['style.css'], baseVersion: '1.0.0', headVersion: '1.0.0', swVersion: '1.0.0' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Bump VERSION/);
  });

  it('passes when the version was bumped, or when only docs changed', () => {
    expect(checkBump({ changedFiles: ['style.css', 'src/version.js', 'sw.js'], baseVersion: '1.0.0', headVersion: '1.0.1', swVersion: '1.0.1' })).toEqual([]);
    expect(checkBump({ changedFiles: ['docs/BACKLOG.md'], baseVersion: '1.0.0', headVersion: '1.0.0', swVersion: '1.0.0' })).toEqual([]);
  });

  it('fails when sw.js and src/version.js disagree', () => {
    expect(checkBump({ changedFiles: [], baseVersion: null, headVersion: '1.0.1', swVersion: '1.0.0' })).toHaveLength(1);
  });

  it('reads the version constant', () => {
    expect(readVersion("export const VERSION = '0.2.0';")).toBe('0.2.0');
    expect(readVersion('nothing')).toBeNull();
  });
});
