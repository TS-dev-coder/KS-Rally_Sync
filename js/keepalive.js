/**
 * keepalive.js — keeps the tab running while a launch is pending.
 *
 * Browsers work hard to make background tabs cheap, which is normally right and
 * is exactly wrong for an alarm. Two mechanisms fight back, and both are honest
 * uses of the platform rather than tricks:
 *
 *   1. A silent looping <audio> element. Chrome treats a tab playing media as
 *      active, so it is not discarded by Memory Saver and does not fall into
 *      the once-per-minute "intensive throttling" applied to hidden tabs.
 *   2. A screen Wake Lock, so a phone left on the desk does not sleep through
 *      the countdown. Only held while the page is visible — the API requires it.
 *
 * What this cannot do, and no web page can: stop the operating system killing
 * the browser, or keep an iOS Safari tab alive once it is backgrounded. The
 * scheduled tones in alarm.js are the real safety net; this widens the window
 * in which they survive.
 */
;(function (root) {
  'use strict';

  var audio = null;
  var wakeLock = null;
  var running = false;
  var silentUrl = null;

  /** A one-second silent WAV, built at runtime so no asset is shipped. */
  function silentWavUrl() {
    if (silentUrl) return silentUrl;
    var rate = 8000;
    var samples = rate;          // one second
    var bytes = 44 + samples * 2;
    var buffer = new ArrayBuffer(bytes);
    var view = new DataView(buffer);

    function ascii(offset, text) {
      for (var i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    }

    ascii(0, 'RIFF');
    view.setUint32(4, bytes - 8, true);
    ascii(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);        // PCM header size
    view.setUint16(20, 1, true);         // PCM
    view.setUint16(22, 1, true);         // mono
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);  // byte rate
    view.setUint16(32, 2, true);         // block align
    view.setUint16(34, 16, true);        // bits per sample
    ascii(36, 'data');
    view.setUint32(40, samples * 2, true);
    // Samples stay zero — silence.

    silentUrl = root.URL.createObjectURL(new root.Blob([buffer], { type: 'audio/wav' }));
    return silentUrl;
  }

  function start() {
    if (running) return true;
    running = true;
    startAudio();
    requestWakeLock();
    root.document.addEventListener('visibilitychange', onVisibility);
    return true;
  }

  function stop() {
    running = false;
    root.document.removeEventListener('visibilitychange', onVisibility);
    if (audio) {
      try { audio.pause(); } catch (err) { /* ignore */ }
      audio = null;
    }
    releaseWakeLock();
  }

  function isRunning() { return running; }

  function startAudio() {
    try {
      if (!audio) {
        audio = new root.Audio(silentWavUrl());
        audio.loop = true;
        audio.volume = 0.001;   // inaudible, but counts as playing media
        audio.setAttribute('aria-hidden', 'true');
      }
      var played = audio.play();
      if (played && played.catch) {
        // Autoplay is blocked until the page has been interacted with; the
        // first gesture handler in app.js retries this.
        played.catch(function () { /* retried on the next gesture */ });
      }
    } catch (err) { /* keeping alive is best-effort */ }
  }

  function requestWakeLock() {
    try {
      if (!root.navigator || !root.navigator.wakeLock) return;
      if (root.document.visibilityState !== 'visible') return;
      root.navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        lock.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () { /* denied or unsupported */ });
    } catch (err) { /* ignore */ }
  }

  function releaseWakeLock() {
    try { if (wakeLock) wakeLock.release(); } catch (err) { /* ignore */ }
    wakeLock = null;
  }

  /** A wake lock is dropped whenever the page hides; take it back on return. */
  function onVisibility() {
    if (!running) return;
    if (root.document.visibilityState === 'visible') {
      requestWakeLock();
      startAudio();
    }
  }

  function status() {
    return {
      running: running,
      audioPlaying: !!(audio && !audio.paused),
      wakeLock: !!wakeLock,
      wakeLockSupported: !!(root.navigator && root.navigator.wakeLock)
    };
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.keepAlive = { start: start, stop: stop, isRunning: isRunning, status: status };
})(typeof globalThis !== 'undefined' ? globalThis : this);
