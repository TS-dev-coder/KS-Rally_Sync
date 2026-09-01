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
    disclaimerAcknowledged: false
  };

  /** Preloaded targets. Coordinates stay blank until the user fills in their kingdom's. */
  function seedTargets() {
    var seeds = [
      ['King’s Castle', 'castle_relic'],
      ['North Turret', 'turret'],
      ['South Turret', 'turret'],
      ['East Turret', 'turret'],
      ['West Turret', 'turret'],
      ['Ruins', 'ruins'],
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
      crossesRelic: !!lead.crossesRelic
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
      zoneKey: lead.crossesRelic
        ? zonesLib.slowerZone(state.zones, target.zoneKey, 'castle_relic')
        : target.zoneKey,
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

  /** Drops any non-numeric edit so a cleared input cannot poison the model. */
  function assignNumeric(targetObject, changes) {
    Object.keys(changes).forEach(function (key) {
      var value = Number(changes[key]);
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
    now: now
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
