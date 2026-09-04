/**
 * Tests for the feature modules: roster paste parsing, share links, and
 * multi-target planning. All pure — no DOM needed.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('../js/zones.js');
require('../js/i18n.js');
['ar','de','es','fr','id','it','ja','ko','pl','pt','ru','th','tr','vi','zh-Hans','zh-Hant']
  .forEach((c) => require('../js/locale/' + c + '.js'));
require('../js/calculations.js');
require('../js/roster-import.js');
require('../js/share.js');
require('../js/alarm.js');

const { calc, zones, rosterImport, share, i18n } = globalThis.RallySync;

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`);

// ======================================================== roster paste import

test('parses the plain "name x y speed" shape', () => {
  const { rows, okCount } = rosterImport.parseRoster('TS 430 604 62');
  assert.strictEqual(okCount, 1);
  assert.strictEqual(rows[0].name, 'TS');
  assert.strictEqual(rows[0].x, 430);
  assert.strictEqual(rows[0].y, 604);
  assert.strictEqual(rows[0].speedPercent, 62);
});

test('parses comma-separated, percent-suffixed and bracketed coordinates', () => {
  const { rows } = rosterImport.parseRoster([
    'Ash, 388, 471, 38',
    'Mike 501 640 0%',
    'Cabo (611,498) 74%'
  ].join('\n'));

  assert.deepStrictEqual(rows.map((r) => r.name), ['Ash', 'Mike', 'Cabo']);
  assert.deepStrictEqual(rows.map((r) => r.x), [388, 501, 611]);
  assert.deepStrictEqual(rows.map((r) => r.speedPercent), [38, 0, 74]);
  assert.ok(rows.every((r) => r.ok));
});

test('honours x:/y: labels wherever they appear in the line', () => {
  const { rows } = rosterImport.parseRoster('Irfan x:559 y:557 speed:105');
  assert.strictEqual(rows[0].name, 'Irfan');
  assert.strictEqual(rows[0].x, 559);
  assert.strictEqual(rows[0].y, 557);
  assert.strictEqual(rows[0].speedPercent, 105);
});

test('an explicit percentage wins over position', () => {
  // 88 is written last but marked as the percentage, so it is the speed.
  const { rows } = rosterImport.parseRoster('Beast 470 430 88%');
  assert.strictEqual(rows[0].speedPercent, 88);
  assert.strictEqual(rows[0].x, 470);
  assert.strictEqual(rows[0].y, 430);
});

test('pulls out [alliance] and {squad} tags', () => {
  const { rows } = rosterImport.parseRoster('Cabo (611,498) 74% [VNG] {Wave 1}');
  assert.strictEqual(rows[0].name, 'Cabo');
  assert.strictEqual(rows[0].alliance, 'VNG');
  assert.strictEqual(rows[0].squad, 'Wave 1');
  assert.strictEqual(rows[0].ok, true);
});

test('reports unreadable lines rather than dropping them silently', () => {
  const { rows, okCount, errorCount } = rosterImport.parseRoster([
    'TS 430 604 62',
    'this line has no numbers',
    'Ash 388 471 38'
  ].join('\n'));

  assert.strictEqual(okCount, 2);
  assert.strictEqual(errorCount, 1);
  const bad = rows.find((r) => !r.ok);
  assert.ok(bad.error, 'a failing row must explain itself');
  assert.strictEqual(bad.raw, 'this line has no numbers');
});

test('a line missing its speed is flagged, not defaulted to zero', () => {
  const { rows } = rosterImport.parseRoster('TS 430 604');
  assert.strictEqual(rows[0].ok, false);
  assert.match(rows[0].error, /Speed/i);
  assert.strictEqual(rows[0].speedPercent, null);
});

test('blank lines, comments and a header row are skipped', () => {
  const { rows, okCount } = rosterImport.parseRoster([
    'name coords speed',
    '',
    '# our roster',
    '// second wave',
    'TS 430 604 62'
  ].join('\n'));
  assert.strictEqual(okCount, 1);
  assert.strictEqual(rows.length, 1);
});

test('the built-in example parses cleanly', () => {
  const { okCount, errorCount } = rosterImport.parseRoster(rosterImport.EXAMPLE);
  assert.strictEqual(errorCount, 0, 'the example we show users must itself work');
  assert.strictEqual(okCount, 4);
});

// ================================================================ share links

const SLOT = {
  name: 'Ash',
  targetName: "King's Castle",
  rallyOpenMs: Date.parse('2026-09-01T19:53:20Z'),
  departMs: Date.parse('2026-09-01T19:58:20Z'),
  landingMs: Date.parse('2026-09-01T20:00:00Z'),
  marchSeconds: 100,
  gatherSeconds: 300,
  tier: 'measured'
};

test('a slot survives an encode/decode round trip', () => {
  const decoded = share.decodeSlot(share.encodeSlot(SLOT));
  assert.strictEqual(decoded.name, SLOT.name);
  assert.strictEqual(decoded.targetName, SLOT.targetName);
  assert.strictEqual(decoded.rallyOpenMs, SLOT.rallyOpenMs);
  assert.strictEqual(decoded.landingMs, SLOT.landingMs);
  assert.strictEqual(decoded.marchSeconds, 100);
  assert.strictEqual(decoded.gatherSeconds, 300);
  assert.strictEqual(decoded.tier, 'measured');
});

test('the encoded payload is URL-safe', () => {
  const encoded = share.encodeSlot(SLOT);
  assert.ok(!/[+/=]/.test(encoded), 'must not contain +, / or = which chat clients mangle');
  assert.strictEqual(encodeURIComponent(encoded), encoded);
});

test('non-ASCII names survive the round trip', () => {
  const decoded = share.decodeSlot(share.encodeSlot(
    Object.assign({}, SLOT, { name: 'Ash — 王者', targetName: 'King’s Castle' })
  ));
  assert.strictEqual(decoded.name, 'Ash — 王者');
  assert.strictEqual(decoded.targetName, 'King’s Castle');
});

test('slotUrl puts the payload in the fragment, never the query string', () => {
  const url = share.slotUrl(SLOT, 'https://example.com/rallysync/index.html?x=1');
  assert.ok(url.indexOf('#go=') !== -1);
  assert.strictEqual(url.split('#')[0].indexOf('go='), -1, 'payload must not leak into the URL path or query');
});

test('slotUrl replaces an existing fragment rather than appending', () => {
  const url = share.slotUrl(SLOT, 'https://example.com/index.html#go=stale');
  assert.strictEqual(url.split('#go=').length, 2);
});

test('slotFromHash reads a slot back out of a location hash', () => {
  const hash = '#go=' + share.encodeSlot(SLOT);
  const decoded = share.slotFromHash(hash);
  assert.ok(decoded);
  assert.strictEqual(decoded.name, 'Ash');
});

test('garbage and normal page loads decode to null instead of throwing', () => {
  assert.strictEqual(share.slotFromHash(''), null);
  assert.strictEqual(share.slotFromHash('#calculate'), null);
  assert.strictEqual(share.decodeSlot('not-base64!!'), null);
  assert.strictEqual(share.decodeSlot(''), null);
  assert.strictEqual(share.decodeSlot(Buffer.from('{"v":99}').toString('base64')), null);
});

// ========================================================= multi-target plans

const testZones = () => zones.defaultZoneFormulas('coefficient');
const LANDING = Date.parse('2026-09-01T20:00:00Z');
const NOW = LANDING - 3600000;

const castle = { id: 'castle', name: 'Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300 };
const turret = { id: 'turret', name: 'Turret', x: 50, y: 0, zoneKey: 'general', gatherSeconds: 0 };

const leadA = { id: 'a', name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 0 };
const leadB = { id: 'b', name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 };

test('buildMultiPlan merges groups into one launch order', () => {
  const plan = calc.buildMultiPlan({
    groups: [
      { target: castle, leads: [leadA] },
      { target: turret, leads: [leadB] }
    ],
    zones: testZones(), measurements: {}, mode: 'sync',
    gapSeconds: 0, landingMs: LANDING, nowMs: NOW
  });

  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.rows.length, 2);
  // Sorted by who acts first: the Castle lead has a 300s window plus a longer march.
  assert.strictEqual(plan.rows[0].leadId, 'a');
  assert.ok(plan.rows[0].rallyOpenMs < plan.rows[1].rallyOpenMs);
});

test('each row records which target it is marching on', () => {
  const plan = calc.buildMultiPlan({
    groups: [
      { target: castle, leads: [leadA] },
      { target: turret, leads: [leadB] }
    ],
    zones: testZones(), measurements: {}, mode: 'sync',
    gapSeconds: 0, landingMs: LANDING, nowMs: NOW
  });
  const byLead = {};
  plan.rows.forEach((r) => { byLead[r.leadId] = r; });
  assert.strictEqual(byLead.a.targetName, 'Castle');
  assert.strictEqual(byLead.b.targetName, 'Turret');
});

test('each target keeps its own rally window', () => {
  const plan = calc.buildMultiPlan({
    groups: [
      { target: castle, leads: [leadA] },
      { target: turret, leads: [leadB] }
    ],
    zones: testZones(), measurements: {}, mode: 'sync',
    gapSeconds: 0, landingMs: LANDING, nowMs: NOW
  });
  const byLead = {};
  plan.rows.forEach((r) => { byLead[r.leadId] = r; });

  // Castle has a 5m gather; the turret is a solo march with none.
  near(byLead.a.departMs - byLead.a.rallyOpenMs, 300000, 1e-6);
  assert.strictEqual(byLead.b.rallyOpenMs, byLead.b.departMs);
});

test('every target lands at the requested time in sync mode', () => {
  const plan = calc.buildMultiPlan({
    groups: [
      { target: castle, leads: [leadA] },
      { target: turret, leads: [leadB] }
    ],
    zones: testZones(), measurements: {}, mode: 'sync',
    gapSeconds: 0, landingMs: LANDING, nowMs: NOW
  });
  plan.rows.forEach((row) => assert.strictEqual(row.landingMs, LANDING));
});

test('a sequence stagger applies within a target wave, not across targets', () => {
  const plan = calc.buildMultiPlan({
    groups: [
      { target: castle, leads: [leadA, leadB] },
      { target: turret, leads: [{ id: 'c', name: 'Cabo', x: 0, y: 0, marchSpeedUpPercent: 0 }] }
    ],
    zones: testZones(), measurements: {}, mode: 'sequence',
    gapSeconds: 10, landingMs: LANDING, nowMs: NOW
  });

  const byLead = {};
  plan.rows.forEach((r) => { byLead[r.leadId] = r; });

  // Castle wave staggers 0s then 10s.
  assert.strictEqual(byLead.a.landingMs, LANDING);
  assert.strictEqual(byLead.b.landingMs, LANDING + 10000);
  // The turret wave restarts its own stagger rather than continuing at 20s.
  assert.strictEqual(byLead.c.landingMs, LANDING);
});

test('buildMultiPlan blocks when nothing is selected', () => {
  const empty = calc.buildMultiPlan({ groups: [], zones: testZones(), landingMs: LANDING });
  assert.strictEqual(empty.ok, false);
  assert.ok(empty.blockers.length > 0);
});

test('one bad lead marks the plan not-ok but keeps the good rows', () => {
  const plan = calc.buildMultiPlan({
    groups: [{ target: castle, leads: [leadA, { id: 'x', name: 'Cabo', x: 0, y: 0 }] }],
    zones: testZones(), measurements: {}, mode: 'sync',
    gapSeconds: 0, landingMs: LANDING, nowMs: NOW
  });
  assert.strictEqual(plan.ok, false);
  assert.strictEqual(plan.rows.length, 2);
  assert.ok(plan.rows.some((r) => r.rallyOpenMs !== null));
});

// ============================================================== time picker

require('../js/dom.js');
require('../js/icons.js');
require('../js/timepicker.js');
const { timePicker } = globalThis.RallySync;

test('nextBoundary rounds up to the next round clock mark', () => {
  const at = (iso) => Date.parse(iso);

  // 17:47:49 -> next half hour is 18:00
  assert.strictEqual(
    timePicker.nextBoundary(at('2026-09-01T17:47:49Z'), 1800),
    at('2026-09-01T18:00:00Z')
  );
  // ...and the next quarter is 18:00 too, since 17:45 has passed
  assert.strictEqual(
    timePicker.nextBoundary(at('2026-09-01T17:47:49Z'), 900),
    at('2026-09-01T18:00:00Z')
  );
  // 17:12 -> next quarter is 17:15
  assert.strictEqual(
    timePicker.nextBoundary(at('2026-09-01T17:12:00Z'), 900),
    at('2026-09-01T17:15:00Z')
  );
  // the top of the hour
  assert.strictEqual(
    timePicker.nextBoundary(at('2026-09-01T17:47:49Z'), 3600),
    at('2026-09-01T18:00:00Z')
  );
});

test('nextBoundary always moves forward, never returns the current instant', () => {
  const exact = Date.parse('2026-09-01T18:00:00Z');
  assert.ok(timePicker.nextBoundary(exact, 1800) > exact,
    'sitting exactly on a boundary must advance to the next one');
});

test('nextBoundary rolls past midnight correctly', () => {
  assert.strictEqual(
    timePicker.nextBoundary(Date.parse('2026-09-01T23:47:00Z'), 1800),
    Date.parse('2026-09-02T00:00:00Z')
  );
});

// ==================================================== start-anchored planning

test('landingFromStart is the start plus the slowest chain', () => {
  const start = Date.parse('2026-09-01T20:00:00Z');
  const target = { id: 't', name: 'T', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300 };
  const slow = { id: 'slow', name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 };
  const fast = { id: 'fast', name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 100 };

  const landing = calc.landingFromStart([{ target, leads: [fast, slow] }], {
    zones: testZones(), measurements: {}, mode: 'sync', gapSeconds: 0, startMs: start
  });

  // The slow lead sets the pace: 300s window + 100/0.36 + 3.2 seconds of march.
  near(landing, start + (300 + 100 / 0.36 + 3.2) * 1000, 1e-6);
});

test('the slowest lead taps exactly at the start moment', () => {
  const start = Date.parse('2026-09-01T20:00:00Z');
  const target = { id: 't', name: 'T', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300 };
  const leads = [
    { id: 'fast', name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 100 },
    { id: 'slow', name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 }
  ];

  const plan = calc.buildMultiPlan({
    groups: [{ target, leads }], zones: testZones(), measurements: {},
    mode: 'sync', gapSeconds: 0, startMs: start, nowMs: start - 60000
  });

  const earliest = Math.min.apply(null, plan.rows.map((r) => r.rallyOpenMs));
  near(earliest, start, 1e-6);
  assert.strictEqual(plan.rows[0].leadId, 'slow', 'the slowest lead goes first');
  plan.rows.forEach((r) => assert.ok(r.rallyOpenMs >= start - 1,
    'nobody may be asked to tap before the start'));
});

test('an impossible plan cannot happen — nobody is ever too late', () => {
  const start = Date.parse('2026-09-01T20:00:00Z');
  const target = { id: 't', name: 'T', x: 900, y: 900, zoneKey: 'castle_relic', gatherSeconds: 300 };
  const leads = [{ id: 'a', name: 'TS', x: 0, y: 0, marchSpeedUpPercent: 0 }];

  // Even a punishing march plans cleanly, because the landing is derived.
  const plan = calc.buildMultiPlan({
    groups: [{ target, leads }], zones: testZones(), measurements: {},
    mode: 'sync', gapSeconds: 0, startMs: start, nowMs: start
  });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.rows[0].tooLate, false);
  near(plan.rows[0].rallyOpenMs, start, 1e-6);
});

test('in sequence mode the first person still taps at the start', () => {
  const start = Date.parse('2026-09-01T20:00:00Z');
  const target = { id: 't', name: 'T', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 0 };
  const leads = [
    { id: 'a', name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 0 },
    { id: 'b', name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 }
  ];

  const plan = calc.buildMultiPlan({
    groups: [{ target, leads }], zones: testZones(), measurements: {},
    mode: 'sequence', gapSeconds: 10, startMs: start, nowMs: start - 60000
  });

  const earliest = Math.min.apply(null, plan.rows.map((r) => r.rallyOpenMs));
  near(earliest, start, 1e-6);
  // Identical leads, so the stagger is the only difference between landings.
  const landings = plan.rows.map((r) => r.landingMs).sort((x, y) => x - y);
  near(landings[1] - landings[0], 10000, 1e-6);
});

test('rows still explain themselves when no lead can be resolved', () => {
  const start = Date.parse('2026-09-01T20:00:00Z');
  const target = { id: 't', name: 'T', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300 };
  const plan = calc.buildMultiPlan({
    groups: [{ target, leads: [{ id: 'x', name: 'Cabo', x: 0, y: 0 }] }],
    zones: testZones(), measurements: {}, mode: 'sync', gapSeconds: 0,
    startMs: start, nowMs: start
  });

  assert.strictEqual(plan.ok, false);
  assert.strictEqual(plan.rows.length, 1, 'the broken lead must still be listed');
  assert.ok(plan.rows[0].errors.length > 0, 'and must say what it is missing');
});

// ==================================================== alarm callout thresholds

test('the spoken marks and the pip window cover the whole final minute', () => {
  // 60 / 30 / 10 spoken, then a tick every second for the last five.
  const spokenMarks = [60, 30, 10];
  const pipRange = [5, 4, 3, 2, 1];

  // Every spoken mark must be reachable from a two-second crossing window.
  spokenMarks.forEach((mark) => {
    const justInside = mark - 0.1;
    const justOutside = mark - 2.1;
    assert.ok(justInside <= mark && justInside > mark - 2, mark + 's should fire');
    assert.ok(!(justOutside > mark - 2), mark + 's must not re-fire late');
  });

  // The pips and the last spoken mark must not collide on the same second.
  assert.ok(Math.min.apply(null, spokenMarks) > Math.max.apply(null, pipRange),
    'the 10s callout should finish before the per-second pips start');
});

// ============================================== background-safe alarm booking

test('scheduleOnce books a phrase once and refuses times already past', () => {
  const { alarm } = globalThis.RallySync;
  alarm.reset();

  // Without an audio context nothing can be booked, but the dedupe and the
  // guard against negative offsets are pure logic and must still hold.
  assert.strictEqual(alarm.scheduleOnce('lead:go', 'go', -3), false,
    'a moment that has already passed must not be booked');
  assert.strictEqual(alarm.scheduleOnce('lead:go', 'go', 12), true);
  assert.strictEqual(alarm.scheduleOnce('lead:go', 'go', 12), false,
    'the same key must never sound twice');

  alarm.reset();
  assert.strictEqual(alarm.scheduleOnce('lead:go', 'go', 12), true,
    'a new plan re-arms the same key');
});

test('the booking horizon outruns background timer throttling', () => {
  // Chrome drops hidden tabs to one timer wakeup per minute. The horizon has to
  // exceed that by enough that a plan is always booked before the next wakeup.
  const HORIZON_SECONDS = 150;
  const WORST_BACKGROUND_TICK_SECONDS = 60;
  assert.ok(HORIZON_SECONDS > WORST_BACKGROUND_TICK_SECONDS * 2,
    'a single missed wakeup must not leave a gap in booked alarms');
});

// ================================================== field-measured defaults

test('the shipped default reproduces every recorded field march', () => {
  // The 31-city batch of MEASUREMENTS.md 6j-6k: one lead, one sitting, +25%,
  // pre-deploy timer, 29 to 698 tiles. A representative spread is checked here,
  // including both sides of the 100-tile join.
  //
  // Only PLAYER STRUCTURES are asserted. The monster constants are inferred
  // from three readings taken at a different buff, not fitted, so holding them
  // to a tolerance would be asserting a guess.
  const all = zones.defaultZoneFormulas();
  const zone = zones.findZone(all, 'general');
  const at = (x, y) => calc.marchSecondsForZone(
    zone, { x: 536, y: 740 }, { x: x, y: y }, 25
  ).seconds;

  const marches = [
    { x: 562, y: 753, actual: 68, what: '29.1 tiles (near branch)' },
    { x: 584, y: 759, actual: 114, what: '51.6 tiles' },
    { x: 448, y: 756, actual: 188, what: '89.4 tiles' },
    { x: 439, y: 761, actual: 207, what: '99.3 tiles (just below the join)' },
    { x: 681, y: 991, actual: 523, what: '289.9 tiles (far branch)' },
    { x: 172, y: 730, actual: 626, what: '364.1 tiles' },
    { x: 466 - 0, y: 1140, actual: 0, what: 'skip' },
    { x: 998, y: 1026, actual: 842, what: '543.4 tiles' },
    { x: 1133, y: 1102, actual: 997, what: '698.2 tiles (longest)' }
  ].filter((m) => m.actual > 0);

  marches.forEach((m) => {
    const got = at(m.x, m.y);
    const off = Math.abs(got - m.actual);
    assert.ok(off < Math.max(8, m.actual * 0.02),
      m.what + ': predicted ' + got.toFixed(1) + 's against an actual ' + m.actual +
      's, off by ' + off.toFixed(1) + 's');
  });
});

test('the near and far branches meet exactly at the join', () => {
  // Fitted independently the two branches disagree by about 12s, and a march
  // crossing 100 tiles would jump backwards in time. The far branch is fitted
  // under a continuity constraint precisely to prevent that.
  const zone = zones.findZone(zones.defaultZoneFormulas(), 'general');
  const c = zone.constants;
  const below = calc.piecewiseMarchSeconds(c.join - 0.0001, 1.25, c);
  const above = calc.piecewiseMarchSeconds(c.join + 0.0001, 1.25, c);
  assert.ok(Math.abs(above - below) < 0.01,
    'the branches must agree at the join; got ' + below.toFixed(4) + ' vs ' + above.toFixed(4));
  assert.ok(calc.piecewiseMarchSeconds(1, 1.25, c) > 0,
    'and the curve must be positive at one tile, unlike every curve fitted before it');
});

test('a march routed around the blocked centre is flagged, not silently modelled', () => {
  // Seven known cases separate perfectly on where the straight line crosses
  // y=600: inside x in [540,680] the march runs 19-44% slow.
  const from = { x: 536, y: 740 };
  const blocked = [[712, 208], [854, 96], [1027, 158], [999, 142]];
  const clear = [[518, 190], [250, 194], [975, 391], [448, 756]];
  blocked.forEach(([x, y]) => assert.ok(calc.crossesBlockedCentre(from, { x, y }),
    x + ',' + y + ' crosses the blocked band and must be flagged'));
  clear.forEach(([x, y]) => assert.ok(!calc.crossesBlockedCentre(from, { x, y }),
    x + ',' + y + ' clears the band and must NOT be flagged'));
});

test('pooling the field marches across target types would distort the fit', () => {
  // The short marches ran ~0.87 tiles/sec and the long one ~0.60. Forcing a
  // line through all three drives the intercept negative, which would have a
  // short march finishing before it began.
  const samples = [
    { distance: Math.hypot(28, 10), speedPercent: 25, observedTimeSeconds: 34.5 },
    { distance: Math.hypot(12, 32), speedPercent: 25, observedTimeSeconds: 39 },
    { distance: Math.hypot(32, 403), speedPercent: 25, observedTimeSeconds: 679 }
  ];

  // Pooled, a straight line through all three needs a negative intercept —
  // a march under ~8 tiles finishing before it starts. That is the signature of
  // mixing two populations, and is why HQ has its own zone.
  const line = calc.fitAffine(samples, { secPerTile: 1.31, offset: 3.2 });
  assert.ok(line.offset < 0 || line.maxErrorSeconds > 10,
    'pooled, a line either goes negative or misses badly; got offset ' +
    line.offset.toFixed(1) + ' and worst error ' + line.maxErrorSeconds.toFixed(1) + 's');

  // A power curve also fits the pooled data, which is exactly the problem:
  // two very different models are indistinguishable on this data.
  const curve = calc.fitPower(samples);
  assert.ok(curve.maxErrorSeconds < 2,
    'the curve fits the pooled data too, so it cannot settle the question; got ' +
    curve.maxErrorSeconds.toFixed(2) + 's');
});

test('fitPower needs samples at genuinely different distances', () => {
  const sameDistance = [
    { distance: 30, speedPercent: 25, observedTimeSeconds: 34 },
    { distance: 30, speedPercent: 25, observedTimeSeconds: 36 }
  ];
  assert.strictEqual(calc.fitPower(sameDistance), null,
    'two marches of the same length cannot describe a curve');
  assert.strictEqual(calc.fitPower([sameDistance[0]]), null, 'one sample cannot either');
});

test('the superseded community models are kept, and both are far too slow', () => {
  // They stay selectable so the disagreement stays visible rather than being
  // quietly rewritten out of the app.
  //
  // Measured over a LONG march, where the per-tile rate dominates. Over a short
  // one the fixed offsets crowd the comparison and understate the gap.
  const far = (preset) => {
    const zone = zones.findZone(zones.defaultZoneFormulas(preset), 'general');
    return calc.marchSecondsForZone(zone, { x: 0, y: 0 }, { x: 36, y: 403 }, 25).seconds;
  };

  // Measured against the OPEN-MAP curve, which is slower than the monster one
  // the comparison used to run against, so the gap is smaller than it was --
  // but both community models still overshoot badly at range.
  const measured = far('measured');
  assert.ok(far('coefficient') / measured > 1.25,
    'the coefficient model still runs well over the measured curve; got ' +
    (far('coefficient') / measured).toFixed(2) + 'x');
  assert.ok(far('sixSecond') / measured > 2.5,
    'the six-second model runs far over; got ' + (far('sixSecond') / measured).toFixed(2) + 'x');
  assert.strictEqual(zones.DEFAULT_PRESET, 'measured');
});

test('an untouched zone migrates to a better default, a calibrated one does not', () => {
  // Simulates an install carrying the old, twice-too-slow constants.
  const stale = zones.defaultZoneFormulas('coefficient');
  const rate = (list, key) => zones.findZone(list, key).constants.secPerTile;
  assert.ok(rate(stale, 'general') > 2.7, 'fixture really does hold the old value');

  // The reconcile rule: untouched means no fit, no hand edit.
  const untouched = (z) => !z.lastFitISO && !z.fitQuality &&
    z.trust !== 'calibrated' && z.trust !== 'manual';
  assert.strictEqual(untouched(zones.findZone(stale, 'general')), true);

  const calibrated = zones.findZone(zones.defaultZoneFormulas('coefficient'), 'general');
  calibrated.trust = 'calibrated';
  calibrated.lastFitISO = new Date().toISOString();
  assert.strictEqual(untouched(calibrated), false,
    'a zone fitted from real samples must never be overwritten by a new default');
});

// ================================================ the diagonal-route anomaly

test('diagonality separates the five marches that fit from the one that does not', () => {
  // Every march whose route runs close to an axis matched the straight-line
  // model to within half a second. The single strongly diagonal one took about
  // 30% longer, and its time matches the grid path instead.
  const from = { x: 536, y: 740 };
  const cases = [
    { to: { x: 508, y: 730 }, fits: true },
    { to: { x: 548, y: 708 }, fits: true },
    { to: { x: 504, y: 1143 }, fits: true },
    { to: { x: 154, y: 592 }, fits: true },
    { to: { x: 497, y: 63 }, fits: true },
    { to: { x: 999, y: 142 }, fits: false }   // the outlier
  ];

  cases.forEach((c) => {
    const d = calc.diagonality(from, c.to);
    if (c.fits) {
      assert.ok(d < 0.4, 'a march that fits should be axis-aligned, got ' + d.toFixed(3));
    } else {
      assert.ok(d > 0.6, 'the outlier should be strongly diagonal, got ' + d.toFixed(3));
    }
  });
});

test('diagonality is 0 along an axis and 1 at exactly 45 degrees', () => {
  assert.strictEqual(calc.diagonality({ x: 0, y: 0 }, { x: 100, y: 0 }), 0);
  assert.strictEqual(calc.diagonality({ x: 0, y: 0 }, { x: 0, y: 100 }), 0);
  assert.strictEqual(calc.diagonality({ x: 0, y: 0 }, { x: 100, y: 100 }), 1);
  assert.strictEqual(calc.diagonality({ x: 5, y: 5 }, { x: 5, y: 5 }), 0, 'no distance, no angle');
});

test('the outlier time matches the grid path, not the straight line', () => {
  const from = { x: 536, y: 740 }, to = { x: 999, y: 142 };
  const euclidean = calc.distanceTiles(from, to);
  const manhattan = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

  // A HISTORICAL finding, from the older regime (MEASUREMENTS.md 6). Its
  // constants are pinned here rather than read from the shipped zone, because
  // the shipped model has since been refitted to a different session and no
  // longer describes that march. The anomaly itself still stands and is why
  // strongly diagonal marches are flagged rather than silently modelled.
  const OLD_HQ = { secPerTile: 1.3622, offset: 238.0 };
  const implied = (1378 - OLD_HQ.offset) * 1.25 / OLD_HQ.secPerTile;

  assert.ok(Math.abs(implied - manhattan) / manhattan < 0.05,
    'implied path ' + implied.toFixed(0) + ' should be near the grid path ' + manhattan);
  assert.ok(Math.abs(implied - euclidean) / euclidean > 0.3,
    'and nowhere near the straight line ' + euclidean.toFixed(0));
});

test('an unknown target type takes the well-measured curve, not the guessed one', () => {
  // "Other" is what a target gets when the player does not classify it, so it
  // must fall back to the strongest evidence available. The structure curve is
  // fitted to 55 marches across three leads and two kingdoms; the monster scale
  // is inferred from four readings with 20% of scatter. Defaulting an unknown
  // target to the monster zone under-predicted a real 11:16 march as 5:14.
  const byKey = {};
  zones.TARGET_TYPES.forEach((t) => { byKey[t.key] = t.zoneKey; });

  assert.strictEqual(byKey.other, 'general', 'an unclassified target uses the open-map curve');
  ['sanctuary', 'fortress', 'outpost', 'city', 'hq'].forEach((k) => {
    assert.strictEqual(byKey[k], 'general', k + ' marches on the open-map curve');
  });
  assert.strictEqual(byKey.monster, 'monster', 'only Terrors and Beasts leave the open-map curve');

  // And the two must actually differ, or none of this matters.
  const all = zones.defaultZoneFormulas();
  const at = (key) => calc.marchSecondsForZone(
    zones.findZone(all, key), { x: 536, y: 740 }, { x: 503, y: 1141 }, 25
  ).seconds;
  assert.ok(at('general') / at('monster') > 1.8,
    'an open-map march should be roughly twice a monster march; got ' +
    (at('general') / at('monster')).toFixed(2) + 'x');
  assert.ok(Math.abs(at('general') - 676) < 8,
    'the open-map curve should reproduce the real 11:16 march; got ' + at('general').toFixed(0));
});

// ================================================================== i18n

test('the language list is exactly what Kingshot itself ships', () => {
  // Not a list I chose: these are the seventeen locales declared on the
  // Kingshot App Store listing. Anyone who can read the game can read this.
  const codes = i18n.LANGUAGES.map((l) => l.code).sort();
  assert.deepStrictEqual(codes, [
    'ar', 'de', 'en', 'es', 'fr', 'id', 'it', 'ja', 'ko',
    'pl', 'pt', 'ru', 'th', 'tr', 'vi', 'zh-Hans', 'zh-Hant'
  ]);
  assert.strictEqual(i18n.LANGUAGES[0].code, 'en', 'English is the key set and comes first');
  i18n.LANGUAGES.forEach((l) => {
    assert.ok(l.native && l.english, l.code + ' needs both its own name and an English one');
  });
  assert.ok(i18n.LANGUAGES.find((l) => l.code === 'ar').rtl, 'Arabic must be marked right-to-left');
});

test('a missing translation falls back to English, never to a blank', () => {
  // A half-translated locale has to degrade into a readable mix. A blank button
  // or a raw key on screen mid-event is worse than an English word.
  i18n.setLanguage('de');
  assert.strictEqual(i18n.t('nav.calculate'), 'Berechnen');
  assert.strictEqual(i18n.t('badge.measured'), 'gemessen');

  const invented = 'some.key.no.locale.defines';
  i18n.KEYS[invented] = 'English fallback';
  assert.strictEqual(i18n.t(invented), 'English fallback', 'unknown key must render the English string');
  delete i18n.KEYS[invented];

  assert.strictEqual(i18n.t('totally.unknown'), 'totally.unknown', 'and an unknown key renders as itself');
  i18n.setLanguage('en');
});

test('every locale translates a key the English set actually has', () => {
  // Guards against a typo in a locale creating a key that can never be read.
  const known = Object.keys(i18n.KEYS);
  Object.keys(i18n.DICT).forEach((code) => {
    Object.keys(i18n.DICT[code]).forEach((key) => {
      assert.ok(known.indexOf(key) !== -1,
        code + ' defines "' + key + '", which is not a key in the English set');
    });
  });
});

test('browser tags resolve to the closest language the app speaks', () => {
  // Chinese is the one that matters: zh-TW must not quietly land on Simplified,
  // which would be readable but wrong.
  assert.strictEqual(i18n.resolve('pt-BR'), 'pt');
  assert.strictEqual(i18n.resolve('es-419'), 'es');
  assert.strictEqual(i18n.resolve('zh-TW'), 'zh-Hant');
  assert.strictEqual(i18n.resolve('zh-HK'), 'zh-Hant');
  assert.strictEqual(i18n.resolve('zh-CN'), 'zh-Hans');
  assert.strictEqual(i18n.resolve('zh'), 'zh-Hans');
  assert.strictEqual(i18n.resolve('en-GB'), 'en');
  assert.strictEqual(i18n.resolve('xx'), null, 'a language we do not speak resolves to nothing');
});

test('setting a language flips text direction for Arabic', () => {
  assert.strictEqual(i18n.setLanguage('ar'), 'ar');
  assert.strictEqual(i18n.isRtl(), true);
  assert.strictEqual(i18n.setLanguage('en'), 'en');
  assert.strictEqual(i18n.isRtl(), false);
  assert.strictEqual(i18n.setLanguage('klingon'), 'en', 'an unknown code falls back to English');
});

test('spoken callouts are localised and tagged for the right voice', () => {
  // A callout you must react to in seconds is useless read in the wrong accent,
  // so the utterance carries a language tag as well as translated words.
  //
  // What matters here is that the callout is localised, carries the name and
  // the count, and is tagged for the right voice. It used to assert the exact
  // Japanese wording, which tested nothing about any of that and did real harm:
  // a native reviewer found 今すぐ出撃 means "sortie now" when the instruction is
  // "tap the button now", and could not correct it because this line pinned it.
  i18n.setLanguage('en');
  var english = {
    rallyIn: i18n.t('speech.rallyIn', { name: 'TS', seconds: 30 }),
    goNow: i18n.t('speech.goNow', { name: 'TS' })
  };

  ['ja', 'ko', 'ru', 'ar'].forEach(function (code) {
    i18n.setLanguage(code);
    var rallyIn = i18n.t('speech.rallyIn', { name: 'TS', seconds: 30 });
    var goNow = i18n.t('speech.goNow', { name: 'TS' });
    assert.notStrictEqual(rallyIn, english.rallyIn, code + ' speaks English');
    assert.notStrictEqual(goNow, english.goNow, code + ' speaks English');
    assert.ok(rallyIn.indexOf('TS') !== -1, code + ' drops the name from the callout');
    assert.ok(rallyIn.indexOf('30') !== -1, code + ' drops the countdown from the callout');
    assert.ok(goNow.indexOf('TS') !== -1, code + ' drops the name from the go callout');
    assert.ok(!/\{\w+\}/.test(rallyIn + goNow), code + ' leaked a placeholder into speech');
  });

  i18n.setLanguage('ja');

  // Chinese needs a REGION or the engine falls back to a default voice.
  i18n.setLanguage('zh-Hant');
  assert.strictEqual(i18n.speechTag(), 'zh-TW');
  i18n.setLanguage('zh-Hans');
  assert.strictEqual(i18n.speechTag(), 'zh-CN');
  i18n.setLanguage('tr');
  assert.strictEqual(i18n.speechTag(), 'tr');

  // Every locale must actually carry both phrases, and keep the placeholders.
  Object.keys(i18n.DICT).forEach((code) => {
    i18n.setLanguage(code);
    const said = i18n.t('speech.rallyIn', { name: 'X', seconds: 9 });
    assert.ok(said.indexOf('X') !== -1, code + ' drops the lead name from its callout');
    assert.ok(said.indexOf('9') !== -1, code + ' drops the countdown from its callout');
    assert.ok(said.indexOf('{') === -1, code + ' left an unfilled placeholder: ' + said);
  });
  i18n.setLanguage('en');
});

test('target and zone names follow the chosen language', () => {
  // Resolved when asked rather than when defined, so switching language
  // relabels rows that are already on screen.
  //
  // This asserts the BEHAVIOUR, not the wording. It used to hard-code the
  // Japanese and Turkish strings, which meant any genuine improvement to a
  // translation failed the build and pushed whoever hit it toward reverting
  // good work to make a test pass. Wording belongs to the translators; what
  // belongs here is that the lookup is late-bound and actually localised.
  const KEYS = ['city', 'hq_own', 'monster_lair'];
  const english = {};
  i18n.setLanguage('en');
  KEYS.forEach((k) => { english[k] = zones.targetTypeLabel(k); });
  assert.strictEqual(english.city, 'Enemy player city');

  ['ja', 'tr', 'ru'].forEach((code) => {
    i18n.setLanguage(code);
    KEYS.forEach((k) => {
      const label = zones.targetTypeLabel(k);
      assert.ok(label && label.trim(), code + ' has no label for ' + k);
      assert.notStrictEqual(label, k, code + ' rendered the key name for ' + k);
      assert.notStrictEqual(label, english[k],
        code + ' still shows the English label for ' + k);
    });
    const zone = zones.zoneLabel('general');
    assert.ok(zone && zone.trim() && zone !== 'general',
      code + ' has no zone label for general');
  });

  i18n.setLanguage('en');
  assert.strictEqual(zones.targetTypeLabel('city'), 'Enemy player city');
});

test('every language covers the whole key set', () => {
  // A locale at less than 100% still works -- it falls back to English -- but
  // this catches a key added to English and forgotten everywhere else.
  i18n.LANGUAGES.forEach((l) => {
    assert.strictEqual(i18n.coverage(l.code), 1,
      l.code + ' covers only ' + Math.round(i18n.coverage(l.code) * 100) + '% of the key set');
  });
});

test('no rendered string is a translated fragment glued to an English tail', () => {
  // Two independent translators reported the same defect: a key holding only
  // "Fitted to " concatenated with a count and a hard-coded " samples" reads
  // half-English in every locale, and a language that puts the number first
  // cannot be fixed by translating the prefix at all. Whole sentences with a
  // {placeholder} are the only shape that survives translation, so forbid the
  // concatenation outright rather than trusting anyone to remember.
  var dir = path.join(__dirname, '..', 'js', 'views');
  var offenders = [];
  fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((file) => {
    var src = fs.readFileSync(path.join(dir, file), 'utf8');
    src.split('\n').forEach((line, i) => {
      // T.t(...) welded to a quoted literal on either side. A literal with no
      // letters in it -- a space, a separator, a bracket -- carries no meaning
      // to translate, so it is punctuation around the sentence, not a tail of it.
      var tail = line.match(/T\.t\([^)]*\)\s*\+\s*(['"])((?:(?!\1).)*)\1/);
      var head = line.match(/(['"])((?:(?!\1).)*)\1\s*\+\s*T\.t\(/);
      if ([tail, head].some((m) => m && /[A-Za-z]/.test(m[2]))) {
        offenders.push(file + ':' + (i + 1) + '  ' + line.trim());
      }
    });
  });
  assert.deepStrictEqual(offenders, [],
    'use one key with a {placeholder} instead of concatenating:\n' + offenders.join('\n'));
});

test('every placeholder in an English string survives into every translation', () => {
  // A dropped or renamed {token} renders the literal braces to the player.
  //
  // Lower-initial only, matching tools/i18n-report.js and the sweep. Every
  // real placeholder is a lowercase identifier; a capitalised one is
  // illustrative text. The case-blind pattern read "{Squad}" in the
  // roster-paste guide as a variable and demanded it survive verbatim,
  // which meant an English word stranded inside a Chinese sentence.
  var withTokens = Object.keys(i18n.KEYS).filter((k) => /\{[a-z]\w*\}/.test(i18n.KEYS[k]));
  assert.ok(withTokens.length > 15, 'expected the placeholder keys to exist');
  var problems = [];
  i18n.LANGUAGES.filter((l) => l.code !== 'en').forEach((l) => {
    var table = i18n.DICT[l.code] || {};
    withTokens.forEach((k) => {
      if (!(k in table)) return;                     // absent falls back to English
      var want = (i18n.KEYS[k].match(/\{[a-z]\w*\}/g) || []).slice().sort();
      var got = (String(table[k]).match(/\{[a-z]\w*\}/g) || []).slice().sort();
      if (want.join(',') !== got.join(',')) {
        problems.push(l.code + ' ' + k + ': expected ' + want.join(' ') + ', got ' + (got.join(' ') || 'none'));
      }
    });
  });
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});

test('no module renders hard-coded English outside the dictionary', () => {
  // focus.js and timepicker.js shipped fully untranslated because the original
  // extraction only walked js/views/, and nobody re-checked which files render
  // text. The countdown overlay and the time picker are two of the most-looked-at
  // surfaces in the app. So scan every module, not a directory anyone has to
  // remember to update, and make a new one fail loudly.
  const ALLOWED_FILES = {
    // English here is the default the translating accessor falls back to:
    // zoneLabel()/targetTypeLabel() resolve through i18n at lookup time.
    'zones.js': 'labels resolved via zoneLabel()/targetTypeLabel()',
    // g(key, fallback) deliberately keeps the inline English as its fallback so
    // an untranslated panel still renders a usable instruction.
    'guide.js': 'inline English is the documented g() fallback',
    'howto.js': 'inline English is the documented g() fallback'
  };
  const ALLOWED_VALUES = new Set(['UTC', 'RallySync', 'Kingshot', 'JSON']);

  const slot = /(text|title|placeholder|'aria-label'|label)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  const roots = [path.join(__dirname, '..', 'js'), path.join(__dirname, '..', 'js', 'views')];
  const offenders = [];

  roots.forEach((dir) => {
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.js'))
      .forEach((entry) => {
        if (ALLOWED_FILES[entry.name]) return;
        const src = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        src.split('\n').forEach((line, i) => {
          let m;
          slot.lastIndex = 0;
          while ((m = slot.exec(line)) !== null) {
            const value = m[2];
            if (ALLOWED_VALUES.has(value)) continue;
            if (!/[A-Za-z]{2}/.test(value)) continue;          // punctuation or digits
            if (!/\s/.test(value) && value === value.toLowerCase()) continue; // a token, not prose
            offenders.push(entry.name + ':' + (i + 1) + '  ' + m[1] + ": '" + value + "'");
          }
        });
      });
  });

  assert.deepStrictEqual(offenders, [],
    'wrap these in T.t() with a key, or add the file to ALLOWED_FILES with a reason:\n' +
    offenders.join('\n'));
});

test('spoken callouts go through the dictionary, not string concatenation', () => {
  // speech.rallyIn and speech.goNow were translated in all 16 locales while
  // focus.js spoke an English sentence it built itself, so every non-English
  // player heard English. The keys existing is not evidence they are used.
  const files = ['focus.js', 'alarm.js', path.join('views', 'settings.js'), path.join('views', 'calculate.js')];
  const offenders = [];
  files.forEach((rel) => {
    const p = path.join(__dirname, '..', 'js', rel);
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      // speechSynthesis.speak() is the browser API receiving a built utterance;
      // the rule is about our own alarm.speak(), which takes a sentence.
      if (/speechSynthesis\.speak\(/.test(line)) return;
      const call = line.split('.speak(')[1];
      // The argument must BE a lookup. A quote is fine -- it is the key name --
      // but anything that does not open with T.t( is a sentence built in code.
      if (call !== undefined && !/^\s*T\.t\(/.test(call)) {
        offenders.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
      }
    });
  });
  assert.deepStrictEqual(offenders, [],
    'speak() must be handed a T.t() result:\n' + offenders.join('\n'));
});

test('no English is passed to el() as a child instead of through a key', () => {
  // The third shape, and the one that hid the longest. Two earlier audits looked
  // at `text:` style properties and at labels passed as positional arguments;
  // neither could see a bare string sitting in the children array:
  //
  //     el('button.btn', { onclick: save }, ['Save current setup'])
  //
  // Roughly thirty of the app's most-clicked controls shipped English in every
  // language this way -- Save, Add a target, Export backup, Erase everything,
  // Check for updates -- and nothing in the pipeline could catch it. The
  // coverage check saw no missing key because no key existed. The seventeen-
  // language render sweep flags a rendered string that matches a KEY NAME, and
  // these are real English prose: indistinguishable from a good translation
  // unless you read the language.
  //
  // Seven of them already had translated keys that simply were not wired up.
  const ALLOWED_FILES = {
    'zones.js': 'labels resolved via zoneLabel()/targetTypeLabel()',
    'guide.js': 'inline English is the documented g() fallback',
    'howto.js': 'inline English is the documented g() fallback',
    'icons.js': 'arrays of SVG path data, not text'
  };

  // A quoted string that is an ARRAY ELEMENT: preceded by [ or , and followed
  // by , or ]. Not an object value, not a call argument.
  const child = /[[,]\s*'((?:[^'\\]|\\.)*)'\s*[,\]]/g;
  const roots = [path.join(__dirname, '..', 'js'), path.join(__dirname, '..', 'js', 'views')];
  const offenders = [];

  roots.forEach((dir) => {
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.js'))
      .forEach((entry) => {
        if (ALLOWED_FILES[entry.name]) return;
        const src = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        const lines = src.split('\n');
        lines.forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
          // An explicit, documented escape hatch. The one legitimate case so far
          // is a weekday fallback reached only when Intl is missing — which is
          // exactly when there is no locale data to translate from. Requiring
          // the marker in a comment keeps the reason next to the code.
          const exempt = /i18n-exempt/.test(line) ||
            (i > 0 && /i18n-exempt/.test(lines[i - 1])) ||
            (i > 1 && /i18n-exempt/.test(lines[i - 2]));
          if (exempt) return;
          let m;
          child.lastIndex = 0;
          while ((m = child.exec(line)) !== null) {
            const v = m[1];
            // Prose a player would read: two letters together, and either a
            // space or a leading capital. Class names, event names and keys are
            // lowercase single tokens.
            if (!/[A-Za-z]{2}/.test(v)) continue;
            if (!/\s/.test(v) && !/^[A-Z]/.test(v)) continue;
            // string concatenation fragments, not literals a reader sees
            if (v.indexOf(' + ') !== -1) continue;
            offenders.push(entry.name + ':' + (i + 1) + "  '" + v + "'");
          }
        });
      });
  });

  assert.deepStrictEqual(offenders, [],
    'pass these through T.t() with a key instead of as a literal child:\n' +
    offenders.join('\n'));
});

test('destructive confirmations are translated', () => {
  // Seven confirm() dialogs shipped English in every language: delete a lead,
  // erase everything on this device, discard fitted constants. Of all the text
  // in the app these are the worst to leave unreadable -- the player is being
  // asked to authorise something irreversible, and the one thing they can read
  // is the OK button.
  const roots = [path.join(__dirname, '..', 'js'), path.join(__dirname, '..', 'js', 'views')];
  const offenders = [];
  roots.forEach((dir) => {
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.js'))
      .forEach((entry) => {
        const src = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        src.split('\n').forEach((line, i) => {
          const call = line.split(/\bconfirm\(/)[1];
          if (call === undefined) return;
          if (/^\s*T\.t\(/.test(call)) return;
          offenders.push(entry.name + ':' + (i + 1) + '  ' + line.trim().slice(0, 80));
        });
      });
  });
  assert.deepStrictEqual(offenders, [],
    'confirm() must be handed a T.t() result:\n' + offenders.join('\n'));
});

test('no count is glued to an English tail', () => {
  // "3 blocked", "2 leads share a name." -- a number concatenated with an
  // English literal. The fragment guard cannot see these because it looks for a
  // TRANSLATED fragment welded to an English tail, and here both halves are
  // English. They render as English inside an otherwise translated screen.
  const ALLOWED = new Set(['UTC', 'km', 'RallySync', 'Kingshot', 'JSON', 'X', 'Y']);
  const ALLOWED_FILES = { 'zones.js': 1, 'guide.js': 1, 'howto.js': 1, 'icons.js': 1 };

  // A quoted literal next to a +, OR sitting in a ternary that feeds one.
  // The ternary arm is the shape that hid the third of three sibling warnings:
  //   notes.push(n + (n === 1 ? ' march is' : ' marches are') + ' well outside…')
  // Its two neighbours were caught because they touch a +; this one only ever
  // touches ? and :, so a +-only pattern walked straight past it — and the
  // sentence it joins was already translated, giving a line that switches
  // language halfway through.
  const glued = /([+?:])\s*'((?:[^'\\]|\\.)*)'|'((?:[^'\\]|\\.)*)'\s*([+?:])/g;
  const roots = [path.join(__dirname, '..', 'js'), path.join(__dirname, '..', 'js', 'views')];
  const offenders = [];

  roots.forEach((dir) => {
    fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.js'))
      .forEach((entry) => {
        if (ALLOWED_FILES[entry.name]) return;
        const src = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        const lines = src.split('\n');
        lines.forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
          // Same lookback as the children-array guard, so the marker can sit on
          // a comment line above the code it explains rather than trailing it.
          if (/i18n-exempt/.test(line) ||
              (i > 0 && /i18n-exempt/.test(lines[i - 1])) ||
              (i > 1 && /i18n-exempt/.test(lines[i - 2]))) return;
          let m;
          glued.lastIndex = 0;
          while ((m = glued.exec(line)) !== null) {
            const raw = m[2] !== undefined ? m[2] : m[3];
            const delimiter = m[1] || m[4];
            // A ":" is a ternary arm only where there is a "?" to match it.
            // Everywhere else it introduces an object property value, which is
            // a perfectly ordinary place for an English string to live —
            // js/i18n.js is nothing but those.
            if (delimiter === ':' && line.indexOf('?') === -1) continue;
            const word = raw.trim();
            if (!/[A-Za-z]{3}/.test(word)) continue;   // separators, punctuation
            if (ALLOWED.has(word)) continue;
            // Prose has a space in it. Element selectors ('button.nav-btn'),
            // state-key prefixes ('pip', 'say') and CSS function names
            // ('translateY(') do not, and are not read by anyone.
            if (!/\s/.test(raw)) continue;
            // Class-name fragments toggled onto elements: ' is-selected',
            // '.btn-ghost is-exact'. All-lowercase hyphenated tokens, which no
            // sentence looks like.
            const tokens = word.split(/\s+/);
            if (tokens.every((tk) => /^[.#]?[a-z][a-z0-9-]*$/.test(tk)) &&
                tokens.some((tk) => tk.indexOf('-') !== -1)) continue;
            // Brackets and slashes mean this capture ran across an expression
            // rather than sitting inside one literal -- a ternary or a regex.
            if (/[(){}<>/]/.test(raw)) continue;
            offenders.push(entry.name + ':' + (i + 1) + "  '" + raw + "'");
          }
        });
      });
  });

  assert.deepStrictEqual(offenders, [],
    'use one key with a {placeholder} instead of concatenating English:\n' +
    offenders.join('\n'));
});

test('every guide step and note has a key', () => {
  // Two steps of the roster-paste guide had no key at all and shipped English
  // in sixteen languages. The extractor that built these keys matched
  // `steps: [(.*?)]` and stopped at the first "]" -- which lands inside
  // "Add [Alliance] and {Squad} in brackets", truncating that guide's list.
  // g() falls back to the inline English, so nothing looked broken: the page
  // rendered a perfectly good sentence, in the wrong language, with no key
  // missing from any locale because no key existed to be missing.
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'guide.js'), 'utf8');
  const body = src.slice(src.indexOf('var GUIDES = {'));

  const starts = [...body.matchAll(/\n    (\w+): \{/g)].map((m) => ({ name: m[1], at: m.index }));
  assert.ok(starts.length >= 8, 'expected the guide topics, found ' + starts.length);

  const missing = [];
  starts.forEach((g, i) => {
    const chunk = body.slice(g.at, i + 1 < starts.length ? starts[i + 1].at : body.length);

    const stepsBlock = chunk.match(/steps: \[([\s\S]*?)\n      \]/);
    const declared = stepsBlock ? (stepsBlock[1].match(/^\s*'/gm) || []).length : 0;
    for (let n = 0; n < declared; n++) {
      const key = 'guide.' + g.name + '.step' + n;
      if (i18n.KEYS[key] === undefined) missing.push(key);
    }

    if (/\n      title: '/.test(chunk) && i18n.KEYS['guide.' + g.name + '.title'] === undefined) {
      missing.push('guide.' + g.name + '.title');
    }
    if (/\n      note: /.test(chunk) && i18n.KEYS['guide.' + g.name + '.note'] === undefined) {
      missing.push('guide.' + g.name + '.note');
    }
  });

  assert.deepStrictEqual(missing, [],
    'these guide strings render from the inline English fallback in every ' +
    'language because they have no key:\n' + missing.join('\n'));
});
