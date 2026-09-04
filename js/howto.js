/**
 * howto.js — the walkthrough that actually matters.
 *
 * Two things make a launch land on time, and neither is obvious: reading the
 * real march time out of Kingshot without committing troops, and typing it back
 * in so the estimate is replaced by a measured fact. The distance formula is
 * good — within about 2% across 62 measured marches — but 2% of an eleven
 * minute march is thirteen seconds, and thirteen seconds is a failed rally.
 *
 * Each step carries a drawn figure with the element ringed, because "the timer
 * icon at the bottom right" is a sentence you have to decode while a rally
 * window is running down. A picture of it is not.
 *
 * The figures are inline SVG rather than screenshots: no binary assets to ship
 * or keep in sync, they scale on any phone, and they follow the app's own theme
 * tokens so they are legible in light and dark.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var el = d.el;
  var T = root.RallySync.i18n;
  var C = root.RallySync.calc;

  /** Dictionary lookup that keeps the English text as its fallback. */
  function g(key, fallback) {
    var out = T.t(key);
    return out === key ? fallback : out;
  }

  // Drawn with the app's own tokens so the figures theme with everything else.
  var SVG_HEAD = '<svg viewBox="0 0 260 150" role="img" class="howto-svg">';
  var RING = '<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" ' +
    'fill="none" stroke="var(--accent)" stroke-width="2.5"/>' +
    '<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" ' +
    'fill="var(--accent)" opacity="0.13"/>';

  function ring(x, y, w, h, r) {
    return RING.split('{x}').join(x).split('{y}').join(y)
      .split('{w}').join(w).split('{h}').join(h).split('{r}').join(r || 5);
  }

  function phone(inner) {
    return SVG_HEAD +
      '<rect x="1" y="1" width="258" height="148" rx="9" ' +
      'fill="var(--sunk)" stroke="var(--line)"/>' + inner + '</svg>';
  }

  /** English for every figure label, and the fallback when a locale lacks one. */
  var FIG_EN = {
    'fig.attack': 'Attack',
    'fig.deploy': 'Deploy',
    'fig.getFromGame': 'Get this from the game without marching',
    'fig.holdRally': 'Hold a rally',
    'fig.mini1': '1. Tap the target, then Rally',
    'fig.mini2': '2. Pick a window, Hold a rally',
    'fig.mini3': '3. Read the time by the timer icon',
    'fig.neverTap': 'never tap',
    'fig.noFormula': 'No formula is used for this pair again.',
    'fig.nowExact': 'The tap time is now exact.',
    'fig.rally': 'Rally',
    'fig.scout': 'Scout',
    'fig.step1': '1. Tap the target, then Rally',
    'fig.step2': '2. Any window will do',
    'fig.step3': '3. THIS is the march time',
    'fig.step4': '4. Back out. Nothing deploys, no stamina spent',
    'fig.step5': '5. On the row, tap Exact time',
    'fig.step6': '6. Type what the game showed',
    'fig.step7': '7. Done — this row is a fact',
    'fig.targetOnMap': 'target on the map',
    'fig.targetTown': 'Target: Town',
    'fig.troops': 'your heroes and troops'
  };

  /**
   * Figure label lookup. Keeps the English as the fallback exactly like g(),
   * so an untranslated figure still reads rather than showing a key.
   */
  function F(short) {
    return g('howto.' + short, FIG_EN[short]);
  }

  /**
   * Translated text goes into markup here, so it has to be escaped. An
   * apostrophe is fine, but "&" in a locale's wording would produce an invalid
   * entity and silently break the whole figure.
   */
  function esc(text) {
    return String(text)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;');
  }

  function mins(n) {
    return T.t('dur.minutes', { n: n });
  }

  /**
   * A step's caption, centred under the drawing.
   *
   * Hand-placing these by x meant every caption's left edge was tuned to the
   * length of the English string, so a longer translation ran off the right
   * edge -- SVG text neither wraps nor shrinks. Anchored at the middle, a
   * caption grows both ways and the budget is the same in every language.
   */
  /**
   * A sample row tag, built the way the real results row builds it: the same
   * label key and the same duration formatter. Translating these as fixed
   * strings meant the picture read "march 11m 15s" while the table beside it
   * read the locale's own units.
   */
  function sampleFact(labelKey, seconds) {
    return T.t(labelKey) + ' ' + C.formatDuration(seconds);
  }

  function caption(y, text, size, x) {
    return '<text x="' + (x === undefined ? 130 : x) + '" y="' + y +
      '" text-anchor="middle" font-size="' + (size || 8.5) +
      '" fill="var(--text-3)" font-family="system-ui,sans-serif">' +
      esc(text) + '</text>';
  }

  function label(x, y, text, size) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 8) +
      '" fill="var(--text-3)" font-family="system-ui,sans-serif">' + esc(text) + '</text>';
  }

  function chip(x, y, w, h, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="4" fill="' + (fill || 'var(--surface-2)') + '"/>';
  }

  /**
   * One drawn figure per step, keyed by the step it illustrates.
   *
   * A function rather than a literal: the labels inside these figures are
   * translated, and a literal would freeze whichever language was active when
   * the module loaded, leaving the pictures in the old language after a switch.
   */
  function figures() {
    return {
    // Kingshot: the map, with a target tapped and Rally ringed.
    tapRally: phone(
      '<circle cx="95" cy="46" r="15" fill="var(--surface-2)"/>' +
      caption(72, F('fig.targetOnMap'), 8, 95) +
      chip(150, 24, 96, 96, 'var(--surface)') +
      label(160, 40, 'X:448 Y:756') +
      chip(158, 48, 80, 12) +
      chip(158, 66, 36, 16) + caption(77, F('fig.scout'), 6.5, 176) +
      chip(200, 66, 38, 16) + caption(77, F('fig.attack'), 6.5, 219) +
      chip(158, 90, 80, 16, 'var(--accent-soft)') + caption(101, F('fig.rally'), 8, 198) +
      ring(155, 87, 86, 22) +
      caption(136, F('fig.step1'))
    ),

    // The rally-window dialog, with Hold a rally ringed.
    holdRally: phone(
      chip(50, 22, 160, 92, 'var(--surface)') +
      label(60, 38, F('fig.holdRally')) +
      chip(60, 46, 60, 14) + label(66, 56, mins(5)) +
      chip(130, 46, 60, 14) + label(136, 56, mins(15)) +
      chip(60, 64, 60, 14) + label(66, 74, mins(30)) +
      chip(130, 64, 60, 14) + label(136, 74, mins(60)) +
      chip(78, 86, 104, 18, 'var(--accent-soft)') + caption(98, F('fig.holdRally'), 8, 130) +
      ring(75, 83, 110, 24) +
      caption(136, F('fig.step2'))
    ),

    // The troop screen. This is the number.
    readTimer: phone(
      chip(20, 18, 220, 14) + label(28, 28, F('fig.targetTown')) +
      chip(30, 40, 56, 40) + chip(102, 40, 56, 40) + chip(174, 40, 56, 40) +
      label(74, 96, F('fig.troops')) +
      chip(20, 110, 90, 22, 'var(--surface)') +
      '<circle cx="34" cy="121" r="5" fill="none" stroke="var(--accent)" stroke-width="1.5"/>' +
      '<line x1="34" y1="118" x2="34" y2="121" stroke="var(--accent)" stroke-width="1.5"/>' +
      '<line x1="34" y1="121" x2="37" y2="123" stroke="var(--accent)" stroke-width="1.5"/>' +
      '<text x="46" y="125" font-size="11" fill="var(--accent)" ' +
      'font-family="ui-monospace,monospace" font-weight="700">00:03:33</text>' +
      ring(17, 107, 96, 28) +
      chip(150, 110, 90, 22, 'var(--surface-2)') + caption(124, F('fig.deploy'), 8, 195) +
      caption(146, F('fig.step3'))
    ),

    // Leaving without committing anything.
    backOut: phone(
      chip(12, 12, 26, 20, 'var(--accent-soft)') +
      '<path d="M28 18 L21 22 L28 26" fill="none" stroke="var(--accent)" stroke-width="2"/>' +
      ring(9, 9, 32, 26) +
      chip(50, 14, 190, 16) + label(58, 25, F('fig.targetTown')) +
      chip(30, 44, 200, 50) +
      chip(150, 104, 90, 22, 'var(--surface-2)') + caption(118, F('fig.deploy'), 8, 195) +
      '<line x1="150" y1="104" x2="240" y2="126" stroke="var(--red)" stroke-width="1.6"/>' +
      '<line x1="240" y1="104" x2="150" y2="126" stroke="var(--red)" stroke-width="1.6"/>' +
      label(14, 118, F('fig.neverTap'), 7.5) +
      caption(146, F('fig.step4'))
    ),

    // RallySync: the row, with Exact time ringed.
    exactButton: phone(
      chip(14, 12, 232, 40, 'var(--surface)') +
      label(22, 26, 'T S') + chip(198, 18, 40, 10, 'var(--amber-soft)') +
      label(205, 26, T.t('badge.estimated').toUpperCase(), 6) +
      '<text x="22" y="45" font-size="13" fill="var(--text)" ' +
      'font-family="ui-monospace,monospace" font-weight="700">15:01:10</text>' +
      chip(14, 58, 96, 14) + label(20, 68, sampleFact('row.march', 675), 7) +
      chip(116, 58, 76, 14) + label(122, 68, T.t('row.dist') + ' 402 km', 7) +
      chip(14, 82, 42, 20) + caption(95, T.t('btn.focus'), 7.5, 35) +
      chip(60, 82, 64, 20) + caption(95, T.t('btn.share'), 7.5, 92) +
      chip(128, 82, 38, 20) + caption(95, T.t('btn.copy'), 7.5, 147) +
      chip(170, 82, 76, 20, 'var(--accent-soft)') + caption(95, T.t('btn.exactTime'), 7.5, 208) +
      ring(167, 79, 82, 26) +
      caption(128, F('fig.step5'))
    ),

    // Typing it in.
    typeIt: phone(
      chip(14, 14, 232, 62, 'var(--sunk)') +
      label(22, 28, F('fig.getFromGame'), 7.5) +
      label(22, 40, F('fig.mini1'), 7) +
      label(22, 50, F('fig.mini2'), 7) +
      label(22, 60, F('fig.mini3'), 7) +
      chip(14, 84, 140, 24, 'var(--surface)') +
      '<text x="24" y="100" font-size="11" fill="var(--accent)" ' +
      'font-family="ui-monospace,monospace">3:33</text>' +
      ring(11, 81, 146, 30) +
      chip(164, 84, 82, 24, 'var(--accent-soft)') + caption(100, T.t('btn.setExact'), 8, 205) +
      caption(132, F('fig.step6'))
    ),

    // The payoff.
    measured: phone(
      chip(14, 16, 232, 46, 'var(--surface)') +
      label(22, 32, 'T S') +
      chip(190, 22, 48, 12, 'var(--green-soft)') +
      '<text x="197" y="31" font-size="6.5" fill="var(--green)" ' +
      'font-family="system-ui,sans-serif" font-weight="700">' +
      esc(T.t('badge.measured').toUpperCase()) + '</text>' +
      '<text x="22" y="54" font-size="13" fill="var(--text)" ' +
      'font-family="ui-monospace,monospace" font-weight="700">15:01:09</text>' +
      chip(14, 70, 104, 16, 'var(--green-soft)') +
      '<text x="20" y="81" font-size="7.5" fill="var(--green)" ' +
      'font-family="system-ui,sans-serif">' + esc(sampleFact('row.march', 213)) + '</text>' +
      ring(11, 67, 110, 22) +
      label(14, 106, F('fig.noFormula'), 8) +
      label(14, 120, F('fig.nowExact'), 8) +
      caption(142, F('fig.step7'))
      )
    };
  }

  /**
   * The walkthrough. Ordered so the two Kingshot-side steps come first: the app
   * cannot be exact until you have the number, so asking for it up front is
   * what makes the rest worth doing.
   */
  var STEPS = [
    { fig: 'tapRally', key: 'tapRally',
      title: 'Open the target in Kingshot',
      body: 'On the world map, tap the city, HQ or monster you plan to hit, then tap Rally. ' +
        'Nothing is committed by opening it.' },
    { fig: 'holdRally', key: 'holdRally',
      title: 'Hold a rally, any window',
      body: 'Pick whichever gather time you like and tap Hold a rally. The march time does ' +
        'not depend on which window you chose, so this choice does not matter here.' },
    { fig: 'readTimer', key: 'readTimer',
      title: 'Read the time beside the timer icon',
      body: 'On the troop screen, the time to the left of Deploy is the real march time. ' +
        'It holds still rather than counting down, so there is no rush.' },
    { fig: 'backOut', key: 'backOut',
      title: 'Back out with the arrow',
      body: 'Leave using the arrow at the top left. No troops move, no rally is created and ' +
        'no stamina is spent. Never tap Deploy unless you actually mean to march.' },
    { fig: 'exactButton', key: 'exactButton',
      title: 'Back in RallySync, tap Exact time',
      body: 'On the lead’s row in Launch order, tap Exact time. The row is currently an ' +
        'estimate from the distance formula.' },
    { fig: 'typeIt', key: 'typeIt',
      title: 'Type what the game showed you',
      body: 'Enter it the way the game wrote it — 3:33 — or as plain seconds, 213. ' +
        'Then tap Set exact.' },
    { fig: 'measured', key: 'measured',
      title: 'That row is now exact',
      body: 'The badge turns to MEASURED and the tap time is recalculated from the real ' +
        'march. No formula is used for that lead and target again.' }
  ];

  /**
   * Why bother, in one paragraph, with the number that makes the case. People
   * skip setup steps they think are optional, so the cost of skipping is stated
   * rather than implied.
   */
  var WHY = 'The distance formula is accurate to about 2% across 62 measured marches, ' +
    'which is close — but 2% of an eleven-minute march is thirteen seconds, and thirteen ' +
    'seconds is a rally that lands alone. Setting a real time once per lead and target ' +
    'removes the guess entirely.';

  function stepNode(step, index) {
    return el('li.howto-step', {}, [
      el('div.howto-fig', { html: figures()[step.fig] }),
      el('div.howto-text', {}, [
        el('div.howto-step-title', {}, [
          el('span.howto-num', { text: String(index + 1) }),
          el('span', { text: g('howto.' + step.key + '.title', step.title) })
        ]),
        el('p.howto-body', { text: g('howto.' + step.key + '.body', step.body) })
      ])
    ]);
  }

  /** The whole walkthrough, for the More tab and the first-run empty state. */
  function walkthrough() {
    var wrap = el('section.panel.howto');
    wrap.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: g('howto.title', 'How to get an exact launch time') })
    ]));
    wrap.appendChild(el('p.panel-note', { text: g('howto.why', WHY) }));
    wrap.appendChild(el('ol.howto-list', {}, STEPS.map(stepNode)));
    return wrap;
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.howto = {
    walkthrough: walkthrough,
    STEPS: STEPS,
    figures: figures
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
