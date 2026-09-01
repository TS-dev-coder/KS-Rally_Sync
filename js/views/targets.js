/**
 * views/targets.js — manage target structures and the zone model each uses.
 *
 * The rally window is entered in MINUTES because that is how the game states it
 * (a Castle rally marches at 5:00). It is stored in seconds so the timing math
 * stays in one unit.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var Z = root.RallySync.zones;
  var G = root.RallySync.guide;
  var I = root.RallySync.icons;
  var MP = root.RallySync.mapPicker;
  var el = d.el;
  var icon = I.icon;

  var expanded = {};

  function render(container) {
    d.clear(container);
    var targets = S.data.targets;

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: 'Targets' }),
        el('p.view-sub', { text: 'Set your kingdom’s coordinates once. Reused every event.' })
      ]),
      el('button.btn.btn-primary', { type: 'button', onclick: addTarget }, [
        icon('plus', 15), el('span', { text: 'Add' })
      ])
    ]));

    var needsCoords = targets.filter(function (t) { return t.x === null || t.y === null; }).length;
    if (needsCoords > 0) {
      container.appendChild(el('div.banner.banner-info', {}, [
        icon('alert', 16),
        el('span', {}, [
          el('strong', { text: needsCoords + ' target' + (needsCoords === 1 ? '' : 's') + ' still need coordinates. ' }),
          'Open one and fill in the X/Y you see in game, or pick it on the map.'
        ])
      ]));
    }

    var list = el('div.stack');
    targets.forEach(function (target) { list.appendChild(targetCard(target)); });
    container.appendChild(list);
  }

  function addTarget() {
    var target = S.upsertTarget({ name: '', x: null, y: null, zoneKey: 'general' });
    expanded[target.id] = true;
    root.RallySync.app.refresh();
  }

  function targetCard(target) {
    var isOpen = !!expanded[target.id];
    var missing = target.x === null || target.y === null;

    var card = el('div.card' + (isOpen ? ' is-open' : '') + (missing ? ' is-incomplete' : ''));

    card.appendChild(el('button.card-summary', {
      type: 'button',
      'aria-expanded': isOpen ? 'true' : 'false',
      onclick: function () { expanded[target.id] = !isOpen; root.RallySync.app.refresh(); }
    }, [
      el('div.card-summary-main', {}, [
        el('div.card-title', { text: target.name || 'Unnamed target' }),
        el('div.card-meta', {}, [
          el('span', { text: missing ? 'no coordinates' : 'X:' + target.x + ' Y:' + target.y }),
          el('span.dot', { text: '·' }),
          el('span.tag.tag-zone', { text: Z.zoneLabel(target.zoneKey) }),
          el('span.dot', { text: '·' }),
          el('span', { text: 'rally ' + formatWindow(target.gatherSeconds) })
        ])
      ]),
      missing ? el('span.tag.tag-error', { text: 'set X/Y' }) : null,
      el('span.chev', {}, [icon(isOpen ? 'chevronDown' : 'chevronRight', 14)])
    ]));

    if (!isOpen) return card;

    var body = el('div.card-body');

    body.appendChild(field('Name', el('input.input', {
      type: 'text', value: target.name, placeholder: 'e.g. North Turret', autocomplete: 'off',
      onchange: function (e) { patch(target, { name: e.target.value }); }
    })));

    body.appendChild(el('div.coord-row', {}, [
      el('div.grid-2', {}, [
        field('X', el('input.input', {
          type: 'number', inputmode: 'numeric', value: valueOf(target.x), placeholder: '—',
          onchange: function (e) { patch(target, { x: e.target.value }); }
        })),
        field('Y', el('input.input', {
          type: 'number', inputmode: 'numeric', value: valueOf(target.y), placeholder: '—',
          onchange: function (e) { patch(target, { y: e.target.value }); }
        }))
      ]),
      el('button.btn.btn-secondary.btn-map', {
        type: 'button',
        onclick: function () { openMapFor(target); }
      }, [icon('pin', 15), el('span', { text: 'Pick on map' })])
    ]));
    body.appendChild(G.helpBlock('targetCoords'));

    var zoneSelect = el('select.input', {
      onchange: function (e) { patch(target, { zoneKey: e.target.value }); }
    }, Z.ZONE_DEFS.map(function (def) {
      return el('option', { value: def.key, selected: def.key === target.zoneKey }, [def.label]);
    }));
    var activeZone = Z.zoneDef(target.zoneKey);
    body.appendChild(field('Zone model', zoneSelect, activeZone ? activeZone.blurb : null));

    body.appendChild(field(
      'Rally window (minutes)',
      el('input.input', {
        type: 'number', inputmode: 'decimal', step: '0.5', min: '0',
        value: minutesValue(target.gatherSeconds), placeholder: '5',
        onchange: function (e) {
          var minutes = Number(e.target.value);
          patch(target, { gatherSeconds: isFinite(minutes) ? Math.max(0, minutes) * 60 : 0 });
        }
      }),
      'Castle rallies march at 5 minutes whether or not they filled. Use 0 for a solo march.'
    ));
    body.appendChild(G.helpBlock('rallyWindow'));

    body.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm('Delete ' + (target.name || 'this target') + '?')) {
            delete expanded[target.id];
            S.deleteTarget(target.id);
          }
        }
      }, [icon('trash', 15), el('span', { text: 'Delete' })]),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () { expanded[target.id] = false; root.RallySync.app.refresh(); }
      }, ['Done'])
    ]));

    card.appendChild(body);
    return card;
  }

  function openMapFor(target) {
    MP.open({
      title: 'Where is ' + (target.name || 'this target') + '?',
      subtitle: 'Tap or drag to place it. Other targets and your leads are shown for reference.',
      x: target.x, y: target.y,
      markers: markers(target.id),
      onPick: function (x, y) { patch(target, { x: x, y: y }); }
    });
  }

  function markers(exceptTargetId) {
    var out = [];
    S.data.targets.forEach(function (t) {
      if (t.id !== exceptTargetId && t.x !== null && t.y !== null) {
        out.push({ x: t.x, y: t.y, label: t.name, kind: 'target' });
      }
    });
    S.data.leads.forEach(function (l) {
      if (l.x !== null && l.y !== null) out.push({ x: l.x, y: l.y, label: l.name, kind: 'lead' });
    });
    return out;
  }

  /** "5 min", "2.5 min", or "none" for a solo march. */
  function formatWindow(seconds) {
    var s = Number(seconds) || 0;
    if (s === 0) return 'none';
    var minutes = s / 60;
    return (Math.round(minutes * 10) / 10) + ' min';
  }

  function minutesValue(seconds) {
    var s = Number(seconds) || 0;
    return String(Math.round((s / 60) * 100) / 100);
  }

  function field(label, input, help) {
    return el('label.field', {}, [
      el('span.field-label', { text: label }),
      input,
      help ? el('span.field-help', { text: help }) : null
    ]);
  }

  function patch(target, changes) { S.upsertTarget(Object.assign({}, target, changes)); }
  function valueOf(v) { return v === null || v === undefined ? '' : String(v); }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.targets = { render: render, formatWindow: formatWindow };
})(typeof globalThis !== 'undefined' ? globalThis : this);
