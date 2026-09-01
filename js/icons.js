/**
 * icons.js — inline SVG icon set.
 *
 * Text glyphs (◎ ⚔ ⌖) render differently on every platform and several fall
 * back to emoji on Android, which looked unfinished. These are real vectors
 * that inherit currentColor and scale cleanly.
 */
;(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var ICONS = {
    crosshair: [
      'M12 5V2', 'M12 22v-3', 'M5 12H2', 'M22 12h-3',
      'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
      'M13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0'
    ],
    users: [
      'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
      'M22 20v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75'
    ],
    pin: [
      'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0',
      'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'
    ],
    sliders: [
      'M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3',
      'M1 14h6', 'M9 8h6', 'M17 16h6'
    ],
    menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
    clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M12 7v5l3 2'],
    swap: [
      'M17 3l4 4-4 4', 'M21 7H9a4 4 0 0 0-4 4v1',
      'M7 21l-4-4 4-4', 'M3 17h12a4 4 0 0 0 4-4v-1'
    ],
    chevronDown: ['M6 9l6 6 6-6'],
    chevronRight: ['M9 6l6 6-6 6'],
    plus: ['M12 5v14', 'M5 12h14'],
    check: ['M20 6L9 17l-5-5'],
    copy: [
      'M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
      'M4 16a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1'
    ],
    alert: [
      'M12 9v4', 'M12 17h.01',
      'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'
    ],
    help: [
      'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
      'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01'
    ],
    edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
    trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
    bell: [
      'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9',
      'M13.7 21a2 2 0 0 1-3.4 0'
    ],
    share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v14'],
    flag: ['M4 22V4', 'M4 5h13l-2 4 2 4H4'],
    x: ['M18 6L6 18', 'M6 6l12 12']
  };

  /** Builds an <svg> that inherits colour and font size from its parent. */
  function icon(name, size) {
    var svg = root.document.createElementNS(NS, 'svg');
    var px = size || 20;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', px);
    svg.setAttribute('height', px);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('icon');

    (ICONS[name] || []).forEach(function (d) {
      var p = root.document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.icons = { icon: icon, names: Object.keys(ICONS) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
