/**
 * views/settings.js — clock correction, safety buffer, backup, and the
 * honesty notes the PRD requires in the UI (Section 14).
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var storage = root.RallySync.storage;
  var el = d.el;

  var message = null;

  function render(container) {
    d.clear(container);

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: 'Settings' }),
        el('p.view-sub', { text: 'Everything stays on this device.' })
      ])
    ]));

    if (message) {
      container.appendChild(el('div.banner.banner-' + message.kind, { text: message.text }));
      message = null;
    }

    container.appendChild(themeSection());
    container.appendChild(clockSection());
    container.appendChild(bufferSection());
    container.appendChild(backupSection());
    container.appendChild(aboutSection());
  }

  // ------------------------------------------------------------------- theme

  function themeSection() {
    var current = S.data.settings.theme || 'system';
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Appearance' })
    ]));
    section.appendChild(el('p.panel-note', {
      text: 'Follows your device by default. Dark uses layered dark greys rather than pure black, which is easier on the eyes during a long night event.'
    }));

    var options = [
      ['system', 'System', 'theme-swatch-system'],
      ['light', 'Light', 'theme-swatch-light'],
      ['dark', 'Dark', 'theme-swatch-dark']
    ];

    section.appendChild(el('div.theme-row', {}, options.map(function (opt) {
      return el('button.theme-btn' + (current === opt[0] ? ' is-selected' : ''), {
        type: 'button',
        'aria-pressed': current === opt[0] ? 'true' : 'false',
        onclick: function () {
          S.updateSettings({ theme: opt[0] });
          root.RallySync.app.applyTheme(opt[0]);
          root.RallySync.app.refresh();
        }
      }, [
        el('span.theme-swatch.' + opt[2]),
        el('span', { text: opt[1] })
      ]);
    })));

    return section;
  }

  // -------------------------------------------------------------------- clock

  function clockSection() {
    var settings = S.data.settings;
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Clock correction' })
    ]));
    section.appendChild(el('p.panel-note', {
      text: 'Every launch time is only as good as this device’s clock. Compare the reading below against the in-game event timer; if they differ, correct it here.'
    }));

    var deviceRow = el('div.clock-compare', {}, [
      el('div.clock-block', {}, [
        el('span.clock-label', { text: 'Device UTC' }),
        el('span.clock-value', { text: d.utcClock(Date.now()) })
      ]),
      el('div.clock-block', {}, [
        el('span.clock-label', { text: 'Corrected UTC' }),
        el('span.clock-value.clock-value-primary', { text: d.utcClock(S.now()) })
      ])
    ]);
    section.appendChild(deviceRow);

    section.appendChild(el('label.field', {}, [
      el('span.field-label', { text: 'My clock is ahead by (seconds)' }),
      el('div.stepper', {}, [
        el('button.btn.btn-step', {
          type: 'button', onclick: function () { bumpOffset(-1); }
        }, ['−']),
        el('input.input.input-num', {
          type: 'number', step: '0.1', inputmode: 'decimal',
          value: String(settings.clockOffsetSeconds || 0),
          onchange: function (e) {
            S.updateSettings({ clockOffsetSeconds: Number(e.target.value) || 0 });
            root.RallySync.app.refresh();
          }
        }),
        el('button.btn.btn-step', {
          type: 'button', onclick: function () { bumpOffset(1); }
        }, ['+'])
      ]),
      el('span.field-help', {
        text: 'Use a negative number if this device is behind the game. The app subtracts this from every displayed time and countdown.'
      })
    ]));

    return section;
  }

  function bumpOffset(delta) {
    var next = Math.round(((Number(S.data.settings.clockOffsetSeconds) || 0) + delta) * 10) / 10;
    S.updateSettings({ clockOffsetSeconds: next });
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------ safety buffer

  function bufferSection() {
    var settings = S.data.settings;
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Safety buffer' })
    ]));
    section.appendChild(el('p.panel-note', {
      text: 'Shown alongside estimated rows as the margin to keep. It does not shift any calculated time — it is advice, not a fudge factor.'
    }));
    section.appendChild(el('label.field', {}, [
      el('span.field-label', { text: 'Recommended buffer (seconds)' }),
      el('input.input', {
        type: 'number', min: '0', step: '1', inputmode: 'numeric',
        value: String(settings.safetyBufferSeconds),
        onchange: function (e) {
          S.updateSettings({ safetyBufferSeconds: Math.max(0, Number(e.target.value) || 0) });
        }
      })
    ]));
    return section;
  }

  // ------------------------------------------------------------------ backup

  function backupSection() {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Backup' })
    ]));

    if (!storage.available()) {
      section.appendChild(el('div.banner.banner-error', {
        text: 'This browser is blocking site storage, so nothing will survive a reload. Export a backup before you close the tab.'
      }));
    } else {
      section.appendChild(el('p.panel-note', {
        text: 'iOS wipes website storage after 7 days without a visit — that hits every browser storage type, not just this one. Add RallySync to your Home Screen to be exempt, and keep an exported backup.'
      }));
    }

    section.appendChild(el('div.button-row', {}, [
      el('button.btn.btn-secondary', { type: 'button', onclick: exportBackup }, ['Export backup']),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () { d.$('#import-file').click(); }
      }, ['Import backup'])
    ]));

    section.appendChild(el('input', {
      type: 'file', id: 'import-file', accept: 'application/json,.json',
      style: 'display:none',
      onchange: function (e) { importFile(e.target.files && e.target.files[0]); }
    }));

    section.appendChild(el('details.details', {}, [
      el('summary', { text: 'Paste a backup instead' }),
      el('textarea.input.textarea', {
        id: 'import-paste', rows: '4', placeholder: 'Paste exported JSON here'
      }),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () {
          var area = d.$('#import-paste');
          applyImport(area ? area.value : '');
        }
      }, ['Import pasted JSON'])
    ]));

    section.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm('Erase all leads, targets, measurements and calibration on this device? This cannot be undone.')) {
            storage.clearAll();
            root.location.reload();
          }
        }
      }, ['Erase everything'])
    ]));

    return section;
  }

  function exportBackup() {
    var payload = storage.exportAll();
    var text = JSON.stringify(payload, null, 2);
    var name = 'rallysync-backup-' + d.utcDate(Date.now()) + '.json';
    try {
      var blob = new root.Blob([text], { type: 'application/json' });
      var url = root.URL.createObjectURL(blob);
      var link = el('a', { href: url, download: name });
      root.document.body.appendChild(link);
      link.click();
      root.document.body.removeChild(link);
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
      message = { kind: 'ok', text: 'Backup exported as ' + name + '.' };
    } catch (err) {
      message = { kind: 'error', text: 'Download blocked. Open “Paste a backup instead” and copy the JSON out manually.' };
    }
    root.RallySync.app.refresh();
  }

  function importFile(file) {
    if (!file) return;
    var reader = new root.FileReader();
    reader.onload = function () { applyImport(String(reader.result)); };
    reader.onerror = function () {
      message = { kind: 'error', text: 'That file could not be read.' };
      root.RallySync.app.refresh();
    };
    reader.readAsText(file);
  }

  function applyImport(text) {
    var payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      message = { kind: 'error', text: 'That is not valid JSON.' };
      return root.RallySync.app.refresh();
    }
    var result = storage.importAll(payload);
    if (!result.ok) {
      message = { kind: 'error', text: result.error };
      return root.RallySync.app.refresh();
    }
    S.load();
    message = { kind: 'ok', text: 'Backup restored (' + result.imported.join(', ') + ').' };
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------------- about

  function aboutSection() {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'How accurate is this?' })
    ]));

    section.appendChild(el('div.tier-legend', {}, [
      legendRow('measured', 'Exact', 'A real march you logged for this exact lead and target. No formula involved.'),
      legendRow('calibrated', 'Calibrated', 'Zone constants fitted to your own recorded samples.'),
      legendRow('estimated', 'Estimated', 'Unverified community defaults. Keep a safety buffer.')
    ]));

    section.appendChild(el('p.panel-note', {
      text: 'The developer publishes no march formula. The two community models available disagree by roughly 2× on seconds per tile, and the “ceiling model” some sites cite for the red zone is never actually defined anywhere — so RallySync does not pretend to implement it. Log real marches and the estimates stop mattering.'
    }));

    section.appendChild(el('p.panel-note.muted', {
      text: 'Full sourcing, disagreements and open questions are written up in RESEARCH-NOTES.md alongside this app.'
    }));

    return section;
  }

  function legendRow(kind, title, body) {
    return el('div.legend-row', {}, [
      el('span.badge.badge-' + kind, { text: title }),
      el('span.legend-text', { text: body })
    ]);
  }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.settings = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
