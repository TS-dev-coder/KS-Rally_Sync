/**
 * timepicker.js — UTC time picker built for this job specifically.
 *
 * The native datetime-local input was the wrong tool: it renders differently in
 * every browser, shows a locale date format and AM/PM directly under a label
 * saying UTC, and buries seconds — which matter here, because a rally lands on
 * an exact second.
 *
 * This gives HH : MM : SS as three large segments you can type into, step with
 * the buttons (hold to repeat), or drive with the arrow keys, plus a separate
 * date row that stays out of the way because the answer is nearly always today.
 * Both UTC and local time update live as you edit.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var T = root.RallySync.i18n;
  var I = root.RallySync.icons;
  var el = d.el;
  var icon = I.icon;

  var overlay = null;
  var repeatTimer = null;
  var repeatDelay = null;

  /**
   * @param {{title:string, valueMs:number, nowMs:function|number,
   *          onPick:function(ms)}} options
   */
  function open(options) {
    close();

    var value = new Date(Number(options.valueMs) || nowOf(options));
    var parts = {
      y: value.getUTCFullYear(),
      mo: value.getUTCMonth(),
      d: value.getUTCDate(),
      h: value.getUTCHours(),
      mi: value.getUTCMinutes(),
      s: value.getUTCSeconds()
    };

    var segments = {};
    var dateLabel = el('span.tp-date-value');
    var echoUtc = el('span.tp-echo-utc');
    var echoLocal = el('span.tp-echo-local');
    var relative = el('span.tp-relative');

    function currentMs() {
      return Date.UTC(parts.y, parts.mo, parts.d, parts.h, parts.mi, parts.s, 0);
    }

    /** Rebuild from the canonical ms so overflow normalises (23:59 +1m rolls the date). */
    function sync(fromMs) {
      var next = new Date(fromMs);
      parts.y = next.getUTCFullYear();
      parts.mo = next.getUTCMonth();
      parts.d = next.getUTCDate();
      parts.h = next.getUTCHours();
      parts.mi = next.getUTCMinutes();
      parts.s = next.getUTCSeconds();
      paint();
    }

    function paintEcho() {
      var ms = currentMs();
      echoUtc.textContent = d.utcClock(ms) + ' UTC';
      echoLocal.textContent = d.localClock(ms) + ' ' + d.localZoneName();
      relative.textContent = describeOffset(ms - nowOf(options));
    }

    function paint() {
      var ms = currentMs();
      segments.h.value = pad(parts.h);
      segments.mi.value = pad(parts.mi);
      segments.s.value = pad(parts.s);
      dateLabel.textContent = d.utcDate(ms) + ' · ' + weekday(ms);
      echoUtc.textContent = d.utcClock(ms) + ' UTC';
      echoLocal.textContent = d.localClock(ms) + ' ' + d.localZoneName();
      relative.textContent = describeOffset(ms - nowOf(options));
    }

    function bump(unit, delta) {
      var ms = currentMs();
      if (unit === 'h') ms += delta * 3600000;
      else if (unit === 'mi') ms += delta * 60000;
      else if (unit === 's') ms += delta * 1000;
      else if (unit === 'day') ms += delta * 86400000;
      sync(ms);
    }

    function segment(unit, label, max) {
      var input = el('input.tp-input', {
        type: 'text', inputmode: 'numeric', maxlength: '2',
        'aria-label': label, value: pad(parts[unit]),
        onfocus: function (e) { e.target.select(); },
        oninput: function (e) {
          var digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          e.target.value = digits;
          if (digits === '') return;
          var n = Math.min(max, parseInt(digits, 10));
          parts[unit] = n;
          // Two digits typed means this segment is done — move to the next.
          if (digits.length === 2) {
            sync(currentMs());
            focusNext(unit);
          } else {
            // Mid-typing: refresh the echo but leave the field as typed.
            paintEcho();
          }
        },
        onblur: function () { sync(currentMs()); },
        onkeydown: function (e) {
          if (e.key === 'ArrowUp') { e.preventDefault(); bump(unit, 1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bump(unit, -1); }
          else if (e.key === 'Enter') { e.preventDefault(); commit(); }
        }
      });
      segments[unit] = input;

      return el('div.tp-seg', {}, [
        stepper(T.t('tp.increase', { unit: label }), 'up', function () { bump(unit, 1); }),
        input,
        stepper(T.t('tp.decrease', { unit: label }), 'down', function () { bump(unit, -1); }),
        el('span.tp-seg-label', { text: label })
      ]);
    }

    function focusNext(unit) {
      var order = ['h', 'mi', 's'];
      var next = order[order.indexOf(unit) + 1];
      if (next && segments[next]) segments[next].focus();
    }

    function commit() {
      var ms = currentMs();
      close();
      if (options.onPick) options.onPick(ms);
    }

    var body = el('div.tp-dialog', {}, [
      el('div.tp-head', {}, [
        el('div.tp-head-main', {}, [
          el('h2.tp-title', { text: options.title || T.t('tp.setTime') }),
          el('p.tp-sub', { text: T.t('tp.utcNote') })
        ]),
        el('button.btn.btn-icon', {
          type: 'button', 'aria-label': T.t('tp.close'), onclick: close
        }, [icon('x', 18)])
      ]),

      el('div.tp-clockrow', {}, [
        segment('h', T.t('tp.hh'), 23),
        el('span.tp-colon', { text: ':' }),
        segment('mi', T.t('tp.mm'), 59),
        el('span.tp-colon', { text: ':' }),
        segment('s', T.t('tp.ss'), 59)
      ]),

      el('div.tp-quick', {}, [
        quick(T.t('tp.now'), function () { sync(nowOf(options)); }),
        // Coarsest first. Each snaps to the next mark on that grid -- so at
        // 19:34 these give 20:00, 20:00 and 19:45. They were labelled
        // ":00 / :15 / :30", which promised a time ending in those digits and
        // was only true of the first.
        quick(T.t('tp.nextHour'), function () { sync(nextBoundary(nowOf(options), 3600)); }),
        quick(T.t('tp.nextHalf'), function () { sync(nextBoundary(nowOf(options), 1800)); }),
        quick(T.t('tp.nextQuarter'), function () { sync(nextBoundary(nowOf(options), 900)); }),
        quick(T.t('tp.zeroSecs'), function () { parts.s = 0; sync(currentMs()); })
      ]),

      el('div.tp-daterow', {}, [
        el('button.btn.btn-icon', {
          type: 'button', 'aria-label': T.t('tp.prevDay'), onclick: function () { bump('day', -1); }
        }, [icon('chevronRight', 15)]),
        el('div.tp-date-main', {}, [
          el('span.tp-date-label', { text: T.t('tp.dateLabel') }),
          dateLabel
        ]),
        el('button.btn.btn-icon', {
          type: 'button', 'aria-label': T.t('tp.nextDay'), onclick: function () { bump('day', 1); }
        }, [icon('chevronRight', 15)])
      ]),

      el('div.tp-quick', {}, [
        quick(T.t('tp.today'), function () { sync(sameClockOn(nowOf(options), 0, parts)); }),
        quick(T.t('tp.tomorrow'), function () { sync(sameClockOn(nowOf(options), 1, parts)); })
      ]),

      el('div.tp-echo', {}, [echoUtc, echoLocal, relative]),

      el('div.tp-actions', {}, [
        el('button.btn.btn-ghost', { type: 'button', onclick: close }, [T.t('common.cancel')]),
        el('button.btn.btn-primary', { type: 'button', onclick: commit }, [T.t('tp.setTime')])
      ])
    ]);

    // The previous-day chevron is the same glyph mirrored.
    var prevIcon = body.querySelector('.tp-daterow .btn .icon');
    if (prevIcon) prevIcon.style.transform = 'rotate(180deg)';

    overlay = el('div.tp-overlay', {
      role: 'dialog', 'aria-modal': 'true',
      onclick: function (e) { if (e.target === overlay) close(); }
    }, [body]);

    root.document.body.appendChild(overlay);
    root.document.addEventListener('keydown', onKey);
    paint();
    if (segments.h) segments.h.focus();
  }

  /** Press-and-hold repeats, so setting a time 40 minutes out is not 40 taps. */
  function stepper(label, direction, action) {
    var button = el('button.tp-step', {
      type: 'button', 'aria-label': label,
      onclick: function (e) {
        e.preventDefault();
        // A keyboard-activated click reports detail 0; a mouse click reports 1+
        // and has already been handled by pointerdown. This keeps the button
        // reachable by keyboard without double-stepping for pointer users.
        if (e.detail === 0) action();
      }
    }, [icon('chevronDown', 14)]);

    if (direction === 'up') {
      var glyph = button.querySelector('.icon');
      if (glyph) glyph.style.transform = 'rotate(180deg)';
    }

    button.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      action();
      stopRepeat();
      repeatDelay = root.setTimeout(function () {
        repeatTimer = root.setInterval(action, 80);
      }, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (evt) {
      button.addEventListener(evt, stopRepeat);
    });
    return button;
  }

  function stopRepeat() {
    if (repeatDelay) { root.clearTimeout(repeatDelay); repeatDelay = null; }
    if (repeatTimer) { root.clearInterval(repeatTimer); repeatTimer = null; }
  }

  function quick(label, onclick) {
    return el('button.btn.btn-quick', { type: 'button', onclick: onclick }, [label]);
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    stopRepeat();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    root.document.removeEventListener('keydown', onKey);
  }

  // ---------------------------------------------------------------- helpers

  function nowOf(options) {
    return typeof options.nowMs === 'function' ? options.nowMs() : (Number(options.nowMs) || Date.now());
  }

  /** The next round boundary after now — "next :30" and friends. */
  function nextBoundary(nowMs, stepSeconds) {
    var step = stepSeconds * 1000;
    return Math.ceil((nowMs + 1000) / step) * step;
  }

  /** Keeps the chosen clock time but moves it to today / today + n days. */
  function sameClockOn(nowMs, dayOffset, parts) {
    var base = new Date(nowMs + dayOffset * 86400000);
    return Date.UTC(
      base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(),
      parts.h, parts.mi, parts.s, 0
    );
  }

  function describeOffset(deltaMs) {
    var seconds = Math.round(deltaMs / 1000);
    if (Math.abs(seconds) < 5) return T.t('tp.rightNow');
    return T.t(seconds < 0 ? 'tp.ago' : 'tp.fromNow',
      { time: d.countdown(Math.abs(seconds)) });
  }

  function weekday(ms) {
    // Intl ships every locale's weekday names, so translating an array by
    // hand would be 16 chances to get a calendar wrong for no benefit.
    try {
      return new Intl.DateTimeFormat(T.speechTag(), {
        weekday: 'short', timeZone: 'UTC'
      }).format(new Date(ms));
    } catch (err) {
      // i18n-exempt: only reached if Intl is unavailable, which is the one
      // case where no locale data exists to translate these from anyway.
      var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return names[new Date(ms).getUTCDay()];
    }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  root.RallySync.timePicker = { open: open, close: close, nextBoundary: nextBoundary };
})(typeof globalThis !== 'undefined' ? globalThis : this);
