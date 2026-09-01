/**
 * views/roster.js — manage rally lead profiles.
 *
 * Setup screen, not time-pressured (PRD Section 12), so it favours clarity over
 * density: one card per lead, expanded in place, with the in-game instructions
 * next to the field they explain.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var G = root.RallySync.guide;
  var I = root.RallySync.icons;
  var RI = root.RallySync.rosterImport;
  var el = d.el;
  var icon = I.icon;

  var expanded = {};
  var pasteOpen = false;
  var pasteText = '';
  var pasteResult = null;
  var filter = { field: 'none', value: '' };
  var message = null;

  function render(container) {
    d.clear(container);
    var leads = S.data.leads;

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: 'Rally leads' }),
        el('p.view-sub', {
          text: leads.length
            ? leads.length + (leads.length === 1 ? ' lead saved' : ' leads saved')
            : 'Add everyone who opens rallies. Saved on this device.'
        })
      ]),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () { pasteOpen = !pasteOpen; root.RallySync.app.refresh(); }
      }, [icon('copy', 15), el('span', { text: 'Paste list' })]),
      el('button.btn.btn-primary', { type: 'button', onclick: addLead }, [
        icon('plus', 15), el('span', { text: 'Add' })
      ])
    ]));

    if (message) {
      container.appendChild(el('div.banner.banner-' + message.kind, {}, [
        icon(message.kind === 'error' ? 'alert' : 'check', 16),
        el('span', { text: message.text })
      ]));
      message = null;
    }

    if (pasteOpen) container.appendChild(pastePanel());

    if (leads.length === 0) {
      if (!pasteOpen) container.appendChild(emptyState());
      return;
    }

    container.appendChild(filterBar());

    var visible = leads.filter(matchesFilter);
    if (visible.length === 0) {
      container.appendChild(el('p.muted', { text: 'No leads match this filter.' }));
      return;
    }

    var list = el('div.stack');
    visible.forEach(function (lead) { list.appendChild(leadCard(lead)); });
    container.appendChild(list);
  }

  // ------------------------------------------------------------ bulk import

  function pastePanel() {
    var panel = el('section.panel.panel-accent');
    panel.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: 'Paste a roster' }),
      el('button.btn.btn-icon', {
        type: 'button', 'aria-label': 'Close',
        onclick: function () { pasteOpen = false; pasteResult = null; root.RallySync.app.refresh(); }
      }, [icon('x', 16)])
    ]));

    panel.appendChild(el('textarea.input.textarea.paste-box', {
      rows: '6',
      placeholder: RI.EXAMPLE,
      oninput: function (e) { pasteText = e.target.value; }
    }, [pasteText]));

    panel.appendChild(G.helpBlock('bulkPaste'));

    panel.appendChild(el('div.button-row', {}, [
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () {
          pasteResult = RI.parseRoster(pasteText);
          root.RallySync.app.refresh();
        }
      }, ['Preview']),
      el('button.btn.btn-ghost', {
        type: 'button',
        onclick: function () {
          pasteText = RI.EXAMPLE;
          pasteResult = RI.parseRoster(pasteText);
          root.RallySync.app.refresh();
        }
      }, ['Use example'])
    ]));

    if (pasteResult) panel.appendChild(pastePreview());
    return panel;
  }

  function pastePreview() {
    var wrap = el('div.paste-preview');

    wrap.appendChild(el('div.paste-summary', {}, [
      el('span.badge.badge-measured', { text: pasteResult.okCount + ' ready' }),
      pasteResult.errorCount > 0
        ? el('span.badge.badge-error', { text: pasteResult.errorCount + ' unreadable' })
        : null
    ]));

    var rows = el('div.rows');
    pasteResult.rows.forEach(function (row) {
      rows.appendChild(el('div.row-item' + (row.ok ? '' : ' is-stale'), {}, [
        el('div.row-main', {}, [
          el('div.row-title', { text: row.ok ? row.name : row.raw }),
          el('div.row-meta', {
            text: row.ok
              ? 'X:' + row.x + ' Y:' + row.y + ' · +' + row.speedPercent + '%' +
                (row.alliance ? ' · [' + row.alliance + ']' : '') +
                (row.squad ? ' · {' + row.squad + '}' : '')
              : row.error
          })
        ]),
        row.ok ? icon('check', 16) : icon('alert', 16)
      ]));
    });
    wrap.appendChild(rows);

    if (pasteResult.okCount > 0) {
      wrap.appendChild(el('button.btn.btn-primary.btn-wide', {
        type: 'button', onclick: importParsed
      }, ['Import ' + pasteResult.okCount + ' lead' + (pasteResult.okCount === 1 ? '' : 's')]));
    }
    return wrap;
  }

  /** Matching an existing name updates that lead rather than duplicating them. */
  function importParsed() {
    var added = 0;
    var updated = 0;

    pasteResult.rows.filter(function (r) { return r.ok; }).forEach(function (row) {
      var existing = null;
      for (var i = 0; i < S.data.leads.length; i++) {
        if (S.data.leads[i].name.toLowerCase() === row.name.toLowerCase()) {
          existing = S.data.leads[i];
          break;
        }
      }
      S.upsertLead({
        id: existing ? existing.id : undefined,
        name: row.name,
        x: row.x,
        y: row.y,
        marchSpeedUpPercent: row.speedPercent,
        alliance: row.alliance || (existing ? existing.alliance : ''),
        squad: row.squad || (existing ? existing.squad : ''),
        rallyCapacity: existing ? existing.rallyCapacity : null,
        power: existing ? existing.power : null
      });
      if (existing) updated++; else added++;
    });

    pasteText = '';
    pasteResult = null;
    pasteOpen = false;
    message = {
      kind: 'ok',
      text: 'Imported ' + added + ' new lead' + (added === 1 ? '' : 's') +
        (updated ? ' and updated ' + updated + ' existing' : '') + '.'
    };
    root.RallySync.app.refresh();
  }

  // ----------------------------------------------------------------- filters

  function filterBar() {
    var alliances = S.alliances();
    var squads = S.squads();
    if (alliances.length === 0 && squads.length === 0) return el('span');

    var bar = el('div.filter-bar');
    bar.appendChild(chip('All', filter.field === 'none', function () {
      filter = { field: 'none', value: '' };
      root.RallySync.app.refresh();
    }));

    alliances.forEach(function (name) {
      bar.appendChild(chip('[' + name + ']', filter.field === 'alliance' && filter.value === name, function () {
        filter = { field: 'alliance', value: name };
        root.RallySync.app.refresh();
      }));
    });
    squads.forEach(function (name) {
      bar.appendChild(chip('{' + name + '}', filter.field === 'squad' && filter.value === name, function () {
        filter = { field: 'squad', value: name };
        root.RallySync.app.refresh();
      }));
    });
    return bar;
  }

  function chip(text, selected, onclick) {
    return el('button.chip.chip-sm' + (selected ? ' is-selected' : ''), {
      type: 'button', onclick: onclick
    }, [text]);
  }

  function matchesFilter(lead) {
    if (filter.field === 'none') return true;
    return String(lead[filter.field] || '') === filter.value;
  }

  // ------------------------------------------------------------------ cards

  function emptyState() {
    return el('div.empty', {}, [
      icon('users', 30),
      el('h3', { text: 'No rally leads yet' }),
      el('p', { text: 'Add each player who will open a rally, with their city coordinates and their March Speed Up %. Or paste your whole roster at once.' }),
      el('div.button-row', {}, [
        el('button.btn.btn-primary', { type: 'button', onclick: addLead }, ['Add a lead']),
        el('button.btn.btn-secondary', {
          type: 'button',
          onclick: function () { pasteOpen = true; root.RallySync.app.refresh(); }
        }, ['Paste a list'])
      ])
    ]);
  }

  function addLead() {
    var lead = S.upsertLead({ name: '', x: null, y: null, marchSpeedUpPercent: null });
    expanded[lead.id] = true;
    root.RallySync.app.refresh();
    var input = d.$('[data-focus="' + lead.id + '"]');
    if (input) input.focus();
  }

  function leadCard(lead) {
    var isOpen = !!expanded[lead.id];
    var incomplete = !isComplete(lead);

    var card = el('div.card' + (isOpen ? ' is-open' : '') + (incomplete ? ' is-incomplete' : ''));

    card.appendChild(el('button.card-summary', {
      type: 'button',
      'aria-expanded': isOpen ? 'true' : 'false',
      onclick: function () { expanded[lead.id] = !isOpen; root.RallySync.app.refresh(); }
    }, [
      el('div.card-summary-main', {}, [
        el('div.card-title', {}, [
          el('span', { text: lead.name || 'Unnamed lead' }),
          lead.alliance ? el('span.tag.tag-zone', { text: lead.alliance }) : null,
          lead.squad ? el('span.tag.tag-squad', { text: lead.squad }) : null
        ]),
        el('div.card-meta', {}, [
          el('span', { text: coordText(lead) }),
          el('span.dot', { text: '·' }),
          el('span', {
            text: lead.marchSpeedUpPercent === null ? 'no speed %' : '+' + lead.marchSpeedUpPercent + '% speed'
          }),
          lead.power ? el('span.dot', { text: '·' }) : null,
          lead.power ? el('span', { text: formatCompact(lead.power) + ' power' }) : null
        ])
      ]),
      incomplete ? el('span.tag.tag-error', { text: 'incomplete' }) : null,
      el('span.chev', {}, [icon(isOpen ? 'chevronDown' : 'chevronRight', 14)])
    ]));

    if (!isOpen) return card;

    var body = el('div.card-body');

    body.appendChild(field('Name', el('input.input', {
      type: 'text', value: lead.name, placeholder: 'In-game name',
      'data-focus': lead.id, autocomplete: 'off',
      onchange: function (e) { patch(lead, { name: e.target.value }); }
    })));

    body.appendChild(el('div.grid-2', {}, [
      field('X', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(lead.x), placeholder: '—',
        onchange: function (e) { patch(lead, { x: e.target.value }); }
      })),
      field('Y', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(lead.y), placeholder: '—',
        onchange: function (e) { patch(lead, { y: e.target.value }); }
      }))
    ]));
    body.appendChild(G.helpBlock('cityCoords'));

    body.appendChild(field(
      'March Speed Up %',
      el('input.input', {
        type: 'number', inputmode: 'decimal', step: '0.1',
        value: valueOf(lead.marchSpeedUpPercent), placeholder: 'e.g. 45',
        onchange: function (e) { patch(lead, { marchSpeedUpPercent: e.target.value }); }
      }),
      'Enter the bonus only, not 100 + bonus.'
    ));
    body.appendChild(G.helpBlock('marchSpeed'));

    body.appendChild(el('div.grid-2', {}, [
      field('Alliance', el('input.input', {
        type: 'text', value: lead.alliance, placeholder: 'e.g. VNG', autocomplete: 'off',
        list: 'alliance-options',
        onchange: function (e) { patch(lead, { alliance: e.target.value }); }
      })),
      field('Squad', el('input.input', {
        type: 'text', value: lead.squad, placeholder: 'e.g. Wave 1', autocomplete: 'off',
        list: 'squad-options',
        onchange: function (e) { patch(lead, { squad: e.target.value }); }
      }))
    ]));
    body.appendChild(datalist('alliance-options', S.alliances()));
    body.appendChild(datalist('squad-options', S.squads()));

    body.appendChild(el('div.grid-2', {}, [
      field('Rally capacity', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(lead.rallyCapacity), placeholder: 'optional',
        onchange: function (e) { patch(lead, { rallyCapacity: e.target.value }); }
      })),
      field('March power', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(lead.power), placeholder: 'optional',
        onchange: function (e) { patch(lead, { power: e.target.value }); }
      }))
    ]));
    body.appendChild(G.helpBlock('rallyPower'));

    body.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm('Delete ' + (lead.name || 'this lead') + '? Their saved measurements go too.')) {
            delete expanded[lead.id];
            S.deleteLead(lead.id);
          }
        }
      }, [icon('trash', 15), el('span', { text: 'Delete' })]),
      el('button.btn.btn-secondary', {
        type: 'button',
        onclick: function () { expanded[lead.id] = false; root.RallySync.app.refresh(); }
      }, ['Done'])
    ]));

    card.appendChild(body);
    return card;
  }

  function datalist(id, values) {
    return el('datalist', { id: id }, values.map(function (v) {
      return el('option', { value: v });
    }));
  }

  function field(label, input, help) {
    return el('label.field', {}, [
      el('span.field-label', { text: label }),
      input,
      help ? el('span.field-help', { text: help }) : null
    ]);
  }

  function patch(lead, changes) { S.upsertLead(Object.assign({}, lead, changes)); }

  function isComplete(lead) {
    return !!String(lead.name || '').trim() &&
      lead.x !== null && lead.y !== null && lead.marchSpeedUpPercent !== null;
  }

  function coordText(lead) {
    if (lead.x === null || lead.y === null) return 'no coordinates';
    return 'X:' + lead.x + ' Y:' + lead.y;
  }

  function formatCompact(n) {
    var value = Number(n) || 0;
    if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return String(value);
  }

  function valueOf(v) { return v === null || v === undefined ? '' : String(v); }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.roster = { render: render, formatCompact: formatCompact };
})(typeof globalThis !== 'undefined' ? globalThis : this);
