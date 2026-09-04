/**
 * i18n-report.js — what does each language still owe?
 *
 * The translation rounds were driven by hand-written JSON snapshots of the
 * missing keys, which went stale the moment English grew — and English grew
 * five times mid-round, which cost real confusion. This regenerates the answer
 * from the live tables instead, so there is nothing to keep in sync.
 *
 *   node tools/i18n-report.js                 coverage for every language
 *   node tools/i18n-report.js de              the keys German is missing
 *   node tools/i18n-report.js de --json       same, as a translator's worklist
 *   node tools/i18n-report.js --audit         placeholder and fallback problems
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'js', 'i18n.js'));

const CODES = fs.readdirSync(path.join(ROOT, 'js', 'locale'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\.js$/, ''));
CODES.forEach((c) => require(path.join(ROOT, 'js', 'locale', c + '.js')));

const T = globalThis.RallySync.i18n;
const EN = T.KEYS;
const EN_KEYS = Object.keys(EN);

function missing(code) {
  const table = T.DICT[code] || {};
  return EN_KEYS.filter((k) => !(k in table));
}

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const target = args.find((a) => !a.startsWith('--'));

if (args.includes('--audit')) {
  // A translation that drops a {placeholder} renders the literal braces to the
  // player, and one that is byte-identical to English is usually an oversight
  // -- though sometimes it is simply the same word, so this reports rather
  // than fails. The test suite is where the hard rules live.
  const problems = [];
  const identical = [];
  CODES.forEach((code) => {
    const table = T.DICT[code] || {};
    Object.keys(table).forEach((k) => {
      if (!(k in EN)) {
        problems.push(code + ' ' + k + ': not in the English table');
        return;
      }
      const want = (EN[k].match(/\{\w+\}/g) || []).slice().sort().join(' ');
      const got = (String(table[k]).match(/\{\w+\}/g) || []).slice().sort().join(' ');
      if (want !== got) {
        problems.push(code + ' ' + k + ': expected [' + want + '], got [' + got + ']');
      }
      if (String(table[k]) === EN[k] && /[A-Za-z]{3}/.test(EN[k])) identical.push(code + ' ' + k);
    });
  });
  console.log(problems.length ? problems.join('\n') : 'no placeholder problems');
  console.log('\n' + identical.length + ' values identical to English (often correct):');
  console.log(identical.slice(0, 40).join(', ') + (identical.length > 40 ? ' …' : ''));
  process.exit(problems.length ? 1 : 0);
}

if (target) {
  const gaps = missing(target);
  if (wantJson) {
    const out = {};
    gaps.forEach((k) => { out[k] = EN[k]; });
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(target + ' is missing ' + gaps.length + ' of ' + EN_KEYS.length + ' keys');
    gaps.forEach((k) => console.log('  ' + k + '  ' + JSON.stringify(EN[k])));
  }
  process.exit(0);
}

console.log('English key set: ' + EN_KEYS.length + '\n');
CODES.concat().sort().forEach((code) => {
  const gaps = missing(code).length;
  const pct = Math.round(((EN_KEYS.length - gaps) / EN_KEYS.length) * 100);
  console.log(code.padEnd(9) + String(pct).padStart(3) + '%' +
    (gaps ? '   ' + gaps + ' missing' : ''));
});
