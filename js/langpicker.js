/**
 * langpicker.js — the language sheet.
 *
 * Reachable from the nav on every screen, because a player who has the app in
 * the wrong language cannot navigate to a settings page to fix it. That is the
 * whole reason this is not only in Settings: the one person who most needs the
 * language switch is the one least able to read their way to it.
 *
 * Everything a language touches — text, the spoken callouts, the illustrated
 * guide, and the text direction — updates on the tap, with no reload.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var el = d.el;
  var icon = root.RallySync.icons.icon;
  var T = root.RallySync.i18n;
  var S = root.RallySync.state;

  var overlay = null;
  var lastFocus = null;

  function close(keepFocus) {
    if (!overlay) return;
    root.document.removeEventListener('keydown', onKey);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    // Back to the button that opened it, or focus lands on <body> and the next
    // Tab starts from the top of the page. Skipped when a language change is
    // about to re-render the nav: restoring focus to a node that is one tick
    // from being replaced loses it anyway.
    if (!keepFocus && lastFocus && lastFocus.isConnected) lastFocus.focus();
    if (!keepFocus) lastFocus = null;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }

    // aria-modal only tells a screen reader the rest of the page is inert; it
    // does not stop Tab walking out into it. Without this, Tab from the last
    // row lands on the page behind a sheet that still covers it.
    if (e.key === 'Tab') {
      // Every button in this sheet is visible by construction -- the close
      // control and one row per language -- so there is nothing to filter out,
      // and a visibility check here would depend on layout the test DOM does
      // not compute, silently disabling the trap where it is being verified.
      var focusable = [].slice.call(overlay.querySelectorAll('button:not([disabled])'));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && root.document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && root.document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    var items = [].slice.call(overlay.querySelectorAll('.lang-row'));
    if (!items.length) return;
    e.preventDefault();
    var at = items.indexOf(root.document.activeElement);
    var next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length;
    else next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
    items[next].focus();
  }

  function choose(code) {
    S.updateSettings({ language: code });
    root.RallySync.app.applyLanguage();
    close(true);
    root.RallySync.app.refresh();
    // The nav is rebuilt by refresh(), so the button that opened this no longer
    // exists. Focus its replacement, which is always present.
    var back = root.document.querySelector('.nav-lang');
    if (back) back.focus();
    lastFocus = null;
  }

  /** The short badge on the nav button: what am I on right now? */
  function currentShort() {
    var chosen = S.data.settings.language;
    var def = byCode(chosen || T.detect()) || byCode('en');
    return def.short;
  }

  function byCode(code) {
    var found = null;
    T.LANGUAGES.forEach(function (l) { if (l.code === code) found = l; });
    return found;
  }

  function row(def, isOn, onPick) {
    // The row's layout follows the interface direction so the tick stays on the
    // same side for every row; only the NAMES carry their own direction. A
    // language list is the one place guaranteed to mix scripts, and putting dir
    // on the row would flip its layout instead of just its text.
    var textDir = def && def.rtl ? 'rtl' : 'ltr';
    return el('button.lang-row' + (isOn ? ' is-on' : ''), {
      type: 'button',
      lang: def ? def.code : null,
      role: 'option',
      'aria-selected': isOn ? 'true' : 'false',
      onclick: onPick
    }, [
      el('span.lang-row-main', {}, [
        el('span.lang-row-native', {
          dir: textDir, text: def ? def.native : T.t('set.automatic')
        }),
        el('span.lang-row-english', {
          dir: def ? 'ltr' : textDir,
          text: def ? def.english : (byCode(T.detect()) || byCode('en')).native
        })
      ]),
      isOn ? el('span.lang-row-check', {}, [icon('check', 16)]) : null
    ]);
  }

  function open(anchor) {
    close();
    lastFocus = anchor || root.document.activeElement;
    var chosen = S.data.settings.language;

    var list = el('div.lang-list', { role: 'listbox', 'aria-label': T.t('head.language') }, [
      row(null, !chosen, function () { choose(null); })
    ]);

    T.LANGUAGES.forEach(function (def) {
      list.appendChild(row(def, chosen === def.code, function () { choose(def.code); }));
    });

    var sheet = el('div.lang-sheet', { role: 'dialog', 'aria-modal': 'true' }, [
      el('div.lang-head', {}, [
        el('div.lang-head-main', {}, [
          el('h2.lang-title', { text: T.t('head.language') }),
          el('p.lang-sub', { text: T.t('lang.everythingFollows') })
        ]),
        el('button.btn.btn-icon', {
          // Wrapped, not passed directly: a handler receives the click Event as
          // its first argument, which would arrive as a truthy keepFocus and
          // silently strand focus on <body>.
          type: 'button', 'aria-label': T.t('lang.close'),
          onclick: function () { close(); }
        }, [icon('x', 18)])
      ]),
      list
    ]);

    overlay = el('div.lang-overlay', {
      onclick: function (e) { if (e.target === overlay) close(); }
    }, [sheet]);

    root.document.body.appendChild(overlay);
    root.document.addEventListener('keydown', onKey);

    // Open on the current language so the selected one is visible in a list of
    // seventeen, and arrow keys start from where you already are.
    var on = overlay.querySelector('.lang-row.is-on') || overlay.querySelector('.lang-row');
    if (on) {
      on.focus();
      if (on.scrollIntoView) on.scrollIntoView({ block: 'center' });
    }
  }

  root.RallySync.langPicker = {
    open: open,
    close: close,
    currentShort: currentShort
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
