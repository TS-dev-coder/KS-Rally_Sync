/**
 * Unit tests for the pure calculation layer. Run with: node --test tests/
 *
 * The js/*.js files are classic browser scripts that attach to globalThis, so
 * they can be require()d here unchanged — no build step, same code the app runs.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../js/zones.js');
require('../js/calculations.js');

const { calc, zones } = globalThis.RallySync;

const near = (actual, expected, tolerance = 1e-9, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    message || `expected ${actual} to be within ${tolerance} of ${expected}`
  );

// ------------------------------------------------------------------ geometry

test('distanceTiles uses straight-line Euclidean distance', () => {
  near(calc.distanceTiles({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  near(calc.distanceTiles({ x: 100, y: 100 }, { x: 100, y: 100 }), 0);
  near(calc.distanceTiles({ x: 512, y: 512 }, { x: 500, y: 507 }), 13);
});

test('distanceTiles accepts numeric strings from form inputs', () => {
  near(calc.distanceTiles({ x: '0', y: '0' }, { x: '3', y: '4' }), 5);
});

test('speedMultiplier turns a March Speed Up percentage into a multiplier', () => {
  near(calc.speedMultiplier(0), 1);
  near(calc.speedMultiplier(45), 1.45);
  near(calc.speedMultiplier(150), 2.5);
});

// -------------------------------------------------------------------- models

test('affine model reproduces the coefficient model from RESEARCH-NOTES 3.1', () => {
  const constants = { secPerTile: 1 / 0.36, offset: 3.2 };
  // 100 tiles at 100% speed: 100 / 0.36 + 3.2
  near(calc.affineMarchSeconds(100, 1, constants), 100 / 0.36 + 3.2, 1e-9);
  // The same march at 150% speed takes proportionally less travel time.
  near(calc.affineMarchSeconds(100, 1.5, constants), 100 / 0.36 / 1.5 + 3.2, 1e-9);
});

test('affine model treats a missing offset as zero', () => {
  near(calc.affineMarchSeconds(10, 1, { secPerTile: 6 }), 60);
});

test('segmentLengthInsideCircle returns the diameter for a line through the centre', () => {
  const inside = calc.segmentLengthInsideCircle({ x: 0, y: 50 }, { x: 100, y: 50 }, 50, 50, 10);
  near(inside, 20, 1e-9);
});

test('segmentLengthInsideCircle returns zero for a route that misses the circle', () => {
  const inside = calc.segmentLengthInsideCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, 80, 10);
  assert.strictEqual(inside, 0);
});

test('segmentLengthInsideCircle clamps to the travelled segment, not the infinite line', () => {
  // Route stops at x=40, well before the circle centred at x=90.
  const inside = calc.segmentLengthInsideCircle({ x: 0, y: 0 }, { x: 40, y: 0 }, 90, 0, 10);
  assert.strictEqual(inside, 0);
});

test('segmentLengthInsideCircle handles a route ending inside the circle', () => {
  // Ends at the centre, so only the entry half of the radius is travelled.
  const inside = calc.segmentLengthInsideCircle({ x: 0, y: 0 }, { x: 50, y: 0 }, 50, 0, 10);
  near(inside, 10, 1e-9);
});

test('segmented model charges relic tiles at the slow rate and the rest at the normal rate', () => {
  const constants = {
    secPerTile: 2, secPerTileInside: 10, offset: 0,
    relicX: 50, relicY: 0, relicRadius: 10
  };
  // 100 tiles total, 20 of them inside the relic circle.
  const seconds = calc.segmentedMarchSeconds({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, constants);
  near(seconds, 80 * 2 + 20 * 10, 1e-9);
});

test('segmented model equals the affine model when the route avoids the relic', () => {
  const constants = {
    secPerTile: 2, secPerTileInside: 10, offset: 3.2,
    relicX: 500, relicY: 500, relicRadius: 10
  };
  const seconds = calc.segmentedMarchSeconds({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, constants);
  near(seconds, calc.affineMarchSeconds(100, 1, constants), 1e-9);
});

test('marchSecondsForZone dispatches on formulaType', () => {
  const affineZone = {
    zoneKey: 'general', formulaType: 'affine',
    constants: { secPerTile: 3, offset: 0 }
  };
  const result = calc.marchSecondsForZone(affineZone, { x: 0, y: 0 }, { x: 0, y: 10 }, 0);
  near(result.seconds, 30);
  near(result.distance, 10);

  const segZone = {
    zoneKey: 'castle_relic', formulaType: 'segmented',
    constants: { secPerTile: 3, offset: 0 },
    segmented: { secPerTile: 3, secPerTileInside: 9, offset: 0, relicX: 0, relicY: 5, relicRadius: 2 }
  };
  const segResult = calc.marchSecondsForZone(segZone, { x: 0, y: 0 }, { x: 0, y: 10 }, 0);
  near(segResult.insideTiles, 4, 1e-9);
  near(segResult.seconds, 6 * 3 + 4 * 9, 1e-9);
});

// --------------------------------------------------------------- calibration

test('fitAffine recovers known constants from two clean samples', () => {
  // Truth: t = 3 * (distance / multiplier) + 5
  const samples = [
    { distance: 100, speedPercent: 0, observedTimeSeconds: 305 },
    { distance: 300, speedPercent: 0, observedTimeSeconds: 905 }
  ];
  const fit = calc.fitAffine(samples, { secPerTile: 1, offset: 0 });
  near(fit.secPerTile, 3, 1e-9);
  near(fit.offset, 5, 1e-9);
  assert.strictEqual(fit.n, 2);
  assert.strictEqual(fit.fittedOffset, true);
  near(fit.rmse, 0, 1e-9);
});

test('fitAffine handles the speed multiplier when fitting', () => {
  // t = 4 * distance / 1.5 + 0
  const samples = [
    { distance: 150, speedPercent: 50, observedTimeSeconds: 400 },
    { distance: 300, speedPercent: 50, observedTimeSeconds: 800 }
  ];
  const fit = calc.fitAffine(samples, { secPerTile: 1, offset: 0 });
  near(fit.secPerTile, 4, 1e-9);
  near(fit.offset, 0, 1e-6);
});

test('fitAffine holds the offset fixed when there is only one sample', () => {
  const fit = calc.fitAffine(
    [{ distance: 100, speedPercent: 0, observedTimeSeconds: 103.2 }],
    { secPerTile: 2.778, offset: 3.2 }
  );
  near(fit.secPerTile, 1, 1e-9);
  near(fit.offset, 3.2, 1e-9);
  assert.strictEqual(fit.fittedOffset, false);
});

test('fitAffine holds the offset fixed when every sample sits at the same x', () => {
  const fit = calc.fitAffine(
    [
      { distance: 100, speedPercent: 0, observedTimeSeconds: 103 },
      { distance: 100, speedPercent: 0, observedTimeSeconds: 105 }
    ],
    { secPerTile: 2.778, offset: 3.2 }
  );
  assert.strictEqual(fit.fittedOffset, false);
  near(fit.secPerTile, (104 - 3.2) / 100, 1e-9);
});

test('fitAffine reports error spread so the UI can show fit quality', () => {
  const fit = calc.fitAffine(
    [
      { distance: 100, speedPercent: 0, observedTimeSeconds: 300 },
      { distance: 200, speedPercent: 0, observedTimeSeconds: 610 },
      { distance: 300, speedPercent: 0, observedTimeSeconds: 890 }
    ],
    { secPerTile: 3, offset: 0 }
  );
  assert.ok(fit.rmse > 0, 'imperfect samples should produce a non-zero rmse');
  assert.ok(fit.maxErrorSeconds >= fit.rmse);
});

test('fitAffine rejects a fit that would imply a negative march rate', () => {
  // Faster-looking time at a longer distance would slope downwards.
  const fit = calc.fitAffine(
    [
      { distance: 100, speedPercent: 0, observedTimeSeconds: 500 },
      { distance: 300, speedPercent: 0, observedTimeSeconds: 100 }
    ],
    { secPerTile: 3, offset: 0 }
  );
  assert.ok(fit === null || fit.secPerTile > 0, 'must never return a negative rate');
});

test('fitAffine ignores unusable samples and returns null when none remain', () => {
  assert.strictEqual(calc.fitAffine([], { offset: 0 }), null);
  assert.strictEqual(
    calc.fitAffine([{ distance: 0, speedPercent: 0, observedTimeSeconds: 10 }], { offset: 0 }),
    null
  );
});

// ------------------------------------------------------------------ duration

test('parseDuration accepts the formats a rally lead would actually type', () => {
  near(calc.parseDuration('95'), 95);
  near(calc.parseDuration('95s'), 95);
  near(calc.parseDuration('1m35s'), 95);
  near(calc.parseDuration('1m 35'), 95);
  near(calc.parseDuration('1:35'), 95);
  near(calc.parseDuration('01:35'), 95);
  near(calc.parseDuration('1:02:03'), 3723);
  near(calc.parseDuration('1h2m3s'), 3723);
  near(calc.parseDuration('  2m  '), 120);
});

test('parseDuration returns null for junk rather than a wrong number', () => {
  assert.strictEqual(calc.parseDuration(''), null);
  assert.strictEqual(calc.parseDuration('   '), null);
  assert.strictEqual(calc.parseDuration('soon'), null);
  assert.strictEqual(calc.parseDuration(null), null);
  assert.strictEqual(calc.parseDuration(undefined), null);
  assert.strictEqual(calc.parseDuration('1:2:3:4'), null);
});

test('formatDuration is readable at a glance', () => {
  assert.strictEqual(calc.formatDuration(45), '45s');
  assert.strictEqual(calc.formatDuration(95), '1m 35s');
  assert.strictEqual(calc.formatDuration(3723), '1h 02m 03s');
  assert.strictEqual(calc.formatDuration(-5), '-5s');
});

// ------------------------------------------------------------- measurements

test('a measurement is fresh only while its defining inputs are unchanged', () => {
  const lead = { x: 100, y: 200, marchSpeedUpPercent: 45 };
  const target = { x: 512, y: 512 };
  const measurement = {
    seconds: 180, leadX: 100, leadY: 200, speedPercent: 45, targetX: 512, targetY: 512
  };

  assert.strictEqual(calc.measurementIsFresh(measurement, lead, target), true);
  assert.strictEqual(
    calc.measurementIsFresh(measurement, { ...lead, marchSpeedUpPercent: 50 }, target), false
  );
  assert.strictEqual(calc.measurementIsFresh(measurement, { ...lead, x: 101 }, target), false);
  assert.strictEqual(calc.measurementIsFresh(measurement, lead, { x: 513, y: 512 }), false);
  assert.strictEqual(calc.measurementIsFresh(null, lead, target), false);
});

// --------------------------------------------------------- march resolution

const testZones = () => zones.defaultZoneFormulas('coefficient');

test('a fresh measurement beats the formula entirely', () => {
  const lead = { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 45 };
  const target = { id: 't1', x: 100, y: 0, zoneKey: 'general' };
  const resolved = calc.resolveMarchSeconds({
    lead, target, zones: testZones(),
    measurement: {
      seconds: 123.5, leadX: 0, leadY: 0, speedPercent: 45, targetX: 100, targetY: 0
    }
  });
  assert.strictEqual(resolved.tier, calc.TIER.MEASURED);
  near(resolved.seconds, 123.5);
});

test('a stale measurement is ignored and explained, not silently reused', () => {
  const lead = { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 60 };
  const target = { id: 't1', x: 100, y: 0, zoneKey: 'general' };
  const resolved = calc.resolveMarchSeconds({
    lead, target, zones: testZones(),
    measurement: {
      seconds: 123.5, leadX: 0, leadY: 0, speedPercent: 45, targetX: 100, targetY: 0
    }
  });
  assert.notStrictEqual(resolved.tier, calc.TIER.MEASURED);
  assert.ok(resolved.notes.some((n) => /ignored/i.test(n)));
});

test('an uncalibrated zone reports the estimated tier', () => {
  const resolved = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 0 },
    target: { id: 't1', x: 100, y: 0, zoneKey: 'general' },
    zones: testZones(),
    measurement: null
  });
  assert.strictEqual(resolved.tier, calc.TIER.ESTIMATED);
  near(resolved.seconds, 100 / 0.36 + 3.2, 1e-9);
});

test('a calibrated zone reports the calibrated tier', () => {
  const zs = testZones();
  zs[0].trust = 'calibrated';
  const resolved = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 0 },
    target: { id: 't1', x: 100, y: 0, zoneKey: 'general' },
    zones: zs,
    measurement: null
  });
  assert.strictEqual(resolved.tier, calc.TIER.CALIBRATED);
});

test('missing speed blocks that lead with an error instead of guessing', () => {
  const resolved = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: null },
    target: { id: 't1', x: 100, y: 0, zoneKey: 'general' },
    zones: testZones(),
    measurement: null
  });
  assert.strictEqual(resolved.seconds, null);
  assert.ok(resolved.errors.some((e) => /March Speed Up/i.test(e)));
});

test('missing coordinates block that lead with an error', () => {
  const resolved = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: '', y: '', marchSpeedUpPercent: 45 },
    target: { id: 't1', x: 100, y: 0, zoneKey: 'general' },
    zones: testZones(),
    measurement: null
  });
  assert.strictEqual(resolved.seconds, null);
  assert.ok(resolved.errors.some((e) => /coordinates/i.test(e)));
});

test('the zone comes from the target, not from the lead', () => {
  // The Castle always sits in the Forbidden Zone, so the penalty is a property
  // of where you are marching, never of who is marching.
  const onCastle = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 0 },
    target: { id: 't1', x: 100, y: 0, zoneKey: 'castle_relic' },
    zones: testZones(),
    measurement: null
  });
  assert.strictEqual(onCastle.zoneKeyUsed, 'castle_relic');
  near(onCastle.seconds, 100 / 0.185 + 3.2, 1e-9);

  // Same lead, same distance, open-map target: the faster rate applies.
  const onOpenMap = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 0 },
    target: { id: 't2', x: 100, y: 0, zoneKey: 'general' },
    zones: testZones(),
    measurement: null
  });
  assert.strictEqual(onOpenMap.zoneKeyUsed, 'general');
  near(onOpenMap.seconds, 100 / 0.36 + 3.2, 1e-9);
});

test('a lead carries no zone state of its own', () => {
  // Stray legacy fields on a lead must not influence the model chosen.
  const withJunk = calc.resolveMarchSeconds({
    lead: { id: 'l1', x: 0, y: 0, marchSpeedUpPercent: 0, crossesRelic: true },
    target: { id: 't1', x: 100, y: 0, zoneKey: 'general' },
    zones: testZones(),
    measurement: null
  });
  assert.strictEqual(withJunk.zoneKeyUsed, 'general');
  near(withJunk.seconds, 100 / 0.36 + 3.2, 1e-9);
});

// ------------------------------------------------------------ plan building

test('calculateLaunchTime subtracts march time from landing time', () => {
  const landing = new Date('2026-09-01T20:00:00Z');
  const launch = calc.calculateLaunchTime(landing, 95);
  assert.strictEqual(launch.toISOString(), '2026-09-01T19:58:25.000Z');
});

const planLeads = [
  { id: 'fast', name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 100 },
  { id: 'slow', name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 }
];
const planTarget = { id: 'castle', name: 'Castle', x: 100, y: 0, zoneKey: 'general' };
const LANDING = Date.parse('2026-09-01T20:00:00Z');

test('sync mode lands everyone at the same instant', () => {
  const plan = calc.buildPlan({
    leads: planLeads, target: planTarget, zones: testZones(),
    mode: 'sync', landingMs: LANDING, gatherSeconds: 300, nowMs: LANDING - 3600000
  });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.rows.length, 2);
  plan.rows.forEach((row) => assert.strictEqual(row.landingMs, LANDING));
});

test('sync mode makes the slower lead open their rally earlier', () => {
  const plan = calc.buildPlan({
    leads: planLeads, target: planTarget, zones: testZones(),
    mode: 'sync', landingMs: LANDING, gatherSeconds: 300, nowMs: LANDING - 3600000
  });
  // Rows are sorted by who must act first.
  assert.strictEqual(plan.rows[0].leadId, 'slow');
  assert.strictEqual(plan.rows[1].leadId, 'fast');
  assert.ok(plan.rows[0].rallyOpenMs < plan.rows[1].rallyOpenMs);
});

test('the gather window is subtracted on top of march time', () => {
  const plan = calc.buildPlan({
    leads: [planLeads[1]], target: planTarget, zones: testZones(),
    mode: 'sync', landingMs: LANDING, gatherSeconds: 300, nowMs: LANDING - 3600000
  });
  const row = plan.rows[0];
  near(row.departMs, LANDING - row.marchSeconds * 1000, 1e-6);
  near(row.rallyOpenMs, row.departMs - 300000, 1e-6);
});

test('a zero gather window makes rally-open and depart the same moment', () => {
  const plan = calc.buildPlan({
    leads: [planLeads[1]], target: planTarget, zones: testZones(),
    mode: 'sync', landingMs: LANDING, gatherSeconds: 0, nowMs: LANDING - 3600000
  });
  assert.strictEqual(plan.rows[0].rallyOpenMs, plan.rows[0].departMs);
});

test('sequence mode staggers landings by the gap, in roster order', () => {
  const plan = calc.buildPlan({
    leads: planLeads, target: planTarget, zones: testZones(),
    mode: 'sequence', gapSeconds: 5, landingMs: LANDING, gatherSeconds: 300,
    nowMs: LANDING - 3600000
  });
  const bySlot = {};
  plan.rows.forEach((r) => { bySlot[r.leadId] = r; });
  assert.strictEqual(bySlot.fast.landingMs, LANDING);
  assert.strictEqual(bySlot.slow.landingMs, LANDING + 5000);
});

test('a landing time too soon for a lead is flagged, not shown as a negative countdown', () => {
  const plan = calc.buildPlan({
    leads: planLeads, target: planTarget, zones: testZones(),
    mode: 'sync', landingMs: LANDING, gatherSeconds: 300, nowMs: LANDING - 60000
  });
  assert.ok(plan.rows.every((r) => r.tooLate), 'both leads cannot make a 60s window');
  assert.ok(plan.rows.every((r) => r.secondsUntilOpen < 0));
});

test('buildPlan blocks with a clear reason when inputs are missing', () => {
  const noTarget = calc.buildPlan({ leads: planLeads, target: null, zones: testZones() });
  assert.strictEqual(noTarget.ok, false);
  assert.ok(noTarget.blockers.some((b) => /target/i.test(b)));

  const noLeads = calc.buildPlan({
    leads: [], target: planTarget, zones: testZones(), landingMs: LANDING
  });
  assert.ok(noLeads.blockers.some((b) => /leads/i.test(b)));

  const noTime = calc.buildPlan({ leads: planLeads, target: planTarget, zones: testZones() });
  assert.ok(noTime.blockers.some((b) => /landing time/i.test(b)));
});

test('one lead with missing data does not block the rest of the roster', () => {
  const plan = calc.buildPlan({
    leads: [planLeads[0], { id: 'broken', name: 'Cabo', x: 0, y: 0 }],
    target: planTarget, zones: testZones(),
    mode: 'sync', landingMs: LANDING, gatherSeconds: 300, nowMs: LANDING - 3600000
  });
  assert.strictEqual(plan.ok, false);
  const good = plan.rows.find((r) => r.leadId === 'fast');
  const bad = plan.rows.find((r) => r.leadId === 'broken');
  assert.ok(good.rallyOpenMs !== null, 'valid lead still gets a time');
  assert.strictEqual(bad.rallyOpenMs, null);
  assert.ok(bad.errors.length > 0);
});

test('plan rows carry measurements through by lead and target pair', () => {
  const key = calc.measurementKey('fast', 'castle');
  const measurements = {};
  measurements[key] = {
    seconds: 42, leadX: 0, leadY: 0, speedPercent: 100, targetX: 100, targetY: 0
  };
  const plan = calc.buildPlan({
    leads: planLeads, target: planTarget, zones: testZones(), measurements,
    mode: 'sync', landingMs: LANDING, gatherSeconds: 300, nowMs: LANDING - 3600000
  });
  const fast = plan.rows.find((r) => r.leadId === 'fast');
  assert.strictEqual(fast.tier, calc.TIER.MEASURED);
  near(fast.marchSeconds, 42);
});
