/**
 * views/settings.js — clock correction, safety buffer, backup, and the
 * honesty notes the PRD requires in the UI (Section 14).
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var T = root.RallySync.i18n;
  var storage = root.RallySync.storage;
  var I = root.RallySync.icons;
  var el = d.el;
  var icon = I.icon;

  var message = null;

  function render(container) {
    d.clear(container);

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: T.t('set.settings') }),
        el('p.view-sub', { text: T.t('set.everythingStaysOnThis') })
      ])
    ]));

    if (message) {
      container.appendChild(el('div.banner.banner-' + message.kind, { text: message.text }));
      message = null;
    }

    container.appendChild(versionSection());
    container.appendChild(root.RallySync.howto.walkthrough());
    container.appendChild(languageSection());
    container.appendChild(themeSection());
    container.appendChild(clockSection());
    container.appendChild(alarmSection());
    container.appendChild(backgroundSection());
    container.appendChild(bufferSection());
    container.appendChild(backupSection());
    container.appendChild(aboutSection());
  }

  // ----------------------------------------------------------------- version

  var updateState = null;   // null | 'checking' | result object

  function versionSection() {
    var V = root.RallySync.version;
    var section = el('section.panel');

    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('set.version') }),
      el('span.panel-hint', { text: 'v' + V.VERSION })
    ]));

    section.appendChild(el('div.clock-compare', {}, [
      el('div.clock-block', {}, [
        el('span.clock-label', { text: T.t('set.release') }),
        el('span.clock-value.clock-value-primary', { text: 'v' + V.VERSION })
      ]),
      el('div.clock-block', {}, [
        el('span.clock-label', { text: T.t('set.published') }),
        el('span.clock-value.clock-value-small', { text: V.buildText() })
      ])
    ]));

    section.appendChild(el('p.panel-note', {
      text: T.t('set.publishedIsWhenThe')
    }));

    if (updateState && updateState !== 'checking') {
      if (!updateState.ok) {
        section.appendChild(el('div.banner.banner-warn', {}, [
          icon('alert', 16), el('span', { text: updateState.reason })
        ]));
      } else if (updateState.stale) {
        section.appendChild(el('div.banner.banner-warn', {}, [
          icon('alert', 16),
          el('span', {}, [
            el('strong', { text: T.t('set.aNewerVersionIs') }),
            T.t('set.publishedAt', {
              when: d.utcDate(updateState.latestMs) + ' ' + d.utcClock(updateState.latestMs)
            })
          ])
        ]));
        section.appendChild(el('button.btn.btn-primary.btn-wide', {
          type: 'button', onclick: function () { V.reloadFresh(); }
        }, [T.t('btn.reloadUpdate')]));
        return section;
      } else {
        section.appendChild(el('div.banner.banner-ok', {}, [
          icon('check', 16), el('span', { text: T.t('set.thisIsTheLatest') })
        ]));
      }
    }

    section.appendChild(el('button.btn.btn-secondary.btn-wide', {
      type: 'button',
      disabled: updateState === 'checking',
      onclick: function () {
        updateState = 'checking';
        root.RallySync.app.refresh();
        V.checkForUpdate().then(function (result) {
          updateState = result;
          root.RallySync.app.refresh();
        });
      }
    }, [updateState === 'checking' ? T.t('btn.checking') : T.t('btn.checkUpdates')]));

    return section;
  }

  // ---------------------------------------------------------------- language

  /**
   * The seventeen languages Kingshot itself ships in. "Automatic" follows the
   * browser, which is the right default: a player who reads the game in Turkish
   * should not have to find this screen first.
   *
   * Each option shows its own name in its own script, because someone looking
   * for their language is scanning for how THEY write it, not for the English
   * word for it.
   */
  function byCode(code) {
    var found = null;
    T.LANGUAGES.forEach(function (l) { if (l.code === code) found = l; });
    return found;
  }

  function languageSection() {
    var chosen = S.data.settings.language;
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('head.language') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('set.languagesNote')
    }));

    // One list, in one place. This used to be a second grid of every language
    // that had to be kept in step with the sheet the nav opens; two lists of
    // seventeen languages is two chances to drift.
    var active = chosen ? byCode(chosen) : null;

    section.appendChild(el('div.lang-current', {}, [
      el('div.lang-current-main', {}, [
        el('span.lang-current-label', { text: T.t('head.language') }),
        el('span.lang-current-value', {
          lang: (active || byCode(T.detect()) || byCode('en')).code,
          // Name the language either way, and say when it is following the
          // device rather than a choice -- "Automatic" alone does not tell you
          // which language you actually ended up in.
          text: active
            ? active.native + ' · ' + active.english
            : (byCode(T.detect()) || byCode('en')).native + ' · ' + T.t('set.automatic')
        })
      ]),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function (e) { root.RallySync.langPicker.open(e.currentTarget); }
      }, [icon('globe', 15), el('span', { text: T.t('set.changeLanguage') })])
    ]));

    return section;
  }

  // ------------------------------------------------------------------- theme

  function themeSection() {
    var current = S.data.settings.theme || 'system';
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('set.appearance') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('set.followsYourDeviceBy')
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
      el('h2.panel-title', { text: T.t('set.clockCorrection') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('set.everyLaunchTimeIs')
    }));

    var deviceRow = el('div.clock-compare', {}, [
      el('div.clock-block', {}, [
        el('span.clock-label', { text: T.t('set.deviceUtc') }),
        el('span.clock-value', { text: d.utcClock(Date.now()) })
      ]),
      el('div.clock-block', {}, [
        el('span.clock-label', { text: T.t('set.correctedUtc') }),
        el('span.clock-value.clock-value-primary', { text: d.utcClock(S.now()) })
      ])
    ]);
    section.appendChild(deviceRow);

    section.appendChild(el('label.field', {}, [
      el('span.field-label', { text: T.t('set.myClockIsAhead') }),
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
        text: T.t('set.useANegativeNumber')
      })
    ]));

    return section;
  }

  function bumpOffset(delta) {
    var next = Math.round(((Number(S.data.settings.clockOffsetSeconds) || 0) + delta) * 10) / 10;
    S.updateSettings({ clockOffsetSeconds: next });
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------------ alarm

  function alarmSection() {
    var settings = S.data.settings;
    var on = settings.alarmEnabled !== false;

    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('set.launchAlarm') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('set.onByDefaultSounds')
    }));

    section.appendChild(el('label.toggle-row', {}, [
      el('input', {
        type: 'checkbox', checked: on,
        onchange: function (e) {
          S.updateSettings({ alarmEnabled: e.target.checked });
          if (e.target.checked) root.RallySync.alarm.prime();
          root.RallySync.app.refresh();
        }
      }),
      el('span', {}, [
        el('span.toggle-label', { text: T.t('set.soundAndVibrateBefore') }),
        el('span.toggle-help', {
          text: root.RallySync.alarm.supported()
            ? T.t('set.audioArmsOnTap')
            : T.t('set.audioUnsupported')
        })
      ])
    ]));

    if (on) {
      section.appendChild(el('label.field', {}, [
        el('span.field-label', { text: T.t('set.warnThisManySeconds') }),
        el('input.input', {
          type: 'number', min: '0', max: '120', step: '1', inputmode: 'numeric',
          value: String(settings.alarmLeadSeconds),
          onchange: function (e) {
            var n = Number(e.target.value);
            S.updateSettings({ alarmLeadSeconds: isFinite(n) ? Math.max(0, Math.min(120, n)) : 10 });
          }
        })
      ]));
      section.appendChild(el('label.field', {}, [
        el('span.field-label', { text: T.t('set.volume') }),
        el('input.input.volume-slider', {
          type: 'range', min: '0', max: '1', step: '0.05',
          value: String(settings.alarmVolume === undefined ? 0.8 : settings.alarmVolume),
          oninput: function (e) {
            var v = Number(e.target.value);
            root.RallySync.alarm.setVolume(v);
            S.updateSettings({ alarmVolume: v });
          }
        })
      ]));

      var speechOn = settings.speechEnabled !== false;
      section.appendChild(el('label.toggle-row', {}, [
        el('input', {
          type: 'checkbox', checked: speechOn,
          onchange: function (e) {
            S.updateSettings({ speechEnabled: e.target.checked });
            root.RallySync.alarm.setSpeech(e.target.checked);
            root.RallySync.app.refresh();
          }
        }),
        el('span', {}, [
          el('span.toggle-label', { text: T.t('set.sayItOutLoud') }),
          el('span.toggle-help', {
            text: root.RallySync.alarm.speechSupported()
              ? T.t('set.speechHelp')
              : T.t('set.speechUnsupported')
          })
        ])
      ]));

      section.appendChild(el('div.button-row', {}, [
        el('button.btn.btn-secondary', {
          type: 'button',
          onclick: function () {
            if (root.RallySync.alarm.prime()) root.RallySync.alarm.warn();
          }
        }, [T.t('btn.testWarning')]),
        speechOn ? el('button.btn.btn-secondary', {
          type: 'button',
          onclick: function () {
            root.RallySync.alarm.prime();
            var lead = S.data.leads[0];
            root.RallySync.alarm.speak(T.t('speech.rallyIn', {
              name: lead && lead.name ? lead.name : 'TS', seconds: 30
            }));
          }
        }, [T.t('btn.testVoice')]) : null,
        el('button.btn.btn-secondary', {
          type: 'button',
          onclick: function () {
            if (root.RallySync.alarm.prime()) root.RallySync.alarm.go();
          }
        }, [T.t('btn.testAlarm')])
      ]));
    }

    return section;
  }

  // -------------------------------------------------------------- background

  function backgroundSection() {
    var settings = S.data.settings;
    var on = settings.keepAwake !== false;
    var status = root.RallySync.keepAlive.status();

    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('set.keepRunningInThe') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('set.browsersSlowHiddenTabs')
    }));

    section.appendChild(el('label.toggle-row', {}, [
      el('input', {
        type: 'checkbox', checked: on,
        onchange: function (e) {
          S.updateSettings({ keepAwake: e.target.checked });
          if (!e.target.checked) root.RallySync.keepAlive.stop();
          root.RallySync.app.refresh();
        }
      }),
      el('span', {}, [
        el('span.toggle-label', { text: T.t('set.holdTheTabAwake') }),
        el('span.toggle-help', {
          text: T.t('set.playsASilentTrack')
        })
      ])
    ]));

    section.appendChild(el('p.panel-note.muted', {
      text: T.t('set.alarmClockNote')
    }));

    if (on) {
      section.appendChild(el('div.fit-quality', {}, [
        el('span', {
          text: T.t(status.running ? 'set.bgActiveNow' : 'set.bgIdle')
        }),
        el('span.dot', { text: '·' }),
        el('span', {
          text: status.wakeLockSupported
            ? T.t(status.wakeLock ? 'set.screenHeld' : 'set.screenLockAvailable')
            : T.t('set.screenLockUnsupported')
        })
      ]));
    }

    return section;
  }

  // ------------------------------------------------------------ safety buffer

  function bufferSection() {
    var settings = S.data.settings;
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('set.safetyBuffer') })
    ]));
    section.appendChild(el('p.panel-note', {
      text: T.t('set.shownAlongsideEstimatedRows')
    }));
    section.appendChild(el('label.field', {}, [
      el('span.field-label', { text: T.t('set.recommendedBufferSeconds') }),
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
      el('h2.panel-title', { text: T.t('set.backup') })
    ]));

    if (!storage.available()) {
      section.appendChild(el('div.banner.banner-error', {
        text: T.t('set.thisBrowserIsBlocking')
      }));
    } else {
      section.appendChild(el('p.panel-note', {
        text: T.t('set.iosWipesWebsiteStorage')
      }));
    }

    section.appendChild(el('div.button-row', {}, [
      el('button.btn.btn-secondary', { type: 'button', onclick: exportBackup }, [T.t('btn.exportBackup')]),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () { d.$('#import-file').click(); }
      }, [T.t('btn.importBackup')])
    ]));

    section.appendChild(el('input', {
      type: 'file', id: 'import-file', accept: 'application/json,.json',
      style: 'display:none',
      onchange: function (e) { importFile(e.target.files && e.target.files[0]); }
    }));

    section.appendChild(el('details.details', {}, [
      el('summary', { text: T.t('set.pasteABackupInstead') }),
      el('textarea.input.textarea', {
        id: 'import-paste', rows: '4', placeholder: T.t('set.pasteExportedJsonHere')
      }),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () {
          var area = d.$('#import-paste');
          applyImport(area ? area.value : '');
        }
      }, [T.t('btn.importPasted')])
    ]));

    section.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm(T.t('confirm.eraseAll'))) {
            storage.clearAll();
            root.location.reload();
          }
        }
      }, [T.t('btn.eraseAll')])
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
      message = { kind: 'ok', text: T.t('set.backupExportedAsFile', { name: name }) };
    } catch (err) {
      message = { kind: 'error', text: T.t('set.downloadBlockedOpenPaste') };
    }
    root.RallySync.app.refresh();
  }

  function importFile(file) {
    if (!file) return;
    var reader = new root.FileReader();
    reader.onload = function () { applyImport(String(reader.result)); };
    reader.onerror = function () {
      message = { kind: 'error', text: T.t('set.thatFileCouldNot') };
      root.RallySync.app.refresh();
    };
    reader.readAsText(file);
  }

  function applyImport(text) {
    var payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      message = { kind: 'error', text: T.t('set.thatIsNotValid') };
      return root.RallySync.app.refresh();
    }
    var result = storage.importAll(payload);
    if (!result.ok) {
      message = { kind: 'error', text: result.error };
      return root.RallySync.app.refresh();
    }
    S.load();
    message = { kind: 'ok', text: T.t('set.backupRestoredWith', { list: result.imported.join(', ') }) };
    root.RallySync.app.refresh();
  }

  // ------------------------------------------------------------------- about

  function aboutSection() {
    var section = el('section.panel');
    section.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t('set.howAccurateIsThis') })
    ]));

    section.appendChild(el('div.tier-legend', {}, [
      legendRow('measured', T.t('tier.exact'), T.t('tier.exactBody')),
      legendRow('calibrated', T.t('tier.calibrated'), T.t('tier.calibratedBody')),
      legendRow('estimated', T.t('tier.estimated'), T.t('tier.estimatedBody'))
    ]));

    section.appendChild(el('p.panel-note', {
      text: T.t('set.theDeveloperPublishesNo')
    }));

    section.appendChild(el('p.panel-note.muted', {
      text: T.t('set.fullSourcingDisagreementsAnd')
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
