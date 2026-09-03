/**
 * Validates MEASUREMENTS.md against arithmetic.
 *
 * That file is a hand-maintained log that grows every time a march is timed in
 * play, and it is the primary source the model is fitted to — so a mistyped
 * coordinate there is worse than a bug in the code. These tests recompute every
 * derived column from the raw coordinates, so a bad row fails immediately
 * rather than quietly re-fitting the constants to a typo.
 *
 * There are two rally leads with different origins. Their tables are kept apart
 * deliberately (see MEASUREMENTS.md 6d: readings from different regimes must
 * never be pooled), so each pair is checked against its own origin.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('../js/zones.js');
require('../js/calculations.js');
const { calc, zones } = globalThis.RallySync;

const ROOT = path.join(__dirname, '..');
const DOC = fs.readFileSync(path.join(ROOT, 'MEASUREMENTS.md'), 'utf8');

/** Each lead: where its tables are, and the origin its distances are from. */
const LEADS = [
  { name: 'Lead A', a: '## 2. Table A', b: '## 3. Table B', origin: { x: 536, y: 740 }, min: 15 },
  { name: 'Lead B', a: '## 2b. Table A2', b: '## 3b. Table B2', origin: { x: 973, y: 437 }, min: 8 },
  // Lead A again, but a separate sitting: same origin, its own session.
  { name: 'Lead A batch', a: '## 2c. Table A3', b: '## 3c. Table B3', origin: { x: 536, y: 740 }, min: 31 }
];

/**
 * Reads a number out of a table cell. The log is written for humans, so a cell
 * can be bolded and carry a unit: "**34.5 s**", "0.862 t/s". Stripping has to
 * happen in stages — a single pass cannot anchor the unit to the end while the
 * bold markers are still there.
 */
const num = (cell) => Number(
  String(cell)
    .replace(/[−–—]/g, '-')   // typographic minus to ASCII
    .replace(/\*+/g, '')
    .replace(/\s+/g, '')
    .replace(/(t\/s|tiles?|s)$/i, '')
);

/**
 * Rows of the markdown table that follows `heading`. Stops at the next heading
 * so that a later table cannot bleed into this one — which it silently did when
 * the second lead's tables were added.
 */
function dataRows(heading) {
  const start = DOC.indexOf(heading);
  assert.notStrictEqual(start, -1, 'section not found: ' + heading);
  const after = DOC.slice(start + heading.length);
  const end = after.search(/\n#{2,3} /);
  const body = end === -1 ? after : after.slice(0, end);
  return body
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()));
}

for (const lead of LEADS) {
  const tableA = dataRows(lead.a);
  const tableB = dataRows(lead.b);

  test(lead.name + ': both tables describe the same set of marches', () => {
    assert.ok(tableA.length >= lead.min, lead.name + ': expected at least ' + lead.min + ' marches');
    assert.strictEqual(tableA.length, tableB.length,
      lead.name + ': Table A and Table B disagree on how many marches exist');
    for (let i = 0; i < tableA.length; i++) {
      assert.strictEqual(tableA[i][0], tableB[i][0],
        lead.name + ' row ' + (i + 1) + ': march numbers are out of step');
    }
  });

  test(lead.name + ': geometry is recomputed correctly from the coordinates', () => {
    for (let i = 0; i < tableA.length; i++) {
      const label = lead.name + ' march ' + tableA[i][0];

      const to = /X:\s*(-?\d+)\s*Y:\s*(-?\d+)/.exec(tableA[i][2]);
      assert.ok(to, label + ': could not read a target coordinate from Table A');
      const tx = Number(to[1]);
      const ty = Number(to[2]);

      const [, dxCell, dyCell, eucCell, manCell, chebCell, diagCell] = tableB[i];
      const dx = tx - lead.origin.x;
      const dy = ty - lead.origin.y;

      assert.strictEqual(num(dxCell), dx, label + ': dx disagrees with the coordinates');
      assert.strictEqual(num(dyCell), dy, label + ': dy disagrees with the coordinates');

      const euclid = Math.hypot(dx, dy);
      assert.ok(Math.abs(num(eucCell) - euclid) < 0.02, label + ': Euclidean distance is wrong');
      assert.strictEqual(num(manCell), Math.abs(dx) + Math.abs(dy), label + ': Manhattan distance is wrong');
      assert.strictEqual(num(chebCell), Math.max(Math.abs(dx), Math.abs(dy)), label + ': Chebyshev distance is wrong');

      const diag = Math.min(Math.abs(dx), Math.abs(dy)) / Math.max(Math.abs(dx), Math.abs(dy));
      assert.ok(Math.abs(num(diagCell) - diag) < 0.002, label + ': diagonality is wrong');

      // The app must agree with the log about how far apart these two points are.
      const resolved = calc.resolveMarchSeconds({
        lead: { x: lead.origin.x, y: lead.origin.y, marchSpeedUpPercent: 25 },
        target: { x: tx, y: ty, zoneKey: 'general' },
        zones: zones.defaultZoneFormulas()
      });
      assert.ok(
        Math.abs(resolved.distance - euclid) < 0.01,
        label + ': the app computes a different distance than the log records'
      );
    }
  });

  test(lead.name + ': the two tables agree on the observed time', () => {
    for (let i = 0; i < tableA.length; i++) {
      const label = lead.name + ' march ' + tableA[i][0];
      const a = num(tableA[i][6]);
      const b = num(tableB[i][7]);
      assert.ok(Number.isFinite(a) && a > 0, label + ': Table A has no readable actual time');
      assert.ok(Math.abs(a - b) < 0.05, label + ': Table A says ' + a + 's but Table B says ' + b + 's');
    }
  });

  test(lead.name + ': implied speed matches distance over time', () => {
    for (const row of tableB) {
      const euclid = num(row[3]);
      const seconds = num(row[7]);
      const stated = num(row[8]);
      assert.ok(
        Math.abs(stated - euclid / seconds) < 0.002,
        lead.name + ' march ' + row[0] + ': implied speed should be ' +
        (euclid / seconds).toFixed(3) + ', log says ' + stated
      );
    }
  });
}

test('march numbers run consecutively across both leads', () => {
  const all = LEADS.flatMap((lead) => dataRows(lead.a).map((r) => Number(r[0])));
  all.sort((x, y) => x - y);
  all.forEach((n, i) => assert.strictEqual(n, i + 1,
    'march numbering must be unique and consecutive across leads; got ' + all.join(',')));
});
