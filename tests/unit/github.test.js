import { describe, expect, it, vi } from 'vitest';
import { GitHubError, createGitHub, fromBase64, toBase64 } from '../../src/core/github.js';
import { TEST_TOKEN, createFakeGitHub } from '../fixtures/fake-github.js';

const client = (fake, extra = {}) => createGitHub({ token: TEST_TOKEN, fetch: fake.fetch, isOnline: () => true, ...extra });

describe('base64', () => {
  it('round-trips UTF-8 (Cyrillic, emoji)', () => {
    const text = 'Здравей 🏋️ ' + 'x'.repeat(70_000);
    expect(fromBase64(toBase64(text))).toBe(text);
  });
});

describe('GitHub client', () => {
  it('writes, then reads back at the commit, and lists commits newest first', async () => {
    const fake = createFakeGitHub();
    const gh = client(fake);
    expect(await gh.readBackup()).toBeNull();
    const a = await gh.writeBackup('{"n":1}', 'first');
    const b = await gh.writeBackup('{"n":2}', 'second');
    expect((await gh.readBackup({ ref: a.commitSha })).text).toBe('{"n":1}');
    expect((await gh.readBackup()).text).toBe('{"n":2}');
    const list = await gh.listBackups();
    expect(list.map((c) => c.message)).toEqual(['second', 'first']);
    expect(list[0].sha).toBe(b.commitSha);
    expect(fake.requests.some((r) => r.url.includes('/commits?path=backup.json'))).toBe(true);
  });

  it('retries once on a sha conflict, and gives up on a second one', async () => {
    const fake = createFakeGitHub();
    const gh = client(fake);
    await gh.writeBackup('{"n":1}', 'first');
    fake.knobs.conflictsLeft = 1;
    const ok = await gh.writeBackup('{"n":2}', 'after conflict');
    expect(fake.latest().sha).toBe(ok.commitSha);
    expect(fake.latest().text).toBe('{"n":2}');

    fake.knobs.conflictsLeft = 2;
    await expect(gh.writeBackup('{"n":3}', 'two conflicts')).rejects.toMatchObject({ kind: 'conflict' });
    expect(fake.requests.filter((r) => r.method === 'PUT').length).toBe(2 + 2 + 1);
  });

  it('gives clear errors for 401, 403, 404 and offline', async () => {
    const fake = createFakeGitHub();
    await expect(createGitHub({ token: 'wrong-token', fetch: fake.fetch, isOnline: () => true }).testConnection()).rejects.toMatchObject({
      kind: 'auth',
      message: expect.stringContaining('401'),
    });
    fake.knobs.repoStatus = 403;
    await expect(client(fake).readBackup()).rejects.toMatchObject({ kind: 'access', message: expect.stringContaining('Contents') });
    fake.knobs.repoStatus = 404;
    await expect(client(fake).readBackup()).rejects.toMatchObject({ kind: 'access', message: expect.stringContaining('not found') });
    fake.knobs.repoStatus = null;
    fake.knobs.offline = true;
    await expect(client(fake).readBackup()).rejects.toMatchObject({ kind: 'offline' });
    await expect(client(fake, { isOnline: () => false }).readBackup()).rejects.toBeInstanceOf(GitHubError);
  });

  it('sends the token only to api.github.com, only in the Authorization header', async () => {
    const fake = createFakeGitHub();
    const gh = client(fake);
    await gh.testConnection();
    await gh.writeBackup('{}', 'x');
    await gh.readBackup();
    await gh.listBackups();
    expect(fake.requests.length).toBeGreaterThan(3);
    for (const r of fake.requests) {
      expect(new URL(r.url).origin).toBe('https://api.github.com');
      expect(r.url).not.toContain(TEST_TOKEN);
      expect(r.headers.authorization).toBe(`Bearer ${TEST_TOKEN}`);
      const others = Object.entries(r.headers).filter(([k]) => k !== 'authorization');
      expect(JSON.stringify(others)).not.toContain(TEST_TOKEN);
    }
  });

  it('never follows a redirect with the token (a moved repo is an error)', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 301, headers: { Location: 'https://example.com/' } }));
    const err = await createGitHub({ token: TEST_TOKEN, fetch, isOnline: () => true }).testConnection().catch((e) => e);
    expect(fetch.mock.calls[0][1].redirect).toBe('manual');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(err).toMatchObject({ kind: 'access', message: expect.stringContaining('moved') });
  });

  it('never puts the token in an error message', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'boom' }), { status: 500 }));
    const err = await createGitHub({ token: TEST_TOKEN, fetch, isOnline: () => true }).testConnection().catch((e) => e);
    expect(err.message).toContain('500');
    expect(err.message).not.toContain(TEST_TOKEN);
  });

  it('refuses a bad owner or repository name instead of building another URL', () => {
    expect(() => createGitHub({ token: TEST_TOKEN, owner: 'a/b', fetch: () => {} })).toThrow(/owner/);
    expect(() => createGitHub({ token: TEST_TOKEN, repo: '..', fetch: () => {} })).toThrow(/repository/);
    expect(() => createGitHub({ token: '', fetch: () => {} })).toThrow(/token/);
  });

  it('falls back to the raw file when GitHub sends no content (files over 1 MB)', async () => {
    const fetch = vi.fn(async (url, init) =>
      init.headers.Accept === 'application/vnd.github.raw+json'
        ? new Response('{"big":true}', { status: 200 })
        : new Response(JSON.stringify({ sha: 'abc', encoding: 'none', content: '' }), { status: 200 }),
    );
    const got = await createGitHub({ token: TEST_TOKEN, fetch, isOnline: () => true }).readBackup({ ref: 'c1' });
    expect(got).toEqual({ sha: 'abc', text: '{"big":true}' });
  });
});
