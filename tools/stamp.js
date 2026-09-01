#!/usr/bin/env node
/**
 * stamp.js — pin every asset URL in index.html to the current version.
 *
 * Without this, a host that caches each file independently can serve a new
 * index.html alongside an old script, and the app breaks in a way that looks
 * like a code bug. That is not hypothetical: shipping the km formatter produced
 * "d.km is not a function" in a browser holding a fresh calculate.js and a
 * stale dom.js.
 *
 * Stamping the version onto every src and href means a release changes all of
 * their URLs at once, so a browser can never mix versions. Run it whenever the
 * version in js/version.js changes:
 *
 *   npm run stamp
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const VERSION_FILE = path.join(ROOT, 'js', 'version.js');

function readVersion() {
  const source = fs.readFileSync(VERSION_FILE, 'utf8');
  const match = /var VERSION\s*=\s*'([^']+)'/.exec(source);
  if (!match) throw new Error('Could not find VERSION in js/version.js');
  return match[1];
}

function stamp(html, version) {
  let changed = 0;
  const out = html.replace(
    /(<(?:script|link)[^>]*\s(?:src|href)=")([^"]+)(")/g,
    (whole, before, url, after) => {
      // Leave anything absolute or data-encoded alone; only our own files move.
      if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return whole;
      const bare = url.split('?')[0];
      if (!/\.(js|css)$/.test(bare)) return whole;
      changed++;
      return before + bare + '?v=' + version + after;
    }
  );
  return { out, changed };
}

function main() {
  const version = readVersion();
  const html = fs.readFileSync(INDEX, 'utf8');
  const { out, changed } = stamp(html, version);

  if (out === html) {
    console.log('index.html already stamped at v' + version + ' (' + changed + ' assets)');
    return;
  }
  fs.writeFileSync(INDEX, out);
  console.log('stamped ' + changed + ' assets at v' + version);
}

if (require.main === module) main();
module.exports = { stamp, readVersion };
