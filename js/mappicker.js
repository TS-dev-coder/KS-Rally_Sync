/**
 * mappicker.js — tap-a-map coordinate picker.
 *
 * Typing X/Y is error-prone and slow on a phone, and a transposed pair silently
 * produces a plausible-but-wrong march time. This shows the kingdom grid with
 * everything already placed on it, so a bad coordinate is visible rather than
 * hidden in a number field. Numeric inputs stay available for exactness.
 */
;(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var d = root.RallySync.dom;
  var I = root.RallySync.icons;
  var el = d.el;

  /** Kingshot coordinates run 0..1023 with the Castle at the centre. */
  var MAP_MAX = 1024;
  var GRID_STEP = 128;

  var overlay = null;

  /**
   * @param {{x:number|null, y:number|null, title:string, subtitle:string,
   *          markers:Array<{x,y,label,kind}>, onPick:function(x,y)}} options
   */
  function open(options) {
    close();

    var pick = {
      x: isFinite(options.x) && options.x !== null ? Number(options.x) : Math.round(MAP_MAX / 2),
      y: isFinite(options.y) && options.y !== null ? Number(options.y) : Math.round(MAP_MAX / 2)
    };

    var readout = el('span.map-readout', { text: label(pick) });
    var svg = buildSvg(options.markers || [], pick, function (next) {
      pick.x = next.x;
      pick.y = next.y;
      readout.textContent = label(pick);
      inputX.value = String(pick.x);
      inputY.value = String(pick.y);
      movePin(svg, pick);
    });

    var inputX = el('input.input.input-num', {
      type: 'number', inputmode: 'numeric', min: '0', max: String(MAP_MAX - 1),
      value: String(pick.x),
      onchange: function (e) { setFromInput(e.target.value, 'x'); }
    });
    var inputY = el('input.input.input-num', {
      type: 'number', inputmode: 'numeric', min: '0', max: String(MAP_MAX - 1),
      value: String(pick.y),
      onchange: function (e) { setFromInput(e.target.value, 'y'); }
    });

    function setFromInput(value, axis) {
      var n = clamp(Math.round(Number(value)));
      pick[axis] = n;
      readout.textContent = label(pick);
      movePin(svg, pick);
      (axis === 'x' ? inputX : inputY).value = String(n);
    }

    overlay = el('div.map-overlay', {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title || 'Pick coordinates',
      onclick: function (e) { if (e.target === overlay) close(); }
    }, [
      el('div.map-dialog', {}, [
        el('div.map-head', {}, [
          el('div.map-head-main', {}, [
            el('h2.map-title', { text: options.title || 'Pick coordinates' }),
            options.subtitle ? el('p.map-sub', { text: options.subtitle }) : null
          ]),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': 'Close', onclick: close
          }, [I.icon('x', 18)])
        ]),

        el('div.map-canvas', {}, [svg]),

        el('div.map-foot', {}, [
          el('div.map-coords', {}, [
            el('label.map-coord', {}, [el('span', { text: 'X' }), inputX]),
            el('label.map-coord', {}, [el('span', { text: 'Y' }), inputY]),
            readout
          ]),
          el('div.map-actions', {}, [
            el('button.btn.btn-ghost', { type: 'button', onclick: close }, ['Cancel']),
            el('button.btn.btn-primary', {
              type: 'button',
              onclick: function () {
                var chosen = { x: pick.x, y: pick.y };
                close();
                if (options.onPick) options.onPick(chosen.x, chosen.y);
              }
            }, ['Use these coordinates'])
          ])
        ])
      ])
    ]);

    root.document.body.appendChild(overlay);
    root.document.addEventListener('keydown', onKey);
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    root.document.removeEventListener('keydown', onKey);
  }

  function label(pick) { return 'X:' + pick.x + '  Y:' + pick.y; }
  function clamp(n) { return Math.max(0, Math.min(MAP_MAX - 1, isFinite(n) ? n : 0)); }

  // ------------------------------------------------------------------ canvas

  function buildSvg(markers, pick, onMove) {
    var svg = root.document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + MAP_MAX + ' ' + MAP_MAX);
    svg.setAttribute('class', 'map-svg');
    svg.setAttribute('role', 'application');

    svg.appendChild(node('rect', { x: 0, y: 0, width: MAP_MAX, height: MAP_MAX, class: 'map-bg' }));

    for (var g = GRID_STEP; g < MAP_MAX; g += GRID_STEP) {
      svg.appendChild(node('line', { x1: g, y1: 0, x2: g, y2: MAP_MAX, class: 'map-grid' }));
      svg.appendChild(node('line', { x1: 0, y1: g, x2: MAP_MAX, y2: g, class: 'map-grid' }));
    }
    // Centre lines, where the Castle sits.
    var mid = MAP_MAX / 2;
    svg.appendChild(node('line', { x1: mid, y1: 0, x2: mid, y2: MAP_MAX, class: 'map-axis' }));
    svg.appendChild(node('line', { x1: 0, y1: mid, x2: MAP_MAX, y2: mid, class: 'map-axis' }));

    markers.forEach(function (marker) {
      if (!isFinite(marker.x) || !isFinite(marker.y)) return;
      var cls = 'map-marker map-marker-' + (marker.kind || 'target');
      svg.appendChild(node('circle', { cx: marker.x, cy: marker.y, r: 9, class: cls }));
      if (marker.label) {
        svg.appendChild(node('text', {
          x: marker.x, y: marker.y - 16, class: 'map-marker-label', 'text-anchor': 'middle'
        }, marker.label));
      }
    });

    // The pin, drawn last so it is always on top.
    var pinGroup = node('g', { class: 'map-pin' });
    pinGroup.appendChild(node('line', { x1: 0, y1: 0, x2: 0, y2: 0, class: 'map-pin-h' }));
    pinGroup.appendChild(node('line', { x1: 0, y1: 0, x2: 0, y2: 0, class: 'map-pin-v' }));
    pinGroup.appendChild(node('circle', { cx: 0, cy: 0, r: 14, class: 'map-pin-ring' }));
    pinGroup.appendChild(node('circle', { cx: 0, cy: 0, r: 4, class: 'map-pin-dot' }));
    svg.appendChild(pinGroup);

    var dragging = false;

    function pointFromEvent(e) {
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      var source = e.touches && e.touches[0] ? e.touches[0] : e;
      return {
        x: clamp(Math.round(((source.clientX - rect.left) / rect.width) * MAP_MAX)),
        y: clamp(Math.round(((source.clientY - rect.top) / rect.height) * MAP_MAX))
      };
    }

    function handle(e) {
      var point = pointFromEvent(e);
      if (point) onMove(point);
    }

    svg.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (err) {} }
      handle(e);
    });
    svg.addEventListener('pointermove', function (e) { if (dragging) handle(e); });
    svg.addEventListener('pointerup', function () { dragging = false; });
    svg.addEventListener('pointercancel', function () { dragging = false; });

    movePin(svg, pick);
    return svg;
  }

  function movePin(svg, pick) {
    var group = svg.querySelector('.map-pin');
    if (!group) return;
    group.querySelector('.map-pin-h').setAttribute('x1', 0);
    group.querySelector('.map-pin-h').setAttribute('x2', MAP_MAX);
    group.querySelector('.map-pin-h').setAttribute('y1', pick.y);
    group.querySelector('.map-pin-h').setAttribute('y2', pick.y);

    group.querySelector('.map-pin-v').setAttribute('y1', 0);
    group.querySelector('.map-pin-v').setAttribute('y2', MAP_MAX);
    group.querySelector('.map-pin-v').setAttribute('x1', pick.x);
    group.querySelector('.map-pin-v').setAttribute('x2', pick.x);

    group.querySelector('.map-pin-ring').setAttribute('cx', pick.x);
    group.querySelector('.map-pin-ring').setAttribute('cy', pick.y);
    group.querySelector('.map-pin-dot').setAttribute('cx', pick.x);
    group.querySelector('.map-pin-dot').setAttribute('cy', pick.y);
  }

  function node(tag, attrs, text) {
    var element = root.document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      element.setAttribute(key, attrs[key]);
    });
    if (text !== undefined) element.textContent = text;
    return element;
  }

  root.RallySync.mapPicker = { open: open, close: close, MAP_MAX: MAP_MAX };
})(typeof globalThis !== 'undefined' ? globalThis : this);
