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
/**
 * Read the script list straight out of index.html rather than repeating it.
 * A hand-maintained copy silently drifts, and a module missing from the
 * harness fails as an undefined namespace far from the real cause.
 */
const SCRIPTS = (() => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // Strip the cache-busting ?v= stamp: it belongs in the URL, not the path.
  const found = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((m) => m[1].split('?')[0]);
  assert.ok(found.length > 0, 'no scripts found in index.html');
  return found;
})();

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

maybe('the only lead taps exactly at the start, and the landing follows from them', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;

    const target = state.upsertTarget({
      name: 'Test Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'TS', x: 0, y: 0, marchSpeedUpPercent: 0 });

    const start = Date.now() + 3600 * 1000;
    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [lead.id],
      mode: 'sync',
      startMs: start
    });

    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const rows = ctx.window.document.querySelectorAll('.result');
    assert.strictEqual(rows.length, 1);

    // The slowest lead — here the only one — taps at the start moment itself.
    assert.strictEqual(rows[0].querySelector('.result-time-value').textContent, utc(start));

    // Asked through the public API rather than restating a formula, so this
    // survives both a refit and a change of model shape.
    const march = ctx.RS.calc.marchSecondsForZone(
      state.findZone('general'), { x: 0, y: 0 }, { x: 100, y: 0 }, 0
    ).seconds;
    const expectedLanding = start + (300 + march) * 1000;
    const facts = rows[0].textContent;
    assert.ok(facts.indexOf(utc(expectedLanding)) !== -1,
      'the row should land at ' + utc(expectedLanding) + ', got: ' + facts);
    assert.match(rows[0].querySelector('.badge').textContent, /estimated/);
    assert.strictEqual(ctx.errors.length, 0, ctx.errors.join('; '));
  } finally { teardown(ctx); }
});

maybe('adding a slower lead pushes the landing later on its own', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'T', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 0
    });
    const fast = state.upsertLead({ name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 100 });
    const start = Date.now() + 3600 * 1000;

    state.updateSettings({
      selectedTargetId: target.id, selectedLeadIds: [fast.id], mode: 'sync', startMs: start
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');
    const soloLanding = ctx.window.document.querySelector('.results-sub').textContent;

    const slow = state.upsertLead({ name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 });
    state.updateSettings({ selectedLeadIds: [fast.id, slow.id] });
    ctx.RS.app.refresh();

    const pairLanding = ctx.window.document.querySelector('.results-sub').textContent;
    assert.notStrictEqual(pairLanding, soloLanding,
      'a slower lead must move the landing time later');

    // The slow lead now taps at the start; the fast one waits.
    const rows = ctx.window.document.querySelectorAll('.result');
    assert.strictEqual(rows[0].querySelector('.result-name').textContent, 'Beast');
    assert.strictEqual(rows[0].querySelector('.result-time-value').textContent, utc(start));
  } finally { teardown(ctx); }
});

maybe('the slower lead is listed first and the faster lead launches later', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'T', x: 200, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const slow = state.upsertLead({ name: 'Beast', x: 0, y: 0, marchSpeedUpPercent: 0 });
    const fast = state.upsertLead({ name: 'Ash', x: 0, y: 0, marchSpeedUpPercent: 120 });

    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [fast.id, slow.id], // deliberately out of launch order
      mode: 'sync',
      startMs: Date.now() + 3600 * 1000
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const names = Array.from(ctx.window.document.querySelectorAll('.result-name'))
      .map((n) => n.textContent);
    assert.deepStrictEqual(names, ['Beast', 'Ash']);
  } finally { teardown(ctx); }
});

