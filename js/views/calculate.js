/**
 * views/calculate.js — the live screen, results-first.
 *
 * Layout is one grid with two regions:
 *   .calc-setup  the mission bar plus the controls behind it
 *   .calc-live   the launch times
 *
 * On a phone the mission bar is a two-line summary and the controls stay
 * collapsed, so launch times start near the top of the screen. From 900px up
 * the grid becomes two columns and the controls are always open in the left
 * pane. Everything recomputes on change — there is no Calculate button.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var C = root.RallySync.calc;
  var Z = root.RallySync.zones;
  var G = root.RallySync.guide;
  var I = root.RallySync.icons;
  var A = root.RallySync.alarm;
  var SH = root.RallySync.share;
  var F = root.RallySync.focus;
  var DO = root.RallySync.dragOrder;
  var TP = root.RallySync.timePicker;
  var KA = root.RallySync.keepAlive;
  var SS = root.RallySync.searchSelect;
  var el = d.el;
  var icon = I.icon;

  var live = [];          // per-row countdown nodes, updated by tick()
  var lastPlan = null;
  var resultsHost = null;
  var nextGoNode = null;
  var controlsOpen = false;
  var savingPreset = false;
  var presetName = '';

  // ---------------------------------------------------------------- rendering

  function render(container) {
    live = [];
    nextGoNode = null;

    var settings = S.data.settings;
    var target = S.findTarget(settings.selectedTargetId) || S.data.targets[0] || null;
    if (target && settings.selectedTargetId !== target.id) settings.selectedTargetId = target.id;

    var setup = el('div.calc-setup', {}, [missionBar(target), controlsPanel(target)]);
    resultsHost = el('div.results-host');

    container.appendChild(el('div.calc', {}, [setup, el('div.calc-live', {}, [resultsHost])]));
    recompute();
  }

  function missionBar(target) {
    var settings = S.data.settings;
    var leadCount = selectedLeads().length;

    return el('button.mission', {
      type: 'button',
      'aria-expanded': controlsOpen ? 'true' : 'false',
      onclick: function () { controlsOpen = !controlsOpen; root.RallySync.app.refresh(); }
    }, [
      el('div.mission-row', {}, [
        el('span.mission-chip', {}, [
          icon('crosshair', 15),
          el('span.mission-chip-text', {
            text: settings.multiTarget ? 'Multi-target' : (target ? (target.name || 'Unnamed') : 'No target')
          })
        ]),
        el('span.mission-chip', {}, [
          icon('swap', 15),
          el('span.mission-chip-text', {
            text: settings.mode === 'sync' ? 'Sync' : settings.gapSeconds + 's gap'
          })
        ]),
        el('span.mission-chip', {}, [
          icon('clock', 15),
          el('span.mission-chip-text.is-mono', { text: d.utcClock(S.startMs()) })
        ])
      ]),
      el('div.mission-row.mission-sub', {}, [
        el('span', { text: leadCount + (leadCount === 1 ? ' lead' : ' leads') }),
        el('span.dot', { text: '·' }),
        nextGoNode = el('span.mission-next', { text: 'no plan yet' }),
        el('span.mission-toggle', {}, [
          el('span.mission-toggle-text', { text: controlsOpen ? 'Hide setup' : 'Setup' }),
          icon(controlsOpen ? 'chevronDown' : 'chevronRight', 14)
        ])
      ])
    ]);
  }

  function controlsPanel(target) {
    var panel = el('div.controls' + (controlsOpen ? ' is-open' : ''));

    var needsSetup = S.data.leads.length === 0 ||
      !S.data.targets.some(function (t) { return t.x !== null && t.y !== null; });
    if (needsSetup) panel.appendChild(quickStart());

    panel.appendChild(presetGroup());
    panel.appendChild(targetGroup(target));
    panel.appendChild(modeGroup());
    panel.appendChild(startGroup(target));
    panel.appendChild(leadGroup());
    return panel;
  }

  function group(title, children, hint) {
    return el('section.group', {}, [
      el('div.group-head', {}, [
        el('h2.group-title', { text: title }),
        hint ? el('span.group-hint', { text: hint }) : null
      ])
    ].concat(children));
  }

  // ----------------------------------------------------------- event presets

  function presetGroup() {
    var presets = S.data.presets;
    var children = [];

    if (presets.length > 0) {
      var chips = el('div.chips');
      presets.forEach(function (preset) {
        chips.appendChild(el('span.preset-chip', {}, [
          el('button.preset-chip-main', {
            type: 'button',
            title: 'Saved ' + new Date(preset.savedISO).toLocaleDateString(),
            onclick: function () {
              S.applyPresetSetup(preset.id);
              root.RallySync.app.refresh();
            }
          }, [preset.name]),
          el('button.preset-chip-x', {
            type: 'button', 'aria-label': 'Delete ' + preset.name,
            onclick: function () {
              if (root.confirm('Delete the setup "' + preset.name + '"?')) S.deletePreset(preset.id);
            }
          }, [icon('x', 12)])
        ]));
      });
      children.push(chips);
    } else {
      children.push(el('p.group-note', {
        text: 'Save the current target, roster and mode as a named setup you can reload next event.'
      }));
    }

    if (savingPreset) {
      children.push(el('div.preset-save', {}, [
        el('input.input', {
          type: 'text', value: presetName, placeholder: 'e.g. Weekly Castle Battle',
          autocomplete: 'off',
          oninput: function (e) { presetName = e.target.value; },
          onkeydown: function (e) { if (e.key === 'Enter') commitPreset(); }
        }),
        el('div.button-row', {}, [
          el('button.btn.btn-ghost', {
            type: 'button',
            onclick: function () { savingPreset = false; root.RallySync.app.refresh(); }
          }, ['Cancel']),
          el('button.btn.btn-primary', { type: 'button', onclick: commitPreset }, ['Save'])
        ])
      ]));
    } else {
      children.push(el('button.btn.btn-secondary.btn-wide', {
        type: 'button',
        onclick: function () { savingPreset = true; presetName = ''; root.RallySync.app.refresh(); }
      }, ['Save current setup']));
    }

    return group('Event setups', children, presets.length ? String(presets.length) : null);
  }

  function commitPreset() {
    S.savePreset(presetName || 'Setup ' + (S.data.presets.length + 1));
    savingPreset = false;
    presetName = '';
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------------ target

  function targetGroup(target) {
    var settings = S.data.settings;

    if (S.data.targets.length === 0) {
      return group('Target', [
        el('div.empty.empty-inline', {}, [
          icon('pin', 26),
          el('h3', { text: 'No targets yet' }),
          el('p', { text: 'Add the Castle, a turret, a Sanctuary — whatever you are hitting.' }),
          el('button.btn.btn-primary', {
            type: 'button', onclick: function () { root.RallySync.app.go('targets'); }
          }, ['Add a target'])
        ])
      ]);
    }

    var needsCoords = S.data.targets.filter(function (t) {
      return t.x === null || t.y === null;
    }).length;

    var picker = SS.create({
      value: target ? target.id : null,
      placeholder: 'Choose a target',
      searchPlaceholder: 'Search your targets…',
      emptyText: 'No target matches that.',
      options: S.data.targets.map(function (t) {
        var incomplete = t.x === null || t.y === null;
        var typeLabel = Z.targetTypeLabel(t.type);
        var name = t.name || 'Unnamed';
        return {
          id: t.id,
          label: name,
          // Don't repeat the type when the name already is it.
          badge: name.toLowerCase() === typeLabel.toLowerCase() ? null : typeLabel,
          sub: incomplete
            ? 'no coordinates set'
            : t.x + ',' + t.y + ' · ' + Z.zoneLabel(t.zoneKey) +
              ' · rally ' + C.formatDuration(t.gatherSeconds),
          warn: incomplete ? 'set X/Y' : null
        };
      }),
      footer: needsCoords > 0
        ? el('div.ss-footer', {}, [
            icon('alert', 14),
            el('span', {
              text: needsCoords + ' of these still need coordinates.'
            }),
            el('button.btn.btn-link', {
              type: 'button', onclick: function () { root.RallySync.app.go('targets'); }
            }, ['Fix'])
          ])
        : null,
      onSelect: function (id) {
        S.updateSettings({ selectedTargetId: id });
        root.RallySync.app.refresh();
      }
    });

    var children = [picker];

    if (target) {
      if (target.x === null || target.y === null) {
        children.push(el('div.banner.banner-error', {}, [
          icon('alert', 16),
          el('span', { text: 'Set this target’s coordinates on the Targets tab before calculating.' })
        ]));
      }
    }

    children.push(el('label.toggle-row', {}, [
      el('input', {
        type: 'checkbox', checked: settings.multiTarget,
        onchange: function (e) {
          S.updateSettings({ multiTarget: e.target.checked });
          root.RallySync.app.refresh();
        }
      }),
      el('span', {}, [
        el('span.toggle-label', { text: 'Split across multiple targets' }),
        el('span.toggle-help', {
          text: 'Send part of the roster somewhere else in the same run — Castle and a turret together. Assign each lead below; the target above stays the default.'
        })
      ])
    ]));

    return group('Target', children, String(S.data.targets.length));
  }

  // -------------------------------------------------------------------- mode

  function modeGroup() {
    var settings = S.data.settings;
    var children = [
      el('div.segmented', {}, [
        segButton('Sync', 'All land together', settings.mode === 'sync', function () {
          S.updateSettings({ mode: 'sync' });
          root.RallySync.app.refresh();
        }),
        segButton('Sequence', 'Staggered, gapless', settings.mode === 'sequence', function () {
          S.updateSettings({ mode: 'sequence' });
          root.RallySync.app.refresh();
        })
      ])
    ];

    if (settings.mode === 'sequence') {
      children.push(el('div.gap-row', {}, [
        el('span.gap-label', { text: 'Gap' }),
        el('div.stepper', {}, [
          el('button.btn.btn-step', { type: 'button', onclick: function () { bumpGap(-1); } }, ['−']),
          el('input.input.input-num', {
            type: 'number', inputmode: 'numeric', min: '0', value: String(settings.gapSeconds),
            onchange: function (e) {
              S.updateSettings({ gapSeconds: Math.max(0, Number(e.target.value) || 0) });
              root.RallySync.app.refresh();
            }
          }),
          el('button.btn.btn-step', { type: 'button', onclick: function () { bumpGap(1); } }, ['+'])
        ]),
        el('span.unit', { text: 'seconds apart' })
      ]));
      children.push(el('p.group-note', {
        text: 'Sanctuary and Fortress pushes are usually staggered 10–15s so the first rally softens the garrison.'
      }));
    }
    return group('Mode', children);
  }

  function bumpGap(delta) {
    S.updateSettings({ gapSeconds: Math.max(0, (Number(S.data.settings.gapSeconds) || 0) + delta) });
    root.RallySync.app.refresh();
  }

  function segButton(label, sub, selected, onclick) {
    return el('button.seg' + (selected ? ' is-selected' : ''), {
      type: 'button', onclick: onclick, 'aria-pressed': selected ? 'true' : 'false'
    }, [
      el('span.seg-label', { text: label }),
      el('span.seg-sub', { text: sub })
    ]);
  }

  // ------------------------------------------------------------ landing time

  function startGroup(target) {
    var children = [];

    children.push(el('p.group-note', {
      text: 'Set when rallies open. The slowest lead taps then, everyone else follows, and the app works out when it all lands.'
    }));

    children.push(el('div.anchor-row', {}, [
      el('div.anchor-main', {}, [
        el('span.anchor-label', {}, [el('span', { text: 'START RALLIES AT' })]),
        el('button.anchor-value', {
          type: 'button',
          title: 'Set when rallies open',
          onclick: openStartPicker
        }, [
          el('span.anchor-time', { text: d.utcClock(S.startMs()) }),
          el('span.anchor-zone', { text: 'UTC' })
        ]),
        el('span.anchor-hint', { text: 'when the first person taps their rally button' })
      ]),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button',
        title: 'Open rallies right now',
        onclick: function () {
          S.updateSettings({ startMs: S.now() });
          root.RallySync.app.refresh();
        }
      }, ['Now'])
    ]));

    children.push(el('div.quick-row', {}, [1, 5, 10, 15, 30].map(function (mins) {
      return el('button.btn.btn-quick', {
        type: 'button',
        onclick: function () {
          S.updateSettings({ startMs: S.now() + mins * 60000 });
          root.RallySync.app.refresh();
        }
      }, ['in ' + mins + 'm']);
    })));

    if (!S.startIsExplicit()) {
      children.push(el('p.group-note', {
        text: 'No start set, so rallies are treated as opening now.'
      }));
    }

    // The landing time is a result, not an input.
    var landing = lastPlan && lastPlan.plan ? lastPlan.plan.landingMs : null;
    children.push(el('div.lands-row', {}, [
      el('span.anchor-label', {}, [
        el('span.anchor-op', { text: '=' }),
        el('span', { text: 'TROOPS LAND AT' })
      ]),
      landing
        ? el('span.lands-value', { text: d.utcClock(landing) })
        : el('span.lands-value.is-empty', { text: '--:--:--' }),
      el('span.lands-zone', { text: 'UTC' }),
      landing
        ? el('span.lands-local', {
            text: d.localClock(landing) + ' ' + d.localZoneName() + ' · ' + d.utcDate(landing)
          })
        : el('span.lands-local', { text: 'pick a target and some leads' }),
      el('span.anchor-hint', {
        text: landing
          ? 'as early as the slowest lead can make it'
          : 'worked out from the slowest march once a plan exists'
      })
    ]));

    if (target && Number(target.gatherSeconds) > 0) {
      children.push(el('p.group-note.group-note-accent', {
        text: 'The ' + C.formatDuration(target.gatherSeconds) +
          ' rally window is already included — times below are when to TAP the rally button.'
      }));
    }

    children.push(G.helpBlock('startTime'));
    return group('Timing', children, 'UTC');
  }

  function openStartPicker() {
    TP.open({
      title: 'Start rallies at',
      valueMs: S.startMs(),
      nowMs: S.now,
      onPick: function (ms) {
        S.updateSettings({ startMs: ms });
        root.RallySync.app.refresh();
      }
    });
  }

  // ------------------------------------------------------------------- leads

  function selectedLeads() {
    return S.data.settings.selectedLeadIds
      .map(function (id) { return S.findLead(id); })
      .filter(Boolean);
  }

  function leadGroup() {
    var settings = S.data.settings;
    var selected = selectedLeads();
    var selectedIds = selected.map(function (l) { return l.id; });

    if (S.data.leads.length === 0) {
      return group('Who is marching', [
        el('p.muted', { text: 'No rally leads yet — add them on the Leads tab.' })
      ]);
    }

    var children = [
      el('div.select-actions', {}, [
        el('button.btn.btn-link', {
          type: 'button',
          onclick: function () {
            S.updateSettings({ selectedLeadIds: S.data.leads.map(function (l) { return l.id; }) });
            root.RallySync.app.refresh();
          }
        }, ['Select all']),
        el('button.btn.btn-link', {
          type: 'button',
          onclick: function () {
            S.updateSettings({ selectedLeadIds: [] });
            root.RallySync.app.refresh();
          }
        }, ['Clear'])
      ])
    ];

    // Add a whole alliance or squad in one tap.
    var quickGroups = [];
    S.alliances().forEach(function (name) { quickGroups.push({ field: 'alliance', name: name, wrap: ['[', ']'] }); });
    S.squads().forEach(function (name) { quickGroups.push({ field: 'squad', name: name, wrap: ['{', '}'] }); });

    if (quickGroups.length > 0) {
      var quick = el('div.chips.chips-quick');
      quickGroups.forEach(function (g) {
        var members = S.data.leads.filter(function (l) { return String(l[g.field] || '') === g.name; });
        var allIn = members.every(function (l) { return selectedIds.indexOf(l.id) !== -1; });
        quick.appendChild(el('button.chip.chip-sm' + (allIn ? ' is-selected' : ''), {
          type: 'button',
          title: (allIn ? 'Remove' : 'Add') + ' all ' + members.length + ' in ' + g.name,
          onclick: function () { toggleGroupSelection(members, allIn); }
        }, [
          g.wrap[0] + g.name + g.wrap[1],
          el('span.chip-count', { text: String(members.length) })
        ]));
      });
      children.push(quick);
    }

    var chips = el('div.chips');
    S.data.leads.forEach(function (lead) {
      var isSelected = selectedIds.indexOf(lead.id) !== -1;
      // Shown in the chip rather than a tooltip: there is no hover on a phone,
      // which is exactly where checking a coordinate matters most.
      var missing = lead.x === null || lead.y === null;
      var detail = missing
        ? 'no coordinates'
        : lead.x + ',' + lead.y +
          (lead.marchSpeedUpPercent === null ? ' · no speed' : ' · +' + lead.marchSpeedUpPercent + '%');

      chips.appendChild(el('button.chip.chip-stacked' +
        (isSelected ? ' is-selected' : '') + (missing ? ' is-incomplete' : ''), {
        type: 'button',
        onclick: function () { toggleLead(lead.id); }
      }, [
        isSelected ? icon('check', 13) : null,
        el('span.chip-main', {}, [
          el('span.chip-name', { text: lead.name || 'Unnamed' }),
          el('span.chip-sub', { text: detail })
        ])
      ]));
    });
    children.push(chips);

    // Per-lead target assignment, only when splitting across targets.
    if (settings.multiTarget && selected.length > 0) {
      var assignList = el('div.assign-list');
      selected.forEach(function (lead) {
        var assigned = S.targetForLead(lead.id);
        assignList.appendChild(el('label.assign-row', {}, [
          el('span.assign-name', { text: lead.name || 'Unnamed' }),
          el('select.input.assign-select', {
            onchange: function (e) {
              var next = Object.assign({}, S.data.settings.assignments);
              if (e.target.value) next[lead.id] = e.target.value;
              else delete next[lead.id];
              S.updateSettings({ assignments: next });
              root.RallySync.app.refresh();
            }
          }, targetOptionsGrouped(assigned))
        ]));
      });
      children.push(el('p.group-note', { text: 'Each lead marches on:' }));
      children.push(assignList);
    }

    if (settings.mode === 'sequence' && selected.length > 1) {
      var orderList = el('ol.order-list');
      selected.forEach(function (lead, index) {
        orderList.appendChild(el('li.order-item', { dataset: { index: String(index) } }, [
          el('span.drag-handle', {
            'aria-hidden': 'true', title: 'Drag to reorder'
          }, [icon('menu', 14)]),
          el('span.order-rank', { text: String(index + 1) }),
          el('span.order-name', { text: lead.name || 'Unnamed' }),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': 'Move ' + (lead.name || 'lead') + ' earlier',
            disabled: index === 0,
            onclick: function () { moveLead(index, -1); }
          }, ['↑']),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': 'Move ' + (lead.name || 'lead') + ' later',
            disabled: index === selected.length - 1,
            onclick: function () { moveLead(index, 1); }
          }, ['↓'])
        ]));
      });

      // Drag from the handle; the arrows stay for keyboard and precision.
      DO.enable(orderList, {
        handleSelector: '.drag-handle',
        onReorder: reorderLead
      });

      children.push(el('p.group-note', { text: 'Lands in this order — drag the handle or use the arrows.' }));
      children.push(orderList);
    }

    return group('Who is marching', children, selected.length + '/' + S.data.leads.length);
  }

  /** Targets as <optgroup>s by type, so a long list stays navigable. */
  function targetOptionsGrouped(assigned) {
    var groups = [];
    Z.TARGET_TYPES.forEach(function (def) {
      var members = S.data.targets.filter(function (t) { return (t.type || 'other') === def.key; });
      if (members.length === 0) return;
      groups.push(el('optgroup', { label: def.label }, members.map(function (t) {
        return el('option', {
          value: t.id, selected: assigned && t.id === assigned.id
        }, [t.name || 'Unnamed']);
      })));
    });
    return groups;
  }

  function toggleGroupSelection(members, allIn) {
    var ids = S.data.settings.selectedLeadIds.slice();
    members.forEach(function (lead) {
      var at = ids.indexOf(lead.id);
      if (allIn && at !== -1) ids.splice(at, 1);
      else if (!allIn && at === -1) ids.push(lead.id);
    });
    S.updateSettings({ selectedLeadIds: ids });
    root.RallySync.app.refresh();
  }

  function toggleLead(id) {
    var ids = S.data.settings.selectedLeadIds.slice();
    var index = ids.indexOf(id);
    if (index === -1) ids.push(id); else ids.splice(index, 1);
    S.updateSettings({ selectedLeadIds: ids });
    root.RallySync.app.refresh();
  }

  /** Moves one lead from a position to another, used by drag release. */
  function reorderLead(fromIndex, toIndex) {
    var ids = S.data.settings.selectedLeadIds.slice();
    if (fromIndex < 0 || fromIndex >= ids.length) return;
    var moved = ids.splice(fromIndex, 1)[0];
    ids.splice(Math.max(0, Math.min(ids.length, toIndex)), 0, moved);
    S.updateSettings({ selectedLeadIds: ids });
    root.RallySync.app.refresh();
  }

  function moveLead(index, delta) {
    var ids = S.data.settings.selectedLeadIds.slice();
    var next = index + delta;
    if (next < 0 || next >= ids.length) return;
    var tmp = ids[index]; ids[index] = ids[next]; ids[next] = tmp;
    S.updateSettings({ selectedLeadIds: ids });
    root.RallySync.app.refresh();
  }

  // -------------------------------------------------------------- quickstart

  function quickStart() {
    var haveLeads = S.data.leads.length > 0;
    var haveCoords = S.data.targets.some(function (t) { return t.x !== null && t.y !== null; });

    return el('section.group.quickstart', {}, [
      el('div.group-head', {}, [el('h2.group-title', { text: 'Set up once, reuse every event' })]),
      el('ol.steps', {}, [
        stepRow(1, 'Add your rally leads', 'Name, city X/Y, March Speed Up %. You can paste a whole list.', haveLeads, 'roster'),
        stepRow(2, 'Set target coordinates', 'Castle, turrets, Sanctuary, Outpost — whatever you hit.', haveCoords, 'targets'),
        stepRow(3, 'Log a real march', 'Optional. Makes that lead exact instead of estimated.', false, 'calibrate')
      ]),
      G.guideCard('marchSpeed'),
      G.guideCard('targetCoords')
    ]);
  }

  function stepRow(number, title, body, done, tab) {
    return el('li.step' + (done ? ' is-done' : ''), {}, [
      el('span.step-num', {}, [done ? icon('check', 14) : el('span', { text: String(number) })]),
      el('div.step-main', {}, [
        el('div.step-title', { text: title }),
        el('div.step-body', { text: body })
      ]),
      el('button.btn.btn-secondary.btn-sm', {
        type: 'button', onclick: function () { root.RallySync.app.go(tab); }
      }, [done ? 'Edit' : 'Open'])
    ]);
  }

  // -------------------------------------------------------------- calculation

  /** One planning group per target, so a stagger applies within a wave. */
  function planGroups(leads, primary) {
    if (!S.data.settings.multiTarget) return [{ target: primary, leads: leads }];

    var byTarget = {};
    var order = [];
    leads.forEach(function (lead) {
      var target = S.targetForLead(lead.id) || primary;
      if (!target) return;
      if (!byTarget[target.id]) { byTarget[target.id] = { target: target, leads: [] }; order.push(target.id); }
      byTarget[target.id].leads.push(lead);
    });
    return order.map(function (id) { return byTarget[id]; });
  }

  function recompute() {
    if (!resultsHost) return;
    live = [];
    A.reset();
    d.clear(resultsHost);

    var settings = S.data.settings;
    var primary = S.findTarget(settings.selectedTargetId);
    var leads = selectedLeads();

    if (!primary || leads.length === 0) {
      lastPlan = null;
      resultsHost.appendChild(el('div.empty.empty-live', {}, [
        icon('crosshair', 30),
        el('h3', { text: !primary ? 'Pick a target' : 'Select who is marching' }),
        el('p', {
          text: !primary
            ? 'Open Setup and choose what you are hitting.'
            : 'Open Setup and tap the leads joining this hit.'
        })
      ]));
      return;
    }

    var plan = C.buildMultiPlan({
      groups: planGroups(leads, primary),
      zones: S.data.zones,
      measurements: S.data.measurements,
      mode: settings.mode,
      gapSeconds: settings.gapSeconds,
      startMs: S.startMs(),
      nowMs: S.now()
    });
    lastPlan = { plan: plan, primary: primary };

    if (plan.blockers.length > 0) {
      plan.blockers.forEach(function (message) {
        resultsHost.appendChild(el('div.banner.banner-error', {}, [
          icon('alert', 16), el('span', { text: message })
        ]));
      });
      return;
    }

    refreshLandingReadout(plan.landingMs);
    resultsHost.appendChild(resultsHeader(plan));

    groupRows(plan.rows).forEach(function (section) {
      if (section.label) resultsHost.appendChild(sectionHeader(section));
      var list = el('div.results');
      section.rows.forEach(function (row, index) {
        list.appendChild(resultRow(row, section.startIndex + index));
      });
      resultsHost.appendChild(list);
    });

    resultsHost.appendChild(G.helpBlock('timingChain'));

    var caveat = modelCaveat(plan.rows);
    if (caveat) {
      resultsHost.appendChild(el('div.banner.banner-warn', {}, [
        icon('alert', 16), el('span', { text: caveat })
      ]));
    }

    resultsHost.appendChild(el('p.disclaimer', {}, [
      el('strong', { text: 'Estimates, not guarantees. ' }),
      'Rows marked ', el('span.badge.badge-measured', { text: 'measured' }),
      ' come from a real march you logged and are exact. Everything else should carry a ',
      el('strong', { text: (settings.safetyBufferSeconds || 2) + 's buffer' }),
      ' — the in-game countdown is the final word.'
    ]));

    tick(S.now());
    updateKeepAlive();
  }

  /**
   * Hold the tab open only while there is genuinely something still to launch,
   * so the silent keep-alive track and the screen lock are not burning battery
   * once the operation is over.
   */
  function updateKeepAlive() {
    var wanted = S.data.settings.keepAwake !== false && live.some(function (item) {
      return item.rallyOpenMs > S.now();
    });
    if (wanted) KA.start(); else KA.stop();
  }

  /**
   * The landing time is a result of the plan, but its readout lives up in the
   * controls, which render first. Patch it in place rather than re-rendering
   * the whole screen and looping.
   */
  function refreshLandingReadout(landingMs) {
    var host = root.document.querySelector('.lands-row');
    if (!host || !landingMs) return;
    var value = host.querySelector('.lands-value');
    var local = host.querySelector('.lands-local');
    var hint = host.querySelector('.anchor-hint');
    if (value) { value.textContent = d.utcClock(landingMs); value.classList.remove('is-empty'); }
    if (local) {
      local.textContent = d.localClock(landingMs) + ' ' + d.localZoneName() +
        ' · ' + d.utcDate(landingMs);
    }
    if (hint) hint.textContent = 'as early as the slowest lead can make it';
  }

  /**
   * The shipped curve was fitted from a handful of real marches, all at one
   * speed. Rows outside that range are extrapolation, and saying so is more
   * use than a confident wrong number.
   */
  function modelCaveat(rows) {
    var zone = S.findZone(S.data.settings.selectedTargetId
      ? (S.findTarget(S.data.settings.selectedTargetId) || {}).zoneKey
      : 'general');
    if (!zone || !zone.fittedFrom || zone.trust === 'calibrated') return null;

    var range = zone.fittedFrom;
    var speeds = {};
    var beyond = 0;

    rows.forEach(function (row) {
      if (row.errors.length > 0) return;
      var lead = S.findLead(row.leadId);
      if (lead && lead.marchSpeedUpPercent !== null) speeds[lead.marchSpeedUpPercent] = true;
      if (row.distance > range.maxDistance * 1.25 || row.distance < range.minDistance * 0.5) beyond++;
    });

    var offSpeed = Object.keys(speeds).filter(function (value) {
      return range.speedPercents.indexOf(Number(value)) === -1;
    }).length;

    var notes = [];
    if (offSpeed > 0) {
      notes.push(offSpeed + (offSpeed === 1 ? ' lead marches' : ' leads march') +
        ' at a speed the model has never been measured at (it was fitted only at +' +
        range.speedPercents.join('/+') + '%)');
    }
    if (beyond > 0) {
      notes.push(beyond + (beyond === 1 ? ' march is' : ' marches are') +
        ' outside the ' + Math.round(range.minDistance) + '–' +
        Math.round(range.maxDistance) + ' tile range it was fitted over');
    }
    if (notes.length === 0) return null;

    return 'Extrapolating: ' + notes.join(', ') +
      '. Log a real march for those and they become exact.';
  }

  // ------------------------------------------------------------- row grouping

  function groupRows(rows) {
    var groupBy = S.data.settings.groupBy;
    if (groupBy === 'none') return [{ key: '', label: null, rows: rows, startIndex: 0 }];

    var buckets = {};
    var order = [];
    rows.forEach(function (row) {
      var key = groupKeyFor(row, groupBy);
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push(row);
    });

    var startIndex = 0;
    return order.map(function (key) {
      var section = {
        key: key,
        label: key || 'Ungrouped',
        rows: buckets[key],
        startIndex: startIndex
      };
      startIndex += buckets[key].length;
      return section;
    });
  }

  function groupKeyFor(row, groupBy) {
    if (groupBy === 'target') return row.targetName || 'Unnamed target';
    var lead = S.findLead(row.leadId);
    if (!lead) return '';
    return String(lead[groupBy] || '');
  }

  function sectionHeader(section) {
    var totals = totalsFor(section.rows);
    return el('div.section-head', {}, [
      el('span.section-label', { text: section.label }),
      el('span.section-count', { text: section.rows.length + (section.rows.length === 1 ? ' rally' : ' rallies') }),
      totals.power ? el('span.section-total', { text: compact(totals.power) + ' power' }) : null,
      totals.capacity ? el('span.section-total', { text: compact(totals.capacity) + ' troops' }) : null
    ]);
  }

  function totalsFor(rows) {
    var power = 0;
    var capacity = 0;
    rows.forEach(function (row) {
      var lead = S.findLead(row.leadId);
      if (!lead) return;
      power += Number(lead.power) || 0;
      capacity += Number(lead.rallyCapacity) || 0;
    });
    return { power: power, capacity: capacity };
  }

  function compact(n) {
    var value = Number(n) || 0;
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return String(value);
  }

  // ----------------------------------------------------------------- header

  function resultsHeader(plan) {
    var settings = S.data.settings;
    var landing = plan.landingMs;
    var problems = plan.rows.filter(function (r) { return r.errors.length > 0; }).length;
    var late = plan.rows.filter(function (r) { return r.tooLate; }).length;
    var totals = totalsFor(plan.rows);

    var alarmOn = settings.alarmEnabled !== false;
    var alarmBtn = el('button.btn.btn-secondary.btn-copy' + (alarmOn ? ' is-armed' : ''), {
      type: 'button',
      title: alarmOn
        ? 'Sound and vibration before each launch — tap to turn off'
        : 'Turn on sound and vibration before each launch',
      onclick: function () {
        var next = !alarmOn;
        S.updateSettings({ alarmEnabled: next });
        if (next && A.prime()) A.beep(880, 0.07);
        root.RallySync.app.refresh();
      }
    }, [icon('bell', 15), el('span', { text: alarmOn ? 'Alarm on' : 'Alarm off' })]);

    return el('div.results-head', {}, [
      el('div.results-head-main', {}, [
        el('h2.results-title', { text: 'Launch order' }),
        el('p.results-sub', {
          text: (settings.mode === 'sync'
            ? 'All ' + plan.rows.length + ' land ' + d.utcClock(landing) + ' UTC'
            : plan.rows.length + ' landings ' + settings.gapSeconds + 's apart from ' + d.utcClock(landing) + ' UTC') +
            (totals.power ? ' · ' + compact(totals.power) + ' power' : '')
        })
      ]),
      problems > 0 ? el('span.tag.tag-error', { text: problems + ' blocked' }) : null,
      late > 0 ? el('span.tag.tag-warn', { text: late + ' too late' }) : null,
      groupBySelect(),
      alarmBtn,
      el('button.btn.btn-secondary.btn-copy', {
        type: 'button', onclick: function (e) { copyPlan(e.currentTarget); }
      }, [icon('copy', 15), el('span', { text: 'Copy' })])
    ]);
  }

  function groupBySelect() {
    var options = [
      ['none', 'No grouping'], ['alliance', 'By alliance'],
      ['squad', 'By squad'], ['target', 'By target']
    ];
    return el('select.input.group-select', {
      'aria-label': 'Group results by',
      onchange: function (e) {
        S.updateSettings({ groupBy: e.target.value });
        root.RallySync.app.refresh();
      }
    }, options.map(function (pair) {
      return el('option', {
        value: pair[0], selected: S.data.settings.groupBy === pair[0]
      }, [pair[1]]);
    }));
  }

  // -------------------------------------------------------------------- rows

  function resultRow(row, index) {
    var hasError = row.errors.length > 0;
    var node = el('div.result' + (hasError ? ' is-error' : ''));
    var lead = S.findLead(row.leadId);

    node.appendChild(el('div.result-head', {}, [
      el('span.result-rank', { text: String(index + 1) }),
      el('span.result-name', { text: row.name || 'Unnamed' }),
      lead && lead.alliance ? el('span.tag.tag-zone', { text: lead.alliance }) : null,
      tierBadge(row.tier, hasError)
    ]));

    if (hasError) {
      node.appendChild(el('div.result-errors', {}, row.errors.map(function (message) {
        return el('div.result-error', {}, [icon('alert', 14), el('span', { text: message })]);
      })));
      return node;
    }

    var target = S.findTarget(row.targetId);
    var gathering = target && Number(target.gatherSeconds) > 0;
    var countdownNode = el('span.count-value', { text: '—' });
    var countdownPill = el('div.countdown', {}, [
      countdownNode,
      el('span.count-label', { text: 'until you go' })
    ]);

    node.appendChild(el('div.result-body', {}, [
      el('div.result-time', {}, [
        el('span.result-time-label', { text: gathering ? 'TAP RALLY AT' : 'MARCH AT' }),
        el('div.result-time-main', {}, [
          el('span.result-time-value', { text: d.utcClock(row.rallyOpenMs) }),
          el('span.result-time-zone', { text: 'UTC' })
        ]),
        el('div.result-time-local', { text: d.localClock(row.rallyOpenMs) + ' ' + d.localZoneName() })
      ]),
      countdownPill
    ]));

    node.appendChild(el('div.result-facts', {}, [
      S.data.settings.multiTarget ? fact('on', row.targetName || '—') : null,
      fact('march', C.formatDuration(row.marchSeconds)),
      gathering ? fact('departs', d.utcClock(row.departMs)) : null,
      fact('lands', d.utcClock(row.landingMs)),
      // The inputs behind the number, so a mistyped coordinate or speed is
      // visible here rather than only on the Leads tab.
      lead && lead.x !== null && lead.y !== null
        ? fact('from', 'X:' + lead.x + ' Y:' + lead.y) : null,
      target && target.x !== null && target.y !== null
        ? fact('to', 'X:' + target.x + ' Y:' + target.y) : null,
      fact('dist', row.distance.toFixed(1) + ' tiles'),
      lead && lead.marchSpeedUpPercent !== null
        ? fact('speed', '+' + lead.marchSpeedUpPercent + '%') : null,
      lead && lead.power ? fact('power', compact(lead.power)) : null
    ]));

    row.notes.forEach(function (note) {
      node.appendChild(el('div.result-note', {}, [icon('alert', 14), el('span', { text: note })]));
    });

    var slot = slotFor(row, target);
    node.appendChild(el('div.result-actions', {}, [
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button', onclick: function () { F.open(slot, S.now); }
      }, [icon('crosshair', 14), el('span', { text: 'Focus' })]),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button', onclick: function (e) { shareSlot(slot, e.currentTarget); }
      }, [icon('share', 14), el('span', { text: 'Share link' })])
    ]));

    live.push({
      node: node, countdownNode: countdownNode, pill: countdownPill,
      rallyOpenMs: row.rallyOpenMs, leadId: row.leadId, name: row.name || 'Rally'
    });
    return node;
  }

  function slotFor(row, target) {
    return {
      name: row.name,
      targetName: row.targetName,
      rallyOpenMs: row.rallyOpenMs,
      departMs: row.departMs,
      landingMs: row.landingMs,
      marchSeconds: row.marchSeconds,
      gatherSeconds: target ? Number(target.gatherSeconds) || 0 : 0,
      tier: row.tier
    };
  }

  function shareSlot(slot, button) {
    var url = SH.slotUrl(slot);
    var label = button.querySelector('span');
    var original = label.textContent;
    writeClipboard(url).then(function (ok) {
      label.textContent = ok ? 'Link copied' : 'Copy failed';
      root.setTimeout(function () { label.textContent = original; }, 1800);
    });
  }

  function fact(label, value) {
    return el('span.fact', {}, [
      el('span.fact-label', { text: label }),
      el('span.fact-value', { text: value })
    ]);
  }

  function tierBadge(tier, hasError) {
    if (hasError) return el('span.badge.badge-error', { text: 'blocked' });
    if (tier === C.TIER.MEASURED) return el('span.badge.badge-measured', { text: 'measured' });
    if (tier === C.TIER.CALIBRATED) return el('span.badge.badge-calibrated', { text: 'calibrated' });
    return el('span.badge.badge-estimated', { text: 'estimated' });
  }

  // --------------------------------------------------------------- live tick

  function tick(nowMs) {
    var soonest = null;
    var leadSeconds = Number(S.data.settings.alarmLeadSeconds) || 10;
    var alarmOn = S.data.settings.alarmEnabled !== false;
    var speakOn = alarmOn && S.data.settings.speechEnabled !== false;

    for (var i = 0; i < live.length; i++) {
      var item = live[i];
      var seconds = (item.rallyOpenMs - nowMs) / 1000;
      item.countdownNode.textContent = seconds <= -1 ? 'gone' : d.countdown(seconds);

      item.pill.classList.toggle('is-imminent', seconds > 0 && seconds <= 30);
      item.pill.classList.toggle('is-now', seconds <= 0 && seconds > -10);
      item.node.classList.toggle('is-late', seconds < -10);
      item.node.classList.toggle('is-next', seconds > 0 && seconds <= 60);

      if (alarmOn && A.isPrimed()) bookAlarms(item, seconds, leadSeconds);

      if (speakOn) announce(item, seconds);

      if (seconds > -1 && (soonest === null || seconds < soonest)) soonest = seconds;
    }

    if (nextGoNode) {
      if (live.length === 0) nextGoNode.textContent = 'no plan yet';
      else if (soonest === null) nextGoNode.textContent = 'all launched';
      else nextGoNode.textContent = 'first go in ' + d.countdown(soonest);
    }
  }

  /**
   * Everything inside this many seconds is booked on the audio clock now, so a
   * throttled or frozen tab still sounds on time. Ticks top the booking up, and
   * the horizon comfortably exceeds Chrome's once-per-minute background rate.
   */
  var BOOK_HORIZON_SECONDS = 150;

  function bookAlarms(item, seconds, leadSeconds) {
    if (seconds > BOOK_HORIZON_SECONDS) return;

    // Heads-up, a tick every second for the last five, then the launch itself.
    A.scheduleOnce(item.leadId + ':warn', 'warn', seconds - leadSeconds);
    for (var p = 5; p >= 1; p--) {
      A.scheduleOnce(item.leadId + ':pip:' + p, 'pip', seconds - p);
    }
    A.scheduleOnce(item.leadId + ':go', 'go', seconds);
  }

  /** Spoken callouts by name, so you can keep your eyes on the game. */
  var SAY_AT = [60, 30, 10];

  function announce(item, seconds) {
    for (var i = 0; i < SAY_AT.length; i++) {
      var mark = SAY_AT[i];
      // A two-second window catches the crossing even if a tick is delayed, and
      // the spoken number is the real remaining time rather than the mark.
      if (seconds <= mark && seconds > mark - 2) {
        A.sayOnce(item.leadId + ':say:' + mark,
          item.name + ', rally in ' + Math.round(seconds) + ' seconds');
      }
    }
    if (seconds <= 0 && seconds > -3) {
      A.sayOnce(item.leadId + ':say:go', item.name + ', go now');
    }
  }

  // ----------------------------------------------------------------- sharing

  function planText() {
    if (!lastPlan) return '';
    var plan = lastPlan.plan;
    var settings = S.data.settings;
    var multi = settings.multiTarget;

    var lines = [];
    lines.push('**RallySync — ' + (multi ? 'multi-target' : (lastPlan.primary.name || 'Target')) + '**');
    lines.push('Rallies open ' + d.utcClock(S.startMs()) + ' UTC');
    lines.push(settings.mode === 'sync'
      ? 'Sync: everyone lands ' + d.utcClock(plan.landingMs) + ' UTC'
      : 'Sequence: ' + settings.gapSeconds + 's apart from ' + d.utcClock(plan.landingMs) + ' UTC');
    lines.push('');
    lines.push('```');
    lines.push(padRight('TAP AT', 11) + padRight('NAME', 16) +
      (multi ? padRight('TARGET', 14) : '') + padRight('MARCH', 9) + 'LANDS');

    plan.rows.forEach(function (row) {
      if (row.errors.length > 0) {
        lines.push(padRight('--:--:--', 11) + padRight(trim(row.name, 15), 16) +
          'BLOCKED: ' + row.errors[0]);
        return;
      }
      lines.push(
        padRight(d.utcClock(row.rallyOpenMs), 11) +
        padRight(trim(row.name || 'Unnamed', 15), 16) +
        (multi ? padRight(trim(row.targetName || '', 13), 14) : '') +
        padRight(C.formatDuration(row.marchSeconds), 9) +
        d.utcClock(row.landingMs) +
        (row.tier === C.TIER.MEASURED ? '  *exact' : '')
      );
    });
    lines.push('```');
    lines.push('All times UTC. Rally window already subtracted.');
    lines.push('Rows without `*exact` are estimates — keep a ' +
      (settings.safetyBufferSeconds || 2) + 's buffer.');
    return lines.join('\n');
  }

  function copyPlan(button) {
    var text = planText();
    if (!text) return;
    var label = button.querySelector('span');
    var original = label ? label.textContent : '';
    writeClipboard(text).then(function (ok) {
      if (!label) return;
      label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      root.setTimeout(function () { label.textContent = original; }, 1800);
    });
  }

  function writeClipboard(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var area = root.document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      root.document.body.appendChild(area);
      area.select();
      var ok = root.document.execCommand('copy');
      root.document.body.removeChild(area);
      return ok;
    } catch (err) { return false; }
  }

  function padRight(text, width) {
    var out = String(text);
    while (out.length < width) out += ' ';
    return out;
  }

  function trim(text, max) {
    var out = String(text || '');
    return out.length > max ? out.slice(0, max - 1) + '…' : out;
  }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.calculate = {
    render: render, tick: tick, recompute: recompute, updateKeepAlive: updateKeepAlive
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
