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
      title: 'Read a march time without marching',
      steps: [
        'Tap the target on the map, then Rally.',
        'Pick any rally window and tap Hold a rally.',
        'On the troop screen, read the time beside the timer icon at the bottom right, just left of Deploy — that is the march time.',
        'Leave with the arrow at the top left. Nothing is deployed, no rally is created, and no stamina is spent.',
        'Type that time into Exact time on the result row.'
      ],
      note: 'Verified against real marches: the number the screen shows before you commit is the time the march actually takes. ' +
        'It holds still rather than counting down, and it does not change with the rally window you picked, so there is no rush to read it. ' +
        'Small monsters offer only Attack rather than Rally — that screen shows the same number, so use it. ' +
        'Once typed in, that lead and target are exact and no formula is used for them again.'
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
    startTime: {
      title: 'How the timing works',
      steps: [
        'Set START RALLIES AT — the moment the first person taps.',
        'The slowest lead taps right then, because they need the most time.',
        'Everyone faster taps later, so all the marches arrive together.',
        'TROOPS LAND AT is the result: as early as the slowest lead can manage.'
      ],
      note: 'You never pick the landing time — it falls out of who is marching and how far they are. Add a slower player and the whole plan shifts later on its own.'
    },
    timingChain: {
      title: 'How your tap time is worked out',
      steps: [
        'Start at TROOPS LAND AT — the moment everyone hits.',
        'Subtract that player’s march time to get when their troops leave the city (DEPARTS).',
        'Subtract the target’s rally window to get when they tap the rally button.',
        'Slower players therefore tap earlier, so everyone still lands together.'
      ],
      note: 'The rally window is the gather countdown set on the target — 5 minutes for a Castle. It is separate from the march, and both are already included in the tap time.'
    },
    zoneAccuracy: {
      title: 'Why some zones are trusted more than others',
      steps: [
        'Monsters and player structures are two different families: a rally on a city or an HQ runs about 2.1x slower per tile than one on a Terror or Beast.',
        'Each family is fitted from two real marches, read minutes apart so nothing else could drift between them.',
        'The city line then predicted an HQ it had never seen to within 3 seconds, which is the only out-of-sample check in the model.',
        'Castle and Ruins have never been measured at all, and anything far outside a fitted range is flagged on the results.'
      ],
      note: 'The constants drift between sessions — one identical march has read 684s on one day and 777s on another — so treat them as a starting point, not gospel. For any target you actually care about, read its march time off the rally screen and set it with Exact time on the result row: that is exact, with no formula involved.'
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