maybe('a logged march turns that lead exact and refits its zone', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Castle', x: 100, y: 0, zoneKey: 'general', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'Irfan', x: 0, y: 0, marchSpeedUpPercent: 0 });

    state.recordMeasurement(lead.id, target.id, 240);
    const fit = state.recalibrateZone('general');
    assert.strictEqual(fit.ok, true);
    assert.strictEqual(state.findZone('general').trust, 'calibrated');

    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [lead.id],
      mode: 'sync',
      startMs: Date.now() + 3600 * 1000
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
    const broken = state.upsertLead({ name: 'Cabo', x: 0, y: 0 });

    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [broken.id],
      mode: 'sync',
      startMs: Date.now() + 3600 * 1000
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
    const a = state.upsertLead({ name: 'Mike', x: 0, y: 0, marchSpeedUpPercent: 0 });
    const b = state.upsertLead({ name: 'Irfan', x: 0, y: 0, marchSpeedUpPercent: 0 });

    const landing = Date.now() + 2 * 3600 * 1000;
    state.updateSettings({
      selectedTargetId: target.id,
      selectedLeadIds: [a.id, b.id],
      mode: 'sequence',
      gapSeconds: 5,
      startMs: landing - 3600000
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
      name: 'TS', x: 12, y: 34, marchSpeedUpPercent: 45
    }).id;

    // It really reached the browser store, not just memory.
    const raw = ctx.window.localStorage.getItem('rallysync.v1.leads');
    assert.ok(raw && raw.indexOf('TS') !== -1, 'lead was not written to localStorage');

    // Drop the in-memory copy and reload the way a fresh page load would.
    state.data.leads = [];
    state.load();

    const lead = state.findLead(leadId);
    assert.ok(lead, 'lead did not survive the reload');
    assert.strictEqual(lead.name, 'TS');
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
    state.upsertLead({ name: 'Ash', x: 1, y: 2, marchSpeedUpPercent: 10 });

    const payload = JSON.parse(JSON.stringify(storage.exportAll()));
    storage.clearAll();
    state.load();
    assert.strictEqual(state.data.leads.length, 0);

    const result = storage.importAll(payload);
    assert.strictEqual(result.ok, true);
    state.load();
    assert.ok(state.data.leads.some((l) => l.name === 'Ash'));
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

maybe('theme choice is applied to the document and persisted', async () => {
  const ctx = await boot();
  try {
    const html = ctx.window.document.documentElement;

    ctx.RS.app.applyTheme('dark');
    assert.strictEqual(html.getAttribute('data-theme'), 'dark');

    ctx.RS.app.applyTheme('light');
    assert.strictEqual(html.getAttribute('data-theme'), 'light');

    // 'system' removes the override so prefers-color-scheme takes over.
    ctx.RS.app.applyTheme('system');
    assert.strictEqual(html.getAttribute('data-theme'), null);

    ctx.RS.state.updateSettings({ theme: 'dark' });
    ctx.RS.state.load();
    assert.strictEqual(ctx.RS.state.data.settings.theme, 'dark');
  } finally { teardown(ctx); }
});

maybe('a share link renders only that person and hides the nav', async () => {
  const ctx = await boot();
  const slot = {
    name: 'Cabo', targetName: "King's Castle",
    rallyOpenMs: Date.now() + 600000,
    departMs: Date.now() + 900000,
    landingMs: Date.now() + 1000000,
    marchSeconds: 100, gatherSeconds: 300, tier: 'estimated'
  };
  const encoded = ctx.RS.share.encodeSlot(slot);
  teardown(ctx);

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost:8765/index.html#go=' + encoded,
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  try {
    for (const file of SCRIPTS) {
      dom.window.eval(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    }
    await new Promise((resolve) => {
      if (dom.window.document.readyState === 'complete') resolve();
      else dom.window.addEventListener('load', resolve, { once: true });
    });
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    const doc = dom.window.document;
    assert.ok(doc.body.classList.contains('is-solo'), 'solo mode should be flagged on body');
    assert.match(doc.querySelector('#main').textContent, /Cabo/);
    assert.match(doc.querySelector('#main').textContent, /King/);
    assert.strictEqual(doc.querySelectorAll('#nav .nav-btn').length, 0, 'nav must not render');
  } finally { dom.window.close(); }
});

maybe('editing X then Y keeps both — sequential field edits must not clobber each other', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const lead = state.upsertLead({ name: 'Cabo' });

    ctx.RS.app.go('roster');
    ctx.window.document.querySelector('.card-summary').click();

    const inputs = ctx.window.document.querySelectorAll('.card-body .grid-2 .input');
    const [xInput, yInput] = inputs;

    // Two separate commits, as a person filling in a form produces.
    xInput.value = '536';
    xInput.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));

    yInput.value = '740';
    yInput.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));

    const saved = state.findLead(lead.id);
    assert.strictEqual(saved.x, 536, 'X was lost when Y was edited afterwards');
    assert.strictEqual(saved.y, 740);
    assert.strictEqual(saved.name, 'Cabo', 'the name must survive coordinate edits');
  } finally { teardown(ctx); }
});

