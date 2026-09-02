#!/usr/bin/env node
/**
 * serve.js — local preview of the real thing.
 *
 * Two details that a throwaway static server usually gets wrong, and that this
 * app actually depends on:
 *
 *   Query strings.  Assets are stamped as `js/dom.js?v=2.1` (see stamp.js), so
 *   the path has to be resolved with the query removed or every script 404s.
 *
 *   Last-Modified.  The version check reads it from index.html to decide
 *   whether a newer build is live, so it must be sent and must be real.
 *
 * Usage: npm run serve  [-- --port 8765]
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

function portFromArgv(argv) {
  const i = argv.indexOf('--port');
  const value = i !== -1 ? Number(argv[i + 1]) : Number(process.env.PORT || 8765);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : 8765;
}

/** Maps a request URL to a file, or null if it escapes the project. */
function resolve(requestUrl) {
  // Strip the ?v= stamp and any fragment before touching the filesystem.
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const full = path.join(ROOT, pathname);
  // path.join resolves '..', so compare against the root to block traversal.
  const rel = path.relative(ROOT, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const file = resolve(req.url);
  if (!file) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found: ' + req.url);
    }

    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      // The version check compares this against the running build.
      'last-modified': stat.mtime.toUTCString(),
      // Preview should always show what is on disk right now.
      'cache-control': 'no-store'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

const port = portFromArgv(process.argv);
server.listen(port, () => {
  console.log('RallySync preview: http://localhost:' + port + '/');
});
