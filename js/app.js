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
  var I = root.RallySync.icons;
  var SH = root.RallySync.share;
  var A = root.RallySync.alarm;
  var KA = root.RallySync.keepAlive;
  var F = root.RallySync.focus;
  var el = d.el;

  var TABS = [
    { key: 'calculate', label: 'Calculate', icon: 'crosshair', view: 'calculate' },
    { key: 'roster', label: 'Leads', icon: 'users', view: 'roster' },
    { key: 'targets', label: 'Targets', icon: 'pin', view: 'targets' },
    { key: 'calibrate', label: 'Tune', icon: 'sliders', view: 'calibrate' },
    { key: 'settings', label: 'More', icon: 'menu', view: 'settings' }
  ];

  var current = 'calculate';
  var main = null;
  var nav = null;
  var clockNode = null;
  var localNode = null;
  var offsetNode = null;

  function start() {
    S.load();
    applyTheme(S.data.settings.theme);
    A.setVolume(S.data.settings.alarmVolume);
    A.setSpeech(S.data.settings.speechEnabled);

    main = d.$('#main');
    nav = d.$('#nav');
    var versionNode = d.$('#brand-version');
    if (versionNode) {
      versionNode.textContent = 'v' + root.RallySync.version.VERSION;
      versionNode.title = 'Published ' + root.RallySync.version.buildText();
    }

    clockNode = d.$('#clock-utc');
    localNode = d.$('#clock-local');
    offsetNode = d.$('#clock-offset');

    // A share link is somebody else's device: show only their slot.
    var shared = SH.slotFromHash(root.location.hash);
    if (shared) {
      root.document.body.classList.add('is-solo');
      F.renderStandalone(main, shared);
      tick();
      root.setInterval(tick, 250);
      return;
    }

    armAudioOnFirstGesture();

    current = S.data.settings.tab || 'calculate';
    if (!tabByKey(current)) current = 'calculate';

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
        el('span.nav-icon', {}, [I.icon(tab.icon, 21)]),
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

    if (main && main.dataset.tab === 'calculate' && root.RallySync.views.calculate.tick) {
      root.RallySync.views.calculate.tick(now);
    }
    if (root.RallySync.views.calculate.updateKeepAlive) {
      root.RallySync.views.calculate.updateKeepAlive();
    }
  }

  /**
   * Alarms are on by default, but browsers refuse to play audio until the user
   * has interacted with the page. Arm the context on the very first tap or key
   * press so the alarm is ready long before a countdown matters, without
   * anyone having to know that rule exists.
   */
  function armAudioOnFirstGesture() {
    function once() {
      if (S.data.settings.alarmEnabled !== false) A.prime();
      // Autoplay was very likely blocked on load; now that there is a gesture,
      // the silent keep-alive track can actually start.
      if (KA.isRunning()) KA.start();
      root.document.removeEventListener('pointerdown', once, true);
      root.document.removeEventListener('keydown', once, true);
    }
    root.document.addEventListener('pointerdown', once, true);
    root.document.addEventListener('keydown', once, true);
  }

  /** 'system' removes the attribute so prefers-color-scheme takes over. */
  function applyTheme(theme) {
    var html = root.document.documentElement;
    if (theme === 'light' || theme === 'dark') html.setAttribute('data-theme', theme);
    else html.removeAttribute('data-theme');
  }

  root.RallySync.app = {
    start: start, go: go, refresh: refresh, tick: tick, applyTheme: applyTheme
  };

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
