/**
 * Validates MEASUREMENTS.md against arithmetic.
 *
 * That file is a hand-maintained log that grows every time a march is timed in
 * play, and it is the primary source the model is fitted to — so a mistyped
 * coordinate there is worse than a bug in the code. These tests recompute every
 * derived column from the raw coordinates, so a bad row fails immediately
 * rather than quietly re-fitting the constants to a typo.
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

const LEAD = { x: 536, y: 740 };

/**
 * Reads a number out of a table cell. The log is written for humans, so a cell
 * can be bolded and carry a unit: "**34.5 s**", "0.862 t/s". Stripping has to
 * happen in stages \u2014 a single pass cannot anchor the unit to the end while the
 * bold markers are still there.
 */
const num = (cell) => Number(
  String(cell)
    .replace(/[\u2212\u2013\u2014]/g, '-')   // typographic minus to ASCII
    .replace(/\*+/g, '')
    .replace(/\s+/g, '')
    .replace(/(t\/s|tiles?|s)$/i, '')
);

/** Rows of a markdown table whose first cell is a bare row number. */
function dataRows(section) {
  const start = DOC.indexOf(section);
  assert.notStrictEqual(start, -1, 'section not found: ' + section);
  const body = DOC.slice(start, DOC.indexOf('\n---', start));
  return body
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()));
}

const tableA = dataRows('## 2. Table A');
const tableB = dataRows('## 3. Table B');

test('both tables describe the same set of marches', () => {
  assert.ok(tableA.length >= 7, 'expected at least the 7 original marches');
  assert.strictEqual(tableA.length, tableB.length, 'Table A and Table B disagree on how many marches exist');
  for (let i = 0; i < tableA.length; i++) {
    assert.strictEqual(tableA[i][0], tableB[i][0], 'row ' + (i + 1) + ': march numbers are out of step');
  }
});

test('every march is numbered consecutively from 1', () => {
  tableA.forEach((row, i) => assert.strictEqual(Number(row[0]), i + 1, 'Table A row ' + (i + 1) + ' is misnumbered'));
});

test('Table B geometry is recomputed correctly from the coordinates in Table A', () => {
  for (let i = 0; i < tableA.length; i++) {
    const label = 'march ' + tableA[i][0];

    const to = /X:\s*(-?\d+)\s*Y:\s*(-?\d+)/.exec(tableA[i][2]);
    assert.ok(to, label + ': could not read a target coordinate from Table A');
    const tx = Number(to[1]);
    const ty = Number(to[2]);

    const [, dxCell, dyCell, eucCell, manCell, chebCell, diagCell] = tableB[i];
    const dx = tx - LEAD.x;
    const dy = ty - LEAD.y;

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
      lead: { x: LEAD.x, y: LEAD.y, marchSpeedUpPercent: 25 },
      target: { x: tx, y: ty, zoneKey: 'general' },
      zones: zones.defaultZoneFormulas()
    });
    assert.ok(
      Math.abs(resolved.distance - euclid) < 0.01,
      label + ': the app computes a different distance than the log records'
    );
  }
});

test('the two tables agree on the observed time', () => {
  for (let i = 0; i < tableA.length; i++) {
    const label = 'march ' + tableA[i][0];
    const a = num(tableA[i][6]);
    const b = num(tableB[i][7]);
    assert.ok(Number.isFinite(a) && a > 0, label + ': Table A has no readable actual time');
    assert.ok(Math.abs(a - b) < 0.05, label + ': Table A says ' + a + 's but Table B says ' + b + 's');
  }
});

test('implied speed matches distance over time', () => {
  for (let i = 0; i < tableB.length; i++) {
    const row = tableB[i];
    const euclid = num(row[3]);
    const seconds = num(row[7]);
    const stated = num(row[8]);
    assert.ok(
      Math.abs(stated - euclid / seconds) < 0.002,
      'march ' + row[0] + ': implied speed should be ' + (euclid / seconds).toFixed(3) + ', log says ' + stated
    );
  }
});
