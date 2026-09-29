/**
 * Static server for the Playwright fixture pages.
 *
 *   /                -> test/fixtures/index.html
 *   /<name>.html     -> test/fixtures/<name>.html
 *   /content.js      -> dist-test/content.js (standalone mode for plain pages)
 *   /fixtures-dist/* -> test/fixtures/dist/* (bundled React fixtures)
 *   /health          -> "ok"
 *
 * Usage: npm run fixtures  (builds the test extension, then serves on :4173)
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { buildFixtures } from './build-fixtures';

const root = resolve(import.meta.dirname, '..');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function safeJoin(base: string, rel: string): string | null {
  const p = normalize(join(base, rel));
  return p.startsWith(base) ? p : null;
}

function resolvePath(urlPath: string): string | null {
  if (urlPath === '/' || urlPath === '') return join(root, 'test/fixtures/index.html');
  if (urlPath === '/content.js') return join(root, 'dist-test/content.js');
  if (urlPath.startsWith('/fixtures-dist/')) return safeJoin(join(root, 'test/fixtures/dist'), urlPath.slice('/fixtures-dist/'.length));
  return safeJoin(join(root, 'test/fixtures'), urlPath.slice(1));
}

const portArg = process.argv.indexOf('--port');
const port = portArg >= 0 ? Number(process.argv[portArg + 1]) : 4173;

await buildFixtures();

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  const file = resolvePath(decodeURIComponent(url.pathname));
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}).listen(port, () => {
  console.log(`Fixtures on http://localhost:${port}/`);
});
