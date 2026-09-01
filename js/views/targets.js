/**
 * views/targets.js — manage target structures and the zone model each one uses.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var Z = root.RallySync.zones;
  var G = root.RallySync.guide;
  var el = d.el;

  var expanded = {};

  function render(container) {
    d.clear(container);
    var targets = S.data.targets;

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: 'Targets' }),
        el('p.view-sub', { text: 'Set your kingdom’s coordinates once. Reused every event.' })
      ]),
      el('button.btn.btn-primary', { type: 'button', onclick: addTarget }, ['+ Add'])
    ]));

    var needsCoords = targets.filter(function (t) { return t.x === null || t.y === null; }).length;
    if (needsCoords > 0) {
      container.appendChild(el('div.banner.banner-info', {}, [
        el('strong', { text: needsCoords + ' target' + (needsCoords === 1 ? '' : 's') + ' still need coordinates. ' }),
        'Open one and fill in the X/Y you see in game.'
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
      el('span.chev', { text: isOpen ? '▾' : '▸' })
    ]));

    if (!isOpen) return card;

    var body = el('div.card-body');

    body.appendChild(field('Name', el('input.input', {
      type: 'text', value: target.name, placeholder: 'e.g. North Turret', autocomplete: 'off',
      onchange: function (e) { patch(target, { name: e.target.value }); }
    })));

    body.appendChild(el('div.grid-2', {}, [
      field('X', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(target.x), placeholder: '—',
        onchange: function (e) { patch(target, { x: e.target.value }); }
      })),
      field('Y', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(target.y), placeholder: '—',
        onchange: function (e) { patch(target, { y: e.target.value }); }
      }))
    ]));
    body.appendChild(G.helpBlock('targetCoords'));

    var zoneSelect = el('select.input', {
      onchange: function (e) { patch(target, { zoneKey: e.target.value }); }
    }, Z.ZONE_DEFS.map(function (def) {
      return el('option', {
        value: def.key,
        selected: def.key === target.zoneKey
      }, [def.label]);
    }));
    var activeZone = Z.zoneDef(target.zoneKey);
    body.appendChild(field('Zone model', zoneSelect, activeZone ? activeZone.blurb : null));

    body.appendChild(field(
      'Rally window (seconds)',
      el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(target.gatherSeconds), placeholder: '300',
        onchange: function (e) { patch(target, { gatherSeconds: e.target.value }); }
      }),
      'Castle rallies march at 5:00 (300s) whether or not they filled. Use 0 for a solo march.'
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
      }, ['Delete']),
      el('button.btn.btn-ghost', {
        type: 'button',
        onclick: function () { expanded[target.id] = false; root.RallySync.app.refresh(); }
      }, ['Done'])
    ]));

    card.appendChild(body);
    return card;
  }

  function formatWindow(seconds) {
    var s = Number(seconds) || 0;
    if (s === 0) return 'none';
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + d.pad2(r);
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
  root.RallySync.views.targets = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
