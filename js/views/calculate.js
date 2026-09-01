/**
 * views/calculate.js — the live screen. Pick a target, pick who is going,
 * set the landing time, read everyone's launch time.
 *
 * This is the one screen used under time pressure (PRD Section 12), so it
 * recomputes on every change with no explicit "Calculate" step, and the
 * per-second countdown updates in place rather than re-rendering.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var C = root.RallySync.calc;
  var Z = root.RallySync.zones;
  var G = root.RallySync.guide;
  var el = d.el;

  var live = [];        // countdown nodes updated by tick()
  var lastPlan = null;
  var resultsHost = null;

  // ---------------------------------------------------------------- rendering

  function render(container) {
    d.clear(container);
    live = [];

    var settings = S.data.settings;
    var target = S.findTarget(settings.selectedTargetId) || S.data.targets[0] || null;
    if (target && settings.selectedTargetId !== target.id) {
      settings.selectedTargetId = target.id;
    }

    var needsSetup = S.data.leads.length === 0 ||
      !S.data.targets.some(function (t) { return t.x !== null && t.y !== null; });
    if (needsSetup) container.appendChild(quickStart());

    container.appendChild(targetSection(target));
    container.appendChild(modeSection());
    container.appendChild(landingSection(target));
    container.appendChild(leadSection());

    resultsHost = el('div.results-host');
    container.appendChild(resultsHost);

    container.appendChild(el('p.disclaimer', {}, [
      el('strong', { text: 'Estimates, not guarantees. ' }),
      'March formulas here are community-derived, not published by the developer. ',
      'Rows marked ', el('span.badge.badge-measured', { text: 'measured' }),
      ' come from a real march you recorded and are exact. Everything else should carry a ',
      el('strong', { text: (S.data.settings.safetyBufferSeconds || 2) + 's safety buffer' }),
      ' — use the in-game countdown as the final word.'
    ]));

    recompute();
  }

  /** First-run setup path. Disappears as soon as there is enough data to calculate. */
  function quickStart() {
    var haveLeads = S.data.leads.length > 0;
    var haveCoords = S.data.targets.some(function (t) { return t.x !== null && t.y !== null; });

    var section = el('section.panel.panel-accent.quickstart');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Set up once, reuse every event' })
    ]));

    section.appendChild(el('ol.steps', {}, [
      stepRow(1, 'Add your rally leads', 'Name, city X/Y, and March Speed Up %.', haveLeads, 'roster'),
      stepRow(2, 'Set target coordinates', 'Fill in the Castle and turret X/Y for your kingdom.', haveCoords, 'targets'),
      stepRow(3, 'Log a real march', 'Optional, but it makes that lead exact instead of estimated.', false, 'calibrate')
    ]));

    section.appendChild(G.guideCard('marchSpeed'));
    section.appendChild(G.guideCard('targetCoords'));
    return section;
  }

  function stepRow(number, title, body, done, tab) {
    return el('li.step' + (done ? ' is-done' : ''), {}, [
      el('span.step-num', { text: done ? '✓' : String(number) }),
      el('div.step-main', {}, [
        el('div.step-title', { text: title }),
        el('div.step-body', { text: body })
      ]),
      el('button.btn.btn-secondary.btn-sm', {
        type: 'button',
        onclick: function () { root.RallySync.app.go(tab); }
      }, [done ? 'Edit' : 'Open'])
    ]);
  }

  function targetSection(target) {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [el('h2.panel-title', { text: 'Target' })]));

    if (S.data.targets.length === 0) {
      section.appendChild(el('p.muted', { text: 'No targets yet — add one on the Targets tab.' }));
      return section;
    }

    var chips = el('div.chips');
    S.data.targets.forEach(function (t) {
      var selected = target && t.id === target.id;
      var incomplete = t.x === null || t.y === null;
      chips.appendChild(el('button.chip' + (selected ? ' is-selected' : '') + (incomplete ? ' is-incomplete' : ''), {
        type: 'button',
        onclick: function () {
          S.updateSettings({ selectedTargetId: t.id });
          root.RallySync.app.refresh();
        }
      }, [t.name || 'Unnamed', incomplete ? el('span.chip-warn', { text: '!' }) : null]));
    });
    section.appendChild(chips);

    if (target) {
      if (target.x === null || target.y === null) {
        section.appendChild(el('div.banner.banner-error', {
          text: 'This target has no coordinates. Set them on the Targets tab before calculating.'
        }));
      } else {
        section.appendChild(el('p.panel-note', {}, [
          el('span.tag.tag-zone', { text: Z.zoneLabel(target.zoneKey) }),
          ' X:' + target.x + ' Y:' + target.y + ' · rally window ' + C.formatDuration(target.gatherSeconds)
        ]));
      }
    }
    return section;
  }

  function modeSection() {
    var settings = S.data.settings;
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [el('h2.panel-title', { text: 'Mode' })]));

    section.appendChild(el('div.segmented', {}, [
      segButton('Sync', 'All land together', settings.mode === 'sync', function () {
        S.updateSettings({ mode: 'sync' });
        root.RallySync.app.refresh();
      }),
      segButton('Sequence', 'Staggered, gapless', settings.mode === 'sequence', function () {
        S.updateSettings({ mode: 'sequence' });
        root.RallySync.app.refresh();
      })
    ]));

    if (settings.mode === 'sequence') {
      section.appendChild(el('label.field.field-inline', {}, [
        el('span.field-label', { text: 'Gap between landings' }),
        el('div.stepper', {}, [
          el('button.btn.btn-step', {
            type: 'button',
            onclick: function () { bumpGap(-1); }
          }, ['−']),
          el('input.input.input-num', {
            type: 'number', inputmode: 'numeric', min: '0', value: String(settings.gapSeconds),
            onchange: function (e) {
              S.updateSettings({ gapSeconds: Math.max(0, Number(e.target.value) || 0) });
              root.RallySync.app.refresh();
            }
          }),
          el('button.btn.btn-step', {
            type: 'button',
            onclick: function () { bumpGap(1); }
          }, ['+']),
          el('span.unit', { text: 'sec' })
        ])
      ]));
      section.appendChild(el('p.panel-note', {
        text: 'Order below decides who lands first. Drag order with the arrows.'
      }));
    }
    return section;
  }

  function bumpGap(delta) {
    var next = Math.max(0, (Number(S.data.settings.gapSeconds) || 0) + delta);
    S.updateSettings({ gapSeconds: next });
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

  function landingSection(target) {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Landing time' }),
      el('span.panel-hint', { text: 'UTC' })
    ]));

    var input = el('input.input.input-time', {
      type: 'datetime-local', step: '1',
      value: d.toUtcDateTimeLocal(landingMs()),
      onchange: function (e) {
        var ms = d.parseUtcDateTimeLocal(e.target.value);
        if (isFinite(ms)) {
          S.updateSettings({ landingMs: ms });
          root.RallySync.app.refresh();
        }
      }
    });
    section.appendChild(input);

    var quick = el('div.quick-row');
    [1, 5, 10, 15, 30].forEach(function (mins) {
      quick.appendChild(el('button.btn.btn-quick', {
        type: 'button',
        onclick: function () {
          S.updateSettings({ landingMs: S.now() + mins * 60000 });
          root.RallySync.app.refresh();
        }
      }, ['now +' + mins + 'm']));
    });
    section.appendChild(quick);

    var nudge = el('div.quick-row');
    [-60, -10, -1, 1, 10, 60].forEach(function (secs) {
      nudge.appendChild(el('button.btn.btn-quick.btn-nudge', {
        type: 'button',
        onclick: function () {
          S.updateSettings({ landingMs: landingMs() + secs * 1000 });
          root.RallySync.app.refresh();
        }
      }, [(secs > 0 ? '+' : '') + secs + 's']));
    });
    section.appendChild(nudge);

    section.appendChild(el('p.panel-note.landing-echo', {}, [
      el('strong', { text: d.utcClock(landingMs()) + ' UTC' }),
      ' · ' + d.localClock(landingMs()) + ' ' + d.localZoneName() +
      ' · ' + d.utcDate(landingMs())
    ]));

    if (target && Number(target.gatherSeconds) > 0) {
      section.appendChild(el('p.panel-note', {
        text: 'Rally window of ' + C.formatDuration(target.gatherSeconds) +
          ' is subtracted automatically, so the times below are when to TAP the rally button.'
      }));
    }
    return section;
  }

  function landingMs() {
    var stored = Number(S.data.settings.landingMs);
    if (isFinite(stored) && stored > 0) return stored;
    return S.now() + 15 * 60000;
  }

  function leadSection() {
    var settings = S.data.settings;
    var section = el('section.panel');

    var selected = settings.selectedLeadIds.filter(function (id) { return !!S.findLead(id); });

    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Who is marching' }),
      el('div.panel-actions', {}, [
        el('button.btn.btn-link', {
          type: 'button',
          onclick: function () {
            S.updateSettings({ selectedLeadIds: S.data.leads.map(function (l) { return l.id; }) });
            root.RallySync.app.refresh();
          }
        }, ['All']),
        el('button.btn.btn-link', {
          type: 'button',
          onclick: function () {
            S.updateSettings({ selectedLeadIds: [] });
            root.RallySync.app.refresh();
          }
        }, ['None'])
      ])
    ]));

    if (S.data.leads.length === 0) {
      section.appendChild(el('p.muted', { text: 'No rally leads yet — add them on the Leads tab.' }));
      return section;
    }

    var chips = el('div.chips');
    S.data.leads.forEach(function (lead) {
      var isSelected = selected.indexOf(lead.id) !== -1;
      chips.appendChild(el('button.chip' + (isSelected ? ' is-selected' : ''), {
        type: 'button',
        onclick: function () { toggleLead(lead.id); }
      }, [lead.name || 'Unnamed']));
    });
    section.appendChild(chips);

    if (settings.mode === 'sequence' && selected.length > 1) {
      var orderList = el('ol.order-list');
      selected.forEach(function (id, index) {
        var lead = S.findLead(id);
        orderList.appendChild(el('li.order-item', {}, [
          el('span.order-rank', { text: String(index + 1) }),
          el('span.order-name', { text: lead.name || 'Unnamed' }),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': 'Move earlier', disabled: index === 0,
            onclick: function () { moveLead(index, -1); }
          }, ['↑']),
          el('button.btn.btn-icon', {
            type: 'button', 'aria-label': 'Move later', disabled: index === selected.length - 1,
            onclick: function () { moveLead(index, 1); }
          }, ['↓'])
        ]));
      });
      section.appendChild(orderList);
    }
    return section;
  }

  function toggleLead(id) {
    var ids = S.data.settings.selectedLeadIds.slice();
    var index = ids.indexOf(id);
    if (index === -1) ids.push(id);
    else ids.splice(index, 1);
    S.updateSettings({ selectedLeadIds: ids });
    root.RallySync.app.refresh();
  }

  function moveLead(index, delta) {
    var ids = S.data.settings.selectedLeadIds.slice();
    var next = index + delta;
    if (next < 0 || next >= ids.length) return;
    var tmp = ids[index];
    ids[index] = ids[next];
    ids[next] = tmp;
    S.updateSettings({ selectedLeadIds: ids });
    root.RallySync.app.refresh();
  }

  // -------------------------------------------------------------- calculation

  function recompute() {
    if (!resultsHost) return;
    live = [];
    d.clear(resultsHost);

    var settings = S.data.settings;
    var target = S.findTarget(settings.selectedTargetId);
    var leads = settings.selectedLeadIds
      .map(function (id) { return S.findLead(id); })
      .filter(Boolean);

    if (!target || leads.length === 0) {
      lastPlan = null;
      resultsHost.appendChild(el('div.empty.empty-inline', {}, [
        el('p', { text: !target ? 'Pick a target to see launch times.' : 'Select at least one rally lead.' })
      ]));
      return;
    }

    var plan = C.buildPlan({
      leads: leads,
      target: target,
      zones: S.data.zones,
      measurements: S.data.measurements,
      mode: settings.mode,
      gapSeconds: settings.gapSeconds,
      gatherSeconds: Number(target.gatherSeconds) || 0,
      landingMs: landingMs(),
      nowMs: S.now()
    });
    lastPlan = { plan: plan, target: target };

    if (plan.blockers.length > 0) {
      plan.blockers.forEach(function (message) {
        resultsHost.appendChild(el('div.banner.banner-error', { text: message }));
      });
      return;
    }

    resultsHost.appendChild(resultsHeader(plan, target));
    var list = el('div.results');
    plan.rows.forEach(function (row, index) { list.appendChild(resultRow(row, index, target)); });
    resultsHost.appendChild(list);

    resultsHost.appendChild(el('div.results-footer', {}, [
      el('button.btn.btn-primary.btn-wide', {
        type: 'button',
        onclick: function (e) { copyPlan(e.target); }
      }, ['Copy for Discord'])
    ]));

    tick(S.now());
  }

  function resultsHeader(plan, target) {
    var settings = S.data.settings;
    var landing = landingMs();
    var lastLanding = settings.mode === 'sequence'
      ? landing + Math.max(0, plan.rows.length - 1) * (Number(settings.gapSeconds) || 0) * 1000
      : landing;

    var problems = plan.rows.filter(function (r) { return r.errors.length > 0; }).length;
    var late = plan.rows.filter(function (r) { return r.tooLate; }).length;

    return el('div.results-head', {}, [
      el('div.results-head-main', {}, [
        el('h2.panel-title', { text: 'Launch order' }),
        el('p.results-sub', {
          text: settings.mode === 'sync'
            ? 'All ' + plan.rows.length + ' land at ' + d.utcClock(landing) + ' UTC'
            : plan.rows.length + ' landings, ' + settings.gapSeconds + 's apart, ' +
              d.utcClock(landing) + '–' + d.utcClock(lastLanding) + ' UTC'
        })
      ]),
      problems > 0 ? el('span.tag.tag-error', { text: problems + ' blocked' }) : null,
      late > 0 ? el('span.tag.tag-warn', { text: late + ' too late' }) : null
    ]);
  }

  function resultRow(row, index, target) {
    var hasError = row.errors.length > 0;
    var node = el('div.result' + (hasError ? ' is-error' : '') + (row.tooLate ? ' is-late' : ''));

    var head = el('div.result-head', {}, [
      el('span.result-rank', { text: String(index + 1) }),
      el('span.result-name', { text: row.name || 'Unnamed' }),
      tierBadge(row.tier, hasError)
    ]);
    node.appendChild(head);

    if (hasError) {
      node.appendChild(el('div.result-errors', {}, row.errors.map(function (message) {
        return el('div.result-error', { text: message });
      })));
      return node;
    }

    var gathering = Number(target.gatherSeconds) > 0;

    var timeBlock = el('div.result-time', {}, [
      el('div.result-time-main', {}, [
        el('span.result-time-label', { text: gathering ? 'TAP RALLY' : 'MARCH' }),
        el('span.result-time-value', { text: d.utcClock(row.rallyOpenMs) }),
        el('span.result-time-zone', { text: 'UTC' })
      ]),
      el('div.result-time-local', {
        text: d.localClock(row.rallyOpenMs) + ' ' + d.localZoneName()
      })
    ]);

    var countdownNode = el('span.count-value', { text: '—' });
    var countdownPill = el('div.countdown', {}, [
      countdownNode,
      el('span.count-label', { text: 'until you go' })
    ]);

    node.appendChild(el('div.result-body', {}, [timeBlock, countdownPill]));

    var facts = el('div.result-facts', {}, [
      fact('march', C.formatDuration(row.marchSeconds)),
      gathering ? fact('departs', d.utcClock(row.departMs)) : null,
      fact('lands', d.utcClock(row.landingMs)),
      fact('dist', row.distance.toFixed(1) + ' tiles'),
      row.zoneKeyUsed !== target.zoneKey
        ? fact('zone', Z.zoneLabel(row.zoneKeyUsed))
        : null
    ]);
    node.appendChild(facts);

    row.notes.forEach(function (note) {
      node.appendChild(el('div.result-note', { text: note }));
    });

    live.push({ node: node, countdownNode: countdownNode, pill: countdownPill, rallyOpenMs: row.rallyOpenMs });
    return node;
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
    for (var i = 0; i < live.length; i++) {
      var item = live[i];
      var seconds = (item.rallyOpenMs - nowMs) / 1000;
      item.countdownNode.textContent = seconds <= -1 ? 'gone' : d.countdown(seconds);

      item.pill.classList.toggle('is-imminent', seconds > 0 && seconds <= 30);
      item.pill.classList.toggle('is-now', seconds <= 0 && seconds > -10);
      item.node.classList.toggle('is-late', seconds < -10);
      item.node.classList.toggle('is-next', seconds > 0 && seconds <= 60);
    }
  }

  // ----------------------------------------------------------------- sharing

  function planText() {
    if (!lastPlan) return '';
    var plan = lastPlan.plan;
    var target = lastPlan.target;
    var settings = S.data.settings;
    var gathering = Number(target.gatherSeconds) > 0;

    var lines = [];
    lines.push('**RallySync — ' + (target.name || 'Target') + '**');
    lines.push(settings.mode === 'sync'
      ? 'Sync: everyone lands ' + d.utcClock(landingMs()) + ' UTC'
      : 'Sequence: ' + settings.gapSeconds + 's apart from ' + d.utcClock(landingMs()) + ' UTC');
    lines.push('');
    lines.push('```');
    lines.push((gathering ? 'TAP RALLY' : 'MARCH AT') + '   NAME              MARCH     LANDS');

    plan.rows.forEach(function (row) {
      if (row.errors.length > 0) {
        lines.push(padRight('--:--:--', 11) + padRight(trim(row.name, 17), 18) +
          'BLOCKED: ' + row.errors[0]);
        return;
      }
      lines.push(
        padRight(d.utcClock(row.rallyOpenMs), 11) +
        padRight(trim(row.name || 'Unnamed', 17), 18) +
        padRight(C.formatDuration(row.marchSeconds), 10) +
        d.utcClock(row.landingMs) +
        (row.tier === C.TIER.MEASURED ? '  *exact' : '')
      );
    });
    lines.push('```');
    lines.push('All times UTC.' + (gathering
      ? ' Rally window of ' + C.formatDuration(target.gatherSeconds) + ' already subtracted.'
      : ''));
    lines.push('Rows without `*exact` are estimates — keep a ' +
      (settings.safetyBufferSeconds || 2) + 's buffer.');
    return lines.join('\n');
  }

  function copyPlan(button) {
    var text = planText();
    if (!text) return;
    var original = button.textContent;
    writeClipboard(text).then(function (ok) {
      button.textContent = ok ? '✓ Copied' : 'Press Ctrl+C';
      root.setTimeout(function () { button.textContent = original; }, 1800);
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
    } catch (err) {
      return false;
    }
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
  root.RallySync.views.calculate = { render: render, tick: tick, recompute: recompute };
})(typeof globalThis !== 'undefined' ? globalThis : this);
