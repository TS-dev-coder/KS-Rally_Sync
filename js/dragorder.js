/**
 * dragorder.js — drag to reorder a list.
 *
 * Pointer events rather than HTML5 drag-and-drop: HTML5 drag does not fire on
 * touch, and this list is reordered on a phone mid-event. Dragging only starts
 * from a handle so the list still scrolls normally everywhere else.
 *
 * Items are moved with transforms during the drag and the real reorder is
 * committed once on release, so nothing re-renders under the finger.
 */
;(function (root) {
  'use strict';

  /**
   * @param {Element} list container whose element children are the items
   * @param {{handleSelector:string, onReorder:function(from:number,to:number)}} options
   */
  function enable(list, options) {
    if (!list) return;
    var handleSelector = options.handleSelector || '.drag-handle';

    list.addEventListener('pointerdown', function (event) {
      var handle = event.target.closest ? event.target.closest(handleSelector) : null;
      if (!handle || !list.contains(handle)) return;

      var item = handle.closest('[data-index]');
      if (!item) return;

      event.preventDefault();
      start(list, item, event, options);
    });
  }

  function start(list, item, downEvent, options) {
    var items = Array.prototype.slice.call(list.children);
    var fromIndex = items.indexOf(item);
    if (fromIndex === -1) return;

    var rects = items.map(function (node) {
      var box = node.getBoundingClientRect();
      return { top: box.top, height: box.height, center: box.top + box.height / 2 };
    });

    var startY = downEvent.clientY;
    var draggedHeight = rects[fromIndex].height;
    var gap = itemGap(rects);
    var step = draggedHeight + gap;
    var toIndex = fromIndex;

    list.classList.add('is-reordering');
    item.classList.add('is-dragging');

    var pointerId = downEvent.pointerId;
    try { item.setPointerCapture(pointerId); } catch (err) { /* not fatal */ }

    function onMove(moveEvent) {
      var dy = moveEvent.clientY - startY;
      item.style.transform = 'translateY(' + dy + 'px)';

      var draggedCenter = rects[fromIndex].center + dy;
      var next = 0;
      for (var j = 0; j < rects.length; j++) {
        if (j === fromIndex) continue;
        if (rects[j].center < draggedCenter) next++;
      }
      if (next !== toIndex) {
        toIndex = next;
        shiftOthers(items, fromIndex, toIndex, step);
      }
    }

    function onUp() {
      item.removeEventListener('pointermove', onMove);
      item.removeEventListener('pointerup', onUp);
      item.removeEventListener('pointercancel', onUp);
      try { item.releasePointerCapture(pointerId); } catch (err) { /* ignore */ }

      items.forEach(function (node) {
        node.style.transform = '';
        node.classList.remove('is-shifted');
      });
      item.classList.remove('is-dragging');
      list.classList.remove('is-reordering');

      if (toIndex !== fromIndex && options.onReorder) options.onReorder(fromIndex, toIndex);
    }

    item.addEventListener('pointermove', onMove);
    item.addEventListener('pointerup', onUp);
    item.addEventListener('pointercancel', onUp);
  }

  /** Preview the new order by sliding everything the dragged item passes. */
  function shiftOthers(items, fromIndex, toIndex, step) {
    items.forEach(function (node, index) {
      if (index === fromIndex) return;
      var offset = 0;
      if (fromIndex < index && index <= toIndex) offset = -step;
      else if (toIndex <= index && index < fromIndex) offset = step;
      node.style.transform = offset ? 'translateY(' + offset + 'px)' : '';
      node.classList.toggle('is-shifted', offset !== 0);
    });
  }

  function itemGap(rects) {
    if (rects.length < 2) return 0;
    return Math.max(0, rects[1].top - (rects[0].top + rects[0].height));
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.dragOrder = { enable: enable };
})(typeof globalThis !== 'undefined' ? globalThis : this);
