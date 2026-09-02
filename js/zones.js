/**
 * zones.js — zone formula definitions and their default constants.
 *
 * Every number the march-time math depends on lives here or in localStorage,
 * never inline in a calculation function (PRD Section 10). See RESEARCH-NOTES.md
 * Section 5 for where these defaults come from and how much to trust them.
 *
 * Classic script, no build step: attaches to globalThis.RallySync so the same
 * file works from file:// in a browser and from `require()` in node tests.
 */
;(function (root) {
  'use strict';

  /** Zone metadata. Order here is the order shown in pickers. */
  var ZONE_DEFS = [
    {
      key: 'general',
      label: 'Open map',
      blurb: 'Free-form world map with no known obstruction. Use this for Outposts, Sanctuaries, Fortresses and any other structure outside the Castle Forbidden Zone.'
    },
    {
      key: 'castle_relic',
      label: 'Castle (Relic)',
      blurb: 'Inside or near the King’s Castle Forbidden Zone, where the Relic slows marches.'
    },
    {
      key: 'turret',
      label: 'Turret',
      blurb: 'Path to a turret. Assumed to behave like open map — unverified.'
    },
    {
      key: 'ruins',
      label: 'Ruins',
      blurb: 'The Ruins chokepoint. Penalty is a placeholder — no source quantifies it.'
    },
    {
      key: 'city',
      label: 'Enemy player city',
      blurb: 'A rally on another player’s city. Marches to player structures run about 2.1x slower per tile than marches to monsters — measured over two cities 313 tiles apart.'
    },
    {
      key: 'hq',
      label: 'Enemy HQ (attack)',
      blurb: 'Attacking an enemy alliance headquarters. Measured to behave the same as an enemy player city: a city at 402 tiles took 767 s and an HQ at 410 tiles took 777 s.'
    },
    {
      key: 'hq_own',
      label: 'Own HQ (reinforce)',
      blurb: 'Reinforcing your own alliance headquarters. Carries a far smaller overhead than attacking an enemy one — about 22 seconds. One sample, at short range.'
    }
  ];

  /**
   * The kinds of structure you can rally. A type is a starting point, not a
   * constraint: it seeds the zone model and rally window for a new target, and
   * both stay editable afterwards. You can have as many of a type as you like —
   * three Sanctuaries with your own names for them is the normal case.
   */
  var TARGET_TYPES = [
    { key: 'castle', label: 'King’s Castle', zoneKey: 'castle_relic', gatherSeconds: 300 },
    { key: 'turret', label: 'Turret', zoneKey: 'turret', gatherSeconds: 300 },
    { key: 'sanctuary', label: 'Sanctuary', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'fortress', label: 'Fortress', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'outpost', label: 'Outpost', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'monster', label: 'Terror or Beast', zoneKey: 'general', gatherSeconds: 180 },
    { key: 'city', label: 'Enemy player city', zoneKey: 'city', gatherSeconds: 300 },
    { key: 'hq', label: 'Enemy HQ', zoneKey: 'hq', gatherSeconds: 300 },
    { key: 'hq_own', label: 'Own HQ (reinforce)', zoneKey: 'hq_own', gatherSeconds: 300 },
    { key: 'ruins', label: 'Ruins', zoneKey: 'ruins', gatherSeconds: 300 },
    { key: 'other', label: 'Other', zoneKey: 'general', gatherSeconds: 300 }
  ];

  function targetTypeDef(key) {
    for (var i = 0; i < TARGET_TYPES.length; i++) {
      if (TARGET_TYPES[i].key === key) return TARGET_TYPES[i];
    }
    return TARGET_TYPES[TARGET_TYPES.length - 1];
  }

  function targetTypeLabel(key) { return targetTypeDef(key).label; }

  /** Best guess for targets saved before types existed. */
  function inferTargetType(target) {
    var name = String(target && target.name || '').toLowerCase();
    for (var i = 0; i < TARGET_TYPES.length - 1; i++) {
      var def = TARGET_TYPES[i];
      var word = def.label.toLowerCase().replace('king’s ', '');
      if (name.indexOf(word) !== -1) return def.key;
    }
    if (target && target.zoneKey === 'castle_relic') return 'castle';
    if (target && target.zoneKey === 'turret') return 'turret';
    if (target && target.zoneKey === 'ruins') return 'ruins';
    if (target && target.zoneKey === 'city') return 'city';
    if (target && target.zoneKey === 'hq') return 'hq';
    if (target && target.zoneKey === 'hq_own') return 'hq_own';
    return 'other';
  }

  /**
   * Competing community models (RESEARCH-NOTES 3.1). Both unverified; both
   * selectable so the user can settle the disagreement with real data.
   */
  var MODEL_PRESETS = {
    /**
     * Fitted from marches actually recorded in play, and the shipped default.
     *
     * Two marches at +25% speed, 29.7 and 34.2 tiles, took 34-35 s and 39 s.
     * Solved independently they give 1.316 and 1.309 s/tile — agreement within
     * half a percent, across different distances and different target types.
     * Both published community models predict roughly twice those times.
     *
     * The red-zone figure is the community's own claim that the Forbidden Zone
     * runs 0.360/0.185 = 1.95x slower, applied to this measured base. Their
     * relative claim may hold even though their absolute scale did not, but it
     * is untested — calibrate before trusting a Castle march.
     */
    measured: {
      id: 'measured',
      label: 'Field-measured',
      note: 'Two families measured in one session: monsters from a Terror at 61 tiles and a Beast at 405; player structures from two cities 313 tiles apart, then confirmed against an HQ that was not used in the fit. Castle and Ruins are still only inferred.',
      formulaType: 'affine',
      rates: {
        /**
         * MONSTERS and open map. A Terror at 60.8 tiles took 72 s and a Beast
         * at 404.6 tiles took 356 s, read from the rally screen minutes apart
         * so conditions were fixed. Those two fix this line exactly.
         *
         * These constants are session-specific -- see MEASUREMENTS.md 6d, where
         * one identical march read 684 s on one day and 777 s on another. What
         * is durable is the shape, not these numbers. Set an exact time on a
         * result row to pin any pair you actually care about.
         *
         * Stored at a +25%% baseline because marchSecondsForZone divides by the
         * speed multiplier: 1.0326 / 1.25 = 0.8261, the rate actually observed.
         * The buff during these readings was never verified, so +25%% is an
         * assumption inherited from the earlier set.
         */
        general: { secPerTile: 1.0326, offset: 21.8 },
        turret: { secPerTile: 1.0326, offset: 21.8 },

        /**
         * PLAYER STRUCTURES. Two enemy cities 313 tiles apart -- 89.4 tiles at
         * 213 s and 402.4 tiles at 767 s -- fix this line.
         *
         * It then predicted an enemy HQ at 409.7 tiles as 779.9 s against an
         * actual 777 s, out by 2.9 s, WITHOUT that HQ being used in the fit.
         * That is the only out-of-sample test anywhere in this model, and it is
         * why a city and an HQ share one set of constants here.
         *
         * The 238 s HQ overhead this replaces was an artefact of comparing
         * readings taken in different sessions (MEASUREMENTS.md 6d).
         */
        city: { secPerTile: 2.2131, offset: 54.6 },
        hq: { secPerTile: 2.2131, offset: 54.6 },

        /**
         * REINFORCING your own HQ was not re-measured in this session, so it is
         * left in the fast family and marked a guess. The older evidence put
         * friendly marches near the monster rate: a 14.4 tile reinforcement took
         * 38 s while a Terror at twice the distance took 34.5 s.
         */
        hq_own: { secPerTile: 1.0326, offset: 21.8 },

        // The community's own claim that the Forbidden Zone runs 1.95x slower,
        // applied to the measured open-map rate. Untested.
        castle_relic: { secPerTile: 1.0326 * (0.360 / 0.185), offset: 21.8 },
        ruins: { secPerTile: 1.0326 * (0.360 / 0.185), offset: 21.8 }
      },
      /**
       * What each zone was actually measured over. Anything outside is
       * extrapolation and the app says so — which matters most here, because
       * open map has only ever been measured at about 30 tiles.
       */
      fittedFrom: {
        general: { sampleCount: 2, minDistance: 60.8, maxDistance: 404.6, speedPercents: [25] },
        turret: null,
        city: { sampleCount: 2, minDistance: 89.4, maxDistance: 402.4, speedPercents: [25] },
        hq: { sampleCount: 2, minDistance: 89.4, maxDistance: 402.4, speedPercents: [25] },
        hq_own: null,
        castle_relic: null,
        ruins: null
      }
    },
    coefficient: {
      id: 'coefficient',
      label: 'Coefficient model',
      note: 'kingshotguide.org: round(distance / speed + 3.2), normal 0.360 / red 0.185.',
      rates: {
        general: { secPerTile: 1 / 0.360, offset: 3.2 },
        castle_relic: { secPerTile: 1 / 0.185, offset: 3.2 },
        turret: { secPerTile: 1 / 0.360, offset: 3.2 },
        ruins: { secPerTile: 1 / 0.185, offset: 3.2 },
        city: { secPerTile: 1 / 0.360, offset: 3.2 },
        hq: { secPerTile: 1 / 0.360, offset: 3.2 },
        hq_own: { secPerTile: 1 / 0.360, offset: 3.2 }
      }
    },
    sixSecond: {
      id: 'sixSecond',
      label: 'Six-second model',
      note: 'KingshotPro: roughly 6 seconds per tile at 100% speed, no fixed offset.',
      rates: {
        general: { secPerTile: 6, offset: 0 },
        castle_relic: { secPerTile: 6 * (0.360 / 0.185), offset: 0 },
        turret: { secPerTile: 6, offset: 0 },
        ruins: { secPerTile: 6 * (0.360 / 0.185), offset: 0 },
        city: { secPerTile: 6, offset: 0 },
        hq: { secPerTile: 6, offset: 0 },
        hq_own: { secPerTile: 6, offset: 0 }
      }
    }
  };

  var DEFAULT_PRESET = 'measured';

  /**
   * Confidence a zone's constants carry before any calibration.
   * 'guess' is deliberately harsher than 'unverified' — see RESEARCH-NOTES 5.
   */
  var DEFAULT_TRUST = {
    // Still 'unverified' even under the measured preset: those marches came from
    // one kingdom, and nothing here is your own data until you log a march.
    general: 'unverified',
    castle_relic: 'unverified',
    turret: 'unverified',
    ruins: 'guess',
    city: 'unverified',
    hq: 'unverified',
    hq_own: 'guess'
  };

  /** Default parameters for the optional geometric Relic model. All tunable. */
  function defaultSegmentedConstants(rates) {
    return {
      secPerTile: rates.secPerTile,
      secPerTileInside: MODEL_PRESETS.coefficient.rates.castle_relic.secPerTile,
      offset: rates.offset,
      relicX: 512,
      relicY: 512,
      relicRadius: 20
    };
  }

  /** Build a fresh set of ZoneFormula records from a preset id. */
  function defaultZoneFormulas(presetId) {
    var preset = MODEL_PRESETS[presetId] || MODEL_PRESETS[DEFAULT_PRESET];
    var formulaType = preset.formulaType || 'affine';

    return ZONE_DEFS.map(function (def) {
      var rates = preset.rates[def.key];
      var constants = formulaType === 'power'
        ? { coefficient: rates.coefficient, exponent: rates.exponent }
        : { secPerTile: rates.secPerTile, offset: rates.offset };

      // The geometric Relic model is affine-based, so it needs a per-tile rate
      // even when the zone itself is running on the power curve.
      var segmentedSource = formulaType === 'power'
        ? { secPerTile: MODEL_PRESETS.coefficient.rates[def.key].secPerTile, offset: 3.2 }
        : rates;

      return {
        zoneKey: def.key,
        label: def.label,
        formulaType: formulaType,
        constants: constants,
        segmented: defaultSegmentedConstants(segmentedSource),
        fittedFrom: (preset.fittedFrom && preset.fittedFrom[def.key]) || null,
        presetId: preset.id,
        trust: DEFAULT_TRUST[def.key] || 'unverified',
        lastFitISO: null
      };
    });
  }

  function zoneDef(key) {
    for (var i = 0; i < ZONE_DEFS.length; i++) {
      if (ZONE_DEFS[i].key === key) return ZONE_DEFS[i];
    }
    return null;
  }

  function zoneLabel(key) {
    var def = zoneDef(key);
    return def ? def.label : key;
  }

  /**
   * Which of two zones is slower, used for the multi-zone route decision
   * (RESEARCH-NOTES 5.2: take the worse zone, never sum penalties).
   */
  function slowerZone(zones, a, b) {
    if (!a) return b;
    if (!b) return a;
    var za = findZone(zones, a);
    var zb = findZone(zones, b);
    if (!za) return b;
    if (!zb) return a;
    return za.constants.secPerTile >= zb.constants.secPerTile ? a : b;
  }

  function findZone(zones, key) {
    for (var i = 0; i < zones.length; i++) {
      if (zones[i].zoneKey === key) return zones[i];
    }
    return null;
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.zones = {
    ZONE_DEFS: ZONE_DEFS,
    TARGET_TYPES: TARGET_TYPES,
    targetTypeDef: targetTypeDef,
    targetTypeLabel: targetTypeLabel,
    inferTargetType: inferTargetType,
    MODEL_PRESETS: MODEL_PRESETS,
    DEFAULT_PRESET: DEFAULT_PRESET,
    defaultZoneFormulas: defaultZoneFormulas,
    defaultSegmentedConstants: defaultSegmentedConstants,
    zoneDef: zoneDef,
    zoneLabel: zoneLabel,
    findZone: findZone,
    slowerZone: slowerZone
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