maybe('editing a target field does not clobber its other fields', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({ name: 'Outpost', zoneKey: 'general' });

    ctx.RS.app.go('targets');
    const cards = ctx.window.document.querySelectorAll('.card-summary');
    cards[cards.length - 1].click();

    const inputs = ctx.window.document.querySelectorAll('.card-body .grid-2 .input');
    inputs[0].value = '612';
    inputs[0].dispatchEvent(new ctx.window.Event('change', { bubbles: true }));
    inputs[1].value = '455';
    inputs[1].dispatchEvent(new ctx.window.Event('change', { bubbles: true }));

    const saved = state.findTarget(target.id);
    assert.strictEqual(saved.x, 612, 'X was lost when Y was edited afterwards');
    assert.strictEqual(saved.y, 455);
    assert.strictEqual(saved.name, 'Outpost');
  } finally { teardown(ctx); }
});

// ---------------------------------------------------------------------------
// Field-by-field persistence audit. Every editable control in the app is
// driven the way a person drives it — set the value, fire the event the
// handler listens for — and then read back from state. This exists because a
// stale-closure bug silently dropped edits, and speculation is a poor way to
// find the rest.
// ---------------------------------------------------------------------------

function fire(ctx, node, type) {
  node.dispatchEvent(new ctx.window.Event(type, { bubbles: true }));
}

function labelled(ctx, text) {
  return ctx.window.document.querySelectorAll('.card-body .field, .card-body .grid-2 .field');
}

/** Finds the input whose .field-label matches. Label-based, never positional,
 *  so inserting a section above cannot silently retarget a test. */
function fieldInput(ctx, labelText) {
  const fields = ctx.window.document.querySelectorAll('.field');
  for (const f of fields) {
    const label = f.querySelector('.field-label');
    if (label && label.textContent.trim().toLowerCase() === labelText.toLowerCase()) {
      return f.querySelector('.input');
    }
  }
  return null;
}

maybe('every Leads field persists when edited one after another', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const lead = state.upsertLead({ name: 'Start' });
    ctx.RS.app.go('roster');
    ctx.window.document.querySelector('.card-summary').click();

    const edits = [
      ['Name', 'Beast'],
      ['X', '536'],
      ['Y', '740'],
      ['March Speed Up %', '88'],
      ['Alliance', 'VNG'],
      ['Squad', 'Wave 2'],
      ['Rally capacity', '135000'],
      ['March power', '48200000']
    ];

    for (const [label, value] of edits) {
      const input = fieldInput(ctx, label);
      assert.ok(input, 'no input found for field: ' + label);
      input.value = value;
      fire(ctx, input, 'change');
    }

    const saved = state.findLead(lead.id);
    assert.strictEqual(saved.name, 'Beast');
    assert.strictEqual(saved.x, 536);
    assert.strictEqual(saved.y, 740);
    assert.strictEqual(saved.marchSpeedUpPercent, 88);
    assert.strictEqual(saved.alliance, 'VNG');
    assert.strictEqual(saved.squad, 'Wave 2');
    assert.strictEqual(saved.rallyCapacity, 135000);
    assert.strictEqual(saved.power, 48200000);
  } finally { teardown(ctx); }
});

maybe('every Targets field persists when edited one after another', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({ name: 'Start', zoneKey: 'general' });
    ctx.RS.app.go('targets');
    const cards = ctx.window.document.querySelectorAll('.card-summary');
    cards[cards.length - 1].click();

    for (const [label, value] of [['Name', 'Sanctuary'], ['X', '604'], ['Y', '455']]) {
      const input = fieldInput(ctx, label);
      input.value = value;
      fire(ctx, input, 'change');
    }

    const zone = fieldInput(ctx, 'Zone model');
    zone.value = 'ruins';
    fire(ctx, zone, 'change');

    const window_ = fieldInput(ctx, 'Rally window (minutes)');
    window_.value = '10';
    fire(ctx, window_, 'change');

    const saved = state.findTarget(target.id);
    assert.strictEqual(saved.name, 'Sanctuary');
    assert.strictEqual(saved.x, 604);
    assert.strictEqual(saved.y, 455);
    assert.strictEqual(saved.zoneKey, 'ruins');
    assert.strictEqual(saved.gatherSeconds, 600, 'minutes must be stored as seconds');
  } finally { teardown(ctx); }
});

