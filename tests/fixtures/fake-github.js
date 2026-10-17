// An in-memory stand-in for the few GitHub REST endpoints src/core/github.js calls. Used as a
// mocked fetch by the unit tests, and behind page.route() by the e2e tests. Never calls GitHub.
import { fromBase64, toBase64 } from '../../src/core/github.js';

export const TEST_TOKEN = 'github_pat_TEST0000SECRET1111TOKEN';

let counter = 0;
const fakeSha = () => (++counter).toString(16).padStart(8, '0').repeat(5);

export function createFakeGitHub({ owner = 'MartinLNoel', repo = 'thehub-backup', token = TEST_TOKEN } = {}) {
  const commits = []; // oldest first: { sha, fileSha, message, date, text }
  const requests = []; // every request: { method, url, headers }
  const knobs = {
    offline: false, // fetch rejects like a network failure
    putStatus: null, // answer every PUT with this status
    conflictsLeft: 0, // answer this many PUTs with 409 before accepting
    readBackStatus: null, // answer GET contents at a ref with this status
    tamperReadBack: false, // GET contents at a ref returns changed data
    repoStatus: null, // answer GET /repos/{o}/{r} with this status
  };
  const base = `/repos/${owner}/${repo}`;

  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

  function addCommit(text, message = 'seeded backup', date = new Date().toISOString()) {
    const c = { sha: fakeSha(), fileSha: fakeSha(), message, date, text };
    commits.push(c);
    return c;
  }

  async function fetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    requests.push({ method, url: url.href, headers });
    if (knobs.offline) throw new TypeError('Failed to fetch');
    if (url.origin !== 'https://api.github.com') return json(404, { message: 'not GitHub' });
    if (headers.authorization !== `Bearer ${token}`) return json(401, { message: 'Bad credentials' });

    const path = url.pathname;
    const ref = url.searchParams.get('ref');
    if (method === 'GET' && path === base) {
      if (knobs.repoStatus) return json(knobs.repoStatus, { message: 'nope' });
      return json(200, { full_name: `${owner}/${repo}`, private: true, permissions: { push: true, pull: true } });
    }
    if (path === `${base}/contents/backup.json`) {
      if (knobs.repoStatus) return json(knobs.repoStatus, { message: 'nope' });
      if (method === 'GET') {
        if (ref && knobs.readBackStatus) return json(knobs.readBackStatus, { message: 'broken' });
        const c = ref ? commits.find((x) => x.sha === ref) : commits.at(-1);
        if (!c) return json(404, { message: 'Not Found' });
        let text = c.text;
        if (ref && knobs.tamperReadBack) {
          const parsed = JSON.parse(text);
          parsed.createdAt = 'tampered';
          const first = Object.values(parsed.modules)[0];
          if (first?.data?.notes) first.data.notes.push({ text: 'tampered' });
          text = JSON.stringify(parsed);
        }
        if (headers.accept === 'application/vnd.github.raw+json') return new Response(text, { status: 200 });
        // GitHub wraps base64 at 60 characters; do the same so decoding is tested.
        const content = toBase64(text).replace(/(.{60})/g, '$1\n');
        return json(200, { sha: c.fileSha, encoding: 'base64', content });
      }
      if (method === 'PUT') {
        if (knobs.putStatus) return json(knobs.putStatus, { message: 'refused' });
        const body = JSON.parse(init.body);
        if (knobs.conflictsLeft > 0) {
          knobs.conflictsLeft -= 1;
          addCommit(commits.at(-1)?.text ?? '{}', 'someone else wrote'); // the sha moves on
          return json(409, { message: 'is at x but expected y' });
        }
        const latest = commits.at(-1);
        if (latest && body.sha !== latest.fileSha) return json(409, { message: 'sha does not match' });
        if (!latest && body.sha) return json(422, { message: 'sha given for a new file' });
        const c = addCommit(fromBase64(body.content), body.message);
        return json(200, { content: { sha: c.fileSha }, commit: { sha: c.sha } });
      }
    }
    if (method === 'GET' && path === `${base}/commits` && url.searchParams.get('path') === 'backup.json') {
      return json(
        200,
        [...commits].reverse().map((c) => ({ sha: c.sha, commit: { message: c.message, committer: { date: c.date } } })),
      );
    }
    return json(404, { message: 'Not Found' });
  }

  return { fetch, commits, requests, knobs, addCommit, latest: () => commits.at(-1) };
}
