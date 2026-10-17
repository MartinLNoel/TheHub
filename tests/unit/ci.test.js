// The CI workflow cannot run locally, so check its shape: valid YAML, tests before deploy,
// deploy only from main, and only app files uploaded.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const ci = parse(readFileSync(join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8'));

describe('ci.yml', () => {
  it('runs on every push and pull request', () => {
    expect(Object.keys(ci.on)).toEqual(expect.arrayContaining(['push', 'pull_request']));
  });

  it('runs the version check, unit tests and e2e tests', () => {
    const runs = ci.jobs.test.steps.map((s) => s.run || '').join('\n');
    expect(runs).toContain('check-version-bump.mjs');
    expect(runs).toContain('npm test');
    expect(runs).toContain('npm run e2e');
  });

  it('deploys only from main, only after the tests pass, with the official Pages actions', () => {
    const deploy = ci.jobs.deploy;
    expect(deploy.needs).toBe('test');
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
    const uses = deploy.steps.map((s) => s.uses).filter(Boolean);
    expect(uses.some((u) => u.startsWith('actions/upload-pages-artifact@'))).toBe(true);
    expect(uses.some((u) => u.startsWith('actions/deploy-pages@'))).toBe(true);
    expect(deploy.permissions).toEqual({ pages: 'write', 'id-token': 'write' });
  });

  it('uploads only app files', () => {
    const collect = ci.jobs.deploy.steps.find((s) => s.run?.includes('_site')).run;
    for (const banned of ['tests', 'docs', 'node_modules', 'scripts', 'private']) {
      expect(collect).not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
    expect(ci.jobs.deploy.steps.find((s) => s.uses?.startsWith('actions/upload-pages-artifact')).with.path).toBe('_site');
  });
});
