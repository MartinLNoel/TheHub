// Fails when app files changed since a base commit but the version in src/version.js did not,
// so the phone always sees an update. Also checks that sw.js carries the same version.
//   node scripts/check-version-bump.mjs <base-sha>
// With no usable base (a new branch, the first push), it compares with origin/main if that
// exists, and otherwise only checks that sw.js and src/version.js agree.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const APP_FILE = /^(index\.html|style\.css|manifest\.webmanifest|sw\.js|src\/|icons\/|content\/)/;

export function appFilesChanged(changedFiles) {
  return changedFiles.filter((f) => APP_FILE.test(f));
}

export function readVersion(text) {
  return text.match(/VERSION = '([^']+)'/)?.[1] ?? null;
}

/** Returns a list of problems; [] means the check passes. */
export function checkBump({ changedFiles, baseVersion, headVersion, swVersion }) {
  const problems = [];
  if (!headVersion) problems.push('src/version.js has no VERSION.');
  if (swVersion !== headVersion) {
    problems.push(`sw.js VERSION (${swVersion}) differs from src/version.js (${headVersion}).`);
  }
  const changed = appFilesChanged(changedFiles);
  if (changed.length && baseVersion !== null && baseVersion === headVersion) {
    problems.push(
      `App files changed (${changed.join(', ')}) but the version is still ${headVersion}. ` +
        'Bump VERSION in src/version.js and sw.js.',
    );
  }
  return problems;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function usableBase(candidate) {
  if (!candidate || /^0+$/.test(candidate)) return null;
  try {
    git('cat-file', '-e', `${candidate}^{commit}`);
    return candidate;
  } catch {
    return null;
  }
}

function main() {
  const base = usableBase(process.argv[2] || process.env.BASE_SHA) || usableBase('origin/main');
  const headVersion = readVersion(readFileSync('src/version.js', 'utf8'));
  const swVersion = readVersion(readFileSync('sw.js', 'utf8'));
  let changedFiles = [];
  let baseVersion = null;
  if (base) {
    changedFiles = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
    try {
      baseVersion = readVersion(git('show', `${base}:src/version.js`));
    } catch {
      baseVersion = null; // src/version.js did not exist at the base
    }
  } else {
    console.log('No base commit to compare with; checking sw.js and src/version.js agree only.');
  }
  const problems = checkBump({ changedFiles, baseVersion, headVersion, swVersion });
  if (problems.length) {
    problems.forEach((p) => console.error(`✗ ${p}`));
    process.exit(1);
  }
  console.log(`✓ Version check passed (version ${headVersion}${base ? `, compared with ${base.slice(0, 12)}` : ''}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
