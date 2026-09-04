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
    // null means follow the browser, so a new install speaks the player's
    // language without being asked.
    language: null,
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

    alarmEnabled: true,
    alarmLeadSeconds: 10,
    alarmVolume: 0.8,
    speechEnabled: true,
    keepAwake: true,     // warning pips this long before a launch

    theme: 'system',          // system | light | dark

    // When rallies open. The landing time is derived from it, not set: the
    // slowest lead taps at this moment and everyone else follows.
    startMs: null             // null or stale means "use now"
  };

  /** A start older than this is assumed to be left over from a past event. */
  var START_STALE_MS = 2 * 3600 * 1000;

  /** A blank target of a given type, with that type's defaults filled in. */
  function newTargetOfType(typeKey, name) {
    var def = zonesLib.targetTypeDef(typeKey);
    return {
      id: uid(),
      name: name || def.label,
      type: def.key,
      x: null,
      y: null,
      zoneKey: def.zoneKey,
      gatherSeconds: def.gatherSeconds
    };
  }

  /**
   * Adds a target of a type, numbering it if you already have one — a second
   * Sanctuary comes out as "Sanctuary 2" rather than a duplicate name.
   */
  function addTargetOfType(typeKey) {
    var def = zonesLib.targetTypeDef(typeKey);
    var sameType = state.targets.filter(function (t) { return t.type === def.key; });
    var name = sameType.length === 0 ? def.label : def.label + ' ' + (sameType.length + 1);
    return upsertTarget(newTargetOfType(def.key, name));
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

  /**
   * Nothing currently subscribes, so notify() is inert: views re-render by
   * calling root.RallySync.app.refresh() themselves after a mutation. Do not
   * read a notify() call below as "the screen updates here" — it does not.
   * Kept because the hook is harmless and a future view may want it.
   */
  function subscribe(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(function (fn) { fn(state); }); }

  function load() {
    state.settings = Object.assign({}, DEFAULT_SETTINGS, storage.read('settings', {}));
    state.leads = storage.read('leads', []);
    state.samples = storage.read('samples', []);
    state.measurements = storage.read('measurements', {});
    state.presets = storage.read('presets', []);

    // Targets are only ever the ones you added — nothing is preloaded.
    state.targets = storage.read('targets', []);

    // Targets saved before types existed get one inferred from their name.
    var migrated = false;
    state.targets.forEach(function (t) {
      if (!t.type) { t.type = zonesLib.inferTargetType(t); migrated = true; }
    });

    // Zones were once split into city / hq / general with the monster curve
    // sitting on 'general'. Everything on the open map marches the same way, so
    // they collapsed into one 'general' curve and monsters moved to their own
    // key. Repoint stored targets accordingly.
    state.targets.forEach(function (t) {
      if (t.zoneKey === 'city' || t.zoneKey === 'hq') { t.zoneKey = 'general'; migrated = true; }
      if (t.type === 'monster' && t.zoneKey === 'general') { t.zoneKey = 'monster'; migrated = true; }
    });
    if (migrated) storage.write('targets', state.targets);

    var storedZones = storage.read('zones', null);
    state.zones = storedZones === null
      ? zonesLib.defaultZoneFormulas(state.settings.presetId)
      : reconcileZones(storedZones, state.settings.presetId);
    if (storedZones === null) storage.write('zones', state.zones);

    return state;
  }

  /**
   * Keeps stored zones usable if a future version adds a zone or a field.
   *
   * A zone the user has never touched is also moved onto the current default
   * preset, so an install carrying constants that later turned out to be twice
   * the real value does not keep them forever. Anything fitted from samples or
   * hand-edited is left exactly as it is — that is the user's own data.
   */
  function reconcileZones(stored, presetId) {
    var defaults = zonesLib.defaultZoneFormulas(presetId);
    return defaults.map(function (def) {
      var found = null;
      for (var i = 0; i < stored.length; i++) {
        if (stored[i].zoneKey === def.zoneKey) { found = stored[i]; break; }
      }
      if (!found) return def;

      // Untouched means the user has never fitted or hand-edited this zone, so
      // whatever it holds is a default they never chose. Always hand them the
      // current one. Keying this off a stored presetId was too fragile: an
      // install whose presetId happened to match kept constants that later
      // turned out to be twice the real value.
      var untouched = !found.lastFitISO && !found.fitQuality &&
        found.trust !== 'calibrated' && found.trust !== 'manual';
      if (untouched) return def;

      // A zone the user fitted is their data and is kept whole, including its
      // formula shape. But constants must not be merged ACROSS shapes: affine
      // numbers mean nothing to a piecewise zone, and Object.assign would leave
      // a half-and-half object that silently keeps the old model alive.
      var sameShape = !found.formulaType || found.formulaType === def.formulaType;
      return Object.assign({}, def, found, {
        constants: sameShape
          ? Object.assign({}, def.constants, found.constants)
          : Object.assign({}, found.constants),
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
      type: target.type || zonesLib.inferTargetType(target),
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

    // Fit whichever curve the zone runs on. The power model needs two samples
    // at different distances; below that, fall back to the straight line, which
    // a single sample can still pin down.
    // A piecewise zone calibrates by scale, not by refitting the curve: one
    // real march is enough, and every coefficient moves together so the two
    // branches keep meeting at the join.
    if (zone.formulaType === 'piecewise') {
      var scaled = calc.fitPiecewiseScale(samples, zone.constants);
      if (!scaled) {
        return { ok: false, fit: null, reason: 'These samples do not produce a usable fit.' };
      }
      zone.constants = calc.scalePiecewiseConstants(zone.constants, scaled.scale);
      zone.trust = 'calibrated';
      zone.lastFitISO = new Date().toISOString();
      zone.fitQuality = {
        n: scaled.n, rmse: scaled.rmse, maxErrorSeconds: scaled.maxErrorSeconds,
        fittedOffset: true, model: 'piecewise',
        minDistance: scaled.minDistance, maxDistance: scaled.maxDistance
      };
      persist('zones');
      notify();
      return { ok: true, fit: scaled, reason: null };
    }

    var fit = null;
    var usedPower = false;
    if (zone.formulaType === 'power') {
      fit = calc.fitPower(samples);
      usedPower = !!fit;
    }
    if (!fit) fit = calc.fitAffine(samples, affineSeed(zone));

    if (!fit) {
      return { ok: false, fit: null, reason: 'These samples do not produce a usable fit.' };
    }

    if (usedPower) {
      zone.formulaType = 'power';
      zone.constants = { coefficient: fit.coefficient, exponent: fit.exponent };
    } else {
      zone.formulaType = 'affine';
      zone.constants = { secPerTile: fit.secPerTile, offset: fit.offset };
    }
    zone.trust = 'calibrated';
    zone.lastFitISO = new Date().toISOString();
    zone.fitQuality = {
      n: fit.n,
      rmse: fit.rmse,
      maxErrorSeconds: fit.maxErrorSeconds,
      fittedOffset: usedPower ? true : fit.fittedOffset,
      model: usedPower ? 'power' : 'affine',
      minDistance: fit.minDistance,
      maxDistance: fit.maxDistance
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

  /** A starting offset for the affine fallback, whatever model the zone is on. */
  function affineSeed(zone) {
    if (zone.constants && isFinite(zone.constants.offset)) return zone.constants;
    return { secPerTile: 1.31, offset: 3.2 };
  }

  function updateZone(zoneKey, changes) {
    var zone = findZone(zoneKey);
    if (!zone) return null;
    if (changes.formulaType) zone.formulaType = changes.formulaType;
    if (changes.constants) assignNumeric(zone.constants, changes.constants);
    if (changes.segmented) assignNumeric(zone.segmented, changes.segmented);
    if (changes.trust) zone.trust = changes.trust;
    // A hand edit makes this the user's own data, whatever it was before.
    // Leaving it marked 'unverified' let the default migration overwrite it.
    if (changes.constants || changes.segmented) {
      zone.trust = 'manual';
      zone.fitQuality = null;
    }
    persist('zones');
    notify();
    return zone;
  }

  /** Escape hatch: put every zone back on the shipped defaults. */
  function resetAllZones() {
    state.zones = zonesLib.defaultZoneFormulas(state.settings.presetId);
    persist('zones');
    notify();
    return state.zones;
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
   * The moment the first rally opens. Falls back to the current time when unset,
   * or when it is left over from an event hours ago — a stale start would
   * silently produce launch times in the past.
   */
  function startMs() {
    var stored = Number(state.settings.startMs);
    var current = now();
    if (!isFinite(stored) || stored <= 0) return current;
    if (current - stored > START_STALE_MS) return current;
    return stored;
  }

  function startIsExplicit() {
    var stored = Number(state.settings.startMs);
    return isFinite(stored) && stored > 0 && (now() - stored) <= START_STALE_MS;
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
    addTargetOfType: addTargetOfType,
    newTargetOfType: newTargetOfType,
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
    resetAllZones: resetAllZones,
    applyPreset: applyPreset,
    updateSettings: updateSettings,
    startMs: startMs,
    startIsExplicit: startIsExplicit,
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