maybe('zone constants persist and a cleared field does not become zero', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;

    // Calibrate re-renders itself after every change, and the open zone stays
    // open across renders — so each edit just needs a fresh node lookup.
    ctx.RS.app.go('calibrate');
    ctx.window.document.querySelectorAll('.card-summary')[0].click();

    const perTile = fieldInput(ctx, 'Seconds per tile');
    perTile.value = '4.5';
    fire(ctx, perTile, 'change');
    assert.strictEqual(state.findZone('general').constants.secPerTile, 4.5);

    const offset = fieldInput(ctx, 'Fixed offset (s)');
    offset.value = '2.5';
    fire(ctx, offset, 'change');

    const zone = state.findZone('general');
    assert.strictEqual(zone.constants.offset, 2.5);
    assert.strictEqual(zone.constants.secPerTile, 4.5,
      'editing one constant must not reset the other');
    assert.strictEqual(zone.trust, 'manual',
      'a hand edit must mark the zone as the user\u2019s, or the default migration eats it');

    // Clearing a field must not silently mean zero, which would make every
    // march instant while still looking like a valid calibration.
    const cleared = fieldInput(ctx, 'Seconds per tile');
    cleared.value = '';
    fire(ctx, cleared, 'change');
    assert.strictEqual(state.findZone('general').constants.secPerTile, 4.5,
      'an empty field must be ignored, not stored as zero');
  } finally { teardown(ctx); }
});

maybe('settings fields persist', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    ctx.RS.app.go('settings');

    const clock = fieldInput(ctx, 'My clock is ahead by (seconds)');
    clock.value = '-1.5';
    fire(ctx, clock, 'change');
    assert.strictEqual(state.data.settings.clockOffsetSeconds, -1.5);

    ctx.RS.app.go('settings');
    const lead = fieldInput(ctx, 'Warn this many seconds before');
    lead.value = '20';
    fire(ctx, lead, 'change');
    assert.strictEqual(state.data.settings.alarmLeadSeconds, 20);

    ctx.RS.app.go('settings');
    const buffer = fieldInput(ctx, 'Recommended buffer (seconds)');
    buffer.value = '4';
    fire(ctx, buffer, 'change');

    assert.strictEqual(state.data.settings.safetyBufferSeconds, 4);
    assert.strictEqual(state.data.settings.clockOffsetSeconds, -1.5, 'clock offset must survive');
    assert.strictEqual(state.data.settings.alarmLeadSeconds, 20, 'alarm lead must survive');
  } finally { teardown(ctx); }
});

maybe('you can add several targets of the same type, auto-numbered', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const before = state.data.targets.filter((t) => t.type === 'sanctuary').length;

    const first = state.addTargetOfType('sanctuary');
    const second = state.addTargetOfType('sanctuary');
    const third = state.addTargetOfType('sanctuary');

    assert.strictEqual(first.name, before === 0 ? 'Sanctuary' : 'Sanctuary ' + (before + 1));
    assert.strictEqual(second.name, 'Sanctuary ' + (before + 2));
    assert.strictEqual(third.name, 'Sanctuary ' + (before + 3));

    // Distinct records, each independently editable.
    const ids = [first.id, second.id, third.id];
    assert.strictEqual(new Set(ids).size, 3);

    // Renaming one leaves the others alone.
    state.upsertTarget(Object.assign({}, second, { name: 'East Sanctuary', x: 604, y: 455 }));
    assert.strictEqual(state.findTarget(second.id).name, 'East Sanctuary');
    assert.strictEqual(state.findTarget(first.id).name, first.name);
    assert.strictEqual(state.findTarget(third.id).name, third.name);
  } finally { teardown(ctx); }
});

maybe('a target type seeds the zone model and rally window but does not lock them', async () => {
  const ctx = await boot();
  try {
    const { state, zones } = ctx.RS;

    const castle = state.addTargetOfType('castle');
    assert.strictEqual(castle.zoneKey, 'castle_relic', 'the Castle sits in the Forbidden Zone');
    assert.strictEqual(castle.gatherSeconds, 300);

    // An Outpost is a structure, so it takes the player-structure curve. The
    // monster zone is now reserved for Terrors and Beasts, which run about
    // twice as fast; routing a structure there under-predicts it by ~2x.
    const outpost = state.addTargetOfType('outpost');
    assert.strictEqual(outpost.zoneKey, 'city', 'a structure uses the structure curve');

    const monster = state.addTargetOfType('monster');
    assert.strictEqual(monster.zoneKey, 'general', 'only monsters use the monster zone');

    // Both stay editable afterwards.
    state.upsertTarget(Object.assign({}, outpost, { zoneKey: 'ruins', gatherSeconds: 0 }));
    const edited = state.findTarget(outpost.id);
    assert.strictEqual(edited.zoneKey, 'ruins');
    assert.strictEqual(edited.gatherSeconds, 0);
    assert.strictEqual(edited.type, 'outpost', 'editing the zone must not change the type');

    assert.strictEqual(zones.targetTypeLabel('sanctuary'), 'Sanctuary');
  } finally { teardown(ctx); }
});

