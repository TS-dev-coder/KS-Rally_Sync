/**
 * Tests for the feature modules: roster paste parsing, share links, and
 * multi-target planning. All pure — no DOM needed.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../js/zones.js');
require('../js/calculations.js');
require('../js/roster-import.js');
require('../js/share.js');

const { calc, zones, rosterImport, share } = globalThis.RallySync;

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
