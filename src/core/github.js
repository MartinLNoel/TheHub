// GitHub REST calls for the private backup repo, and nothing more:
//   - read backup.json (latest, or at a given commit),
//   - list the commits that changed backup.json,
//   - write backup.json (with the current sha; a sha conflict re-reads and retries once),
//   - check the repo is reachable with the token ("Test connection").
//
// SECURITY: the token is only ever sent to API_BASE (https://api.github.com), in the Authorization
// header. It is never put in a URL, a message, an error or a log line. Every request URL is
// built from API_BASE and checked to still be on that origin before the token is attached.

export const API_BASE = 'https://api.github.com';
export const BACKUP_PATH = 'backup.json';
export const DEFAULT_OWNER = 'MartinLNoel';
export const DEFAULT_REPO = 'thehub-backup';

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export class GitHubError extends Error {
  /** kind: 'auth' | 'access' | 'offline' | 'conflict' | 'notfound' | 'rate' | 'bad' | 'server' */
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'GitHubError';
    this.kind = kind;
    this.status = status;
  }
}

export function checkRepoName(owner, repo) {
  const problems = [];
  if (typeof owner !== 'string' || !OWNER_PATTERN.test(owner)) problems.push('The owner is not a valid GitHub user name.');
  if (typeof repo !== 'string' || !REPO_PATTERN.test(repo) || repo === '.' || repo === '..') {
    problems.push('The repository name is not valid.');
  }
  return problems;
}

