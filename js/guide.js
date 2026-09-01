/**
 * guide.js — short, in-context instructions for finding each value in Kingshot.
 *
 * Kept deliberately terse: these render next to the field they explain, and a
 * rally lead reading them is usually mid-setup with the game open on another
 * device. Numbered steps, no prose.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var el = d.el;

  var GUIDES = {
    marchSpeed: {
      title: 'Find your March Speed Up %',
      steps: [
        'Tap your avatar, top-left of the town screen.',
        'Open Bonus Overview (under Power).',
        'Scroll to the Military section.',
        'Read the March Speed value.'
      ],
      note: 'Enter the bonus only. If it shows 45%, type 45 — not 145.'
    },
    cityCoords: {
      title: 'Find a player’s city coordinates',
      steps: [
        'Switch to the World map.',
        'Tap the player’s city.',
        'Read the X and Y shown in its info panel.'
      ],
      note: 'Coordinates must be the city the rally launches from. If someone relocates, update them here.'
    },
    targetCoords: {
      title: 'Find a target’s coordinates',
      steps: [
        'Switch to the World map.',
        'Tap the King’s Castle, a turret, or the structure you want.',
        'Read the X and Y from its info panel.'
      ],
      note: 'These are kingdom-specific. Set them once and they are reused every event.'
    },
    marchTime: {
      title: 'Read a real march time',
      steps: [
        'Open the rally as normal and let the rally window run out.',
        'The moment troops depart, the march bar shows the travel time remaining.',
        'Note that number at departure — that is the full march time.',
        'Enter it above.'
      ],
      note: 'Read it at the instant of departure. Reading it later gives you time remaining, not total march time.'
    },
    rallyWindow: {
      title: 'What is the rally window?',
      steps: [
        'It is the gather countdown between opening a rally and the troops leaving.',
        'A Castle rally marches at exactly 5 minutes whether or not it filled.',
        'Leave this at 5 for Castle and turret rallies.',
        'Set it to 0 for a solo march, which departs immediately.'
      ],
      note: 'RallySync subtracts this automatically, so the time it gives you is when to TAP the rally button — not when troops leave.'
    },
    baseTime: {
      title: 'Base time and wait — what are they?',
      steps: [
        'BASE TIME is the moment you are counting from. Tap Now, or set the time your alliance agreed on.',
        'WAIT THIS LONG is how far after the base the marches should land.',
        'TROOPS LAND AT is the result: base plus wait. Everything else works backwards from it.'
      ],
      note: 'Example: base 20:00, wait 5m, so troops land 20:05. RallySync then subtracts each march and the rally window to tell every person when to tap.'
    },
    bulkPaste: {
      title: 'Pasting a roster',
      steps: [
        'One player per line: name, X, Y, then March Speed Up %.',
        'Commas, spaces, brackets and x:/y: labels all work.',
        'Add [Alliance] and {Squad} in brackets if you want them grouped.',
        'Check the preview, then import.'
      ],
      note: 'Lines it cannot read are listed separately rather than skipped silently, so nobody goes missing.'
    },
    rallyPower: {
      title: 'Rally capacity and power',
      steps: [
        'Open the rally screen in game to see your march capacity.',
        'Power is the marching power shown for that troop selection.',
        'Both are optional — they only drive the committed totals.'
      ],
      note: 'Neither affects march timing. They are there so you can see how much force is landing on each target.'
    }
  };

  /**
   * Collapsed help block that expands in place. Used next to the field it
   * explains so the answer is where the question is.
   */
  function helpBlock(key) {
    var guide = GUIDES[key];
    if (!guide) return null;

    var details = el('details.guide');
    details.appendChild(el('summary.guide-summary', {}, [
      el('span.guide-icon', { text: '?' }),
      el('span', { text: guide.title })
    ]));

    var body = el('div.guide-body');
    var list = el('ol.guide-steps');
    guide.steps.forEach(function (step) {
      list.appendChild(el('li', { text: step }));
    });
    body.appendChild(list);
    if (guide.note) body.appendChild(el('p.guide-note', { text: guide.note }));

    details.appendChild(body);
    return details;
  }

  /** Full-width card version, for the first-run quick start. */
  function guideCard(key) {
    var guide = GUIDES[key];
    if (!guide) return null;
    var card = el('div.guide-card');
    card.appendChild(el('h3.guide-card-title', { text: guide.title }));
    var list = el('ol.guide-steps');
    guide.steps.forEach(function (step) { list.appendChild(el('li', { text: step })); });
    card.appendChild(list);
    if (guide.note) card.appendChild(el('p.guide-note', { text: guide.note }));
    return card;
  }

  root.RallySync.guide = {
    GUIDES: GUIDES,
    helpBlock: helpBlock,
    guideCard: guideCard
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
