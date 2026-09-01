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
      blurb: 'Normal kingdom map with no known obstruction.'
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
    }
  ];

  /**
   * Competing community models (RESEARCH-NOTES 3.1). Both unverified; both
   * selectable so the user can settle the disagreement with real data.
   */
  var MODEL_PRESETS = {
    coefficient: {
      id: 'coefficient',
      label: 'Coefficient model',
      note: 'kingshotguide.org: round(distance / speed + 3.2), normal 0.360 / red 0.185.',
      rates: {
        general: { secPerTile: 1 / 0.360, offset: 3.2 },
        castle_relic: { secPerTile: 1 / 0.185, offset: 3.2 },
        turret: { secPerTile: 1 / 0.360, offset: 3.2 },
        ruins: { secPerTile: 1 / 0.185, offset: 3.2 }
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
        ruins: { secPerTile: 6 * (0.360 / 0.185), offset: 0 }
      }
    }
  };

  var DEFAULT_PRESET = 'coefficient';

  /**
   * Confidence a zone's constants carry before any calibration.
   * 'guess' is deliberately harsher than 'unverified' — see RESEARCH-NOTES 5.
   */
  var DEFAULT_TRUST = {
    general: 'unverified',
    castle_relic: 'unverified',
    turret: 'unverified',
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
    return ZONE_DEFS.map(function (def) {
      var rates = preset.rates[def.key];
      return {
        zoneKey: def.key,
        label: def.label,
        formulaType: 'affine',
        constants: {
          secPerTile: rates.secPerTile,
          offset: rates.offset
        },
        segmented: defaultSegmentedConstants(rates),
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
