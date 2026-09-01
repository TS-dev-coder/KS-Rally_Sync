/**
 * alarm.js — audible and haptic warning before a launch time.
 *
 * Phones lock and screens sleep mid-event, so a purely visual countdown gets
 * missed. Tones are synthesised with WebAudio rather than shipped as audio
 * files, which keeps the app to zero assets and works offline.
 *
 * Browsers block audio until the user has interacted with the page, so
 * `prime()` must be called from a real click before any beep will sound.
 */
;(function (root) {
  'use strict';

  var ctx = null;
  var primed = false;
  var fired = {};   // key -> true, so each warning sounds once per plan

  function supported() {
    return !!(root.AudioContext || root.webkitAudioContext);
  }

  /** Call from a user gesture. Creates and unlocks the audio context. */
  function prime() {
    if (!supported()) return false;
    try {
      if (!ctx) ctx = new (root.AudioContext || root.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      primed = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  function isPrimed() { return primed && !!ctx && ctx.state === 'running'; }

  /** One short tone. */
  function beep(frequency, seconds, volume) {
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(frequency, now);

      // Envelope, otherwise square waves click audibly on start and stop.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume === undefined ? 0.16 : volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch (err) { /* audio is a nicety, never fatal */ }
  }

  function vibrate(pattern) {
    try {
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(pattern);
    } catch (err) { /* ignore */ }
  }

  /** Warning pips as the launch approaches. */
  function warn() {
    beep(880, 0.09);
    vibrate(120);
  }

  /** The launch moment itself — deliberately more urgent than a warning. */
  function go() {
    beep(1320, 0.16, 0.22);
    root.setTimeout(function () { beep(1320, 0.16, 0.22); }, 190);
    root.setTimeout(function () { beep(1760, 0.3, 0.24); }, 380);
    vibrate([200, 90, 200, 90, 400]);
  }

  /**
   * Fires each alarm once. `key` identifies the row so a re-render or a tick
   * cannot double-sound it; `resetKeys` clears them when the plan changes.
   */
  function fireOnce(key, kind) {
    if (fired[key]) return false;
    fired[key] = true;
    if (kind === 'go') go(); else warn();
    return true;
  }

  function reset() { fired = {}; }

  root.RallySync = root.RallySync || {};
  root.RallySync.alarm = {
    supported: supported,
    prime: prime,
    isPrimed: isPrimed,
    beep: beep,
    vibrate: vibrate,
    warn: warn,
    go: go,
    fireOnce: fireOnce,
    reset: reset
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