maybe('targets saved before types existed get one inferred on load', async () => {
  const ctx = await boot();
  try {
    const { state, storage } = ctx.RS;

    // Write a legacy-shaped target with no type field at all.
    storage.write('targets', [
      { id: 'legacy1', name: 'North Turret', x: 1, y: 2, zoneKey: 'turret', gatherSeconds: 300 },
      { id: 'legacy2', name: 'Some Sanctuary', x: 3, y: 4, zoneKey: 'general', gatherSeconds: 300 },
      { id: 'legacy3', name: 'Whatever', x: 5, y: 6, zoneKey: 'castle_relic', gatherSeconds: 300 }
    ]);
    state.load();

    assert.strictEqual(state.findTarget('legacy1').type, 'turret', 'inferred from the name');
    assert.strictEqual(state.findTarget('legacy2').type, 'sanctuary');
    assert.strictEqual(state.findTarget('legacy3').type, 'castle', 'falls back to the zone');

    // And the inference is persisted, not recomputed every load.
    assert.match(storage.read('targets', '') && JSON.stringify(storage.read('targets', [])), /"type":"turret"/);
  } finally { teardown(ctx); }
});

maybe('the launch alarm is on by default and can be turned off', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    assert.strictEqual(state.data.settings.alarmEnabled, true,
      'a rally lead should not have to discover the alarm to benefit from it');

    state.updateSettings({ alarmEnabled: false });
    state.load();
    assert.strictEqual(state.data.settings.alarmEnabled, false, 'and the choice sticks');
  } finally { teardown(ctx); }
});

maybe('audio arms itself on the first interaction rather than needing a special tap', async () => {
  const ctx = await boot();
  try {
    const { alarm } = ctx.RS;
    let primed = 0;
    const realPrime = alarm.prime;
    alarm.prime = function () { primed++; return realPrime.apply(null, arguments); };

    // Any tap anywhere counts, not just the alarm button.
    ctx.window.document.body.dispatchEvent(
      new ctx.window.Event('pointerdown', { bubbles: true })
    );
    assert.strictEqual(primed, 1, 'the first gesture should arm the audio context');

    // ...and only the first one, so it is not re-primed on every click.
    ctx.window.document.body.dispatchEvent(
      new ctx.window.Event('pointerdown', { bubbles: true })
    );
    assert.strictEqual(primed, 1);
    alarm.prime = realPrime;
  } finally { teardown(ctx); }
});

maybe('logging a march reports how far the shipped default was out', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;

    // A real reading from the rally screen: an enemy city 89.4 tiles out took
    // 188s. A city, not a monster: the structure curve is the fitted one.
    const target = state.upsertTarget({
      name: 'Enemy city', x: 448, y: 756, zoneKey: 'city', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'TS', x: 536, y: 740, marchSpeedUpPercent: 25 });

    // The shipped default is fitted to this very march, so logging it should
    // land where the model already sits rather than swinging it.
    const predictedBefore = ctx.RS.calc.marchSecondsForZone(
      state.findZone('city'), state.findLead(lead.id), state.findTarget(target.id), 25
    ).seconds;
    assert.ok(Math.abs(predictedBefore - 188) < 2,
      'the shipped default should already be within a couple of seconds, got ' + predictedBefore);

    state.recordMeasurement(lead.id, target.id, 188);
    const fit = state.recalibrateZone('city');
    assert.strictEqual(fit.ok, true);

    const predictedAfter = ctx.RS.calc.marchSecondsForZone(
      state.findZone('city'), state.findLead(lead.id), state.findTarget(target.id), 25
    ).seconds;
    assert.ok(Math.abs(predictedAfter - 188) < 2,
      'and it should still predict the march it was just given, got ' + predictedAfter);

    // And the pair itself is now exact rather than fitted.
    const plan = ctx.RS.calc.buildMultiPlan({
      groups: [{ target: state.findTarget(target.id), leads: [state.findLead(lead.id)] }],
      zones: state.data.zones, measurements: state.data.measurements,
      mode: 'sync', gapSeconds: 0, startMs: Date.now() + 600000, nowMs: Date.now()
    });
    assert.strictEqual(plan.rows[0].tier, 'measured');
    assert.strictEqual(Math.round(plan.rows[0].marchSeconds), 188);
  } finally { teardown(ctx); }
});

