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
  var T = root.RallySync.i18n;
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
        el('h2.view-title', { text: T.t('cal.calibrate') }),
        el('p.view-sub', { text: T.t('cal.everyMarchYouLog') })
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
      el('h2.panel-title', { text: T.t('cal.logARealMarch') }),
      el('span.panel-hint', { text: T.t('cal.exact') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('cal.kingshotShowsTheTrue')
    }));

    if (S.data.leads.length === 0 || S.data.targets.length === 0) {
      section.appendChild(el('p.muted', {
        text: T.t('cal.addAtLeastOne')
      }));
      return section;
    }

    section.appendChild(field(T.t('cal.rallyLead'), selectFrom(
      S.data.leads, draft.leadId, T.t('btn.chooseLead'),
      function (value) { draft.leadId = value; }
    )));

    section.appendChild(field(T.t('cal.targetField'), selectFrom(
      S.data.targets, draft.targetId, T.t('btn.chooseTarget'),
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
    }, [T.t('btn.saveMeasurement')]));

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
      return fail(T.t('cal.timeUnreadable'));
    }
    if (lead.x === null || lead.y === null || lead.marchSpeedUpPercent === null) {
      return fail(T.t('cal.leadMissingData', { name: lead.name || T.t('common.thatLead') }));
    }
    if (target.x === null || target.y === null) {
      return fail(T.t('cal.targetNoCoords', { name: target.name || T.t('common.thatTarget') }));
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
      text: T.t('cal.pairNowExact', {
        lead: lead.name, target: target.name, time: C.formatDuration(seconds)
      }),
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
        parts.push(T.t('cal.modelWasOff', {
          time: C.formatDuration(predicted),
          factor: ratio > 1
            ? T.t('cal.tooSlow', { n: ratio.toFixed(2) })
            : T.t('cal.tooFast', { n: (1 / ratio).toFixed(2) })
        }));
      } else {
        parts.push(T.t('cal.modelWasClose', { time: C.formatDuration(predicted) }));
      }
    }

    if (result.ok) {
      var refitted = S.findZone(zoneKey);
      parts.push(T.t(result.fit.n === 1 ? 'cal.zoneRefittedOne' : 'cal.zoneRefittedMany', {
        zone: Z.zoneLabel(zoneKey), summary: summarise(refitted), n: result.fit.n
      }));
      if (result.fit.n < 2) {
        parts.push(T.t('cal.oneSampleOnly'));
      }
    } else {
      parts.push(T.t('cal.zoneNotRefitted', {
        zone: Z.zoneLabel(zoneKey), reason: result.reason
      }));
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
      el('h2.panel-title', { text: T.t('cal.zoneModels') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('cal.constantsAreEditableConfig')
    }));

    S.data.zones.forEach(function (zone) { section.appendChild(zoneCard(zone)); });

    section.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        title: T.t('cal.discardEveryFitAnd'),
        onclick: function () {
          if (root.confirm(T.t('confirm.resetAllZones'))) {
            S.resetAllZones();
            message = { kind: 'ok', text: T.t('cal.allZonesResetTo') };
            root.RallySync.app.refresh();
          }
        }
      }, [T.t('btn.resetZones')])
    ]));
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
          el('span', { text: summarise(zone) }),
          el('span.dot', { text: '·' }),
          el('span', {
            text: T.t(samples.length === 1 ? 'cal.nSamplesOne' : 'cal.nSamplesMany',
              { n: samples.length })
          })
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
        text: T.t('cal.noPublishedSourceQuantifies')
      }));
    }

    if (zone.formulaType === 'power') {
      body.appendChild(el('div.grid-2', {}, [
        field(T.t('cal.coefficient'), constantInput(zone, 'coefficient', '0.00001')),
        field(T.t('cal.exponent'), constantInput(zone, 'exponent', '0.0001'))
      ]));
      body.appendChild(el('p.field-help', {
        text: T.t('cal.realMarchesShowTime')
      }));
    } else {
      body.appendChild(el('div.grid-2', {}, [
        field(T.t('cal.secondsPerTile'), constantInput(zone, 'secPerTile', '0.001')),
        field(T.t('cal.fixedOffset'), constantInput(zone, 'offset', '0.1'))
      ]));
    }

    body.appendChild(el('p.formula-preview', { text: formulaText(zone) }));

    if (zone.fitQuality) {
      body.appendChild(el('div.fit-quality', {}, [
        el('span', {
          text: T.t(zone.fitQuality.n === 1 ? 'cal.fittedToOne' : 'cal.fittedToMany',
            { n: zone.fitQuality.n })
        }),
        el('span.dot', { text: '·' }),
        el('span', { text: T.t('cal.typicalErrorOf', { value: zone.fitQuality.rmse.toFixed(2) }) }),
        el('span.dot', { text: '·' }),
        el('span', { text: T.t('cal.worstOf', { value: zone.fitQuality.maxErrorSeconds.toFixed(2) }) }),
        zone.fitQuality.fittedOffset ? null : el('span.fit-note', {
          text: T.t('cal.offsetHeldFixedNeeds')
        })
      ]));
    }

    if (zone.lastFitISO) {
      body.appendChild(el('p.field-help', {
        text: T.t('cal.lastRefittedOn', { date: new Date(zone.lastFitISO).toLocaleString() })
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
        el('span.toggle-label', { text: T.t('cal.useTheGeometricRelic') }),
        el('span.toggle-help', { text: T.t('cal.chargesOnlyTheTiles') })
      ])
    ]));

    if (zone.formulaType === 'segmented') {
      body.appendChild(el('div.grid-2', {}, [
        segField(zone, 'relicX', T.t('cal.relicX'), '1'),
        segField(zone, 'relicY', T.t('cal.relicY'), '1')
      ]));
      body.appendChild(el('div.grid-2', {}, [
        segField(zone, 'relicRadius', T.t('cal.radiusTiles'), '1'),
        segField(zone, 'secPerTileInside', T.t('cal.insidePerTile'), '0.001')
      ]));
    }

    body.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm(T.t('confirm.resetZone', { zone: zone.label }))) {
            S.resetZone(zone.zoneKey);
            message = { kind: 'ok', text: T.t('cal.zoneReset', { zone: zone.label }) };
            root.RallySync.app.refresh();
          }
        }
      }, [T.t('btn.resetDefault')]),
      el('button.btn.btn-secondary', {
        type: 'button', disabled: samples.length === 0,
        onclick: function () {
          var result = S.recalibrateZone(zone.zoneKey);
          message = result.ok
            ? { kind: 'ok', text: T.t(
                result.fit.n === 1 ? 'cal.zoneRefitOne' : 'cal.zoneRefitMany',
                { zone: zone.label, n: result.fit.n }) }
            : { kind: 'error', text: result.reason };
          root.RallySync.app.refresh();
        }
      }, [T.t(samples.length === 1 ? 'btn.refitOne' : 'btn.refitMany',
        { n: samples.length })])
    ]));

    card.appendChild(body);
    return card;
  }

  function constantInput(zone, key, step) {
    return el('input.input', {
      type: 'number', step: step, inputmode: 'decimal',
      value: String(zone.constants[key]),
      onchange: function (e) {
        var changes = {};
        changes[key] = e.target.value;
        S.updateZone(zone.zoneKey, { constants: changes });
        root.RallySync.app.refresh();
      }
    });
  }

  // i18n-exempt: the strings below are mathematical notation, which reads the
  // same in every language. Only the words inside it are keyed.
  /** One line describing a zone, whichever model it runs on. */
  function summarise(zone) {
    if (zone.formulaType === 'power') {
      // i18n-exempt: notation
      return Number(zone.constants.coefficient).toFixed(3) + ' × dist^' +
        Number(zone.constants.exponent).toFixed(3);
    }
    if (zone.formulaType === 'piecewise') {
      return T.t('cal.piecewiseSummary', {
        near: Number(zone.constants.nearRate).toFixed(3),
        join: Number(zone.constants.join),
        far: Number(zone.constants.farRate).toFixed(3)
      });
    }
    return Number(zone.constants.secPerTile).toFixed(3) + ' s/tile · ' +
      (zone.constants.offset >= 0 ? '+' : '') + Number(zone.constants.offset).toFixed(2) + 's';
  }

  // i18n-exempt: mathematical notation. It reads identically in every
  // language, and only the words inside it (cal.speedDivisor) are keyed.
  function formulaText(zone) {
    var speed = ' ' + T.t('cal.speedDivisor');
    if (zone.formulaType === 'power') {
      // i18n-exempt: notation
      return 'time = ' + Number(zone.constants.coefficient).toFixed(5) +
        ' × distance^' + Number(zone.constants.exponent).toFixed(5) + speed;
    }
    if (zone.formulaType === 'piecewise') {
      // Three branches joined at fixed distances. Written as notation rather
      // than prose so it reads the same in every language.
      var c = zone.constants;
      var j = Number(c.join);
      var sj = Number(c.shortJoin);
      return 'd ≤ ' + sj + ':  ' + Number(c.shortRate).toFixed(4) + '·(d−' + sj + ') + ' +
        Number(c.shortSeconds).toFixed(2) + '\n' +
        'd ≤ ' + j + ':  ' + Number(c.nearRate).toFixed(4) + '·d + ' +
        Number(c.nearOffset).toFixed(2) + '\n' +
        'd > ' + j + ':  ' + Number(c.farRate).toFixed(4) + '·(d−' + j + ') + ' +
        Number(c.farSqrt).toFixed(3) + '·(√d−√' + j + ') + ' +
        Number(c.joinSeconds).toFixed(2) + '\n' +
        '× ' + Number(c.baselineMultiplier).toFixed(2) + speed;
    }
    return 'time = ' + Number(zone.constants.secPerTile).toFixed(3) +  // i18n-exempt
      ' × distance' + speed + ' ' +
      (zone.constants.offset >= 0 ? '+ ' : '− ') +
      Math.abs(Number(zone.constants.offset)).toFixed(2) + 's';
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
    if (trust === 'calibrated') return el('span.badge.badge-calibrated', { text: T.t('cal.calibrated') });
    if (trust === 'manual') return el('span.badge.badge-manual', { text: T.t('cal.handTuned') });
    if (trust === 'guess') return el('span.badge.badge-error', { text: T.t('cal.guess') });
    return el('span.badge.badge-estimated', { text: T.t('cal.unverified') });
  }

  // ------------------------------------------------------- saved exact pairs

  function measurementsSection() {
    var keys = Object.keys(S.data.measurements);
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('cal.exactPairs') }),
      el('span.panel-hint', { text: String(keys.length) })
    ]));

    if (keys.length === 0) {
      section.appendChild(el('p.muted', {
        text: T.t('cal.noneYetLoggedMarches')
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
              ? T.t('cal.recordedOn', {
                  time: C.formatDuration(m.seconds),
                  date: new Date(m.recordedISO).toLocaleDateString()
                })
              : T.t('cal.staleSince', { time: C.formatDuration(m.seconds) })
          })
        ]),
        fresh ? el('span.badge.badge-measured', { text: T.t('cal.exact2') })
              : el('span.badge.badge-error', { text: T.t('cal.stale') }),
        el('button.btn.btn-icon.btn-danger', {
          type: 'button', 'aria-label': T.t('cal.deleteMeasurement'),
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
      el('h2.panel-title', { text: T.t('cal.calibrationSamples') }),
      el('span.panel-hint', { text: String(S.data.samples.length) })
    ]));

    if (S.data.samples.length === 0) {
      section.appendChild(el('p.muted', { text: T.t('cal.noSamplesRecordedYet') }));
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
            text: T.t('cal.sampleMeta', {
              tiles: sample.distance.toFixed(1),
              speed: sample.speedPercent,
              date: new Date(sample.dateRecorded).toLocaleDateString()
            })
          })
        ]),
        el('button.btn.btn-icon.btn-danger', {
          type: 'button', 'aria-label': T.t('cal.deleteSample'),
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
      el('h2.panel-title', { text: T.t('cal.startingModel') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('cal.twoCommunityModelsDisagree')
    }));

    Object.keys(Z.MODEL_PRESETS).forEach(function (id) {
      var preset = Z.MODEL_PRESETS[id];
      var selected = S.data.settings.presetId === id;
      section.appendChild(el('button.preset' + (selected ? ' is-selected' : ''), {
        type: 'button',
        onclick: function () {
          if (selected) return;
          if (root.confirm(T.t('confirm.switchModel', { model: preset.label }))) {
            S.applyPreset(id);
            message = { kind: 'ok', text: T.t('cal.switchedToModel', { model: preset.label }) };
            root.RallySync.app.refresh();
          }
        }
      }, [
        el('span.preset-label', {}, [preset.label, selected ? el('span.badge.badge-calibrated', { text: T.t('cal.active') }) : null]),
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
