/**
 * Tests that guard the release itself rather than the march math.
 *
 * The bug these exist for: a host that caches each file independently served a
 * fresh calculate.js beside a stale dom.js, and the app died on
 * "d.km is not a function". Nothing in the code was wrong — the *combination*
 * was. Stamping the version onto every asset URL makes that combination
 * impossible, so these check the stamp is actually current.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const { readVersion } = require('../tools/stamp.js');
const VERSION = readVersion();

test('the shipped version number is the one the app reports', () => {
  require('../js/dom.js');
  require('../js/version.js');
  // The stamper reads VERSION out of the file with a regex; the app reads it by
  // running the module. Those are two different parsers of the same line, and
  // if they ever disagree the stamp on index.html would not match the version
  // the header shows. Comparing them keeps the check meaningful without needing
  // a literal edited by hand every release -- which is the sort of chore that
  // gets skipped, leaving the test asserting a number nobody ships any more.
  assert.strictEqual(VERSION, globalThis.RallySync.version.VERSION);
  assert.match(VERSION, /^\d+\.\d+$/, 'version should look like 4.0, got ' + VERSION);
});

test('every local asset URL carries the current version stamp', () => {
  const refs = [...html.matchAll(/<(?:script|link)[^>]*\s(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => /\.(js|css)(\?|$)/.test(url));

  assert.ok(refs.length > 20, 'expected the whole app to be listed, got ' + refs.length);

  for (const url of refs) {
    assert.strictEqual(
      url.split('?')[1],
      'v=' + VERSION,
      url + ' is not stamped at v' + VERSION + ' — run `npm run stamp`. ' +
      'An unstamped asset can be served stale beside a fresh one.'
    );
  }
});

test('every stamped asset actually exists on disk', () => {
  const refs = [...html.matchAll(/<(?:script|link)[^>]*\s(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1].split('?')[0])
    .filter((p) => /\.(js|css)$/.test(p));

  for (const rel of refs) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), 'index.html references a missing file: ' + rel);
  }
});

test('checking for an update resolves instead of throwing when fetch is missing', async () => {
  // root.fetch(...) on a browser without fetch throws synchronously, before any
  // promise exists, so a .catch() never sees it. That escaped as a TypeError
  // rather than the documented result shape.
  const root = {
    document: { lastModified: new Date().toUTCString() },
    location: { href: 'https://example.com/index.html', protocol: 'https:' },
    RallySync: { dom: globalThis.RallySync.dom }
    // deliberately no fetch
  };
  const source = fs.readFileSync(path.join(ROOT, 'js', 'version.js'), 'utf8');
  new Function('globalThis', 'with (globalThis) { ' + source + ' }')(root);

  const result = await root.RallySync.version.checkForUpdate();
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.latestMs, null);
  assert.match(result.reason, /cannot check for updates/);
});