maybe('each result row shows the coordinates and speed behind its number', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Terror', x: 508, y: 730, zoneKey: 'general', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'TS', x: 536, y: 740, marchSpeedUpPercent: 25 });

    state.updateSettings({
      selectedTargetId: target.id, selectedLeadIds: [lead.id],
      mode: 'sync', startMs: Date.now() + 600000
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');

    const facts = ctx.window.document.querySelector('.result .result-facts').textContent;
    assert.match(facts, /X:536 Y:740/, 'the lead coordinates should be on the row');
    assert.match(facts, /X:508 Y:730/, 'and the target coordinates too');
    assert.match(facts, /\+25%/, 'and the speed that scaled the march');
    assert.match(facts, /29 km/);
  } finally { teardown(ctx); }
});

maybe('leads sharing a name are flagged, because identical rows get mistapped', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    state.upsertLead({ name: 'TS', x: 430, y: 604, marchSpeedUpPercent: 62 });
    ctx.RS.app.go('roster');
    assert.strictEqual(
      ctx.window.document.querySelectorAll('.tag-warn').length, 0,
      'one lead of that name is fine'
    );

    state.upsertLead({ name: 'ts', x: 536, y: 740, marchSpeedUpPercent: 25 });
    ctx.RS.app.refresh();

    const text = ctx.window.document.querySelector('#main').textContent;
    assert.match(text, /share a name/i, 'the clash should be called out');
    assert.strictEqual(
      ctx.window.document.querySelectorAll('.tag-warn').length, 2,
      'both offenders tagged, and the match ignores case'
    );
  } finally { teardown(ctx); }
});

maybe('lead chips carry their coordinates inline, not only in a tooltip', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const target = state.upsertTarget({
      name: 'Terror', x: 508, y: 730, zoneKey: 'general', gatherSeconds: 300
    });
    const ready = state.upsertLead({ name: 'TS', x: 536, y: 740, marchSpeedUpPercent: 25 });
    const blank = state.upsertLead({ name: 'Cabo' });

    state.updateSettings({ selectedTargetId: target.id, selectedLeadIds: [ready.id] });
    // go() is a no-op when already on that tab, so force the re-render.
    ctx.RS.app.go('calculate');
    ctx.RS.app.refresh();

    const chips = Array.from(ctx.window.document.querySelectorAll('.chip-stacked'));
    const byName = {};
    chips.forEach((c) => { byName[c.querySelector('.chip-name').textContent] = c; });

    // Coordinates, speed, and the distance to the chosen target.
    assert.strictEqual(byName.TS.querySelector('.chip-sub').textContent, '536,740 · +25% · 29 km');
    assert.strictEqual(byName.Cabo.querySelector('.chip-sub').textContent, 'no coordinates');
    assert.ok(byName.Cabo.classList.contains('is-incomplete'),
      'a lead with nothing set should read as incomplete on the chip itself');
  } finally { teardown(ctx); }
});

maybe('the chosen target shows its detail on the closed selector', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    const castle = state.upsertTarget({
      name: "King's Castle", x: 512, y: 512, zoneKey: 'castle_relic',
      gatherSeconds: 300, type: 'castle'
    });
    state.updateSettings({ selectedTargetId: castle.id });
    ctx.RS.app.go('calculate');
    ctx.RS.app.refresh();

    const sub = ctx.window.document.querySelector('.ss-label-sub');
    assert.ok(sub, 'the closed selector should carry a detail line');
    assert.match(sub.textContent, /512,512/, 'coordinates');
    assert.match(sub.textContent, /Castle/, 'zone model');
    assert.match(sub.textContent, /rally 5m/, 'rally window');

    // A target with nothing set says so rather than showing a blank line.
    const blank = state.upsertTarget({ name: 'Terror', type: 'other' });
    state.updateSettings({ selectedTargetId: blank.id });
    ctx.RS.app.refresh();
    assert.match(
      ctx.window.document.querySelector('.ss-label-sub').textContent,
      /no coordinates set/
    );
  } finally { teardown(ctx); }
});

