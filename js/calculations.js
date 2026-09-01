/**
 * calculations.js — pure march-time and launch-time math. No DOM, no storage.
 *
 * Accuracy model (RESEARCH-NOTES.md Section 4), highest priority first:
 *   1. MEASURED   — a real observed march time for this exact (lead, target) pair
 *   2. CALIBRATED — zone constants least-squares fitted to real samples
 *   3. ESTIMATED  — unverified research-phase defaults
 *
 * All internal time is UTC epoch milliseconds at full precision. Rounding happens
 * only at the display layer (PRD Section 13).
 */
;(function (root) {
  'use strict';

  var TIER = { MEASURED: 'measured', CALIBRATED: 'calibrated', ESTIMATED: 'estimated' };

  // ---------------------------------------------------------------- geometry

  /** Straight-line Euclidean distance in tiles (RESEARCH-NOTES 2). */
  function distanceTiles(from, to) {
    var dx = Number(to.x) - Number(from.x);
    var dy = Number(to.y) - Number(from.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** A March Speed Up of 45% means troops move 1.45x as fast. */
  function speedMultiplier(percent) {
    return 1 + Number(percent) / 100;
  }

  /**
   * Length of the segment from->to that falls inside a circle.
   * Used by the geometric Relic model so a route only pays the penalty for the
   * tiles it actually spends in the slow area.
   */
  function segmentLengthInsideCircle(from, to, cx, cy, radius) {
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var fx = from.x - cx;
    var fy = from.y - cy;

    var a = dx * dx + dy * dy;
    if (a === 0) {
      // Degenerate: origin and target are the same tile.
      return Math.sqrt(fx * fx + fy * fy) <= radius ? 0 : 0;
    }
    var b = 2 * (fx * dx + fy * dy);
    var c = fx * fx + fy * fy - radius * radius;

    var disc = b * b - 4 * a * c;
    if (disc <= 0) return 0; // misses the circle entirely (or grazes it)

    var sq = Math.sqrt(disc);
    var t1 = (-b - sq) / (2 * a);
    var t2 = (-b + sq) / (2 * a);

    // Clamp to the actual travelled segment.
    t1 = Math.max(0, Math.min(1, t1));
    t2 = Math.max(0, Math.min(1, t2));
    if (t2 <= t1) return 0;

    return (t2 - t1) * Math.sqrt(a);
  }

  // ------------------------------------------------------------------ models

  /** t = secPerTile * distance / speedMultiplier + offset */
  function affineMarchSeconds(distance, multiplier, constants) {
    return (Number(constants.secPerTile) * distance) / multiplier + Number(constants.offset || 0);
  }

  /**
   * Charges tiles inside the Relic radius at the slow rate and the rest at the
   * normal rate. Physically motivated, unlike the undefined "ceiling model"
   * (RESEARCH-NOTES 3.2).
   */
  function segmentedMarchSeconds(from, to, multiplier, constants) {
    var total = distanceTiles(from, to);
    var inside = segmentLengthInsideCircle(
      { x: Number(from.x), y: Number(from.y) },
      { x: Number(to.x), y: Number(to.y) },
      Number(constants.relicX),
      Number(constants.relicY),
      Number(constants.relicRadius)
    );
    var outside = Math.max(0, total - inside);
    return (
      (Number(constants.secPerTile) * outside) / multiplier +
      (Number(constants.secPerTileInside) * inside) / multiplier +
      Number(constants.offset || 0)
    );
  }

  /**
   * March time from a zone formula record.
   * @returns {{seconds:number, distance:number, insideTiles:number}}
   */
  function marchSecondsForZone(zone, from, to, speedPercent) {
    var multiplier = speedMultiplier(speedPercent);
    var distance = distanceTiles(from, to);

    if (zone.formulaType === 'segmented') {
      var c = zone.segmented || {};
      return {
        seconds: segmentedMarchSeconds(from, to, multiplier, c),
        distance: distance,
        insideTiles: segmentLengthInsideCircle(
          { x: Number(from.x), y: Number(from.y) },
          { x: Number(to.x), y: Number(to.y) },
          Number(c.relicX), Number(c.relicY), Number(c.relicRadius)
        )
      };
    }

    return {
      seconds: affineMarchSeconds(distance, multiplier, zone.constants),
      distance: distance,
      insideTiles: 0
    };
  }

  // ------------------------------------------------------------- calibration

  /**
   * Least-squares fit of t = a * (distance / speedMultiplier) + b.
   *
   * With two or more samples that differ in x, both a and b are fitted. With a
   * single sample (or samples all at the same x) there is not enough information
   * to fit an intercept, so b is held at its current value and only a is solved.
   *
   * @returns {{secPerTile:number, offset:number, n:number, rmse:number,
   *            maxErrorSeconds:number, fittedOffset:boolean}|null}
   */
  function fitAffine(samples, currentConstants) {
    var pts = [];
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var mult = speedMultiplier(s.speedPercent);
      var x = Number(s.distance) / mult;
      var y = Number(s.observedTimeSeconds);
      if (isFinite(x) && isFinite(y) && x > 0 && y > 0) pts.push({ x: x, y: y });
    }
    if (pts.length === 0) return null;

    var a, b, fittedOffset = false;
    var meanX = 0, meanY = 0, j;
    for (j = 0; j < pts.length; j++) { meanX += pts[j].x; meanY += pts[j].y; }
    meanX /= pts.length;
    meanY /= pts.length;

    var sxx = 0, sxy = 0;
    for (j = 0; j < pts.length; j++) {
      var dx = pts[j].x - meanX;
      sxx += dx * dx;
      sxy += dx * (pts[j].y - meanY);
    }

    if (pts.length >= 2 && sxx > 1e-9) {
      a = sxy / sxx;
      b = meanY - a * meanX;
      fittedOffset = true;
      // A negative rate is physically impossible; fall back to holding the offset.
      if (a <= 0) {
        b = Number(currentConstants.offset || 0);
        a = (meanY - b) / meanX;
        fittedOffset = false;
      }
    } else {
      b = Number(currentConstants.offset || 0);
      a = (meanY - b) / meanX;
      fittedOffset = false;
    }

    if (!isFinite(a) || a <= 0) return null;

    var sumSq = 0, maxErr = 0;
    for (j = 0; j < pts.length; j++) {
      var err = Math.abs(a * pts[j].x + b - pts[j].y);
      sumSq += err * err;
      if (err > maxErr) maxErr = err;
    }

    return {
      secPerTile: a,
      offset: b,
      n: pts.length,
      rmse: Math.sqrt(sumSq / pts.length),
      maxErrorSeconds: maxErr,
      fittedOffset: fittedOffset
    };
  }

  // ------------------------------------------------------- duration parsing

  /**
   * Parses a human march time: "95", "95s", "1m35s", "1m 35", "1:35", "01:35",
   * "1:02:03", "1h2m3s". Returns seconds, or null if unparseable.
   */
  function parseDuration(input) {
    if (input === null || input === undefined) return null;
    var text = String(input).trim().toLowerCase();
    if (text === '') return null;

    if (/^\d+(\.\d+)?$/.test(text)) return parseFloat(text);

    if (text.indexOf(':') !== -1) {
      var parts = text.split(':');
      if (parts.length > 3) return null;
      var total = 0;
      for (var i = 0; i < parts.length; i++) {
        if (!/^\d+(\.\d+)?$/.test(parts[i].trim())) return null;
        total = total * 60 + parseFloat(parts[i]);
      }
      return total;
    }

    var re = /(\d+(?:\.\d+)?)\s*([hms])/g;
    var seconds = 0;
    var matched = false;
    var m;
    while ((m = re.exec(text)) !== null) {
      matched = true;
      var value = parseFloat(m[1]);
      if (m[2] === 'h') seconds += value * 3600;
      else if (m[2] === 'm') seconds += value * 60;
      else seconds += value;
    }
    // Trailing bare number after a unit, e.g. "1m 35".
    var trailing = text.replace(re, '').trim();
    if (matched && trailing !== '') {
      if (!/^\d+(\.\d+)?$/.test(trailing)) return null;
      seconds += parseFloat(trailing);
    }
    return matched ? seconds : null;
  }

  /** Formats seconds as "1m 35s" / "2h 04m 09s" / "45s". */
  function formatDuration(seconds) {
    var total = Math.round(Math.abs(Number(seconds) || 0));
    var sign = Number(seconds) < 0 ? '-' : '';
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return sign + h + 'h ' + pad2(m) + 'm ' + pad2(s) + 's';
    if (m > 0) return sign + m + 'm ' + pad2(s) + 's';
    return sign + s + 's';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ------------------------------------------------------- march resolution

  function measurementKey(leadId, targetId) { return leadId + '|' + targetId; }

  /**
   * A measurement is only valid while the inputs that produced it are unchanged.
   */
  function measurementIsFresh(measurement, lead, target) {
    if (!measurement) return false;
    return (
      Number(measurement.leadX) === Number(lead.x) &&
      Number(measurement.leadY) === Number(lead.y) &&
      Number(measurement.speedPercent) === Number(lead.marchSpeedUpPercent) &&
      Number(measurement.targetX) === Number(target.x) &&
      Number(measurement.targetY) === Number(target.y)
    );
  }

  /**
   * Resolves one lead's march time through the three-tier priority chain.
   * @returns {{seconds:number|null, tier:string, zoneKeyUsed:string,
   *            distance:number, errors:string[], notes:string[]}}
   */
  function resolveMarchSeconds(options) {
    var lead = options.lead;
    var target = options.target;
    var zones = options.zones;
    var measurement = options.measurement;

    var errors = [];
    var notes = [];

    if (!isFiniteNumber(lead.x) || !isFiniteNumber(lead.y)) {
      errors.push('No city coordinates set.');
    }
    if (!isFiniteNumber(target.x) || !isFiniteNumber(target.y)) {
      errors.push('Target has no coordinates set.');
    }

    var distance = errors.length === 0 ? distanceTiles(lead, target) : NaN;

    // Tier 1: an exact observed time for this pair beats every formula.
    if (measurementIsFresh(measurement, lead, target)) {
      return {
        seconds: Number(measurement.seconds),
        tier: TIER.MEASURED,
        zoneKeyUsed: target.zoneKey,
        distance: distance,
        errors: [],
        notes: notes
      };
    }
    if (measurement && !measurementIsFresh(measurement, lead, target)) {
      notes.push('Saved measurement ignored — coordinates or speed changed since it was recorded.');
    }

    if (!isFiniteNumber(lead.marchSpeedUpPercent)) {
      errors.push('No March Speed Up % set.');
    }

    // The zone is a property of the destination, not of who is marching: the
    // Castle always sits in the Forbidden Zone (RESEARCH-NOTES 5.1).
    var zoneKeyUsed = target.zoneKey;

    var zone = root.RallySync.zones.findZone(zones, zoneKeyUsed);
    if (!zone) errors.push('Unknown zone "' + zoneKeyUsed + '".');

    if (errors.length > 0) {
      return {
        seconds: null, tier: null, zoneKeyUsed: zoneKeyUsed,
        distance: distance, errors: errors, notes: notes
      };
    }

    var result = marchSecondsForZone(zone, lead, target, lead.marchSpeedUpPercent);
    return {
      seconds: result.seconds,
      tier: zone.trust === 'calibrated' ? TIER.CALIBRATED : TIER.ESTIMATED,
      zoneKeyUsed: zoneKeyUsed,
      distance: result.distance,
      errors: [],
      notes: notes
    };
  }

  function isFiniteNumber(value) {
    return value !== null && value !== undefined && value !== '' && isFinite(Number(value));
  }

  // ------------------------------------------------------------ plan builder

  /** launchTime = landingTime - marchTime (PRD Section 10). */
  function calculateLaunchTime(landingTimeUTC, marchTimeSeconds) {
    return new Date(landingTimeUTC.getTime() - marchTimeSeconds * 1000);
  }

  /**
   * Builds the full per-lead timing plan.
   *
   * Timing chain per lead:
   *   landing  = requested landing (plus the stagger slot in sequence mode)
   *   depart   = landing - marchSeconds
   *   rallyOpen= depart  - gatherSeconds   (when to tap the rally button)
   *
   * @returns {{rows:Array, ok:boolean, blockers:string[]}}
   */
  function buildPlan(input) {
    var leads = input.leads || [];
    var target = input.target;
    var zones = input.zones || [];
    var measurements = input.measurements || {};
    var mode = input.mode === 'sequence' ? 'sequence' : 'sync';
    var gapSeconds = Number(input.gapSeconds) || 0;
    var gatherSeconds = Number(input.gatherSeconds) || 0;
    var nowMs = Number(input.nowMs) || 0;
    var landingMs = Number(input.landingMs);

    var blockers = [];
    if (!target) blockers.push('No target selected.');
    if (leads.length === 0) blockers.push('No rally leads selected.');
    if (!isFinite(landingMs)) blockers.push('No landing time set.');
    if (blockers.length > 0) return { rows: [], ok: false, blockers: blockers };

    var rows = leads.map(function (lead, index) {
      var slot = mode === 'sequence' ? index : 0;
      var rowLandingMs = landingMs + slot * gapSeconds * 1000;

      var resolved = resolveMarchSeconds({
        lead: lead,
        target: target,
        zones: zones,
        measurement: measurements[measurementKey(lead.id, target.id)]
      });

      var row = {
        leadId: lead.id,
        name: lead.name,
        targetId: target.id,
        targetName: target.name,
        order: index,
        slot: slot,
        distance: resolved.distance,
        marchSeconds: resolved.seconds,
        tier: resolved.tier,
        zoneKeyUsed: resolved.zoneKeyUsed,
        errors: resolved.errors.slice(),
        notes: resolved.notes.slice(),
        landingMs: rowLandingMs,
        departMs: null,
        rallyOpenMs: null,
        secondsUntilOpen: null,
        tooLate: false
      };

      if (resolved.seconds !== null && resolved.errors.length === 0) {
        row.departMs = rowLandingMs - resolved.seconds * 1000;
        row.rallyOpenMs = row.departMs - gatherSeconds * 1000;
        row.secondsUntilOpen = (row.rallyOpenMs - nowMs) / 1000;
        row.tooLate = nowMs > 0 && row.rallyOpenMs < nowMs;
      }
      return row;
    });

    // Live-use ordering: whoever has to act first appears first (PRD Section 15).
    rows.sort(function (a, b) {
      if (a.rallyOpenMs === null && b.rallyOpenMs === null) return a.order - b.order;
      if (a.rallyOpenMs === null) return 1;
      if (b.rallyOpenMs === null) return -1;
      if (a.rallyOpenMs !== b.rallyOpenMs) return a.rallyOpenMs - b.rallyOpenMs;
      return a.order - b.order;
    });

    var ok = rows.every(function (r) { return r.errors.length === 0; });
    return { rows: rows, ok: ok, blockers: [] };
  }

  /**
   * Earliest landing time achievable if the first rally opens at `startMs`.
   *
   * Each lead's chain is their rally window plus their march. The lead with the
   * longest chain sets the pace: they tap at the start moment, and everyone
   * else taps later so that all the marches converge. In sequence mode a lead
   * landing in slot k gets k gaps of slack, so their chain is discounted by it.
   *
   * @returns {number|null} epoch ms, or null if nothing could be resolved
   */
  function landingFromStart(groups, input) {
    var gap = Number(input.gapSeconds) || 0;
    var sequence = input.mode === 'sequence';
    var measurements = input.measurements || {};
    var longest = null;

    groups.forEach(function (groupItem) {
      var gather = Number(groupItem.target.gatherSeconds) || 0;
      groupItem.leads.forEach(function (lead, index) {
        var resolved = resolveMarchSeconds({
          lead: lead,
          target: groupItem.target,
          zones: input.zones,
          measurement: measurements[measurementKey(lead.id, groupItem.target.id)]
        });
        if (resolved.seconds === null || resolved.errors.length > 0) return;

        var slot = sequence ? index : 0;
        var chain = gather + resolved.seconds - slot * gap;
        if (longest === null || chain > longest) longest = chain;
      });
    });

    if (longest === null) return null;
    return Number(input.startMs) + longest * 1000;
  }

  /**
   * Runs several targets in one plan — e.g. part of the roster on the Castle
   * while the rest take a turret.
   *
   * Each target is planned independently (so a sequence stagger applies within
   * a target's own wave, not across unrelated targets) and the rows are then
   * merged into one launch order.
   *
   * @param {{groups:Array<{target:object, leads:Array}>}} input
   * @returns {{rows:Array, ok:boolean, blockers:string[]}}
   */
  function buildMultiPlan(input) {
    var groups = (input.groups || []).filter(function (g) {
      return g && g.target && g.leads && g.leads.length > 0;
    });

    if (groups.length === 0) {
      return { rows: [], ok: false, blockers: ['No rally leads selected.'], landingMs: null };
    }

    // Anchored to when rallies open: the landing time is whatever the slowest
    // lead can actually achieve from that moment, so a plan is never impossible.
    var landingMs = Number(input.landingMs);
    if (input.startMs !== undefined && input.startMs !== null) {
      var solved = landingFromStart(groups, input);
      // If nobody can be resolved there is no landing to derive, but the rows
      // are still worth building: each one names what it is missing, which is
      // more use than a single generic banner.
      landingMs = solved === null ? Number(input.startMs) : solved;
    }

    var rows = [];
    var blockers = [];
    var ok = true;

    groups.forEach(function (groupItem) {
      var plan = buildPlan({
        leads: groupItem.leads,
        target: groupItem.target,
        zones: input.zones,
        measurements: input.measurements,
        mode: input.mode,
        gapSeconds: input.gapSeconds,
        gatherSeconds: Number(groupItem.target.gatherSeconds) || 0,
        landingMs: landingMs,
        nowMs: input.nowMs
      });

      if (plan.blockers.length > 0) {
        blockers = blockers.concat(plan.blockers);
        ok = false;
        return;
      }
      if (!plan.ok) ok = false;
      rows = rows.concat(plan.rows);
    });

    rows.sort(function (a, b) {
      if (a.rallyOpenMs === null && b.rallyOpenMs === null) return 0;
      if (a.rallyOpenMs === null) return 1;
      if (b.rallyOpenMs === null) return -1;
      return a.rallyOpenMs - b.rallyOpenMs;
    });

    return { rows: rows, ok: ok, blockers: blockers, landingMs: landingMs };
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.calc = {
    TIER: TIER,
    buildMultiPlan: buildMultiPlan,
    landingFromStart: landingFromStart,
    distanceTiles: distanceTiles,
    speedMultiplier: speedMultiplier,
    segmentLengthInsideCircle: segmentLengthInsideCircle,
    affineMarchSeconds: affineMarchSeconds,
    segmentedMarchSeconds: segmentedMarchSeconds,
    marchSecondsForZone: marchSecondsForZone,
    fitAffine: fitAffine,
    parseDuration: parseDuration,
    formatDuration: formatDuration,
    measurementKey: measurementKey,
    measurementIsFresh: measurementIsFresh,
    resolveMarchSeconds: resolveMarchSeconds,
    calculateLaunchTime: calculateLaunchTime,
    buildPlan: buildPlan
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