/** Base64 of the UTF-8 bytes of `text` (btoa alone only handles Latin-1). */
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(b64) {
  const binary = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Creates a client for one repo. Options: token, owner, repo, fetch (tests pass a mock),
 * isOnline() (defaults to navigator.onLine).
 */
export function createGitHub({
  token,
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  fetch: fetchFn = globalThis.fetch?.bind(globalThis),
  isOnline = () => globalThis.navigator?.onLine !== false,
} = {}) {
  if (typeof token !== 'string' || !token.trim()) throw new GitHubError('auth', 'No backup token is set. Enter one in Settings → Backup.');
  const nameProblems = checkRepoName(owner, repo);
  if (nameProblems.length) throw new GitHubError('bad', nameProblems.join(' '));
  if (typeof fetchFn !== 'function') throw new GitHubError('offline', 'This browser cannot make network requests.');

  const full = `${owner}/${repo}`;
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const contentsPath = `${repoPath}/contents/${BACKUP_PATH}`;

  function errorFor(response, body) {
    const s = response.status;
    if (s === 401) {
      return new GitHubError('auth', 'GitHub refused the token (401): it is wrong, revoked or expired. Enter a new token in Settings → Backup.', s);
    }
    if (s === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      return new GitHubError('rate', 'GitHub rate limit reached (403). Try again in an hour.', s);
    }
    if (s === 403) {
      return new GitHubError('access', `No access to ${full} (403): the token needs "Contents: Read and write" on this repository.`, s);
    }
    if (s === 404) {
      return new GitHubError('access', `${full} was not found, or the token has no access to it (404). Check the repository name and the token's repository access.`, s);
    }
    if (s === 409 || s === 422) {
      return new GitHubError('conflict', `backup.json changed on GitHub while backing up (${s}).`, s);
    }
    const detail = typeof body?.message === 'string' ? `: ${body.message.slice(0, 200)}` : '';
    return new GitHubError('server', `GitHub answered ${s}${detail}.`, s);
  }

  async function call(method, path, { body, accept = 'application/vnd.github+json', raw = false } = {}) {
    const url = new URL(path, API_BASE);
    // Never attach the token to anything but the GitHub API.
    if (url.origin !== API_BASE) throw new GitHubError('bad', 'Refusing to send the token outside api.github.com.');
    if (!isOnline()) throw new GitHubError('offline', 'You are offline. The backup runs when you are back online.');
    let response;
    try {
      response = await fetchFn(url.href, {
        method,
        headers: {
          Accept: accept,
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        // Never follow a redirect with the token attached; GitHub redirects only for a renamed repo.
        redirect: 'manual',
      });
    } catch {
      throw new GitHubError('offline', 'GitHub could not be reached (offline or no connection). Try again when you are online.');
    }
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      throw new GitHubError('access', `GitHub says ${full} has moved. Enter its new owner and name in Settings → Backup.`, response.status || null);
    }
    if (!response.ok) {
      let parsed = null;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      throw errorFor(response, parsed);
    }
    if (raw) return response.text();
    try {
      return await response.json();
    } catch {
      throw new GitHubError('server', 'GitHub sent an answer that is not JSON.', response.status);
    }
  }

  /** Reads backup.json at `ref` (a commit sha) or the latest. Returns { sha, text }, or null when the file does not exist yet. */
  async function readBackup({ ref } = {}) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    let meta;
    try {
      meta = await call('GET', `${contentsPath}${query}`);
    } catch (err) {
      if (err.status === 404 && !ref) {
        // 404 means "no such file" or "no access to the repo": ask about the repo to tell them apart.
        await call('GET', repoPath);
        return null;
      }
      if (err.status === 404 && ref) throw new GitHubError('notfound', `There is no backup.json at commit ${String(ref).slice(0, 7)}.`, 404);
      throw err;
    }
    if (!meta || typeof meta.sha !== 'string') throw new GitHubError('server', 'GitHub sent an unexpected answer for backup.json.');
    let text;
    if (meta.encoding === 'base64' && typeof meta.content === 'string' && meta.content) {
      text = fromBase64(meta.content);
    } else {
      // Files over 1 MB come without content; ask for the raw file instead.
      text = await call('GET', `${contentsPath}${query}`, { accept: 'application/vnd.github.raw+json', raw: true });
    }
    return { sha: meta.sha, text };
  }

  /** The commits that changed backup.json, newest first: [{ sha, date, message }]. */
  // PLACEHOLDER(Q-9): only the newest 100 backups are listed (one page); older ones stay in git.
  async function listBackups({ perPage = 100 } = {}) {
    const list = await call('GET', `${repoPath}/commits?path=${BACKUP_PATH}&per_page=${perPage}`);
    if (!Array.isArray(list)) throw new GitHubError('server', 'GitHub sent an unexpected commit list.');
    return list.map((c) => ({
      sha: c.sha,
      date: c.commit?.committer?.date || c.commit?.author?.date || null,
      message: c.commit?.message || '',
    }));
  }

  async function currentSha() {
    try {
      const meta = await call('GET', contentsPath);
      return meta?.sha ?? null;
    } catch (err) {
      if (err.status === 404) {
        await call('GET', repoPath); // throws the access error when the repo itself is out of reach
        return null;
      }
      throw err;
    }
  }

  /**
   * Writes backup.json. Reads the current sha first; on a sha conflict, re-reads and retries once.
   * Returns { commitSha, fileSha }.
   */
  async function writeBackup(text, message) {
    const content = toBase64(text);
    let attempt = 0;
    for (;;) {
      const sha = await currentSha();
      try {
        const result = await call('PUT', contentsPath, { body: { message, content, ...(sha ? { sha } : {}) } });
        const commitSha = result?.commit?.sha;
        if (typeof commitSha !== 'string') throw new GitHubError('server', 'GitHub did not say which commit holds the backup.');
        return { commitSha, fileSha: result?.content?.sha ?? null };
      } catch (err) {
        if (err.kind === 'conflict' && attempt === 0) {
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
  }

  /** Checks the repo is reachable. Returns { ok: true, canWrite, full }. */
  async function testConnection() {
    const info = await call('GET', repoPath);
    return { ok: true, full, private: Boolean(info?.private), canWrite: info?.permissions ? Boolean(info.permissions.push) : null };
  }

  return { full, readBackup, listBackups, writeBackup, testConnection };
}
