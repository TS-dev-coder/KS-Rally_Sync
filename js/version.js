/**
 * version.js — what build am I looking at, and is it the current one?
 *
 * There is no build step to stamp a commit hash into, so the release number is
 * kept by hand. The useful half is automatic: `document.lastModified` carries
 * the Last-Modified header of index.html, which on GitHub Pages and Cloudflare
 * Pages is the moment that deploy went out. Comparing it against a fresh fetch
 * of the same file answers the real question — is a newer deploy live than the
 * one this tab loaded?
 */
;(function (root) {
  'use strict';

  var VERSION = '3.5';

  /** When the page this tab is running was published. */
  function buildMs() {
    var parsed = Date.parse(root.document.lastModified);
    return isFinite(parsed) ? parsed : null;
  }

  function buildText() {
    var ms = buildMs();
    if (ms === null) return 'unknown';
    var d = root.RallySync.dom;
    return d.utcDate(ms) + ' ' + d.utcClock(ms) + ' UTC';
  }

  function unavailable(reason) {
    return { ok: false, stale: false, latestMs: null, reason: reason };
  }

  /**
   * Fetches index.html past every cache and reads its Last-Modified.
   *
   * @returns {Promise<{ok:boolean, stale:boolean, latestMs:number|null,
   *                    reason:string|null}>}
   */
  function checkForUpdate() {
    var url = String(root.location.href).split('#')[0].split('?')[0];

    if (root.location.protocol === 'file:') {
      return Promise.resolve(unavailable('Opened from a file, so there is no server to ask.'));
    }
    // Calling a missing fetch throws synchronously, before any promise exists,
    // so the .catch() below would never see it and this would break its own
    // contract of always resolving to a result.
    if (typeof root.fetch !== 'function') {
      return Promise.resolve(unavailable('This browser cannot check for updates on its own.'));
    }

    return root.fetch(url + '?_v=' + Date.now(), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          return { ok: false, stale: false, latestMs: null, reason: 'Server returned ' + response.status + '.' };
        }
        var header = response.headers.get('last-modified');
        var latest = header ? Date.parse(header) : NaN;
        if (!isFinite(latest)) {
          return {
            ok: false, stale: false, latestMs: null,
            reason: 'The server did not say when this was published.'
          };
        }
        var mine = buildMs();
        // A minute of slack: a deploy can touch files a few seconds apart.
        var stale = mine !== null && latest - mine > 60000;
        return { ok: true, stale: stale, latestMs: latest, reason: null };
      })
      .catch(function () {
        return { ok: false, stale: false, latestMs: null, reason: 'Could not reach the server — you may be offline.' };
      });
  }

  /** Bypasses the browser cache on the way back in. */
  function reloadFresh() {
    var url = String(root.location.href).split('#')[0].split('?')[0];
    root.location.replace(url + '?_v=' + Date.now());
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.version = {
    VERSION: VERSION,
    buildMs: buildMs,
    buildText: buildText,
    checkForUpdate: checkForUpdate,
    reloadFresh: reloadFresh
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
