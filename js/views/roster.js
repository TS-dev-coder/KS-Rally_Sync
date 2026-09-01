/**
 * views/roster.js — manage rally lead profiles.
 * Setup screen, not time-pressured (PRD Section 12), so it favours clarity.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var G = root.RallySync.guide;
  var el = d.el;

  var expanded = {};

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
      el('button.btn.btn-primary', { type: 'button', onclick: addLead }, ['+ Add lead'])
    ]));

    if (leads.length === 0) {
      container.appendChild(emptyState());
      return;
    }

    var list = el('div.stack');
    leads.forEach(function (lead) { list.appendChild(leadCard(lead)); });
    container.appendChild(list);
  }

  function emptyState() {
    return el('div.empty', {}, [
      el('div.empty-icon', { text: '🏹' }),
      el('h3', { text: 'No rally leads yet' }),
      el('p', { text: 'Add each player who will open a rally, with their city coordinates and their March Speed Up % from Avatar → Bonus Overview → Military.' }),
      el('button.btn.btn-primary', { type: 'button', onclick: addLead }, ['Add the first lead'])
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

    var summary = el('button.card-summary', {
      type: 'button',
      'aria-expanded': isOpen ? 'true' : 'false',
      onclick: function () {
        expanded[lead.id] = !isOpen;
        root.RallySync.app.refresh();
      }
    }, [
      el('div.card-summary-main', {}, [
        el('div.card-title', { text: lead.name || 'Unnamed lead' }),
        el('div.card-meta', {}, [
          el('span', { text: coordText(lead) }),
          el('span.dot', { text: '·' }),
          el('span', {
            text: lead.marchSpeedUpPercent === null ? 'no speed %' : '+' + lead.marchSpeedUpPercent + '% speed'
          }),
          lead.crossesRelic ? el('span.tag.tag-warn', { text: 'via Relic' }) : null
        ])
      ]),
      incomplete ? el('span.tag.tag-error', { text: 'incomplete' }) : null,
      el('span.chev', { text: isOpen ? '▾' : '▸' })
    ]);
    card.appendChild(summary);

    if (!isOpen) return card;

    var body = el('div.card-body');

    body.appendChild(field('Name', el('input.input', {
      type: 'text',
      value: lead.name,
      placeholder: 'In-game name',
      'data-focus': lead.id,
      autocomplete: 'off',
      onchange: function (e) { patch(lead, { name: e.target.value }); }
    })));

    var coords = el('div.grid-2', {}, [
      field('X', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(lead.x), placeholder: '—',
        onchange: function (e) { patch(lead, { x: e.target.value }); }
      })),
      field('Y', el('input.input', {
        type: 'number', inputmode: 'numeric', value: valueOf(lead.y), placeholder: '—',
        onchange: function (e) { patch(lead, { y: e.target.value }); }
      }))
    ]);
    body.appendChild(coords);
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

    body.appendChild(el('label.toggle-row', {}, [
      el('input', {
        type: 'checkbox', checked: lead.crossesRelic,
        onchange: function (e) { patch(lead, { crossesRelic: e.target.checked }); }
      }),
      el('span', {}, [
        el('span.toggle-label', { text: 'Route crosses the Relic' }),
        el('span.toggle-help', { text: 'Forces the slower Forbidden Zone model for this lead, whatever the target says.' })
      ])
    ]));

    body.appendChild(el('div.card-actions', {}, [
      el('button.btn.btn-ghost.btn-danger', {
        type: 'button',
        onclick: function () {
          if (root.confirm('Delete ' + (lead.name || 'this lead') + '? Their saved measurements go too.')) {
            delete expanded[lead.id];
            S.deleteLead(lead.id);
          }
        }
      }, ['Delete']),
      el('button.btn.btn-ghost', {
        type: 'button',
        onclick: function () { expanded[lead.id] = false; root.RallySync.app.refresh(); }
      }, ['Done'])
    ]));

    card.appendChild(body);
    return card;
  }

  function field(label, input, help) {
    return el('label.field', {}, [
      el('span.field-label', { text: label }),
      input,
      help ? el('span.field-help', { text: help }) : null
    ]);
  }

  function patch(lead, changes) {
    S.upsertLead(Object.assign({}, lead, changes));
  }

  function isComplete(lead) {
    return !!String(lead.name || '').trim() &&
      lead.x !== null && lead.y !== null && lead.marchSpeedUpPercent !== null;
  }

  function coordText(lead) {
    if (lead.x === null || lead.y === null) return 'no coordinates';
    return 'X:' + lead.x + ' Y:' + lead.y;
  }

  function valueOf(v) { return v === null || v === undefined ? '' : String(v); }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.roster = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
