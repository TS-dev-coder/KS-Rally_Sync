/**
 * End-to-end test of the real index.html in a DOM, driving the same code the
 * browser runs. Catches wiring bugs that the pure-math tests cannot see.
 *
 * jsdom is not a project dependency (the app itself has none). If it is not
 * resolvable, these tests skip rather than fail:
 *
 *   npm install jsdom --no-save && node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let JSDOM = null;
try {
  ({ JSDOM } = require('jsdom'));
} catch (err) {
  test('UI tests skipped — jsdom not installed', { skip: true }, () => {});
}

const ROOT = path.join(__dirname, '..');
const SCRIPTS = [
  'js/dom.js', 'js/zones.js', 'js/calculations.js', 'js/storage.js',
  'js/state.js', 'js/guide.js',
  'js/views/roster.js', 'js/views/targets.js', 'js/views/calculate.js',
  'js/views/calibrate.js', 'js/views/settings.js', 'js/app.js'
];

/**
 * Boots index.html with every script evaluated in order, as the browser does.
 * Async because app.js starts on DOMContentLoaded, which jsdom fires on a later
 * tick than the constructor returning.
 */
async function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8765/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const errors = [];
  dom.window.addEventListener('error', (e) => errors.push(String(e.message)));

  for (const file of SCRIPTS) {
    dom.window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  }

  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.addEventListener('load', resolve, { once: true });
  });
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  return { dom, window: dom.window, RS: dom.window.RallySync, errors };
}

function teardown(ctx) {
  ctx.window.close(); // stops the 250ms heartbeat so the test process can exit
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function utc(ms) {
  const d = new Date(ms);
  return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
}

const maybe = JSDOM ? test : test.skip;

maybe('the app boots and mounts its shell without errors', async () => {
  const ctx = await boot();
  try {
    assert.strictEqual(ctx.errors.length, 0, 'unexpected runtime errors: ' + ctx.errors.join('; '));
    assert.ok(ctx.RS.app, 'app namespace missing');
    assert.strictEqual(ctx.window.document.querySelectorAll('#nav .nav-btn').length, 5);
    assert.ok(ctx.window.document.querySelector('#main').children.length > 0, 'main is empty');
  } finally { teardown(ctx); }
});

maybe('a fresh install shows the quick-start guide instead of empty results', async () => {
  const ctx = await boot();
  try {
    const text = ctx.window.document.querySelector('#main').textContent;
    assert.match(text, /Set up once/i);
    assert.match(text, /March Speed Up/i, 'in-game instructions should be on the first screen');
  } finally { teardown(ctx); }
});

maybe('every tab renders without throwing', async () => {
  const ctx = await boot();
  try {
    ['roster', 'targets', 'calibrate', 'settings', 'calculate'].forEach((tab) => {
      ctx.RS.app.go(tab);
      assert.ok(
        ctx.window.document.querySelector('#main').children.length > 0,
        'tab rendered empty: ' + tab
      );
    });
    assert.strictEqual(ctx.errors.length, 0, ctx.errors.join('; '));
  } finally { teardown(ctx); }
});

maybe('sync mode renders a launch time computed from the zone formula', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;

    const target = state.upsertTarget({
      name: 'Test Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'Solo', x: 0, y: 0, marchSpeedUpPercent: 0 });

    const landing = Date.now() + 2 * 3600 * 1000;
    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [lead.id],
      mode: 'sync',
      landingMs: landing
    });

    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const rows = ctx.window.document.querySelectorAll('.result');
    assert.strictEqual(rows.length, 1);

    // 100 tiles at +0%: 100 / 0.36 + 3.2 = 280.978s march, plus the 300s window.
    const expected = utc(landing - (100 / 0.36 + 3.2) * 1000 - 300000);
    assert.strictEqual(rows[0].querySelector('.result-time-value').textContent, expected);
    assert.match(rows[0].querySelector('.badge').textContent, /estimated/);
    assert.strictEqual(ctx.errors.length, 0, ctx.errors.join('; '));
  } finally { teardown(ctx); }
});

maybe('the slower lead is listed first and the faster lead launches later', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'T', x: 200, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const slow = state.upsertLead({ name: 'Slowpoke', x: 0, y: 0, marchSpeedUpPercent: 0 });
    const fast = state.upsertLead({ name: 'Speedy', x: 0, y: 0, marchSpeedUpPercent: 120 });

    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [fast.id, slow.id], // deliberately out of launch order
      mode: 'sync',
      landingMs: Date.now() + 2 * 3600 * 1000
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const names = Array.from(ctx.window.document.querySelectorAll('.result-name'))
      .map((n) => n.textContent);
    assert.deepStrictEqual(names, ['Slowpoke', 'Speedy']);
  } finally { teardown(ctx); }
});

