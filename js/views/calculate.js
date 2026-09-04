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
  var T = root.RallySync.i18n;

  // Which result row has its exact-time panel open, kept across re-renders.
  var exactOpenKey = null;

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
            text: settings.multiTarget
              ? T.t('calc.multiTarget')
              : (target ? (target.name || T.t('calc.unnamedTarget')) : T.t('calc.noTarget'))
          })
        ]),
        el('span.mission-chip', {}, [
          icon('swap', 15),
          el('span.mission-chip-text', {
            text: settings.mode === 'sync'
              ? T.t('mode.sync')
              : T.t('calc.gapChip', { n: settings.gapSeconds })
          })
        ]),
        el('span.mission-chip', {}, [
          icon('clock', 15),
          el('span.mission-chip-text.is-mono', { text: d.utcClock(S.startMs()) })
        ])
      ]),
      el('div.mission-row.mission-sub', {}, [
        el('span', {
          text: T.t(leadCount === 1 ? 'calc.nLeadsOne' : 'calc.nLeadsMany', { n: leadCount })
        }),
        el('span.dot', { text: '·' }),
        nextGoNode = el('span.mission-next', { text: T.t('calc.noPlanYet') }),
        el('span.mission-toggle', {}, [
          el('span.mission-toggle-text', {
            text: T.t(controlsOpen ? 'calc.hideSetup' : 'calc.setup')
          }),
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
            title: T.t('calc.savedOn', { date: new Date(preset.savedISO).toLocaleDateString() }),
            onclick: function () {
              S.applyPresetSetup(preset.id);
              root.RallySync.app.refresh();
            }
          }, [preset.name]),
          el('button.preset-chip-x', {
            type: 'button', 'aria-label': T.t('calc.deleteNamed', { name: preset.name }),
            onclick: function () {
              if (root.confirm(T.t('confirm.deleteSetup', { name: preset.name }))) {
                S.deletePreset(preset.id);
              }
            }
          }, [icon('x', 12)])
        ]));
      });
      children.push(chips);
    } else {
      children.push(el('p.group-note', {
        text: T.t('calc.saveTheCurrentTarget')
      }));
    }

    if (savingPreset) {
      children.push(el('div.preset-save', {}, [
        el('input.input', {
          type: 'text', value: presetName, placeholder: T.t('calc.eGWeeklyCastle'),
          autocomplete: 'off',
          oninput: function (e) { presetName = e.target.value; },
          onkeydown: function (e) { if (e.key === 'Enter') commitPreset(); }
        }),
        el('div.button-row', {}, [
          el('button.btn.btn-ghost', {
            type: 'button',
            onclick: function () { savingPreset = false; root.RallySync.app.refresh(); }
          }, [T.t('common.cancel')]),
          el('button.btn.btn-primary', { type: 'button', onclick: commitPreset }, [T.t('common.save')])
        ])
      ]));
    } else {
      children.push(el('button.btn.btn-secondary.btn-wide', {
        type: 'button',
        onclick: function () { savingPreset = true; presetName = ''; root.RallySync.app.refresh(); }
      }, [T.t('btn.saveSetup')]));
    }

    return group(T.t('head.eventSetups'), children, presets.length ? String(presets.length) : null);
  }

  /**
   * Splices nodes into a translated sentence.
   *
   * The alternative is chopping the sentence into fragments around each styled
   * span, which is how seventeen strings ended up half-translated earlier in
   * this project: a translator cannot move a word past a fragment boundary, and
   * many languages need to. This keeps the sentence whole and lets the
   * placeholders land wherever the grammar puts them.
   */
  function richText(key, nodes) {
    var text = T.t(key);
    var out = [];
    var pattern = /\{(\w+)\}/g;
    var last = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) out.push(text.slice(last, match.index));
      if (nodes[match[1]]) out.push(nodes[match[1]]);
      last = match.index + match[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  function commitPreset() {
    S.savePreset(presetName || T.t('calc.setupN', { n: S.data.presets.length + 1 }));
    savingPreset = false;
    presetName = '';
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------------ target

  function targetGroup(target) {
    var settings = S.data.settings;

    if (S.data.targets.length === 0) {
      return group(T.t('head.target'), [
        el('div.empty.empty-inline', {}, [
          icon('pin', 26),
          el('h3', { text: T.t('calc.noTargetsYet') }),
          el('p', { text: T.t('calc.addTheCastleA') }),
          el('button.btn.btn-primary', {
            type: 'button', onclick: function () { root.RallySync.app.go('targets'); }
          }, [T.t('btn.addTarget')])
        ])
      ]);
    }

    var needsCoords = S.data.targets.filter(function (t) {
      return t.x === null || t.y === null;
    }).length;

    var picker = SS.create({
      value: target ? target.id : null,
      placeholder: T.t('calc.chooseATarget'),
      searchPlaceholder: T.t('calc.searchTargets'),
      emptyText: T.t('calc.noTargetMatches'),
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
            ? T.t('tgt.noCoordinates')
            : t.x + ',' + t.y + ' · ' + Z.zoneLabel(t.zoneKey) + ' · ' +
              (Number(t.gatherSeconds) > 0
                ? T.t('tgt.rallyWindowOf', { window: C.formatDuration(t.gatherSeconds) })
                : T.t('tgt.noRallyWindow')),
          warn: incomplete ? T.t('tgt.setXY') : null
        };
      }),
      footer: needsCoords > 0
        ? el('div.ss-footer', {}, [
            icon('alert', 14),
            el('span', {
              text: T.t('calc.someNeedCoords', { n: needsCoords })
            }),
            el('button.btn.btn-link', {
              type: 'button', onclick: function () { root.RallySync.app.go('targets'); }
            }, [T.t('btn.fix')])
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
          el('span', { text: T.t('calc.setThisTargetS') })
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
        el('span.toggle-label', { text: T.t('calc.splitAcrossMultipleTargets') }),
        el('span.toggle-help', {
          text: T.t('calc.sendPartOfThe')
        })
      ])
    ]));

    return group(T.t('head.target'), children, String(S.data.targets.length));
  }

  // -------------------------------------------------------------------- mode

  function modeGroup() {
    var settings = S.data.settings;
    var children = [
      el('div.segmented', {}, [
        segButton(T.t('mode.sync'), T.t('mode.syncSub'), settings.mode === 'sync', function () {
          S.updateSettings({ mode: 'sync' });
          root.RallySync.app.refresh();
        }),
        segButton(T.t('mode.sequence'), T.t('mode.sequenceSub'), settings.mode === 'sequence', function () {
          S.updateSettings({ mode: 'sequence' });
          root.RallySync.app.refresh();
        })
      ])
    ];

    if (settings.mode === 'sequence') {
      children.push(el('div.gap-row', {}, [
        el('span.gap-label', { text: T.t('calc.gap') }),
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
        el('span.unit', { text: T.t('calc.secondsApart') })
      ]));
      children.push(el('p.group-note', {
        text: T.t('calc.sanctuaryAndFortressPushes')
      }));
    }
    return group(T.t('head.mode'), children);
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
      text: T.t('calc.setWhenRalliesOpen')
    }));

    children.push(el('div.anchor-row', {}, [
      el('div.anchor-main', {}, [
        el('span.anchor-label', {}, [el('span', { text: T.t('calc.startRalliesAt') })]),
        el('button.anchor-value', {
          type: 'button',
          title: T.t('calc.setWhenRalliesOpen2'),
          onclick: openStartPicker
        }, [
          el('span.anchor-time', { text: d.utcClock(S.startMs()) }),
          el('span.anchor-zone', { text: 'UTC' })
        ]),
        el('span.anchor-hint', { text: T.t('calc.whenTheFirstPerson') })
      ]),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button',
        title: T.t('calc.openRalliesRightNow'),
        onclick: function () {
          S.updateSettings({ startMs: S.now() });
          root.RallySync.app.refresh();
        }
      }, [T.t('tp.now')])
    ]));

    children.push(el('div.quick-row', {}, [1, 5, 10, 15, 30].map(function (mins) {
      return el('button.btn.btn-quick', {
        type: 'button',
        onclick: function () {
          S.updateSettings({ startMs: S.now() + mins * 60000 });
          root.RallySync.app.refresh();
        }
      }, [T.t('calc.inMinutes', { n: mins })]);
    })));

    if (!S.startIsExplicit()) {
      children.push(el('p.group-note', {
        text: T.t('calc.noStartSetSo')
      }));
    }

    // The landing time is a result, not an input.
    var landing = lastPlan && lastPlan.plan ? lastPlan.plan.landingMs : null;
    children.push(el('div.lands-row', {}, [
      el('span.anchor-label', {}, [
        el('span.anchor-op', { text: '=' }),
        el('span', { text: T.t('calc.troopsLandAt') })
      ]),
      landing
        ? el('span.lands-value', { text: d.utcClock(landing) })
        : el('span.lands-value.is-empty', { text: '--:--:--' }),
      el('span.lands-zone', { text: 'UTC' }),
      landing
        ? el('span.lands-local', {
            text: d.localClock(landing) + ' ' + d.localZoneName() + ' · ' + d.utcDate(landing)
          })
        : el('span.lands-local', { text: T.t('calc.pickATargetAnd') }),
      el('span.anchor-hint', {
        text: landing
          ? T.t('calc.anchorEarliest')
          : T.t('calc.anchorFromPlan')
      })
    ]));

    if (target && Number(target.gatherSeconds) > 0) {
      children.push(el('p.group-note.group-note-accent', {
        text: T.t('calc.rallyWindowIncluded', {
          window: C.formatDuration(target.gatherSeconds)
        })
      }));
    }

    children.push(G.helpBlock('startTime'));
    return group(T.t('head.timing'), children, 'UTC');
  }

  function openStartPicker() {
    TP.open({
      title: T.t('calc.startRalliesAt2'),
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
    var target = S.findTarget(settings.selectedTargetId);
    var selected = selectedLeads();
    var selectedIds = selected.map(function (l) { return l.id; });

    if (S.data.leads.length === 0) {
      return group('Who is marching', [
        el('p.muted', { text: T.t('calc.noRallyLeadsYet') })
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
        }, [T.t('btn.selectAll')]),
        el('button.btn.btn-link', {
          type: 'button',
          onclick: function () {
            S.updateSettings({ selectedLeadIds: [] });
            root.RallySync.app.refresh();
          }
        }, [T.t('btn.clear')])
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
          title: T.t(allIn ? 'calc.removeAllIn' : 'calc.addAllIn',
            { n: members.length, group: g.name }),
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
      // Distance to the chosen target, so you can see who is far before
      // selecting them rather than after reading the results.
      var reach = '';
      if (!missing && target && target.x !== null && target.y !== null) {
        reach = ' · ' + d.km(C.distanceTiles(lead, target));
      }
      var detail = missing
        ? T.t('tgt.noCoordinates')
        : lead.x + ',' + lead.y +
          ' · ' + (lead.marchSpeedUpPercent === null
            ? T.t('calc.noSpeedShort')
            : '+' + lead.marchSpeedUpPercent + '%') +
          reach;

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
      children.push(el('p.group-note', { text: T.t('calc.eachLeadMarchesOn') }));
      children.push(assignList);
    }

    if (settings.mode === 'sequence' && selected.length > 1) {
      var orderList = el('ol.order-list');
      selected.forEach(function (lead, index) {
        orderList.appendChild(el('li.order-item', { dataset: { index: String(index) } }, [
          el('span.drag-handle', {
            'aria-hidden': 'true', title: T.t('calc.dragToReorder')
          }, [icon('menu', 14)]),
          el('span.order-rank', { text: String(index + 1) }),
          el('span.order-name', { text: lead.name || 'Unnamed' }),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': T.t('calc.moveEarlier', { name: lead.name || 'lead' }),
            disabled: index === 0,
            onclick: function () { moveLead(index, -1); }
          }, ['↑']),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': T.t('calc.moveLater', { name: lead.name || 'lead' }),
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

      children.push(el('p.group-note', { text: T.t('calc.landsInThisOrder') }));
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
      el('div.group-head', {}, [el('h2.group-title', { text: T.t('calc.setUpOnceReuse') })]),
      el('ol.steps', {}, [
        stepRow(1, T.t('qs.leads'), T.t('qs.leadsBody'), haveLeads, 'roster'),
        stepRow(2, T.t('qs.targets'), T.t('qs.targetsBody'), haveCoords, 'targets'),
        stepRow(3, T.t('qs.march'), T.t('qs.marchBody'), false, 'calibrate')
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
      }, [done ? T.t('common.edit') : T.t('btn.open')])
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
        el('h3', { text: T.t(!primary ? 'calc.pickATarget' : 'calc.selectMarching') }),
        el('p', {
          text: T.t(!primary ? 'calc.openSetupTarget' : 'calc.openSetupLeads')
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
    resultsHost.appendChild(G.helpBlock('zoneAccuracy'));

    var caveat = modelCaveat(plan.rows);
    if (caveat) {
      resultsHost.appendChild(el('div.banner.banner-warn', {}, [
        icon('alert', 16), el('span', { text: caveat })
      ]));
    }

    resultsHost.appendChild(el('p.disclaimer', {}, [
      el('strong', { text: T.t('calc.estimatesNotGuarantees') })
    ].concat(richText('calc.estimatesNote', {
      badge: el('span.badge.badge-measured', { text: T.t('badge.measured') }),
      buffer: el('strong', {
        text: T.t('calc.bufferSeconds', { n: settings.safetyBufferSeconds || 2 })
      })
    }))));

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
    var speeds = {};
    var beyond = 0;
    var haveRange = false;

    rows.forEach(function (row) {
      if (row.errors.length > 0) return;
      var zone = S.findZone(row.zoneKeyUsed);
      if (!zone || zone.trust === 'calibrated') return;

      var lead = S.findLead(row.leadId);
      if (lead && lead.marchSpeedUpPercent !== null) speeds[lead.marchSpeedUpPercent] = true;

      // Each zone knows the distances it was actually measured over, which
      // differ sharply: open map only near, HQ only far.
      var range = zone.fittedFrom;
      if (!range) return;
      haveRange = true;
      if (row.distance > range.maxDistance * 1.25 || row.distance < range.minDistance * 0.5) beyond++;
    });

    // The diagonal warning stands on its own, even where no zone records a range.
    var haveDiagonal = rows.some(function (row) {
      return row.errors.length === 0 && row.diagonality > 0.6;
    });
    if (!haveRange && !haveDiagonal) return null;
    var range = { speedPercents: [25] };
    var offSpeed = Object.keys(speeds).filter(function (value) {
      return range.speedPercents.indexOf(Number(value)) === -1;
    }).length;

    var diagonal = rows.filter(function (row) {
      return row.errors.length === 0 && row.diagonality > 0.6;
    }).length;

    var notes = [];
    if (diagonal > 0) {
      notes.push(T.t(diagonal === 1 ? 'calc.diagonalOne' : 'calc.diagonalMany',
        { n: diagonal }));
    }
    if (offSpeed > 0) {
      notes.push(T.t(offSpeed === 1 ? 'calc.offSpeedOne' : 'calc.offSpeedMany',
        { n: offSpeed, speeds: range.speedPercents.join('/+') }));
    }
    if (beyond > 0) {
      notes.push(T.t(beyond === 1 ? 'calc.beyondOne' : 'calc.beyondMany', { n: beyond }));
    }
    if (notes.length === 0) return null;

    // Joined from the dictionary: an ASCII comma-space reads as a foreign
    // body between two Japanese or Chinese clauses, which want 、.
    return T.t('calc.extrapolating', { list: notes.join(T.t('calc.listJoiner')) });
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
      el('span.section-count', {
        text: T.t(section.rows.length === 1 ? 'calc.nRallyOne' : 'calc.nRallyMany',
          { n: section.rows.length })
      }),
      totals.power
        ? el('span.section-total', { text: T.t('calc.nPower', { n: compact(totals.power) }) })
        : null,
      totals.capacity
        ? el('span.section-total', { text: T.t('calc.nTroops', { n: compact(totals.capacity) }) })
        : null
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
      title: T.t(alarmOn ? 'calc.alarmOnTitle' : 'calc.alarmOffTitle'),
      onclick: function () {
        var next = !alarmOn;
        S.updateSettings({ alarmEnabled: next });
        if (next && A.prime()) A.beep(880, 0.07);
        root.RallySync.app.refresh();
      }
    }, [icon('bell', 15), el('span', { text: alarmOn ? T.t('label.alarmOn') : T.t('label.alarmOff') })]);

    return el('div.results-head', {}, [
      el('div.results-head-main', {}, [
        el('h2.results-title', { text: T.t('head.launchOrder') }),
        el('p.results-sub', {
          text: (settings.mode === 'sync'
            ? T.t('calc.allLandAt', { n: plan.rows.length, time: d.utcClock(landing) })
            : T.t('calc.landingsApart', {
                n: plan.rows.length, gap: settings.gapSeconds, time: d.utcClock(landing)
              })) +
            (totals.power
              ? ' · ' + T.t('calc.nPower', { n: compact(totals.power) })
              : '')
        })
      ]),
      problems > 0
        ? el('span.tag.tag-error', { text: T.t('calc.countIncomplete', { n: problems }) })
        : null,
      late > 0
        ? el('span.tag.tag-warn', { text: T.t('calc.countTooLate', { n: late }) })
        : null,
      groupBySelect(),
      alarmBtn,
      el('button.btn.btn-secondary.btn-copy', {
        type: 'button', onclick: function (e) { copyPlan(e.currentTarget); }
      }, [icon('copy', 15), el('span', { text: T.t('btn.copy') })])
    ]);
  }

  function groupBySelect() {
    var options = [
      ['none', T.t('label.noGrouping')], ['alliance', 'By alliance'],
      ['squad', 'By squad'], ['target', 'By target']
    ];
    return el('select.input.group-select', {
      'aria-label': T.t('calc.groupResultsBy'),
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
      el('span.count-label', { text: T.t('label.untilYouGo') })
    ]);

    node.appendChild(el('div.result-body', {}, [
      el('div.result-time', {}, [
        el('span.result-time-label', { text: gathering ? T.t('label.tapRallyAt') : T.t('label.marchAt') }),
        el('div.result-time-main', {}, [
          el('span.result-time-value', { text: d.utcClock(row.rallyOpenMs) }),
          el('span.result-time-zone', { text: 'UTC' })
        ]),
        el('div.result-time-local', { text: d.localClock(row.rallyOpenMs) + ' ' + d.localZoneName() })
      ]),
      countdownPill
    ]));

    node.appendChild(el('div.result-facts', {}, [
      // Always name the target, not only in multi-target mode. A row that says
      // only "to X:503 Y:1141" makes you cross-check the Targets tab to know
      // what you are hitting.
      fact(T.t('row.on'), row.targetName || (target && target.name) || '—'),
      target && target.type ? fact(T.t('row.type'), Z.targetTypeLabel(target.type)) : null,
      fact(T.t('row.march'), C.formatDuration(row.marchSeconds)),
      gathering ? fact(T.t('row.departs'), d.utcClock(row.departMs)) : null,
      fact(T.t('row.lands'), d.utcClock(row.landingMs)),
      // The inputs behind the number, so a mistyped coordinate or speed is
      // visible here rather than only on the Leads tab.
      lead && lead.x !== null && lead.y !== null
        ? fact(T.t('row.from'), 'X:' + lead.x + ' Y:' + lead.y) : null,
      target && target.x !== null && target.y !== null
        ? fact(T.t('row.to'), 'X:' + target.x + ' Y:' + target.y) : null,
      fact(T.t('row.dist'), d.km(row.distance)),
      lead && lead.marchSpeedUpPercent !== null
        ? fact(T.t('row.speed'), '+' + lead.marchSpeedUpPercent + '%') : null,
      lead && lead.power ? fact(T.t('row.power'), compact(lead.power)) : null
    ]));

    row.notes.forEach(function (note) {
      node.appendChild(el('div.result-note', {}, [icon('alert', 14), el('span', { text: note })]));
    });

    var slot = slotFor(row, target);
    var exact = exactTimeControl(row, lead, target);
    node.appendChild(el('div.result-actions', {}, [
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button', onclick: function () { F.open(slot, S.now); }
      }, [icon('crosshair', 14), el('span', { text: T.t('btn.focus') })]),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button', onclick: function (e) { shareSlot(slot, e.currentTarget); }
      }, [icon('share', 14), el('span', { text: T.t('btn.share') })]),
      el('button.btn.btn-ghost.btn-sm', {
        type: 'button', onclick: function (e) { copyRow(row, lead, target, e.currentTarget); }
      }, [icon('copy', 14), el('span', { text: T.t('btn.copy') })]),
      exact.button
    ]));
    node.appendChild(exact.panel);

    live.push({
      node: node, countdownNode: countdownNode, pill: countdownPill,
      rallyOpenMs: row.rallyOpenMs, leadId: row.leadId, name: row.name || 'Rally'
    });
    return node;
  }

  /**
   * Type in the march time the game itself states, which beats every formula.
   *
   * This exists because the game will tell you the number before you commit
   * anything: Rally -> Hold a rally -> the time beside the timer icon, then back
   * out. So being exact costs a few taps rather than a whole march, and there is
   * no reason for a lead you care about to stay on an estimate.
   */
  function exactTimeControl(row, lead, target) {
    var existing = S.measurementFor(row.leadId, row.targetId);
    // Setting a time re-renders the row, so the open panel has to survive that
    // — otherwise it collapses at the exact moment it has something to say.
    var key = row.leadId + '|' + row.targetId;

    var input = el('input.input.exact-input', {
      type: 'text', inputmode: 'text', placeholder: T.t('calc.333Or213'),
      value: existing ? C.formatDuration(existing.seconds) : '',
      'aria-label': T.t('calc.exactMarchTimeAs')
    });
    var feedback = el('div.exact-feedback');

    function save() {
      var seconds = C.parseDuration(input.value);
      if (seconds === null || seconds <= 0) {
        feedback.className = 'exact-feedback is-bad';
        feedback.textContent = 'Enter it the way the game writes it — 3:33, or 213 for plain seconds.';
        return;
      }
      S.recordMeasurement(row.leadId, row.targetId, seconds);
      root.RallySync.app.refresh();
    }

    var panel = el('div.exact-panel', { hidden: exactOpenKey !== key }, [
      // The steps live here rather than only on the Tune tab: this is the moment
      // someone needs them, and sending them to another screen to find out how
      // to get the number is how a feature goes unused.
      el('div.exact-help', {}, [
        el('div.exact-help-title', { text: T.t('calc.getThisFromThe') }),
        el('p.exact-what', { text: T.t('exact.what') }),
        el('ol.exact-steps', {}, [
          el('li', { text: T.t('calc.tapTheTargetOn') }),
          el('li', { text: T.t('calc.pickAnyRallyWindow') }),
          el('li', { text: T.t('calc.readTheTimeBeside') }),
          el('li', { text: T.t('calc.backOutWithThe') })
        ]),
        el('div.exact-help-note', {
          text: T.t('calc.smallMonstersShowAttack')
        })
      ]),
      el('div.exact-row', {}, [
        input,
        el('button.btn.btn-primary.btn-sm', { type: 'button', onclick: save }, [
          icon('check', 14), el('span', { text: T.t('btn.setExact') })
        ]),
        existing ? el('button.btn.btn-ghost.btn-sm', {
          type: 'button',
          onclick: function () {
            S.deleteMeasurement(row.leadId, row.targetId);
            exactOpenKey = null;
            root.RallySync.app.refresh();
          }
        }, [icon('trash', 14), el('span', { text: T.t('btn.clear') })]) : null
      ]),
      feedback
    ]);

    // With a time set, say how far the formula had been off. That is the whole
    // argument for setting one, and it is also the only place the app's own
    // error is ever visible.
    if (existing) {
      var zone = Z.findZone(S.data.zones, target.zoneKey);
      var predicted = zone
        ? C.marchSecondsForZone(zone, lead, target, lead.marchSpeedUpPercent).seconds
        : null;
      if (predicted !== null && isFinite(predicted)) {
        var off = predicted - Number(existing.seconds);
        feedback.className = 'exact-feedback';
        feedback.textContent = Math.abs(off) < 1
          ? T.t('calc.formulaAgreed')
          : T.t(off > 0 ? 'calc.formulaWasSlow' : 'calc.formulaWasFast',
              { time: C.formatDuration(Math.abs(off)) });
      }
    }

    // Styled as the row's primary action while the row is still a guess, and as
    // a quiet confirmation once it is not. Every other button here is optional;
    // this is the one that turns an estimate into a fact, so it should not look
    // like a sibling of Copy.
    var button = el('button.btn.btn-sm' +
      (existing ? '.btn-ghost is-exact' : '.btn-exact-call'), {
      type: 'button',
      title: existing ? T.t('exact.tipSet') : T.t('exact.tipUnset'),
      onclick: function () {
        panel.hidden = !panel.hidden;
        exactOpenKey = panel.hidden ? null : key;
        if (!panel.hidden) input.focus();
      }
    }, [
      icon('clock', 14),
      el('span', { text: existing ? T.t('btn.exactSet') : T.t('btn.exactTime') }),
      existing ? null : el('span.exact-dot', { 'aria-hidden': 'true' })
    ]);

    return { button: button, panel: panel };
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

  /**
   * Copies one row as plain text, for pasting into alliance chat. Deliberately
   * one line per fact rather than a paragraph: it is read on a phone, at speed,
   * by someone about to tap.
   */
  function copyRow(row, lead, target, button) {
    var gathering = target && Number(target.gatherSeconds) > 0;
    var lines = [
      (row.name || T.t('copy.unnamedRally')) +
        (row.targetName ? ' → ' + row.targetName : ''),
      T.t(gathering ? 'copy.tapRallyAt' : 'copy.marchAt', { time: d.utcClock(row.rallyOpenMs) })
    ];
    if (gathering) lines.push(T.t('copy.departs', { time: d.utcClock(row.departMs) }));
    lines.push(T.t('copy.lands', { time: d.utcClock(row.landingMs) }));
    lines.push(T.t('copy.march', { time: C.formatDuration(row.marchSeconds) }));
    if (lead && lead.x !== null && lead.y !== null) {
      lines.push(T.t('copy.from', { x: lead.x, y: lead.y }));
    }
    if (target && target.x !== null && target.y !== null) {
      lines.push(T.t('copy.to', { x: target.x, y: target.y }));
    }
    lines.push(T.t('copy.distance', { distance: d.km(row.distance) }));
    if (lead && lead.marchSpeedUpPercent !== null) {
      lines.push(T.t('copy.speed', { n: lead.marchSpeedUpPercent }));
    }
    flashCopy(button, lines.join('\n'));
  }

  /** Copies text and says so on the button itself, then puts the label back. */
  function flashCopy(button, text) {
    var label = button.querySelector('span');
    var original = label.textContent;
    writeClipboard(text).then(function (ok) {
      label.textContent = ok ? T.t('btn.copied') : T.t('btn.copyFailed');
      root.setTimeout(function () { label.textContent = original; }, 1800);
    });
  }

  function shareSlot(slot, button) {
    var url = SH.slotUrl(slot);
    var label = button.querySelector('span');
    var original = label.textContent;
    writeClipboard(url).then(function (ok) {
      label.textContent = ok ? T.t('btn.linkCopied') : T.t('btn.copyFailed');
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
    if (hasError) return el('span.badge.badge-error', { text: T.t('badge.blocked') });
    if (tier === C.TIER.MEASURED) return el('span.badge.badge-measured', { text: T.t('badge.measured') });
    if (tier === C.TIER.CALIBRATED) return el('span.badge.badge-calibrated', { text: T.t('badge.calibrated') });
    return el('span.badge.badge-estimated', { text: T.t('badge.estimated') });
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
      if (live.length === 0) nextGoNode.textContent = T.t('calc.noPlanYet');
      else if (soonest === null) nextGoNode.textContent = T.t('calc.allLaunched');
      else nextGoNode.textContent = T.t('calc.firstGoIn', { time: d.countdown(soonest) });
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
          T.t('speech.rallyIn', { name: item.name, seconds: Math.round(seconds) }));
      }
    }
    if (seconds <= 0 && seconds > -3) {
      A.sayOnce(item.leadId + ':say:go', T.t('speech.goNow', { name: item.name }));
    }
  }

  // ----------------------------------------------------------------- sharing

  function planText() {
    if (!lastPlan) return '';
    var plan = lastPlan.plan;
    var settings = S.data.settings;
    var multi = settings.multiTarget;

    var lines = [];
    // i18n-exempt: the product name and markdown bold, neither translated.
    lines.push('**RallySync — ' +
      (multi ? T.t('share.multiTarget') : (lastPlan.primary.name || T.t('share.target'))) + '**');
    lines.push(T.t('share.ralliesOpen', { time: d.utcClock(S.startMs()) }));
    lines.push(settings.mode === 'sync'
      ? T.t('share.syncLine', { time: d.utcClock(plan.landingMs) })
      : T.t('share.sequenceLine', {
          gap: settings.gapSeconds, time: d.utcClock(plan.landingMs)
        }));
    lines.push('');
    lines.push('```');

    /**
     * Forces one table line to lay out left-to-right.
     *
     * The block is a fixed-width table, but the bidi algorithm decides a line's
     * direction from its first strong character -- so in Arabic the whole row
     * reorders and the columns scramble, however carefully each header was
     * sized. U+200E is an invisible strong LTR character: putting one at the
     * head of each line pins the layout while Arabic names and headers inside
     * it still render right-to-left as runs, which is what should happen.
     */
    function row(text) {
      lines.push(T.isRtl() ? '‎' + text : text);
    }

    // Column headers are trimmed to their own width: this is a monospace table
    // pasted into chat, and a longer translation would shift every row under it.
    row(padRight(trim(T.t('share.colTapAt'), 10), 11) +
      padRight(trim(T.t('share.colName'), 15), 16) +
      (multi ? padRight(trim(T.t('share.colTarget'), 13), 14) : '') +
      padRight(trim(T.t('share.colMarch'), 8), 9) + trim(T.t('share.colLands'), 8));

    plan.rows.forEach(function (planRow) {
      if (planRow.errors.length > 0) {
        row(padRight('--:--:--', 11) + padRight(trim(planRow.name, 15), 16) +
          T.t('share.blocked', { reason: planRow.errors[0] }));
        return;
      }
      row(
        padRight(d.utcClock(planRow.rallyOpenMs), 11) +
        padRight(trim(planRow.name || T.t('share.unnamed'), 15), 16) +
        (multi ? padRight(trim(planRow.targetName || '', 13), 14) : '') +
        padRight(C.formatDuration(planRow.marchSeconds), 9) +
        d.utcClock(planRow.landingMs) +
        // i18n-exempt: a marker in the table, referenced verbatim by
        // share.bufferNote, so both must stay the same literal.
        (planRow.tier === C.TIER.MEASURED ? '  *exact' : '')
      );
    });
    lines.push('```');
    lines.push(T.t('share.allTimesUtc'));
    lines.push(T.t('share.bufferNote', { n: settings.safetyBufferSeconds || 2 }));
    return lines.join('\n');
  }

  function copyPlan(button) {
    var text = planText();
    if (!text) return;
    var label = button.querySelector('span');
    var original = label ? label.textContent : '';
    writeClipboard(text).then(function (ok) {
      if (!label) return;
      label.textContent = ok ? T.t('btn.copied') : T.t('btn.pressCtrlC');
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

  /**
   * Monospace display width, not string length.
   *
   * A CJK glyph occupies TWO columns in a monospace font but counts as one
   * UTF-16 unit, so padding by .length made every Chinese, Japanese and Korean
   * header render about twice as wide as the column it was padding to fill --
   * silently scrambling a table that is pasted into chat. Counting the wide
   * ranges makes the block align in every language instead of forcing CJK
   * locales to leave their headers in English.
   */
  function displayWidth(text) {
    var width = 0;
    var str = String(text);
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      // Surrogate pair: one character, and in these planes almost always wide.
      if (code >= 0xd800 && code <= 0xdbff) { width += 2; i++; continue; }
      width += isWide(code) ? 2 : 1;
    }
    return width;
  }

  /** The East Asian Wide and Fullwidth ranges this app can actually produce. */
  function isWide(code) {
    return (code >= 0x1100 && code <= 0x115f) ||    // Hangul Jamo
      (code >= 0x2e80 && code <= 0x303e) ||         // CJK radicals, punctuation
      (code >= 0x3041 && code <= 0x33ff) ||         // kana, CJK compatibility
      (code >= 0x3400 && code <= 0x4dbf) ||         // CJK ext A
      (code >= 0x4e00 && code <= 0x9fff) ||         // CJK unified
      (code >= 0xa000 && code <= 0xa4cf) ||         // Yi
      (code >= 0xac00 && code <= 0xd7a3) ||         // Hangul syllables
      (code >= 0xf900 && code <= 0xfaff) ||         // CJK compatibility ideographs
      (code >= 0xfe30 && code <= 0xfe6f) ||         // CJK compatibility forms
      (code >= 0xff00 && code <= 0xff60) ||         // fullwidth forms
      (code >= 0xffe0 && code <= 0xffe6);
  }

  function padRight(text, width) {
    var out = String(text);
    var used = displayWidth(out);
    while (used < width) { out += ' '; used++; }
    return out;
  }

  /**
   * Truncates to a monospace COLUMN budget, matching padRight.
   *
   * These two are a pair: padRight fills a field to N columns and trim keeps a
   * string inside it. Measuring one in display columns and the other in UTF-16
   * units meant a six-glyph Japanese header passed a budget of eight and then
   * rendered twelve columns wide -- the same silent misalignment padRight used
   * to cause, surviving in its other half.
   */
  function trim(text, max) {
    var out = String(text || '');
    if (displayWidth(out) <= max) return out;
    var kept = '';
    var used = 0;
    for (var i = 0; i < out.length; i++) {
      var ch = out.charAt(i);
      var code = out.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < out.length) {
        ch = out.slice(i, i + 2);
        i++;
      }
      var w = displayWidth(ch);
      if (used + w > max - 1) break;   // leave a column for the ellipsis
      kept += ch;
      used += w;
    }
    return kept + '…';
  }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.calculate = {
    render: render, tick: tick, recompute: recompute, updateKeepAlive: updateKeepAlive
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
