/**
 * views/guide.js — the Guide tab.
 *
 * Not to be confused with js/guide.js, which is the component library this
 * renders: that file owns the GUIDES content and the collapsible helpBlock,
 * and every view drops the relevant one in beside the field it explains.
 *
 * This page exists because in-context help only works if you already know
 * which screen to be on. Someone who has just been handed the app, or who is
 * looking for the one thing they read last week, has nowhere to start — the
 * walkthrough was buried under eight panels of settings, and the ten topics
 * were scattered across four screens with no way to see they existed.
 *
 * Nothing here is new content. It is the same walkthrough and the same guides,
 * gathered so they can be found on purpose rather than stumbled upon.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var el = d.el;
  var T = root.RallySync.i18n;
  var G = root.RallySync.guide;

  /** Reading a march time out of Kingshot, then the values it needs. */
  var IN_GAME = ['marchTime', 'marchSpeed', 'cityCoords', 'targetCoords', 'rallyWindow', 'rallyPower'];

  /** What the app does with them. */
  var HOW_IT_WORKS = ['startTime', 'timingChain', 'zoneAccuracy', 'bulkPaste'];

  function section(titleKey, keys) {
    var panel = el('section.panel');
    panel.appendChild(el('div.panel-head', {}, [
      el('h2.panel-title', { text: T.t(titleKey) })
    ]));
    keys.forEach(function (key) {
      var block = G.helpBlock(key);
      if (block) panel.appendChild(block);
    });
    return panel;
  }

  function render(container) {
    d.clear(container);

    container.appendChild(el('div.view-head', {}, [
      el('div', {}, [
        el('h2.view-title', { text: T.t('guide.pageTitle') }),
        el('p.view-sub', { text: T.t('guide.pageSub') })
      ])
    ]));

    // The walkthrough leads: it is the one thing that makes a row exact, and
    // the reason most people open this page at all.
    container.appendChild(root.RallySync.howto.walkthrough());
    container.appendChild(section('guide.sectionInGame', IN_GAME));
    container.appendChild(section('guide.sectionHowItWorks', HOW_IT_WORKS));
  }

  root.RallySync.views = root.RallySync.views || {};
  root.RallySync.views.guide = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