maybe('a logged march turns that lead exact and refits its zone', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'Scout', x: 0, y: 0, marchSpeedUpPercent: 0 });

    state.recordMeasurement(lead.id, target.id, 240);
    const fit = state.recalibrateZone('general');
    assert.strictEqual(fit.ok, true);
    assert.strictEqual(state.findZone('general').trust, 'calibrated');

    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [lead.id],
      mode: 'sync',
      landingMs: Date.now() + 2 * 3600 * 1000
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const row = ctx.window.document.querySelector('.result');
    assert.match(row.querySelector('.badge').textContent, /measured/);
    assert.match(row.textContent, /4m 00s/, 'should show the exact logged march time');
  } finally { teardown(ctx); }
});

maybe('a lead with no speed set is blocked inline instead of getting a wrong time', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const broken = state.upsertLead({ name: 'Nospeed', x: 0, y: 0 });

    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [broken.id],
      mode: 'sync',
      landingMs: Date.now() + 2 * 3600 * 1000
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const row = ctx.window.document.querySelector('.result');
    assert.ok(row.classList.contains('is-error'));
    assert.match(row.textContent, /March Speed Up/);
    assert.strictEqual(row.querySelector('.result-time-value'), null, 'must not show a time');
  } finally { teardown(ctx); }
});

maybe('sequence mode staggers the displayed landing times by the gap', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 0
    });
    const a = state.upsertLead({ name: 'A', x: 0, y: 0, marchSpeedUpPercent: 0 });
    const b = state.upsertLead({ name: 'B', x: 0, y: 0, marchSpeedUpPercent: 0 });

    const landing = Date.now() + 2 * 3600 * 1000;
    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [a.id, b.id],
      mode: 'sequence',
      gapSeconds: 5,
      landingMs: landing
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const rows = ctx.window.document.querySelectorAll('.result');
    assert.strictEqual(rows.length, 2);
    // Identical leads, so the only difference is the 5s stagger.
    const times = Array.from(rows).map((r) => r.querySelector('.result-time-value').textContent);
    const delta = (Date.parse('1970-01-01T' + times[1] + 'Z') -
                   Date.parse('1970-01-01T' + times[0] + 'Z')) / 1000;
    assert.strictEqual(delta, 5);
  } finally { teardown(ctx); }
});

maybe('the clock offset shifts the corrected clock shown in settings', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const before = state.now();
    state.updateSettings({ clockOffsetSeconds: 30 });
    const after = state.now();
    assert.ok(after - before >= 29000, 'offset should move the app clock forward');

    ctx.RS.app.go('settings');
    assert.match(ctx.window.document.querySelector('#main').textContent, /Clock correction/);
  } finally { teardown(ctx); }
});

maybe('setup data round-trips through localStorage', async () => {
  const ctx = await boot();
  try {
    const { state, storage } = ctx.RS;
    assert.strictEqual(storage.available(), true, 'localStorage should be usable here');

    const leadId = state.upsertLead({
      name: 'Persisted', x: 12, y: 34, marchSpeedUpPercent: 45
    }).id;

    // It really reached the browser store, not just memory.
    const raw = ctx.window.localStorage.getItem('rallysync.v1.leads');
    assert.ok(raw && raw.indexOf('Persisted') !== -1, 'lead was not written to localStorage');

    // Drop the in-memory copy and reload the way a fresh page load would.
    state.data.leads = [];
    state.load();

    const lead = state.findLead(leadId);
    assert.ok(lead, 'lead did not survive the reload');
    assert.strictEqual(lead.name, 'Persisted');
    assert.strictEqual(lead.marchSpeedUpPercent, 45);
    assert.strictEqual(lead.x, 12);
  } finally { teardown(ctx); }
});

maybe('targets and zone calibration survive a reload too', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Reloaded Castle', x: 512, y: 512, zoneKey: 'castle_relic', gatherSeconds: 300
    });
    state.updateZone('general', { constants: { secPerTile: 4.25 } });

    state.data.targets = [];
    state.data.zones = [];
    state.load();

    const restored = state.findTarget(target.id);
    assert.ok(restored, 'target did not survive the reload');
    assert.strictEqual(restored.zoneKey, 'castle_relic');
    assert.strictEqual(restored.gatherSeconds, 300);
    assert.strictEqual(state.findZone('general').constants.secPerTile, 4.25);
  } finally { teardown(ctx); }
});

maybe('export produces a backup that import can restore', async () => {
  const ctx = await boot();
  try {
    const { state, storage } = ctx.RS;
    state.upsertLead({ name: 'Backup Me', x: 1, y: 2, marchSpeedUpPercent: 10 });

    const payload = JSON.parse(JSON.stringify(storage.exportAll()));
    storage.clearAll();
    state.load();
    assert.strictEqual(state.data.leads.length, 0);

    const result = storage.importAll(payload);
    assert.strictEqual(result.ok, true);
    state.load();
    assert.ok(state.data.leads.some((l) => l.name === 'Backup Me'));
  } finally { teardown(ctx); }
});

maybe('import rejects a file that is not a RallySync backup', async () => {
  const ctx = await boot();
  try {
    const result = ctx.RS.storage.importAll({ app: 'SomethingElse', data: {} });
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /different app/i);
  } finally { teardown(ctx); }
});
