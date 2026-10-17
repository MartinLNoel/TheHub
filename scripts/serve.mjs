// Tiny static server for local use and e2e tests. Serves the repo under /TheHub/ (like GitHub
// Pages does), so relative paths are tested the way the phone will see them.
//   npm run serve                 -> http://localhost:4173/TheHub/
//   THEHUB_TEST=1 node scripts/serve.mjs   (e2e test build, see below)
//
// Test build (THEHUB_TEST=1) only:
//   - src/modules.js is answered with tests/fixtures/modules.test.js (adds the demo module),
//     and tests/ is served so that file's imports load;
//   - sw.js also precaches the demo module and the sample study course, and GET /__test/sw-version?v=X makes sw.js report
//     version X, which is how the e2e test makes a "new version" appear.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 4173);
const BASE = '/TheHub/';
const TEST = process.env.THEHUB_TEST === '1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Never served: dev-only and private folders.
const BLOCKED = ['node_modules', 'private', '.git', 'docs', 'scripts', '.github', 'playwright-report', 'test-results'];
if (!TEST) BLOCKED.push('tests');

let swVersionOverride = null;

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (TEST && url.pathname === '/__test/sw-version') {
    swVersionOverride = url.searchParams.get('v') || null;
    return send(res, 200, `sw version override: ${swVersionOverride}`);
  }
  if (url.pathname === '/' || url.pathname === '/TheHub') {
    res.writeHead(302, { Location: BASE });
    return res.end();
  }
  if (!url.pathname.startsWith(BASE)) return send(res, 404, 'Not found');

  let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const first = rel.split('/')[0];
  if (BLOCKED.includes(first)) return send(res, 404, 'Not found');

  if (TEST && rel === 'src/modules.js') rel = 'tests/fixtures/modules.test.js';

  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');

  try {
    const info = await stat(file);
    if (!info.isFile()) return send(res, 404, 'Not found');
    let body = await readFile(file);
    const type = TYPES[extname(file)] || 'application/octet-stream';
    if (TEST && rel === 'sw.js') {
      let text = body.toString('utf8');
      text = text.replace(
        'const PRECACHE = [',
        "const PRECACHE = [\n  'tests/fixtures/demo-module.js',\n  'tests/fixtures/sample-study-module.js',\n" +
          "  'tests/fixtures/sample-course/lessons.json',\n  'tests/fixtures/sample-course/questions.json',\n  'tests/fixtures/sample-course/cards.json',",
      );
      if (swVersionOverride) text = text.replace(/const VERSION = '[^']*';/, `const VERSION = '${swVersionOverride}';`);
      body = Buffer.from(text, 'utf8');
    }
    return send(res, 200, body, type);
  } catch {
    return send(res, 404, 'Not found');
  }
});

server.listen(PORT, () => {
  console.log(`TheHub ${TEST ? '(test build) ' : ''}at http://localhost:${PORT}${BASE}`);
});
