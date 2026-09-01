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

  var volume = 0.8;          // 0..1, user adjustable
  var master = null;         // gain + limiter, built lazily on the context

  function setVolume(value) {
    var v = Number(value);
    volume = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
    if (master) master.gain.gain.value = volume;
  }

  function getVolume() { return volume; }

  /**
   * One shared output chain. The compressor stops stacked tones from clipping
   * into a harsh crackle when several fire at once.
   */
  function output() {
    if (master && master.ctx === ctx) return master;
    if (!ctx) return null;
    var gain = ctx.createGain();
    gain.gain.value = volume;
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-8, ctx.currentTime);
    limiter.ratio.setValueAtTime(12, ctx.currentTime);
    gain.connect(limiter);
    limiter.connect(ctx.destination);
    master = { ctx: ctx, gain: gain, limiter: limiter };
    return master;
  }

  /**
   * One tone. `at` is an offset in seconds from now, so a phrase can be
   * scheduled in one go rather than through chained timeouts.
   */
  function tone(frequency, seconds, level, at) {
    var out = output();
    if (!out) return;
    try {
      var start = ctx.currentTime + (at || 0);
      var osc = ctx.createOscillator();
      var env = ctx.createGain();

      // Square cuts through background noise better than a sine at the same level.
      osc.type = 'square';
      osc.frequency.setValueAtTime(frequency, start);

      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), start + 0.008);
      env.gain.setValueAtTime(Math.max(0.0002, level), start + seconds * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

      osc.connect(env);
      env.connect(out.gain);
      osc.start(start);
      osc.stop(start + seconds + 0.03);
    } catch (err) { /* audio is a nicety, never fatal */ }
  }

  /** Kept for callers that just want a short confirmation blip. */
  function beep(frequency, seconds, level) {
    tone(frequency, seconds || 0.12, level === undefined ? 0.5 : level, 0);
  }

  function vibrate(pattern) {
    try {
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(pattern);
    } catch (err) { /* ignore */ }
  }

  /** Heads-up, well before the launch. Two clear pips. */
  function warn() {
    tone(1200, 0.14, 0.55, 0);
    tone(1200, 0.14, 0.55, 0.22);
    vibrate([160, 90, 160]);
  }

  /** One tick per second through the final countdown. */
  function pip() {
    tone(1000, 0.11, 0.5, 0);
    vibrate(90);
  }

  /** The launch moment. Deliberately longer and louder than anything else. */
  function go() {
    tone(1400, 0.18, 0.85, 0);
    tone(1400, 0.18, 0.85, 0.22);
    tone(1900, 0.55, 0.9, 0.44);
    vibrate([250, 100, 250, 100, 600]);
  }

  // ------------------------------------------------------------------ speech

  var speechOn = true;

  function setSpeech(on) {
    speechOn = on !== false;
    if (!speechOn) cancelSpeech();
  }

  function speechSupported() {
    return !!(root.speechSynthesis && root.SpeechSynthesisUtterance);
  }

  /**
   * Speaks a callout using the operating system's own voices, so nothing is
   * downloaded and it still works offline. Deliberately fire-and-forget: a
   * browser with no voices installed simply stays quiet.
   */
  function speak(text) {
    if (!speechOn || !speechSupported()) return false;
    try {
      var utterance = new root.SpeechSynthesisUtterance(String(text));
      utterance.rate = 1.05;      // a touch quick, this is a callout
      utterance.volume = Math.max(0.3, volume);
      root.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      return false;
    }
  }

  function cancelSpeech() {
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (err) { /* ignore */ }
  }

  /** Speaks once per key, sharing the dedupe map with the tones. */
  function sayOnce(key, text) {
    if (fired[key]) return false;
    fired[key] = true;
    return speak(text);
  }

  /**
   * Fires each alarm once. `key` identifies the row so a re-render or a tick
   * cannot double-sound it; `resetKeys` clears them when the plan changes.
   */
  function fireOnce(key, kind) {
    if (fired[key]) return false;
    fired[key] = true;
    if (kind === 'go') go();
    else if (kind === 'pip') pip();
    else warn();
    return true;
  }

  function reset() { fired = {}; cancelSpeech(); }

  root.RallySync = root.RallySync || {};
  root.RallySync.alarm = {
    supported: supported,
    prime: prime,
    isPrimed: isPrimed,
    beep: beep,
    tone: tone,
    vibrate: vibrate,
    warn: warn,
    pip: pip,
    go: go,
    setVolume: setVolume,
    getVolume: getVolume,
    speechSupported: speechSupported,
    setSpeech: setSpeech,
    speak: speak,
    sayOnce: sayOnce,
    cancelSpeech: cancelSpeech,
    fireOnce: fireOnce,
    reset: reset
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
