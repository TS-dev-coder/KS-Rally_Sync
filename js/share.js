/**
 * share.js — encodes one person's slot into a link.
 *
 * The whole payload rides in the URL fragment, so nothing is uploaded anywhere
 * and the recipient needs no setup: they open the link and get their own
 * countdown. Fragments are never sent to a server, which is the point.
 *
 * Keys are single letters because the link gets pasted into chat.
 */
;(function (root) {
  'use strict';

  var VERSION = 1;

  /** @returns {string} the fragment value, e.g. "eyJ2Ijox..." */
  function encodeSlot(slot) {
    var payload = {
      v: VERSION,
      n: slot.name || '',
      t: slot.targetName || '',
      o: Math.round(slot.rallyOpenMs),
      d: Math.round(slot.departMs),
      l: Math.round(slot.landingMs),
      m: Math.round(slot.marchSeconds),
      g: Math.round(slot.gatherSeconds || 0),
      x: slot.tier || ''
    };
    return toBase64Url(JSON.stringify(payload));
  }

  function decodeSlot(fragment) {
    try {
      var parsed = JSON.parse(fromBase64Url(String(fragment || '')));
      if (!parsed || parsed.v !== VERSION) return null;
      if (!isFinite(parsed.o) || !isFinite(parsed.l)) return null;
      return {
        name: String(parsed.n || ''),
        targetName: String(parsed.t || ''),
        rallyOpenMs: Number(parsed.o),
        departMs: Number(parsed.d),
        landingMs: Number(parsed.l),
        marchSeconds: Number(parsed.m),
        gatherSeconds: Number(parsed.g) || 0,
        tier: String(parsed.x || '')
      };
    } catch (err) {
      return null;
    }
  }

  /** Full shareable URL for a slot, based on where the app is served from. */
  function slotUrl(slot, baseHref) {
    var base = String(baseHref || (root.location ? root.location.href : ''));
    base = base.split('#')[0];
    return base + '#go=' + encodeSlot(slot);
  }

  /** Reads a slot out of a location hash, or null if this is a normal load. */
  function slotFromHash(hash) {
    var raw = String(hash || '');
    var match = /[#&]go=([^&]+)/.exec(raw);
    return match ? decodeSlot(match[1]) : null;
  }

  // Base64url so the link survives chat clients that mangle + / = characters.
  function toBase64Url(text) {
    var bytes = unescape(encodeURIComponent(text)); // UTF-8 safe
    var b64 = root.btoa ? root.btoa(bytes) : Buffer.from(bytes, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(value) {
    var b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    var bytes = root.atob ? root.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    return decodeURIComponent(escape(bytes));
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.share = {
    VERSION: VERSION,
    encodeSlot: encodeSlot,
    decodeSlot: decodeSlot,
    slotUrl: slotUrl,
    slotFromHash: slotFromHash
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
