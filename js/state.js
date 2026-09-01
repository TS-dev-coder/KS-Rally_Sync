/**
 * state.js — the app's in-memory state plus its persistence glue.
 *
 * Views read from `state` and call these mutators; every mutator persists the
 * slice it touched, so there is no separate "save" step to forget mid-event.
 */
;(function (root) {
  'use strict';

  var storage = root.RallySync.storage;
  var zonesLib = root.RallySync.zones;
  var calc = root.RallySync.calc;

  var DEFAULT_GATHER_SECONDS = 300; // Castle rallies march at 5:00, filled or not.

  var DEFAULT_SETTINGS = {
    clockOffsetSeconds: 0,
    mode: 'sync',
    gapSeconds: 5,
    safetyBufferSeconds: 2,
    selectedTargetId: null,
    selectedLeadIds: [],
    presetId: zonesLib.DEFAULT_PRESET,
    disclaimerAcknowledged: false,

    // Multi-target runs: part of the roster on the Castle, the rest elsewhere.
    multiTarget: false,
    assignments: {},          // leadId -> targetId, only used when multiTarget

    groupBy: 'none',          // none | alliance | squad | target

    alarmEnabled: false,
    alarmLeadSeconds: 10,     // warning pips this long before a launch

    theme: 'system',          // system | light | dark

    // Landing time is anchored to an explicit base rather than drifting with
    // the clock: alliances agree a reference time and work forward from it.
    baseMs: null,             // null or stale means "use now"
    landingOffsetSeconds: 300
  };

  /** A base older than this is assumed to be left over from a past event. */
  var BASE_STALE_MS = 2 * 3600 * 1000;

  /**
   * Preloaded targets. Coordinates stay blank until the user fills in their
   * kingdom's. Outposts, Sanctuaries and Fortresses sit outside the Castle
   * Forbidden Zone, so they use the free-form open-map model — see
   * RESEARCH-NOTES.md Section 5.
   */
  function seedTargets() {
    var seeds = [
      ['King’s Castle', 'castle_relic'],
      ['North Turret', 'turret'],
      ['South Turret', 'turret'],
      ['East Turret', 'turret'],
      ['West Turret', 'turret'],
      ['Ruins', 'ruins'],
      ['Sanctuary', 'general'],
      ['Fortress', 'general'],
      ['Outpost', 'general'],
      ['Other structure', 'general']
    ];
    return seeds.map(function (seed) {
      return {
        id: uid(),
        name: seed[0],
        x: null,
        y: null,
        zoneKey: seed[1],
        gatherSeconds: DEFAULT_GATHER_SECONDS
      };
    });
  }

  function uid() {
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var state = {
    leads: [],
    targets: [],
    zones: [],
    samples: [],
    measurements: {},
    presets: [],
    settings: {}
  };

  var listeners = [];

  function subscribe(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(function (fn) { fn(state); }); }

  function load() {
    state.settings = Object.assign({}, DEFAULT_SETTINGS, storage.read('settings', {}));
    state.leads = storage.read('leads', []);
    state.samples = storage.read('samples', []);
    state.measurements = storage.read('measurements', {});
    state.presets = storage.read('presets', []);

    var storedTargets = storage.read('targets', null);
    state.targets = storedTargets === null ? seedTargets() : storedTargets;
    if (storedTargets === null) storage.write('targets', state.targets);

    var storedZones = storage.read('zones', null);
    state.zones = storedZones === null
      ? zonesLib.defaultZoneFormulas(state.settings.presetId)
      : reconcileZones(storedZones, state.settings.presetId);
    if (storedZones === null) storage.write('zones', state.zones);

    return state;
  }

  /** Keeps stored zones usable if a future version adds a zone or a field. */
  function reconcileZones(stored, presetId) {
    var defaults = zonesLib.defaultZoneFormulas(presetId);
    return defaults.map(function (def) {
      var found = null;
      for (var i = 0; i < stored.length; i++) {
        if (stored[i].zoneKey === def.zoneKey) { found = stored[i]; break; }
      }
      if (!found) return def;
      return Object.assign({}, def, found, {
        constants: Object.assign({}, def.constants, found.constants),
        segmented: Object.assign({}, def.segmented, found.segmented)
      });
    });
  }

  function persist(key) { storage.write(key, state[key]); }

  // -------------------------------------------------------------- rally leads

  function upsertLead(lead) {
    var record = {
      id: lead.id || uid(),
      name: String(lead.name || '').trim(),
      x: numberOrNull(lead.x),
      y: numberOrNull(lead.y),
      marchSpeedUpPercent: numberOrNull(lead.marchSpeedUpPercent),
      alliance: String(lead.alliance || '').trim(),
      squad: String(lead.squad || '').trim(),
      rallyCapacity: numberOrNull(lead.rallyCapacity),
      power: numberOrNull(lead.power)
    };
    var index = indexById(state.leads, record.id);
    if (index === -1) state.leads.push(record);
    else state.leads[index] = record;
    persist('leads');
    notify();
    return record;
  }

  function deleteLead(id) {
    state.leads = state.leads.filter(function (l) { return l.id !== id; });
    state.settings.selectedLeadIds = state.settings.selectedLeadIds.filter(function (l) {
      return l !== id;
    });
    delete state.settings.assignments[id];
    Object.keys(state.measurements).forEach(function (key) {
      if (key.indexOf(id + '|') === 0) delete state.measurements[key];
    });
    persist('leads');
    persist('measurements');
    persist('settings');
    notify();
  }

  // ------------------------------------------------------------------ targets

  function upsertTarget(target) {
    var record = {
      id: target.id || uid(),
      name: String(target.name || '').trim(),
      x: numberOrNull(target.x),
      y: numberOrNull(target.y),
      zoneKey: target.zoneKey || 'general',
      gatherSeconds: target.gatherSeconds === null || target.gatherSeconds === undefined || target.gatherSeconds === ''
        ? DEFAULT_GATHER_SECONDS
        : Number(target.gatherSeconds)
    };
    var index = indexById(state.targets, record.id);
    if (index === -1) state.targets.push(record);
    else state.targets[index] = record;
    persist('targets');
    notify();
    return record;
  }

  function deleteTarget(id) {
    state.targets = state.targets.filter(function (t) { return t.id !== id; });
    if (state.settings.selectedTargetId === id) state.settings.selectedTargetId = null;
    Object.keys(state.settings.assignments).forEach(function (leadId) {
      if (state.settings.assignments[leadId] === id) delete state.settings.assignments[leadId];
    });
    Object.keys(state.measurements).forEach(function (key) {
      if (key.indexOf('|' + id) === key.length - id.length - 1) delete state.measurements[key];
    });
    persist('targets');
    persist('measurements');
    persist('settings');
    notify();
  }

  function findTarget(id) {
    var index = indexById(state.targets, id);
    return index === -1 ? null : state.targets[index];
  }

  function findLead(id) {
    var index = indexById(state.leads, id);
    return index === -1 ? null : state.leads[index];
  }

  // ------------------------------------------------------------ measurements

  /**
   * Records a real observed march time for one (lead, target) pair. This is the
   * exact tier — it also becomes a calibration sample for the zone, so every
   * measurement improves the estimates for leads who have not measured yet.
   */
  function recordMeasurement(leadId, targetId, observedSeconds) {
    var lead = findLead(leadId);
    var target = findTarget(targetId);
    if (!lead || !target) return null;

    var record = {
      seconds: Number(observedSeconds),
      leadX: Number(lead.x),
      leadY: Number(lead.y),
      speedPercent: Number(lead.marchSpeedUpPercent),
      targetX: Number(target.x),
      targetY: Number(target.y),
      recordedISO: new Date().toISOString()
    };
    state.measurements[calc.measurementKey(leadId, targetId)] = record;
    persist('measurements');

    addSample({
      zoneKey: target.zoneKey,
      distance: calc.distanceTiles(lead, target),
      speedPercent: Number(lead.marchSpeedUpPercent),
      observedTimeSeconds: Number(observedSeconds),
      sourceLeadId: leadId,
      sourceTargetId: targetId
    });
    notify();
    return record;
  }

  function measurementFor(leadId, targetId) {
    return state.measurements[calc.measurementKey(leadId, targetId)] || null;
  }

  function deleteMeasurement(leadId, targetId) {
    delete state.measurements[calc.measurementKey(leadId, targetId)];
    persist('measurements');
    notify();
  }

  // ------------------------------------------------------------- calibration

  function addSample(sample) {
    var record = {
      id: uid(),
      zoneKey: sample.zoneKey,
      distance: Number(sample.distance),
      speedPercent: Number(sample.speedPercent),
      observedTimeSeconds: Number(sample.observedTimeSeconds),
      sourceLeadId: sample.sourceLeadId || null,
      sourceTargetId: sample.sourceTargetId || null,
      dateRecorded: new Date().toISOString()
    };
    state.samples.push(record);
    persist('samples');
    notify();
    return record;
  }

  function deleteSample(id) {
    state.samples = state.samples.filter(function (s) { return s.id !== id; });
    persist('samples');
    notify();
  }

  function samplesForZone(zoneKey) {
    return state.samples.filter(function (s) { return s.zoneKey === zoneKey; });
  }

  function findZone(zoneKey) { return zonesLib.findZone(state.zones, zoneKey); }

  /**
   * Refits one zone's constants to its samples.
   * @returns {{ok:boolean, fit:object|null, reason:string|null}}
   */
  function recalibrateZone(zoneKey) {
    var zone = findZone(zoneKey);
    if (!zone) return { ok: false, fit: null, reason: 'Unknown zone.' };

    var samples = samplesForZone(zoneKey);
    if (samples.length === 0) {
      return { ok: false, fit: null, reason: 'No samples recorded for this zone yet.' };
    }

    var fit = calc.fitAffine(samples, zone.constants);
    if (!fit) {
      return { ok: false, fit: null, reason: 'These samples do not produce a usable fit.' };
    }

    zone.formulaType = 'affine';
    zone.constants.secPerTile = fit.secPerTile;
    zone.constants.offset = fit.offset;
    zone.trust = 'calibrated';
    zone.lastFitISO = new Date().toISOString();
    zone.fitQuality = {
      n: fit.n,
      rmse: fit.rmse,
      maxErrorSeconds: fit.maxErrorSeconds,
      fittedOffset: fit.fittedOffset
    };
    persist('zones');
    notify();
    return { ok: true, fit: fit, reason: null };
  }

  /**
   * Drops any non-numeric edit so a cleared input cannot poison the model.
   * Blank counts as non-numeric: Number('') is 0, and a zero seconds-per-tile
   * would silently make every march instant.
   */
  function assignNumeric(targetObject, changes) {
    Object.keys(changes).forEach(function (key) {
      var raw = changes[key];
      if (raw === null || raw === undefined || String(raw).trim() === '') return;
      var value = Number(raw);
      if (isFinite(value)) targetObject[key] = value;
    });
  }

  function updateZone(zoneKey, changes) {
    var zone = findZone(zoneKey);
    if (!zone) return null;
    if (changes.formulaType) zone.formulaType = changes.formulaType;
    if (changes.constants) assignNumeric(zone.constants, changes.constants);
    if (changes.segmented) assignNumeric(zone.segmented, changes.segmented);
    if (changes.trust) zone.trust = changes.trust;
    // Hand-edited constants are no longer the fitted ones.
    if (changes.constants || changes.segmented) {
      if (zone.trust === 'calibrated') zone.trust = 'manual';
      zone.fitQuality = null;
    }
    persist('zones');
    notify();
    return zone;
  }

  function resetZone(zoneKey) {
    var defaults = zonesLib.defaultZoneFormulas(state.settings.presetId);
    var fresh = zonesLib.findZone(defaults, zoneKey);
    if (!fresh) return null;
    var index = -1;
    for (var i = 0; i < state.zones.length; i++) {
      if (state.zones[i].zoneKey === zoneKey) { index = i; break; }
    }
    if (index === -1) return null;
    state.zones[index] = fresh;
    persist('zones');
    notify();
    return fresh;
  }

  /** Swaps every zone to a different community model preset, discarding fits. */
  function applyPreset(presetId) {
    state.settings.presetId = presetId;
    state.zones = zonesLib.defaultZoneFormulas(presetId);
    persist('zones');
    persist('settings');
    notify();
  }

  // ------------------------------------------------------------ event presets

  /**
   * Saves the current selection as a reusable setup — "Weekly Castle Battle",
   * "KvK Day 4". Landing time is deliberately not saved: it changes every run.
   */
  function savePreset(name) {
    var settings = state.settings;
    var record = {
      id: uid(),
      name: String(name || '').trim() || 'Untitled setup',
      selectedTargetId: settings.selectedTargetId,
      selectedLeadIds: settings.selectedLeadIds.slice(),
      assignments: Object.assign({}, settings.assignments),
      multiTarget: !!settings.multiTarget,
      mode: settings.mode,
      gapSeconds: settings.gapSeconds,
      groupBy: settings.groupBy,
      savedISO: new Date().toISOString()
    };
    state.presets.push(record);
    persist('presets');
    notify();
    return record;
  }

  function applyPresetSetup(id) {
    var preset = null;
    for (var i = 0; i < state.presets.length; i++) {
      if (state.presets[i].id === id) { preset = state.presets[i]; break; }
    }
    if (!preset) return null;

    // Drop anything the preset points at that has since been deleted.
    var leadIds = (preset.selectedLeadIds || []).filter(function (leadId) {
      return !!findLead(leadId);
    });
    var assignments = {};
    Object.keys(preset.assignments || {}).forEach(function (leadId) {
      if (findLead(leadId) && findTarget(preset.assignments[leadId])) {
        assignments[leadId] = preset.assignments[leadId];
      }
    });

    updateSettings({
      selectedTargetId: findTarget(preset.selectedTargetId) ? preset.selectedTargetId : state.settings.selectedTargetId,
      selectedLeadIds: leadIds,
      assignments: assignments,
      multiTarget: !!preset.multiTarget,
      mode: preset.mode || 'sync',
      gapSeconds: Number(preset.gapSeconds) || 0,
      groupBy: preset.groupBy || 'none'
    });
    return preset;
  }

  function deletePreset(id) {
    state.presets = state.presets.filter(function (p) { return p.id !== id; });
    persist('presets');
    notify();
  }

  // ------------------------------------------------------------- groupings

  /** Distinct non-empty values of a lead field, for grouping and filters. */
  function distinctLeadValues(field) {
    var seen = {};
    state.leads.forEach(function (lead) {
      var value = String(lead[field] || '').trim();
      if (value !== '') seen[value] = true;
    });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
  }

  function alliances() { return distinctLeadValues('alliance'); }
  function squads() { return distinctLeadValues('squad'); }

  /** The target a lead marches on, honouring per-lead assignment. */
  function targetForLead(leadId) {
    var settings = state.settings;
    if (settings.multiTarget && settings.assignments[leadId]) {
      var assigned = findTarget(settings.assignments[leadId]);
      if (assigned) return assigned;
    }
    return findTarget(settings.selectedTargetId);
  }

  // ----------------------------------------------------------------- settings

  function updateSettings(changes) {
    Object.assign(state.settings, changes);
    persist('settings');
    notify();
  }

  /** Device clock plus the user's manual correction. All timing derives from this. */
  function now() {
    return Date.now() + (Number(state.settings.clockOffsetSeconds) || 0) * 1000;
  }

  /**
   * The anchor every landing time is measured from. Falls back to the current
   * time when unset, or when it is left over from an event hours ago — a stale
   * base would silently produce launch times in the past.
   */
  function baseMs() {
    var stored = Number(state.settings.baseMs);
    var current = now();
    if (!isFinite(stored) || stored <= 0) return current;
    if (current - stored > BASE_STALE_MS) return current;
    return stored;
  }

  function baseIsExplicit() {
    var stored = Number(state.settings.baseMs);
    return isFinite(stored) && stored > 0 && (now() - stored) <= BASE_STALE_MS;
  }

  /** base + offset. The single definition of when troops land. */
  function landingMs() {
    return baseMs() + (Number(state.settings.landingOffsetSeconds) || 0) * 1000;
  }

  // ---------------------------------------------------------------- utilities

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function indexById(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  root.RallySync.state = {
    DEFAULT_GATHER_SECONDS: DEFAULT_GATHER_SECONDS,
    data: state,
    uid: uid,
    load: load,
    subscribe: subscribe,
    notify: notify,
    upsertLead: upsertLead,
    deleteLead: deleteLead,
    findLead: findLead,
    upsertTarget: upsertTarget,
    deleteTarget: deleteTarget,
    findTarget: findTarget,
    recordMeasurement: recordMeasurement,
    measurementFor: measurementFor,
    deleteMeasurement: deleteMeasurement,
    addSample: addSample,
    deleteSample: deleteSample,
    samplesForZone: samplesForZone,
    findZone: findZone,
    recalibrateZone: recalibrateZone,
    updateZone: updateZone,
    resetZone: resetZone,
    applyPreset: applyPreset,
    updateSettings: updateSettings,
    baseMs: baseMs,
    baseIsExplicit: baseIsExplicit,
    landingMs: landingMs,
    savePreset: savePreset,
    applyPresetSetup: applyPresetSetup,
    deletePreset: deletePreset,
    alliances: alliances,
    squads: squads,
    distinctLeadValues: distinctLeadValues,
    targetForLead: targetForLead,
    now: now
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
