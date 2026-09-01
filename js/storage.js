/**
 * storage.js — localStorage read/write helpers.
 *
 * Every access is wrapped: Safari private mode and browsers with site data
 * blocked throw on localStorage access rather than returning null, and an
 * exception here would take the whole app down mid-event.
 */
;(function (root) {
  'use strict';

  var PREFIX = 'rallysync.v1.';
  var memoryFallback = {};
  var storageWorks = null;

  function available() {
    if (storageWorks !== null) return storageWorks;
    try {
      var probe = PREFIX + '__probe__';
      root.localStorage.setItem(probe, '1');
      root.localStorage.removeItem(probe);
      storageWorks = true;
    } catch (err) {
      storageWorks = false;
    }
    return storageWorks;
  }

  function read(key, fallback) {
    try {
      var raw = available()
        ? root.localStorage.getItem(PREFIX + key)
        : memoryFallback[key];
      if (raw === null || raw === undefined) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    var raw;
    try {
      raw = JSON.stringify(value);
    } catch (err) {
      return false;
    }
    try {
      if (available()) root.localStorage.setItem(PREFIX + key, raw);
      else memoryFallback[key] = raw;
      return true;
    } catch (err) {
      // Quota exceeded or storage disabled mid-session: keep working in memory.
      memoryFallback[key] = raw;
      return false;
    }
  }

  function remove(key) {
    try {
      if (available()) root.localStorage.removeItem(PREFIX + key);
    } catch (err) { /* ignore */ }
    delete memoryFallback[key];
  }

  /** Keys owned by the app, for export and reset. */
  var KEYS = ['leads', 'targets', 'zones', 'samples', 'measurements', 'settings'];

  function exportAll() {
    var payload = { app: 'RallySync', version: 1, exportedISO: new Date().toISOString(), data: {} };
    KEYS.forEach(function (key) { payload.data[key] = read(key, null); });
    return payload;
  }

  /**
   * Replaces stored data from an export payload.
   * @returns {{ok:boolean, error:string|null, imported:string[]}}
   */
  function importAll(payload) {
    if (!payload || typeof payload !== 'object' || !payload.data) {
      return { ok: false, error: 'That file is not a RallySync backup.', imported: [] };
    }
    if (payload.app && payload.app !== 'RallySync') {
      return { ok: false, error: 'That backup came from a different app.', imported: [] };
    }
    var imported = [];
    KEYS.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(payload.data, key) && payload.data[key] !== null) {
        write(key, payload.data[key]);
        imported.push(key);
      }
    });
    if (imported.length === 0) {
      return { ok: false, error: 'That backup contained no RallySync data.', imported: [] };
    }
    return { ok: true, error: null, imported: imported };
  }

  function clearAll() {
    KEYS.forEach(remove);
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.storage = {
    PREFIX: PREFIX,
    KEYS: KEYS,
    available: available,
    read: read,
    write: write,
    remove: remove,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
