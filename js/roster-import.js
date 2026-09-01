/**
 * roster-import.js — parses a roster pasted out of Discord into rally leads.
 *
 * People paste wildly inconsistent text, so this is deliberately forgiving:
 * it pulls a name, two coordinates and a speed percentage out of a line in
 * whatever order and punctuation they arrived in, and reports per-line what it
 * could not read rather than silently dropping people.
 *
 * Optional tags:  [Alliance]  {Squad}
 */
;(function (root) {
  'use strict';

  var HEADER_RE = /\b(name|player|coord|speed|march)\b/i;
  var COMMENT_RE = /^\s*(#|\/\/)/;

  /**
   * @returns {{rows:Array, okCount:number, errorCount:number}}
   *   row = { raw, name, x, y, speedPercent, alliance, squad, ok, error }
   */
  function parseRoster(text) {
    var lines = String(text || '').split(/\r?\n/);
    var rows = [];
    var okCount = 0;
    var errorCount = 0;

    lines.forEach(function (rawLine, index) {
      var line = rawLine.trim();
      if (line === '' || COMMENT_RE.test(line)) return;

      // A header row only counts as one if it carries no numbers of its own.
      if (index === 0 && HEADER_RE.test(line) && !/\d/.test(line)) return;

      var row = parseLine(line);
      rows.push(row);
      if (row.ok) okCount++; else errorCount++;
    });

    return { rows: rows, okCount: okCount, errorCount: errorCount };
  }

  function parseLine(line) {
    var row = {
      raw: line, name: '', x: null, y: null,
      speedPercent: null, alliance: '', squad: '',
      ok: false, error: null
    };

    var working = line;

    // Pull the optional tags out first so they cannot be mistaken for a name.
    var alliance = working.match(/\[([^\]]{1,24})\]/);
    if (alliance) { row.alliance = alliance[1].trim(); working = working.replace(alliance[0], ' '); }

    var squad = working.match(/\{([^}]{1,24})\}/);
    if (squad) { row.squad = squad[1].trim(); working = working.replace(squad[0], ' '); }

    // An explicit percentage always wins as the speed, wherever it sits.
    var explicitSpeed = working.match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (explicitSpeed) {
      row.speedPercent = parseFloat(explicitSpeed[1]);
      working = working.replace(explicitSpeed[0], ' ');
    }

    // Labelled coordinates beat positional ones.
    var labelledX = working.match(/\bx\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i);
    var labelledY = working.match(/\by\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i);
    if (labelledX && labelledY) {
      row.x = parseFloat(labelledX[1]);
      row.y = parseFloat(labelledY[1]);
      working = working.replace(labelledX[0], ' ').replace(labelledY[0], ' ');
    }

    var numbers = (working.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);

    if (row.x === null && numbers.length >= 2) {
      row.x = numbers.shift();
      row.y = numbers.shift();
    }
    if (row.speedPercent === null && numbers.length >= 1) {
      row.speedPercent = numbers.shift();
    }

    // Whatever text is left, minus separators, is the name.
    row.name = working
      .replace(/-?\d+(?:\.\d+)?/g, ' ')
      .replace(/[|,;:()\[\]{}=]+/g, ' ')
      .replace(/\b(x|y|speed|march|coords?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (row.name === '') row.error = 'No name found.';
    else if (row.x === null || row.y === null) row.error = 'Could not read X and Y.';
    else if (row.speedPercent === null) row.error = 'Could not read a March Speed Up %.';
    else row.ok = true;

    return row;
  }

  /** Example text shown in the paste box so the accepted shapes are obvious. */
  var EXAMPLE = [
    'TS 430 604 62%',
    'Ash, 388, 471, 38',
    'Irfan x:559 y:557 speed:105 [Vanguard]',
    'Cabo (611,498) 74% {Wave 1}'
  ].join('\n');

  root.RallySync = root.RallySync || {};
  root.RallySync.rosterImport = { parseRoster: parseRoster, parseLine: parseLine, EXAMPLE: EXAMPLE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
