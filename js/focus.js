/**
 * focus.js — one person, one number, filling the screen.
 *
 * Two entry points, same UI:
 *   open(slot)                 overlay from the results list
 *   renderStandalone(el, slot) the whole page, when opened from a share link
 *
 * A rally lead watching this does not need the roster, the formula, or anyone
 * else's times — they need to know when to tap, and to be told out loud.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var I = root.RallySync.icons;
  var A = root.RallySync.alarm;
  var C = root.RallySync.calc;
  var el = d.el;
  var icon = I.icon;

  var overlay = null;
  var timer = null;
  var fired = {};

  function open(slot, nowFn) {
    close();
    overlay = el('div.focus-overlay');
    var body = buildBody(slot, nowFn, close);
    overlay.appendChild(body.node);
    root.document.body.appendChild(overlay);
    root.document.addEventListener('keydown', onKey);
    startTimer(body.update, nowFn);
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (timer) { root.clearInterval(timer); timer = null; }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    fired = {};
    root.document.removeEventListener('keydown', onKey);
  }

  /** Share-link mode: this is the entire page. */
  function renderStandalone(container, slot) {
    d.clear(container);
    var body = buildBody(slot, null, null);
    container.appendChild(body.node);
    startTimer(body.update, null);
  }

  function startTimer(update, nowFn) {
    update((nowFn || Date.now)());
    timer = root.setInterval(function () { update((nowFn || Date.now)()); }, 250);
  }

  // ------------------------------------------------------------------ layout

  function buildBody(slot, nowFn, onClose) {
    var gathering = Number(slot.gatherSeconds) > 0;

    var big = el('div.focus-count', { text: '—' });
    var state = el('div.focus-state', { text: 'waiting' });
    var alarmBtn = el('button.btn.btn-secondary.focus-alarm', {
      type: 'button',
      onclick: function () {
        var ok = A.prime();
        alarmBtn.classList.toggle('is-armed', ok);
        alarmBtn.querySelector('span').textContent = ok ? 'Alarm armed' : 'Alarm unavailable';
        if (ok) A.beep(880, 0.07);
      }
    }, [icon('bell', 16), el('span', { text: 'Arm alarm' })]);

    var node = el('div.focus', {}, [
      el('div.focus-head', {}, [
        el('div.focus-head-main', {}, [
          el('div.focus-name', { text: slot.name || 'Your rally' }),
          el('div.focus-target', { text: slot.targetName ? 'on ' + slot.targetName : '' })
        ]),
        onClose ? el('button.btn.btn-icon', {
          type: 'button', 'aria-label': 'Close', onclick: onClose
        }, [icon('x', 20)]) : null
      ]),

      el('div.focus-label', { text: gathering ? 'TAP RALLY IN' : 'MARCH IN' }),
      big,
      state,

      el('div.focus-times', {}, [
        focusFact(gathering ? 'Tap at' : 'March at', d.utcClock(slot.rallyOpenMs) + ' UTC'),
        focusFact('Local', d.localClock(slot.rallyOpenMs) + ' ' + d.localZoneName()),
        gathering ? focusFact('Departs', d.utcClock(slot.departMs) + ' UTC') : null,
        focusFact('Lands', d.utcClock(slot.landingMs) + ' UTC'),
        focusFact('March', C.formatDuration(slot.marchSeconds))
      ]),

      alarmBtn,

      slot.tier === C.TIER.MEASURED
        ? el('p.focus-note', {}, [
            el('span.badge.badge-measured', { text: 'measured' }),
            ' This came from a real march, so it is exact.'
          ])
        : el('p.focus-note', {}, [
            el('span.badge.badge-estimated', { text: 'estimated' }),
            ' Community-estimated. Keep a couple of seconds spare and trust the in-game timer.'
          ])
    ]);

    function update(nowMs) {
      var seconds = (slot.rallyOpenMs - nowMs) / 1000;
      big.textContent = d.countdown(seconds);

      node.classList.toggle('is-soon', seconds > 0 && seconds <= 30);
      node.classList.toggle('is-now', seconds <= 0 && seconds > -15);
      node.classList.toggle('is-past', seconds <= -15);

      if (seconds > 30) state.textContent = 'waiting';
      else if (seconds > 0) state.textContent = 'get ready';
      else if (seconds > -15) state.textContent = 'GO NOW';
      else state.textContent = 'launch window passed';

      if (A.isPrimed()) {
        if (seconds <= 10 && seconds > 0 && !fired.warn) { fired.warn = true; A.warn(); }
        if (seconds <= 0 && seconds > -3 && !fired.go) { fired.go = true; A.go(); }
      }
    }

    return { node: node, update: update };
  }

  function focusFact(label, value) {
    return el('div.focus-fact', {}, [
      el('span.focus-fact-label', { text: label }),
      el('span.focus-fact-value', { text: value })
    ]);
  }

  root.RallySync.focus = { open: open, close: close, renderStandalone: renderStandalone };
})(typeof globalThis !== 'undefined' ? globalThis : this);
