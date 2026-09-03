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
      blurb: 'The normal march. Player cities, alliance HQs, outposts, sanctuaries, fortresses, resource nodes \u2014 everything on the open map behaves the same way, so they all share one curve. Measured over 55 marches from three leads across two kingdoms.'
    },
    {
      key: 'monster',
      label: 'Monster (Terror, Beast)',
      blurb: 'The one target that does NOT follow the open-map curve. A rally on a Terror or Beast runs roughly half the time. Inferred from four readings that scatter by about 20 percent, so it is the weakest part of the model.'
    },
    {
      key: 'castle_relic',
      label: 'Castle (Relic)',
      blurb: 'Inside or near the King\u2019s Castle Forbidden Zone, where the Relic slows marches. Never measured.'
    },
    {
      key: 'turret',
      label: 'Turret',
      blurb: 'Path to a turret. Assumed to behave like the open map \u2014 unverified.'
    },
    {
      key: 'ruins',
      label: 'Ruins',
      blurb: 'The Ruins chokepoint. Penalty is a placeholder \u2014 no source quantifies it.'
    },
    {
      key: 'hq_own',
      label: 'Own HQ (reinforce)',
      blurb: 'Reinforcing your own alliance headquarters. Never re-measured since the model changed, so it is assumed to match the open map.'
    }
  ];

  /**
   * The kinds of structure you can rally. A type is a starting point, not a
   * constraint: it seeds the zone model and rally window for a new target, and
   * both stay editable afterwards. You can have as many of a type as you like —
   * three Sanctuaries with your own names for them is the normal case.
   */
  var TARGET_TYPES = [
    { key: 'castle', label: 'King\u2019s Castle', zoneKey: 'castle_relic', gatherSeconds: 300 },
    { key: 'turret', label: 'Turret', zoneKey: 'turret', gatherSeconds: 300 },
    { key: 'sanctuary', label: 'Sanctuary', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'fortress', label: 'Fortress', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'outpost', label: 'Outpost', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'monster', label: 'Terror or Beast', zoneKey: 'monster', gatherSeconds: 180 },
    { key: 'city', label: 'Enemy player city', zoneKey: 'general', gatherSeconds: 300 },
    { key: 'hq', label: 'Enemy HQ', zoneKey: 'general', gatherSeconds: 300 },
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
      note: 'One curve for the open map, fitted to 55 marches from three leads across two kingdoms at +25 and +5 percent, spanning 4 to 726 tiles. Mean error 0.5 percent, worst 2.2 percent. Monsters are the single exception and run about half that time.',
      formulaType: 'piecewise',
      rates: {
        /**
         * THE open-map curve. Cities, alliance HQs, outposts, sanctuaries,
         * fortresses and resource nodes all march identically -- a city and an
         * HQ were confirmed equal out of sample at both 94 and 410 tiles -- so
         * they share one set of constants rather than being split into zones
         * that would only drift apart on no evidence.
         */
        general: { shortJoin: 20, shortRate: 2.4084, shortSeconds: 51.3902, join: 120, nearRate: 1.9517, nearOffset: 12.3559, farRate: 0.29972, farSqrt: 37.7088, joinSeconds: 246.5616, baselineMultiplier: 1.25 },
        turret: { shortJoin: 20, shortRate: 2.4084, shortSeconds: 51.3902, join: 120, nearRate: 1.9517, nearOffset: 12.3559, farRate: 0.29972, farSqrt: 37.7088, joinSeconds: 246.5616, baselineMultiplier: 1.25 },
        hq_own: { shortJoin: 20, shortRate: 2.4084, shortSeconds: 51.3902, join: 120, nearRate: 1.9517, nearOffset: 12.3559, farRate: 0.29972, farSqrt: 37.7088, joinSeconds: 246.5616, baselineMultiplier: 1.25 },

        /**
         * MONSTERS are the exception, at roughly 0.465 of an open-map march.
         * Inferred from four readings whose implied ratio ranges 0.45 to 0.56,
         * which hints that monster type or level matters. Weakest part of the
         * model.
         */
        monster: { shortJoin: 20, shortRate: 1.119906, shortSeconds: 23.896443, join: 120, nearRate: 0.907541, nearOffset: 5.745494, farRate: 0.13937, farSqrt: 17.534592, joinSeconds: 114.651144, baselineMultiplier: 1.25 },

        /** The Forbidden Zone claim applied to the measured curve. Untested. */
        castle_relic: { shortJoin: 20, shortRate: 0.574311, shortSeconds: 12.254586, join: 120, nearRate: 0.465405, nearOffset: 2.946407, farRate: 0.071472, farSqrt: 8.992098, joinSeconds: 58.795458, baselineMultiplier: 1.25 },
        ruins: { shortJoin: 20, shortRate: 0.574311, shortSeconds: 12.254586, join: 120, nearRate: 0.465405, nearOffset: 2.946407, farRate: 0.071472, farSqrt: 8.992098, joinSeconds: 58.795458, baselineMultiplier: 1.25 }
      },
      fittedFrom: {
        general: { sampleCount: 55, minDistance: 4.2, maxDistance: 726.2, speedPercents: [5, 25] },
        turret: null,
        hq_own: null,
        monster: null,
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
        monster: { secPerTile: 1 / 0.360, offset: 3.2 },
        turret: { secPerTile: 1 / 0.360, offset: 3.2 },
        hq_own: { secPerTile: 1 / 0.360, offset: 3.2 },
        castle_relic: { secPerTile: 1 / 0.185, offset: 3.2 },
        ruins: { secPerTile: 1 / 0.185, offset: 3.2 }
      }
    },
    sixSecond: {
      id: 'sixSecond',
      label: 'Six-second model',
      note: 'KingshotPro: roughly 6 seconds per tile at 100% speed, no fixed offset.',
      rates: {
        general: { secPerTile: 6, offset: 0 },
        monster: { secPerTile: 6, offset: 0 },
        turret: { secPerTile: 6, offset: 0 },
        hq_own: { secPerTile: 6, offset: 0 },
        castle_relic: { secPerTile: 6 * (0.360 / 0.185), offset: 0 },
        ruins: { secPerTile: 6 * (0.360 / 0.185), offset: 0 }
      }
    }
  };

  var DEFAULT_PRESET = 'measured';

  /**
   * Confidence a zone's constants carry before any calibration.
   * 'guess' is deliberately harsher than 'unverified' — see RESEARCH-NOTES 5.
   */
  var DEFAULT_TRUST = {
    general: 'unverified',
    monster: 'guess',
    turret: 'unverified',
    hq_own: 'guess',
    castle_relic: 'unverified',
    ruins: 'guess'
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
      var constants;
      if (formulaType === 'power') {
        constants = { coefficient: rates.coefficient, exponent: rates.exponent };
      } else if (formulaType === 'piecewise') {
        // Copied wholesale: a piecewise zone carries six numbers, not two, and
        // silently taking secPerTile/offset here produced NaN march times.
        // Copy every key the preset defines rather than an explicit list: the
        // list silently dropped the short branch when it was added, and a
        // missing constant makes the comparison NaN, which fails quietly by
        // falling through to the next branch.
        constants = {};
        Object.keys(rates).forEach(function (key) { constants[key] = rates[key]; });
      } else {
        constants = { secPerTile: rates.secPerTile, offset: rates.offset };
      }

      // The geometric Relic model is affine-based, so it needs a per-tile rate
      // even when the zone itself is running on the power curve.
      var segmentedSource = (formulaType === 'power' || formulaType === 'piecewise')
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
