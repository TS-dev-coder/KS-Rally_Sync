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
 *   node tools/i18n-report.js --stale <ref>   English strings reworded since <ref>
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

if (args[0] === '--stale') {
  /*
   * Which translations now describe something the English no longer says?
   *
   * This is the one failure nothing else can see. Reword an English value and
   * every locale still HAS that key -- coverage reads 100%, the placeholder
   * audit is clean, and sixteen files quietly describe the old sentence. It
   * happened to guide.bulkPaste.step2 within an hour of that key existing, and
   * was caught only because one reviewer re-read the English before finalising
   * instead of trusting the brief it had been handed.
   *
   * Git is already the provenance store, so nothing has to be maintained: read
   * the old table out of any ref and diff it against the live one.
   */
  const ref = args[1] || 'HEAD';
  let previous;
  try {
    previous = require('child_process')
      .execSync('git show ' + ref + ':js/i18n.js', { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    console.error('Could not read js/i18n.js at ' + ref + '.');
    process.exit(2);
  }

  // Run the old file in its own context so it cannot clobber the loaded table.
  const vm = require('vm');
  const sandbox = vm.createContext({});
  vm.runInContext(previous, sandbox);
  const before = sandbox.RallySync.i18n.KEYS;

  const reworded = EN_KEYS.filter((k) => k in before && before[k] !== EN[k]);
  const added = EN_KEYS.filter((k) => !(k in before));
  const removed = Object.keys(before).filter((k) => !(k in EN));

  if (reworded.length) {
    console.log(reworded.length + ' English string(s) REWORDED since ' + ref + '.');
    console.log('Every locale still has these keys, so nothing else will flag them:');
    reworded.forEach((k) => {
      console.log('  ' + k);
      console.log('    was: ' + JSON.stringify(before[k]));
      console.log('    now: ' + JSON.stringify(EN[k]));
    });
  } else {
    console.log('No English strings reworded since ' + ref + '.');
  }
  if (added.length) console.log('Added (' + added.length + '): ' + added.join(', '));
  if (removed.length) console.log('Removed (' + removed.length + '): ' + removed.join(', '));
  process.exit(reworded.length ? 1 : 0);
}

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
      // Lower-initial: a real placeholder is always a lowercase identifier.
      // A capitalised token is illustrative text, and treating it as a
      // variable told five reviewers to keep an English word inside an
      // otherwise translated sentence.
      const want = (EN[k].match(/\{[a-z]\w*\}/g) || []).slice().sort().join(' ');
      const got = (String(table[k]).match(/\{[a-z]\w*\}/g) || []).slice().sort().join(' ');
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