maybe('the build marker is shown and the update check reads Last-Modified', async () => {
  const ctx = await boot();
  try {
    const V = ctx.RS.version;

    // The release number is visible without opening anything.
    assert.strictEqual(
      ctx.window.document.querySelector('#brand-version').textContent,
      'v' + V.VERSION
    );
    assert.match(V.buildText(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$|^unknown$/);

    // A newer Last-Modified than this page's own build reads as stale.
    const mine = V.buildMs();
    ctx.window.fetch = () => Promise.resolve({
      ok: true,
      headers: { get: () => new Date(mine + 10 * 60000).toUTCString() }
    });
    const stale = await V.checkForUpdate();
    assert.strictEqual(stale.ok, true);
    assert.strictEqual(stale.stale, true, 'a deploy ten minutes newer must register');

    // The same timestamp is not an update.
    ctx.window.fetch = () => Promise.resolve({
      ok: true,
      headers: { get: () => new Date(mine).toUTCString() }
    });
    assert.strictEqual((await V.checkForUpdate()).stale, false);

    // Offline says so rather than claiming you are up to date.
    ctx.window.fetch = () => Promise.reject(new Error('offline'));
    const failed = await V.checkForUpdate();
    assert.strictEqual(failed.ok, false);
    assert.match(failed.reason, /offline|reach/i);
  } finally { teardown(ctx); }
});

maybe('the app admits when it is extrapolating past its own measurements', async () => {
  const ctx = await boot();
  try {
    const { state } = ctx.RS;
    // Inside the fitted range: the monster line was measured from 60.8 to
    // 404.6 tiles, so a target at ~90 tiles is interpolation, not extrapolation.
    const target = state.upsertTarget({
      name: 'Base', x: 448, y: 756, zoneKey: 'city', gatherSeconds: 300
    });

    // +25% is the only speed the shipped curve was ever fitted at.
    const onModel = state.upsertLead({ name: 'TS', x: 536, y: 740, marchSpeedUpPercent: 25 });
    state.updateSettings({
      selectedTargetId: target.id, selectedLeadIds: [onModel.id],
      mode: 'sync', startMs: Date.now() + 600000
    });
    ctx.RS.app.go('roster');
    ctx.RS.app.go('calculate');
    assert.ok(
      !/Extrapolating/.test(ctx.window.document.querySelector('#main').textContent),
      'a march inside the fitted range should not be flagged'
    );

    // A lead at a speed never measured must be called out.
    const offModel = state.upsertLead({ name: 'Beast', x: 536, y: 740, marchSpeedUpPercent: 105 });
    state.updateSettings({ selectedLeadIds: [onModel.id, offModel.id] });
    ctx.RS.app.refresh();

    const text = ctx.window.document.querySelector('#main').textContent;
    assert.match(text, /Extrapolating/);
    assert.match(text, /never been measured at/);
  } finally { teardown(ctx); }
});

maybe('an install carrying old constants is migrated on load', async () => {
  const ctx = await boot();
  try {
    const { state, storage } = ctx.RS;

    // An install from before the constants were corrected: the community rate,
    // never fitted, never hand-edited.
    storage.write('zones', [{
      zoneKey: 'general', label: 'Open map', formulaType: 'affine',
      constants: { secPerTile: 2.7777, offset: 3.2 },
      segmented: {}, presetId: 'measured', trust: 'unverified', lastFitISO: null
    }]);
    state.load();

    const migrated = state.findZone('general');
    // The current default is a piecewise curve, so there is no secPerTile to
    // compare. What must hold is that the stale affine constants are gone.
    assert.strictEqual(migrated.formulaType, 'piecewise',
      'an untouched zone must take the current default shape, got ' + migrated.formulaType);
    assert.strictEqual(migrated.constants.secPerTile, undefined,
      'the old affine constants must not survive the migration');
    const secs = ctx.RS.calc.marchSecondsForZone(
      migrated, { x: 0, y: 0 }, { x: 30, y: 40 }, 25
    ).seconds;
    assert.ok(secs > 0 && secs < 200, 'and it must produce a sane march time, got ' + secs);
  } finally { teardown(ctx); }
});

maybe('a zone the user actually calibrated survives a new default', async () => {
  const ctx = await boot();
  try {
    const { state, storage } = ctx.RS;

    storage.write('zones', [{
      zoneKey: 'general', label: 'Open map', formulaType: 'affine',
      constants: { secPerTile: 9.99, offset: 1 },
      segmented: {}, presetId: 'coefficient', trust: 'calibrated',
      lastFitISO: new Date().toISOString(),
      fitQuality: { n: 3, rmse: 0.4, maxErrorSeconds: 0.6 }
    }]);
    state.load();

    assert.strictEqual(state.findZone('general').constants.secPerTile, 9.99,
      'the user\u2019s own fit is their data and must never be overwritten');
  } finally { teardown(ctx); }
});

maybe('an exact march time typed from the game overrides the formula', async () => {
  const ctx = await boot();
  try {
    const { state, calc } = ctx.RS;
    const doc = ctx.window.document;

    const target = state.upsertTarget({
      name: 'WHITESNAKE722', x: 448, y: 756, zoneKey: 'general', gatherSeconds: 300
    });
    const lead = state.upsertLead({ name: 'TS', x: 536, y: 740, marchSpeedUpPercent: 25 });
    state.updateSettings({ selectedTargetId: target.id, selectedLeadIds: [lead.id] });
    ctx.RS.app.go('calculate');
    ctx.RS.app.refresh();

    const row = () => doc.querySelector('.result');
    assert.strictEqual(row().querySelector('.badge').textContent, 'estimated',
      'without a measurement the row should be running on the formula');

    // The control is on the row itself: being exact should not mean a trip to
    // another tab, now that the game states the number before you commit.
    const open = Array.from(row().querySelectorAll('.result-actions button'))
      .find((b) => b.textContent.includes('Exact time'));
    assert.ok(open, 'the result row should offer to set an exact time');

    const panel = row().querySelector('.exact-panel');
    assert.strictEqual(panel.hidden, true, 'the panel should start closed');
    open.dispatchEvent(new ctx.window.Event('click', { bubbles: true }));
    assert.strictEqual(row().querySelector('.exact-panel').hidden, false);

    // 3:33 is what the rally screen reads for this pair.
    const input = row().querySelector('.exact-input');
    input.value = '3:33';
    Array.from(row().querySelectorAll('.exact-panel button'))
      .find((b) => b.textContent.includes('Set exact'))
      .dispatchEvent(new ctx.window.Event('click', { bubbles: true }));

    assert.strictEqual(row().querySelector('.badge').textContent, 'measured',
      'the row should switch to the exact tier');
    const march = Array.from(row().querySelectorAll('.fact'))
      .find((f) => f.querySelector('.fact-label').textContent === 'march');
    assert.strictEqual(march.querySelector('.fact-value').textContent, '3m 33s');

    const stored = state.measurementFor(lead.id, target.id);
    assert.strictEqual(stored.seconds, 213, 'mm:ss should be stored as seconds');

    // The panel has to survive the re-render, or it collapses at the moment it
    // has something to report.
    assert.strictEqual(row().querySelector('.exact-panel').hidden, false,
      'the panel should stay open after setting a time');
    assert.match(row().querySelector('.exact-feedback').textContent, /formula/,
      'it should say how far the formula had been off');

    // It also has to survive as a calibration sample, since one reading should
    // improve every lead who has not measured this pair.
    assert.ok(state.data.samples.some((s) => Math.abs(s.observedTimeSeconds - 213) < 0.01),
      'the reading should feed zone calibration too');
  } finally { teardown(ctx); }
});

maybe('an exact time is dropped when the inputs behind it change', async () => {
  const ctx = await boot();
  try {
    const { state, calc } = ctx.RS;
    const target = state.upsertTarget({ name: 'T', x: 448, y: 756, zoneKey: 'general' });
    const lead = state.upsertLead({ name: 'TS', x: 536, y: 740, marchSpeedUpPercent: 25 });
    state.recordMeasurement(lead.id, target.id, 213);

    const zones = ctx.RS.zones.defaultZoneFormulas();
    const exact = calc.resolveMarchSeconds({
      lead: state.findLead(lead.id), target: state.findTarget(target.id),
      zones, measurement: state.measurementFor(lead.id, target.id)
    });
    assert.strictEqual(exact.seconds, 213);
    assert.strictEqual(exact.tier, calc.TIER.MEASURED);

    // Move the lead: the old reading is no longer about this march.
    state.upsertLead({ id: lead.id, name: 'TS', x: 600, y: 740, marchSpeedUpPercent: 25 });
    const after = calc.resolveMarchSeconds({
      lead: state.findLead(lead.id), target: state.findTarget(target.id),
      zones, measurement: state.measurementFor(lead.id, target.id)
    });
    assert.notStrictEqual(after.tier, calc.TIER.MEASURED,
      'a stale reading must not be presented as exact');
    assert.ok(after.notes.join(' ').includes('ignored'));
  } finally { teardown(ctx); }
});
