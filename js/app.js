/**
 * app.js — bootstrap, tab routing, and the one-second heartbeat.
 *
 * Views own their own markup; this file only decides which one is mounted and
 * keeps the clock and countdowns moving.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var S = root.RallySync.state;
  var el = d.el;

  var TABS = [
    { key: 'calculate', label: 'Calculate', icon: '◎', view: 'calculate' },
    { key: 'roster', label: 'Leads', icon: '⚔', view: 'roster' },
    { key: 'targets', label: 'Targets', icon: '⌖', view: 'targets' },
    { key: 'calibrate', label: 'Tune', icon: '⚙', view: 'calibrate' },
    { key: 'settings', label: 'More', icon: '≡', view: 'settings' }
  ];

  var current = 'calculate';
  var main = null;
  var nav = null;
  var clockNode = null;
  var localNode = null;
  var offsetNode = null;

  function start() {
    S.load();
    current = S.data.settings.tab || 'calculate';
    if (!tabByKey(current)) current = 'calculate';

    main = d.$('#main');
    nav = d.$('#nav');
    clockNode = d.$('#clock-utc');
    localNode = d.$('#clock-local');
    offsetNode = d.$('#clock-offset');

    renderNav();
    render();

    tick();
    root.setInterval(tick, 250);

    // Re-sync immediately when the phone comes back from sleep or tab switch.
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) tick();
    });
  }

  function tabByKey(key) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].key === key) return TABS[i];
    return null;
  }

  function renderNav() {
    d.clear(nav);
    TABS.forEach(function (tab) {
      nav.appendChild(el('button.nav-btn' + (tab.key === current ? ' is-active' : ''), {
        type: 'button',
        'aria-current': tab.key === current ? 'page' : null,
        onclick: function () { go(tab.key); }
      }, [
        el('span.nav-icon', { text: tab.icon }),
        el('span.nav-label', { text: tab.label })
      ]));
    });
  }

  function render() {
    var tab = tabByKey(current);
    var view = root.RallySync.views[tab.view];
    d.clear(main);
    main.dataset.tab = current;
    view.render(main);
  }

  function go(key) {
    if (!tabByKey(key) || key === current) return;
    current = key;
    S.updateSettings({ tab: key });
    renderNav();
    render();
    root.scrollTo(0, 0);
  }

  /** Re-render the active view in place, keeping the scroll position. */
  function refresh() {
    var y = root.scrollY;
    renderNav();
    render();
    root.scrollTo(0, y);
  }

  function tick() {
    var now = S.now();
    if (clockNode) clockNode.textContent = d.utcClock(now);
    if (localNode) localNode.textContent = d.localClock(now) + ' ' + d.localZoneName();

    var offset = Number(S.data.settings.clockOffsetSeconds) || 0;
    if (offsetNode) {
      offsetNode.textContent = offset === 0 ? '' : (offset > 0 ? '+' : '') + offset + 's';
      offsetNode.classList.toggle('is-visible', offset !== 0);
    }

    if (current === 'calculate' && root.RallySync.views.calculate.tick) {
      root.RallySync.views.calculate.tick(now);
    }
  }

  root.RallySync.app = { start: start, go: go, refresh: refresh, tick: tick };

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
