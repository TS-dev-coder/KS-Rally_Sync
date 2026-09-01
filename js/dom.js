/**
 * dom.js — tiny DOM and formatting helpers shared by the views.
 * Deliberately minimal: no framework, no build step (PRD Section 13).
 */
;(function (root) {
  'use strict';

  var doc = root.document;

  function $(selector, scope) { return (scope || doc).querySelector(selector); }
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  /** el('div.row', {...attrs}, [children]) */
  function el(spec, attrs, children) {
    var parts = spec.split('.');
    var tag = parts.shift() || 'div';
    var node = doc.createElement(tag);
    if (parts.length) node.className = parts.join(' ');

    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'class') node.className = node.className ? node.className + ' ' + value : value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset') {
          Object.keys(value).forEach(function (d) { node.dataset[d] = value[d]; });
        } else if (value === true) {
          node.setAttribute(key, '');
        } else {
          node.setAttribute(key, value);
        }
      });
    }

    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function on(node, event, handler) {
    if (node) node.addEventListener(event, handler);
    return node;
  }

  /**
   * Distance the way the game states it.
   *
   * Checked against the game itself: panning the map shows a bubble reading the
   * distance from your Town Center, and one map tile is exactly one kilometre.
   * At X:547 Y:757 from a TC at 536,740 it reads 20km against a Euclidean 20.25;
   * at X:542 Y:744 it reads 7km against 7.21. The game floors, so this does too,
   * and the app's numbers can be compared with the game's directly.
   */
  function km(tiles) {
    var value = Number(tiles);
    if (!isFinite(value)) return '—';
    return Math.floor(value) + ' km';
  }

  // ------------------------------------------------------------ time display

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** HH:MM:SS in UTC — the canonical form, since the game runs on UTC. */
  function utcClock(ms) {
    var d = new Date(ms);
    return pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }

  /** HH:MM:SS in the viewer's own timezone. */
  function localClock(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function utcDate(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /** Local timezone abbreviation, e.g. "IST" or "GMT+5:30". */
  function localZoneName() {
    try {
      var parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'timeZoneName') return parts[i].value;
      }
    } catch (err) { /* fall through */ }
    var mins = -new Date().getTimezoneOffset();
    var sign = mins < 0 ? '-' : '+';
    mins = Math.abs(mins);
    return 'UTC' + sign + pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60);
  }

  /** Countdown as +/-M:SS, used for the live "time until you go" column. */
  function countdown(seconds) {
    var total = Math.round(seconds);
    var sign = total < 0 ? '-' : '';
    total = Math.abs(total);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return sign + h + ':' + pad2(m) + ':' + pad2(s);
    return sign + m + ':' + pad2(s);
  }

  /**
   * Parses the value of a datetime-local input as UTC wall-clock time.
   * The input has no timezone, and the user is typing the UTC time the game
   * shows them — so it must NOT go through the local-timezone Date parser.
   */
  function parseUtcDateTimeLocal(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ''));
    if (!match) return NaN;
    return Date.UTC(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4]), Number(match[5]), Number(match[6] || 0), 0
    );
  }

  /** Formats epoch ms back into a datetime-local input value, in UTC. */
  function toUtcDateTimeLocal(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) +
      'T' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.dom = {
    $: $, $$: $$, el: el, clear: clear, on: on,
    km: km,
    pad2: pad2,
    utcClock: utcClock,
    localClock: localClock,
    utcDate: utcDate,
    localZoneName: localZoneName,
    countdown: countdown,
    parseUtcDateTimeLocal: parseUtcDateTimeLocal,
    toUtcDateTimeLocal: toUtcDateTimeLocal
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
