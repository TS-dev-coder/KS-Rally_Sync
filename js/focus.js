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
  var T = root.RallySync.i18n;
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
    var state = el('div.focus-state', { text: T.t('focus.waiting') });
    // Alarms default to on; this only exists to silence them, or to re-arm if
    // the browser has not yet allowed audio on this page.
    var alarmOn = true;
    var alarmBtn = el('button.btn.btn-secondary.focus-alarm.is-armed', {
      type: 'button',
      onclick: function () {
        alarmOn = !alarmOn;
        if (alarmOn && A.prime()) A.beep(880, 0.07);
        alarmBtn.classList.toggle('is-armed', alarmOn);
        alarmBtn.querySelector('span').textContent =
          alarmOn ? T.t('focus.alarmOn') : T.t('focus.alarmOff');
      }
    }, [icon('bell', 16), el('span', { text: T.t('focus.alarmOn') })]);

    var node = el('div.focus', {}, [
      el('div.focus-head', {}, [
        el('div.focus-head-main', {}, [
          el('div.focus-name', { text: slot.name || T.t('focus.yourRally') }),
          el('div.focus-target', {
            text: slot.targetName ? T.t('focus.onTarget', { name: slot.targetName }) : ''
          })
        ]),
        onClose ? el('button.btn.btn-icon', {
          type: 'button', 'aria-label': T.t('focus.close'), onclick: onClose
        }, [icon('x', 20)]) : null
      ]),

      el('div.focus-label', { text: T.t(gathering ? 'focus.tapRallyIn' : 'focus.marchIn') }),
      big,
      state,

      el('div.focus-times', {}, [
        focusFact(T.t(gathering ? 'focus.tapAt' : 'focus.marchAt'),
          d.utcClock(slot.rallyOpenMs) + ' UTC'),
        focusFact(T.t('focus.local'), d.localClock(slot.rallyOpenMs) + ' ' + d.localZoneName()),
        gathering ? focusFact(T.t('focus.departs'), d.utcClock(slot.departMs) + ' UTC') : null,
        focusFact(T.t('focus.lands'), d.utcClock(slot.landingMs) + ' UTC'),
        focusFact(T.t('focus.march'), C.formatDuration(slot.marchSeconds))
      ]),

      alarmBtn,

      slot.tier === C.TIER.MEASURED
        ? el('p.focus-note', {}, [
            el('span.badge.badge-measured', { text: T.t('focus.measured') }),
            ' ' + T.t('focus.measuredNote')
          ])
        : el('p.focus-note', {}, [
            el('span.badge.badge-estimated', { text: T.t('focus.estimated') }),
            ' ' + T.t('focus.estimatedNote')
          ])
    ]);

    function update(nowMs) {
      var seconds = (slot.rallyOpenMs - nowMs) / 1000;
      big.textContent = d.countdown(seconds);

      node.classList.toggle('is-soon', seconds > 0 && seconds <= 30);
      node.classList.toggle('is-now', seconds <= 0 && seconds > -15);
      node.classList.toggle('is-past', seconds <= -15);

      if (seconds > 30) state.textContent = T.t('focus.waiting');
      else if (seconds > 0) state.textContent = T.t('focus.getReady');
      else if (seconds > -15) state.textContent = T.t('focus.goNow');
      else state.textContent = T.t('focus.windowPassed');

      if (alarmOn && A.isPrimed()) {
        if (seconds <= 10 && seconds > 0 && !fired.warn) { fired.warn = true; A.warn(); }
        if (seconds <= 5 && seconds > 0) {
          var pipKey = 'pip' + Math.ceil(seconds);
          if (!fired[pipKey]) { fired[pipKey] = true; A.pip(); }
        }
        if (seconds <= 0 && seconds > -3 && !fired.go) { fired.go = true; A.go(); }

        var who = slot.name || T.t('focus.rallyFallback');
        [60, 30, 10].forEach(function (mark) {
          if (seconds <= mark && seconds > mark - 2 && !fired['say' + mark]) {
            fired['say' + mark] = true;
            A.speak(T.t('speech.rallyIn', { name: who, seconds: Math.round(seconds) }));
          }
        });
        if (seconds <= 0 && seconds > -3 && !fired.sayGo) {
          fired.sayGo = true;
          A.speak(T.t('speech.goNow', { name: who }));
        }
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
