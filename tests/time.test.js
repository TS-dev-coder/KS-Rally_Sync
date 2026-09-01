/**
 * Tests for the time-display helpers. These matter as much as the march math:
 * a timezone slip here silently shifts every launch time by hours.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../js/dom.js');
const { dom } = globalThis.RallySync;

test('utcClock reads the clock in UTC, not the local timezone', () => {
  const ms = Date.parse('2026-09-01T20:07:05Z');
  assert.strictEqual(dom.utcClock(ms), '20:07:05');
});

test('utcClock pads every field to two digits', () => {
  assert.strictEqual(dom.utcClock(Date.parse('2026-01-02T03:04:05Z')), '03:04:05');
});

test('utcDate reports the UTC calendar date', () => {
  assert.strictEqual(dom.utcDate(Date.parse('2026-09-01T23:59:59Z')), '2026-09-01');
  assert.strictEqual(dom.utcDate(Date.parse('2026-09-02T00:00:01Z')), '2026-09-02');
});

test('datetime-local values are read as UTC wall-clock, not local time', () => {
  // The user types the UTC time the game shows them, so this must not go
  // through the local-timezone Date parser.
  assert.strictEqual(
    dom.parseUtcDateTimeLocal('2026-09-01T20:00:00'),
    Date.parse('2026-09-01T20:00:00Z')
  );
  assert.strictEqual(
    dom.parseUtcDateTimeLocal('2026-09-01T20:00'),
    Date.parse('2026-09-01T20:00:00Z')
  );
});

test('datetime-local parsing rejects junk rather than returning a wrong instant', () => {
  assert.ok(Number.isNaN(dom.parseUtcDateTimeLocal('')));
  assert.ok(Number.isNaN(dom.parseUtcDateTimeLocal('tomorrow')));
  assert.ok(Number.isNaN(dom.parseUtcDateTimeLocal(null)));
});

test('toUtcDateTimeLocal round-trips through parseUtcDateTimeLocal', () => {
  const ms = Date.parse('2026-12-31T23:59:01Z');
  assert.strictEqual(dom.parseUtcDateTimeLocal(dom.toUtcDateTimeLocal(ms)), ms);
});

test('countdown formats minutes and seconds, signed', () => {
  assert.strictEqual(dom.countdown(0), '0:00');
  assert.strictEqual(dom.countdown(9), '0:09');
  assert.strictEqual(dom.countdown(95), '1:35');
  assert.strictEqual(dom.countdown(3725), '1:02:05');
  assert.strictEqual(dom.countdown(-7), '-0:07');
});
