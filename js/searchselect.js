/**
 * searchselect.js — a searchable single-select.
 *
 * Chips were fine for three targets and unusable for twenty: they wrap into a
 * wall, and you cannot type to find one. This shows the current choice as a
 * button, and opens a filter box over the list.
 *
 * It owns its own open/filter state and never asks the app to re-render, so
 * typing in the search box cannot lose focus mid-keystroke.
 */
;(function (root) {
  'use strict';

  var d = root.RallySync.dom;
  var I = root.RallySync.icons;
  var el = d.el;
  var icon = I.icon;

  /**
   * @param {{options:Array<{id,label,sub,badge,warn}>, value:string,
   *          placeholder:string, searchPlaceholder:string, emptyText:string,
   *          footer:Node, onSelect:function(id)}} config
   * @returns {HTMLElement}
   */
  function create(config) {
    var options = config.options || [];
    var open = false;
    var filter = '';
    var activeIndex = 0;

    var wrap = el('div.ss');
    var label = el('span.ss-label');
    var trigger = el('button.ss-trigger', {
      type: 'button',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      onclick: function () { toggle(!open); }
    }, [label, el('span.ss-chevron', {}, [icon('chevronDown', 15)])]);

    var search = el('input.input.ss-search', {
      type: 'text',
      placeholder: config.searchPlaceholder || 'Type to filter…',
      autocomplete: 'off',
      oninput: function (e) { filter = e.target.value; activeIndex = 0; paintList(); },
      onkeydown: onSearchKey
    });

    var list = el('div.ss-list', { role: 'listbox' });
    var panel = el('div.ss-panel', { hidden: true }, [
      el('div.ss-search-wrap', {}, [icon('search', 15), search]),
      list,
      config.footer || null
    ]);

    wrap.appendChild(trigger);
    wrap.appendChild(panel);

    // ------------------------------------------------------------ rendering

    function currentOption() {
      for (var i = 0; i < options.length; i++) {
        if (options[i].id === config.value) return options[i];
      }
      return null;
    }

    function paintLabel() {
      var current = currentOption();
      d.clear(label);
      if (!current) {
        label.appendChild(el('span.ss-placeholder', {
          text: config.placeholder || 'Choose…'
        }));
        return;
      }
      // The detail shows on the closed control too, not only in the open list:
      // what you have selected matters more than what you could select.
      label.appendChild(el('span.ss-label-stack', {}, [
        el('span.ss-label-top', {}, [
          el('span.ss-label-main', { text: current.label }),
          current.badge ? el('span.tag.tag-squad', { text: current.badge }) : null,
          current.warn ? el('span.tag.tag-error', { text: current.warn }) : null
        ]),
        current.sub ? el('span.ss-label-sub', { text: current.sub }) : null
      ]));
    }

    function matches() {
      var needle = filter.trim().toLowerCase();
      if (needle === '') return options.slice();
      return options.filter(function (o) {
        return (o.label + ' ' + (o.badge || '') + ' ' + (o.sub || ''))
          .toLowerCase().indexOf(needle) !== -1;
      });
    }

    function paintList() {
      var visible = matches();
      d.clear(list);

      if (visible.length === 0) {
        list.appendChild(el('p.ss-empty', {
          text: config.emptyText || 'Nothing matches that.'
        }));
        return;
      }
      if (activeIndex >= visible.length) activeIndex = visible.length - 1;

      visible.forEach(function (option, index) {
        var selected = option.id === config.value;
        list.appendChild(el('button.ss-option' +
          (selected ? ' is-selected' : '') +
          (index === activeIndex ? ' is-active' : ''), {
          type: 'button',
          role: 'option',
          'aria-selected': selected ? 'true' : 'false',
          onmouseenter: function () { activeIndex = index; markActive(); },
          onclick: function () { choose(option.id); }
        }, [
          el('span.ss-option-main', {}, [
            el('span.ss-option-label', { text: option.label }),
            option.sub ? el('span.ss-option-sub', { text: option.sub }) : null
          ]),
          option.badge ? el('span.tag.tag-squad', { text: option.badge }) : null,
          option.warn ? el('span.tag.tag-error', { text: option.warn }) : null,
          selected ? icon('check', 15) : null
        ]));
      });
    }

    function markActive() {
      var nodes = list.querySelectorAll('.ss-option');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].classList.toggle('is-active', i === activeIndex);
      }
    }

    // -------------------------------------------------------------- behaviour

    function toggle(next) {
      open = next;
      panel.hidden = !open;
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        filter = '';
        search.value = '';
        activeIndex = Math.max(0, matches().findIndex(function (o) {
          return o.id === config.value;
        }));
        paintList();
        search.focus();
        root.document.addEventListener('pointerdown', onOutside, true);
        root.document.addEventListener('keydown', onEscape, true);
      } else {
        root.document.removeEventListener('pointerdown', onOutside, true);
        root.document.removeEventListener('keydown', onEscape, true);
      }
    }

    function onOutside(e) { if (!wrap.contains(e.target)) toggle(false); }
    function onEscape(e) {
      if (e.key === 'Escape') { e.stopPropagation(); toggle(false); trigger.focus(); }
    }

    function onSearchKey(e) {
      var visible = matches();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(visible.length - 1, activeIndex + 1);
        markActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        markActive();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visible[activeIndex]) choose(visible[activeIndex].id);
      }
    }

    function choose(id) {
      config.value = id;
      paintLabel();
      toggle(false);
      trigger.focus();
      if (config.onSelect) config.onSelect(id);
    }

    paintLabel();
    return wrap;
  }

  root.RallySync.searchSelect = { create: create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
