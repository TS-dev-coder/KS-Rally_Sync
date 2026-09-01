/**
 * views/targets.js — manage target structures.
 *
 * Targets work like rally leads: add as many as you want, of any type, with
 * your own names. A type ("Sanctuary", "Turret") is only a starting point — it
 * seeds the zone model and rally window, both of which stay editable, so three
 * Sanctuaries with your own names for them is the normal case rather than a
 * fixed list you have to work around.
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
  var el = d.el;
  var icon = I.icon;

  var expanded = {};
  var addingOpen = false;
  var filterType = 'all';

  function render(container) {
    d.clear(container);
    var targets = S.data.targets;

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: 'Targets' }),
        el('p.view-sub', {
          text: targets.length
            ? targets.length + (targets.length === 1 ? ' target saved' : ' targets saved')
            : 'Set your kingdom’s coordinates once. Reused every event.'
        })
      ]),
      el('button.btn.btn-primary', {
        type: 'button',
        onclick: function () { addingOpen = !addingOpen; root.RallySync.app.refresh(); }
      }, [icon('plus', 15), el('span', { text: 'Add target' })])
    ]));

    if (addingOpen) container.appendChild(typePicker());

    var needsCoords = targets.filter(function (t) { return t.x === null || t.y === null; }).length;
    if (needsCoords > 0) {
      container.appendChild(el('div.banner.banner-info', {}, [
        icon('alert', 16),
        el('span', {}, [
          el('strong', { text: needsCoords + ' target' + (needsCoords === 1 ? '' : 's') + ' still need coordinates. ' }),
          'Open one and fill in the X/Y you see in game.'
        ])
      ]));
    }

    if (targets.length === 0) {
      if (!addingOpen) container.appendChild(emptyState());
      return;
    }

    container.appendChild(filterBar());

    var visible = targets.filter(function (t) {
      return filterType === 'all' || t.type === filterType;
    });
    if (visible.length === 0) {
      container.appendChild(el('p.muted', { text: 'No targets of this type yet.' }));
      return;
    }

    var list = el('div.stack');
    visible.forEach(function (target) { list.appendChild(targetCard(target)); });
    container.appendChild(list);
  }

  // -------------------------------------------------------------- add by type

  function typePicker() {
    var panel = el('section.panel.panel-accent');
    panel.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'What are you adding?' }),
      el('button.btn.btn-icon', {
        type: 'button', 'aria-label': 'Close',
        onclick: function () { addingOpen = false; root.RallySync.app.refresh(); }
      }, [icon('x', 16)])
    ]));
    panel.appendChild(el('p.panel-note', {
      text: 'Pick a type to start from. It only sets the zone model and rally window — you can rename it and change both afterwards, and add as many of a type as you need.'
    }));

    var chips = el('div.chips');
    Z.TARGET_TYPES.forEach(function (def) {
      var count = S.data.targets.filter(function (t) { return t.type === def.key; }).length;
      chips.appendChild(el('button.chip', {
        type: 'button',
        title: 'Add a ' + def.label,
        onclick: function () { addOfType(def.key); }
      }, [
        def.label,
        count > 0 ? el('span.chip-count', { text: String(count) }) : null
      ]));
    });
    panel.appendChild(chips);
    return panel;
  }

  function addOfType(typeKey) {
    var target = S.addTargetOfType(typeKey);
    expanded[target.id] = true;
    addingOpen = false;
    filterType = 'all';
    root.RallySync.app.refresh();
  }

  // ----------------------------------------------------------------- filters

  function filterBar() {
    var used = {};
    S.data.targets.forEach(function (t) { used[t.type || 'other'] = true; });
    var kinds = Z.TARGET_TYPES.filter(function (def) { return used[def.key]; });
    if (kinds.length < 2) return el('span');

    var bar = el('div.filter-bar');
    bar.appendChild(filterChip('All', 'all'));
    kinds.forEach(function (def) { bar.appendChild(filterChip(def.label, def.key)); });
    return bar;
  }

  function filterChip(label, key) {
    return el('button.chip.chip-sm' + (filterType === key ? ' is-selected' : ''), {
      type: 'button',
      onclick: function () { filterType = key; root.RallySync.app.refresh(); }
    }, [label]);
  }

  function emptyState() {
    return el('div.empty', {}, [
      icon('pin', 30),
      el('h3', { text: 'No targets yet' }),
      el('p', { text: 'Add whatever your alliance hits — the Castle, turrets, Sanctuaries, Outposts. You can have as many of each as you like, with your own names.' }),
      el('button.btn.btn-primary', {
        type: 'button',
        onclick: function () { addingOpen = true; root.RallySync.app.refresh(); }
      }, ['Add a target'])
    ]);
  }

  // ------------------------------------------------------------------- cards

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
        el('div.card-title', {}, [
          el('span', { text: target.name || 'Unnamed target' }),
          el('span.tag.tag-squad', { text: Z.targetTypeLabel(target.type) })
        ]),
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
      type: 'text', value: target.name, placeholder: 'e.g. North Sanctuary', autocomplete: 'off',
      onchange: function (e) { patch(target, { name: e.target.value }); }
    }), 'Call it whatever your alliance calls it.'));

    var typeSelect = el('select.input', {
      onchange: function (e) { changeType(target, e.target.value); }
    }, Z.TARGET_TYPES.map(function (def) {
      return el('option', { value: def.key, selected: def.key === target.type }, [def.label]);
    }));
    body.appendChild(field('Type', typeSelect,
      'Changing type resets the zone model and rally window to that type’s defaults.'));

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
      el('button.btn.btn-ghost', {
        type: 'button',
        title: 'Add another of this type',
        onclick: function () { addOfType(target.type); }
      }, [icon('plus', 15), el('span', { text: 'Add another' })]),
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

  /** Switching type re-seeds the zone and rally window, but keeps the name. */
  function changeType(target, typeKey) {
    var def = Z.targetTypeDef(typeKey);
    patch(target, { type: def.key, zoneKey: def.zoneKey, gatherSeconds: def.gatherSeconds });
    root.RallySync.app.refresh();
  }

  /** "5 min", "2.5 min", or "none" for a solo march. */
  function formatWindow(seconds) {
    var s = Number(seconds) || 0;
    if (s === 0) return 'none';
    return (Math.round((s / 60) * 10) / 10) + ' min';
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

  /** Merges into the current record — see the note on roster.js patch(). */
  function patch(target, changes) {
    var current = S.findTarget(target.id) || target;
    S.upsertTarget(Object.assign({}, current, changes));
  }

  function valueOf(v) { return v === null || v === undefined ? '' : String(v); }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.targets = { render: render, formatWindow: formatWindow };
})(typeof globalThis !== 'undefined' ? globalThis : this);
