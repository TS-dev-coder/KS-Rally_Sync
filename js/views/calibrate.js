/**
 * views/calibrate.js — turn real observed marches into accuracy.
 *
 * Logging a march does two things at once: it pins that exact (lead, target)
 * pair to the real number forever, and it feeds the zone fit so leads who have
 * not measured yet get a better estimate too (RESEARCH-NOTES.md Section 4).
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var C = root.RallySync.calc;
  var Z = root.RallySync.zones;
  var G = root.RallySync.guide;
  var I = root.RallySync.icons;
  var el = d.el;
  var icon = I.icon;

  var draft = { leadId: '', targetId: '', observed: '' };
  var message = null;
  var openZone = null;

  function render(container) {
    d.clear(container);

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: 'Calibrate' }),
        el('p.view-sub', { text: 'Every march you log makes this tool more accurate.' })
      ])
    ]));

    if (message) {
      container.appendChild(el('div.banner.banner-' + message.kind, {}, [
        icon(message.kind === 'error' ? 'alert' : 'check', 16),
        el('span', {}, [
          el('strong', { text: message.text }),
          message.detail ? el('span', { text: ' ' + message.detail }) : null
        ])
      ]));
      message = null;
    }

    container.appendChild(logSection());
    container.appendChild(zonesSection());
    container.appendChild(measurementsSection());
    container.appendChild(samplesSection());
    container.appendChild(presetSection());
  }

  // ------------------------------------------------------ log a real march

  function logSection() {
    var section = el('section.panel.panel-accent');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Log a real march' }),
      el('span.panel-hint', { text: 'exact' })
    ]));
    section.appendChild(el('p.panel-note', {
      text: 'Kingshot shows the true march duration once the rally departs. Read it off and enter it here — that pair becomes exact from then on.'
    }));

    if (S.data.leads.length === 0 || S.data.targets.length === 0) {
      section.appendChild(el('p.muted', {
        text: 'Add at least one rally lead and one target first.'
      }));
      return section;
    }

    section.appendChild(field('Rally lead', selectFrom(
      S.data.leads, draft.leadId, 'Choose a lead',
      function (value) { draft.leadId = value; }
    )));

    section.appendChild(field('Target', selectFrom(
      S.data.targets, draft.targetId, 'Choose a target',
      function (value) { draft.targetId = value; }
    )));

    section.appendChild(field(
      'Observed march time',
      el('input.input', {
        type: 'text', inputmode: 'text', value: draft.observed,
        placeholder: '1m 35s  ·  95  ·  1:35',
        oninput: function (e) { draft.observed = e.target.value; }
      }),
      'Type it however you like — 95, 95s, 1m35s and 1:35 all work.'
    ));
    section.appendChild(G.helpBlock('marchTime'));

    section.appendChild(el('button.btn.btn-primary.btn-wide', {
      type: 'button', onclick: saveMeasurement
    }, ['Save measurement']));

    return section;
  }

  function saveMeasurement() {
    var seconds = C.parseDuration(draft.observed);
    var lead = S.findLead(draft.leadId);
    var target = S.findTarget(draft.targetId);

    if (!lead || !target) {
      return fail('Pick both a rally lead and a target.');
    }
    if (seconds === null || seconds <= 0) {
      return fail('That march time could not be read. Try 95, 95s, 1m35s or 1:35.');
    }
    if (lead.x === null || lead.y === null || lead.marchSpeedUpPercent === null) {
      return fail((lead.name || 'That lead') + ' is missing coordinates or March Speed Up % — fill those in first, or the sample cannot be fitted.');
    }
    if (target.x === null || target.y === null) {
      return fail((target.name || 'That target') + ' has no coordinates yet.');
    }

    // What the model thought, before this observation changes it.
    var zoneKey = target.zoneKey;
    var before = S.findZone(zoneKey);
    var predicted = before
      ? C.marchSecondsForZone(before, lead, target, lead.marchSpeedUpPercent).seconds
      : null;

    S.recordMeasurement(lead.id, target.id, seconds);
    var result = S.recalibrateZone(zoneKey);

    draft.observed = '';
    message = {
      kind: 'ok',
      text: lead.name + ' → ' + target.name + ' is now exact at ' + C.formatDuration(seconds) + '.',
      detail: buildFitDetail(predicted, seconds, zoneKey, result)
    };
    root.RallySync.app.refresh();
  }

  /**
   * Says how far the model was out and what changed, because a measurement that
   * silently disappears into a fit teaches the user nothing about how much the
   * shipped defaults could be trusted.
   */
  function buildFitDetail(predicted, observed, zoneKey, result) {
    var parts = [];

    if (predicted !== null && predicted > 0 && observed > 0) {
      var ratio = predicted / observed;
      if (ratio >= 1.15 || ratio <= 0.87) {
        parts.push('The model predicted ' + C.formatDuration(predicted) + ', so it was ' +
          (ratio > 1 ? ratio.toFixed(2) + '× too slow' : (1 / ratio).toFixed(2) + '× too fast') +
          '. That is the community default being wrong, not your reading.');
      } else {
        parts.push('The model predicted ' + C.formatDuration(predicted) + ' — close already.');
      }
    }

    if (result.ok) {
      parts.push(Z.zoneLabel(zoneKey) + ' refitted to ' +
        result.fit.secPerTile.toFixed(3) + ' s/tile from ' + result.fit.n +
        ' sample' + (result.fit.n === 1 ? '' : 's') + '.');
      if (!result.fit.fittedOffset) {
        parts.push('Log one more at a clearly different distance and the fixed offset can be fitted too, which sharpens everything else.');
      }
    } else {
      parts.push(Z.zoneLabel(zoneKey) + ' not refitted: ' + result.reason);
    }

    return parts.join(' ');
  }

  function fail(text) {
    message = { kind: 'error', text: text };
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------- zone cards

  function zonesSection() {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Zone models' })
    ]));
    section.appendChild(el('p.panel-note', {
      text: 'Constants are editable config, never baked into the math. Reset any zone back to its research default at any time.'
    }));

    S.data.zones.forEach(function (zone) { section.appendChild(zoneCard(zone)); });
    return section;
  }

  function zoneCard(zone) {
    var samples = S.samplesForZone(zone.zoneKey);
    var isOpen = openZone === zone.zoneKey;
    var card = el('div.card' + (isOpen ? ' is-open' : ''));

    card.appendChild(el('button.card-summary', {
      type: 'button',
      'aria-expanded': isOpen ? 'true' : 'false',
      onclick: function () {
        openZone = isOpen ? null : zone.zoneKey;
        root.RallySync.app.refresh();
      }
    }, [
      el('div.card-summary-main', {}, [
        el('div.card-title', {}, [
          zone.label,
          trustBadge(zone.trust)
        ]),
        el('div.card-meta', {}, [
          el('span', { text: zone.constants.secPerTile.toFixed(3) + ' s/tile' }),
          el('span.dot', { text: '·' }),
          el('span', { text: (zone.constants.offset >= 0 ? '+' : '') + Number(zone.constants.offset).toFixed(2) + 's' }),
          el('span.dot', { text: '·' }),
          el('span', { text: samples.length + ' sample' + (samples.length === 1 ? '' : 's') })
        ])
      ]),
      el('span.chev', { text: isOpen ? '▾' : '▸' })
    ]));

    if (!isOpen) return card;

    var body = el('div.card-body');
    var def = Z.zoneDef(zone.zoneKey);
    if (def) body.appendChild(el('p.field-help', { text: def.blurb }));

    if (zone.trust === 'guess') {
      body.appendChild(el('div.banner.banner-warn', {
        text: 'No published source quantifies this zone at all. The numbers below are a placeholder copied from the red zone. Do not trust them until you have logged a real march here.'
      }));
    }

    body.appendChild(el('div.grid-2', {}, [
      field('Seconds per tile', el('input.input', {
        type: 'number', step: '0.001', inputmode: 'decimal',
        value: String(zone.constants.secPerTile),
        onchange: function (e) {
          S.updateZone(zone.zoneKey, { constants: { secPerTile: e.target.value } });
          root.RallySync.app.refresh();
        }
      })),
      field('Fixed offset (s)', el('input.input', {
        type: 'number', step: '0.1', inputmode: 'decimal',
        value: String(zone.constants.offset),
        onchange: function (e) {
          S.updateZone(zone.zoneKey, { constants: { offset: e.target.value } });
          root.RallySync.app.refresh();
        }
      }))
    ]));

    body.appendChild(el('p.formula-preview', {
      text: 'time = ' + zone.constants.secPerTile.toFixed(3) + ' × distance ÷ (1 + speed%/100) ' +
        (zone.constants.offset >= 0 ? '+ ' : '− ') + Math.abs(zone.constants.offset).toFixed(2) + 's'
    }));

    if (zone.fitQuality) {
      body.appendChild(el('div.fit-quality', {}, [
        el('span', { text: 'Fitted to ' + zone.fitQuality.n + ' sample' + (zone.fitQuality.n === 1 ? '' : 's') }),
        el('span.dot', { text: '·' }),
        el('span', { text: 'typical error ' + zone.fitQuality.rmse.toFixed(2) + 's' }),
        el('span.dot', { text: '·' }),
        el('span', { text: 'worst ' + zone.fitQuality.maxErrorSeconds.toFixed(2) + 's' }),
        zone.fitQuality.fittedOffset ? null : el('span.fit-note', {
          text: 'offset held fixed — needs samples at two different distances to fit it'
        })
      ]));
    }

    if (zone.lastFitISO) {
      body.appendChild(el('p.field-help', {
        text: 'Last refitted ' + new Date(zone.lastFitISO).toLocaleString()
      }));
    }

    // Optional geometric Relic model.
    body.appendChild(el('label.toggle-row', {}, [
      el('input', {
        type: 'checkbox', checked: zone.formulaType === 'segmented',
        onchange: function (e) {
          S.updateZone(zone.zoneKey, { formulaType: e.target.checked ? 'segmented' : 'affine' });
          root.RallySync.app.refresh();
        }
      }),
      el('span', {}, [
        el('span.toggle-label', { text: 'Use the geometric Relic model' }),
        el('span.toggle-help', { text: 'Charges only the tiles the route actually spends inside the Relic radius at the slow rate. Physically motivated, but unverified — calibrate before relying on it.' })
      ])
    ]));

    if (zone.formulaType === 'segmented') {
      body.appendChild(el('div.grid-2', {}, [
        segField(zone, 'relicX', 'Relic X', '1'),
        segField(zone, 'relicY', 'Relic Y', '1')
      ]));
      body.appendChild(el('div.grid-2', {}, [
        segField(zone, 'relicRadius', 'Radius (tiles)', '1'),
        segField(zone, 'secPerTileInside', 'Inside s/tile', '0.001')
      ]));
    }

    body.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm('Reset ' + zone.label + ' to its research-phase default?')) {
            S.resetZone(zone.zoneKey);
            message = { kind: 'ok', text: zone.label + ' reset to defaults.' };
            root.RallySync.app.refresh();
          }
        }
      }, ['Reset to default']),
      el('button.btn.btn-secondary', {
        type: 'button', disabled: samples.length === 0,
        onclick: function () {
          var result = S.recalibrateZone(zone.zoneKey);
          message = result.ok
            ? { kind: 'ok', text: zone.label + ' refitted to ' + result.fit.n + ' sample' + (result.fit.n === 1 ? '' : 's') + '.' }
            : { kind: 'error', text: result.reason };
          root.RallySync.app.refresh();
        }
      }, ['Refit from ' + samples.length + ' sample' + (samples.length === 1 ? '' : 's')])
    ]));

    card.appendChild(body);
    return card;
  }

  function segField(zone, key, label, step) {
    return field(label, el('input.input', {
      type: 'number', step: step, inputmode: 'decimal',
      value: String(zone.segmented[key]),
      onchange: function (e) {
        var changes = {};
        changes[key] = e.target.value;
        S.updateZone(zone.zoneKey, { segmented: changes });
        root.RallySync.app.refresh();
      }
    }));
  }

  function trustBadge(trust) {
    if (trust === 'calibrated') return el('span.badge.badge-calibrated', { text: 'calibrated' });
    if (trust === 'manual') return el('span.badge.badge-manual', { text: 'hand-tuned' });
    if (trust === 'guess') return el('span.badge.badge-error', { text: 'guess' });
    return el('span.badge.badge-estimated', { text: 'unverified' });
  }

  // ------------------------------------------------------- saved exact pairs

  function measurementsSection() {
    var keys = Object.keys(S.data.measurements);
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Exact pairs' }),
      el('span.panel-hint', { text: String(keys.length) })
    ]));

    if (keys.length === 0) {
      section.appendChild(el('p.muted', {
        text: 'None yet. Logged marches appear here and override the formula entirely.'
      }));
      return section;
    }

    var list = el('div.rows');
    keys.forEach(function (key) {
      var parts = key.split('|');
      var lead = S.findLead(parts[0]);
      var target = S.findTarget(parts[1]);
      var m = S.data.measurements[key];
      if (!lead || !target) return;

      var fresh = C.measurementIsFresh(m, lead, target);
      list.appendChild(el('div.row-item' + (fresh ? '' : ' is-stale'), {}, [
        el('div.row-main', {}, [
          el('div.row-title', { text: lead.name + ' → ' + target.name }),
          el('div.row-meta', {
            text: fresh
              ? C.formatDuration(m.seconds) + ' · recorded ' + new Date(m.recordedISO).toLocaleDateString()
              : C.formatDuration(m.seconds) + ' · stale, inputs changed since recording'
          })
        ]),
        fresh ? el('span.badge.badge-measured', { text: 'exact' })
              : el('span.badge.badge-error', { text: 'stale' }),
        el('button.btn.btn-icon.btn-danger', {
          type: 'button', 'aria-label': 'Delete measurement',
          onclick: function () { S.deleteMeasurement(lead.id, target.id); }
        }, ['×'])
      ]));
    });
    section.appendChild(list);
    return section;
  }

  // ------------------------------------------------------------- raw samples

  function samplesSection() {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Calibration samples' }),
      el('span.panel-hint', { text: String(S.data.samples.length) })
    ]));

    if (S.data.samples.length === 0) {
      section.appendChild(el('p.muted', { text: 'No samples recorded yet.' }));
      return section;
    }

    var list = el('div.rows');
    S.data.samples.slice().reverse().forEach(function (sample) {
      list.appendChild(el('div.row-item', {}, [
        el('div.row-main', {}, [
          el('div.row-title', {
            text: Z.zoneLabel(sample.zoneKey) + ' · ' + C.formatDuration(sample.observedTimeSeconds)
          }),
          el('div.row-meta', {
            text: sample.distance.toFixed(1) + ' tiles at +' + sample.speedPercent + '% · ' +
              new Date(sample.dateRecorded).toLocaleDateString()
          })
        ]),
        el('button.btn.btn-icon.btn-danger', {
          type: 'button', 'aria-label': 'Delete sample',
          onclick: function () { S.deleteSample(sample.id); }
        }, ['×'])
      ]));
    });
    section.appendChild(list);
    return section;
  }

  // ------------------------------------------------------------- model preset

  function presetSection() {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Starting model' })
    ]));
    section.appendChild(el('p.panel-note', {
      text: 'Two community models disagree by roughly 2× on seconds per tile, and neither shows its data. Pick a starting point, then let real samples settle it. Switching discards every fit and hand-edit.'
    }));

    Object.keys(Z.MODEL_PRESETS).forEach(function (id) {
      var preset = Z.MODEL_PRESETS[id];
      var selected = S.data.settings.presetId === id;
      section.appendChild(el('button.preset' + (selected ? ' is-selected' : ''), {
        type: 'button',
        onclick: function () {
          if (selected) return;
          if (root.confirm('Switch to the ' + preset.label + '? All fitted and hand-edited constants are discarded. Your logged marches and samples are kept.')) {
            S.applyPreset(id);
            message = { kind: 'ok', text: 'Switched to the ' + preset.label + '. Refit each zone from your samples.' };
            root.RallySync.app.refresh();
          }
        }
      }, [
        el('span.preset-label', {}, [preset.label, selected ? el('span.badge.badge-calibrated', { text: 'active' }) : null]),
        el('span.preset-note', { text: preset.note })
      ]));
    });
    return section;
  }

  // ---------------------------------------------------------------- helpers

  function selectFrom(items, selectedId, placeholder, onchange) {
    var options = [el('option', { value: '', selected: !selectedId }, [placeholder])];
    items.forEach(function (item) {
      options.push(el('option', {
        value: item.id, selected: item.id === selectedId
      }, [item.name || 'Unnamed']));
    });
    return el('select.input', {
      onchange: function (e) { onchange(e.target.value); }
    }, options);
  }

  function field(label, input, help) {
    return el('label.field', {}, [
      el('span.field-label', { text: label }),
      input,
      help ? el('span.field-help', { text: help }) : null
    ]);
  }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.calibrate = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
