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
  var fired = {};       // key -> true, so each warning sounds once per plan
  var scheduled = [];   // oscillators booked on the audio clock, so they can be cancelled

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

      // Booked on the audio clock, which keeps running when JS is throttled.
      scheduled.push(osc);
      osc.onended = function () {
        var at = scheduled.indexOf(osc);
        if (at !== -1) scheduled.splice(at, 1);
      };
    } catch (err) { /* audio is a nicety, never fatal */ }
  }

  /** Silences anything already booked, for when the plan changes underneath it. */
  function cancelScheduled() {
    scheduled.splice(0).forEach(function (osc) {
      try { osc.onended = null; osc.stop(); osc.disconnect(); } catch (err) { /* already done */ }
    });
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

  // Each phrase takes an offset so it can be booked ahead on the audio clock.

  /** Heads-up, well before the launch. Two clear pips. */
  function warnAt(at) {
    tone(1200, 0.14, 0.55, at);
    tone(1200, 0.14, 0.55, at + 0.22);
  }

  /** One tick per second through the final countdown. */
  function pipAt(at) { tone(1000, 0.11, 0.5, at); }

  /** The launch moment. Deliberately longer and louder than anything else. */
  function goAt(at) {
    tone(1400, 0.18, 0.85, at);
    tone(1400, 0.18, 0.85, at + 0.22);
    tone(1900, 0.55, 0.9, at + 0.44);
  }

  function warn() { warnAt(0); vibrate([160, 90, 160]); }
  function pip() { pipAt(0); vibrate(90); }
  function go() { goAt(0); vibrate([250, 100, 250, 100, 600]); }

  /**
   * Books a phrase once, `delaySeconds` from now, on the audio clock.
   *
   * This is what makes the alarm survive a backgrounded tab: Chrome throttles
   * setInterval to once a minute after a few minutes hidden, but the audio
   * thread is never throttled, so a tone booked in advance still fires on time.
   * Vibration cannot be booked ahead and is skipped for scheduled phrases.
   */
  function scheduleOnce(key, kind, delaySeconds) {
    if (fired[key]) return false;
    if (!(delaySeconds >= 0)) return false;
    fired[key] = true;
    if (kind === 'go') goAt(delaySeconds);
    else if (kind === 'pip') pipAt(delaySeconds);
    else warnAt(delaySeconds);
    return true;
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
  /**
   * The installed voice that best matches a language tag. An exact match wins;
   * otherwise any voice sharing the base language will do, since a Brazilian
   * voice reading European Portuguese is still Portuguese, whereas the default
   * English voice reading it is not.
   */
  function voiceFor(tag) {
    if (!tag) return null;
    var voices;
    try { voices = root.speechSynthesis.getVoices() || []; } catch (err) { return null; }
    if (!voices.length) return null;
    var wanted = String(tag).toLowerCase();
    var base = wanted.split('-')[0];
    var loose = null;
    for (var i = 0; i < voices.length; i++) {
      var have = String(voices[i].lang || '').toLowerCase().replace('_', '-');
      if (have === wanted) return voices[i];
      if (!loose && have.split('-')[0] === base) loose = voices[i];
    }
    return loose;
  }

  function speak(text) {
    if (!speechOn || !speechSupported()) return false;
    try {
      var utterance = new root.SpeechSynthesisUtterance(String(text));
      utterance.rate = 1.05;      // a touch quick, this is a callout
      utterance.volume = Math.max(0.3, volume);

      // Say it in the language it was written in. Without this the engine uses
      // the page default and reads every locale with an English accent, which
      // is worse than useless for a callout you have to react to in seconds.
      var i18n = root.RallySync && root.RallySync.i18n;
      if (i18n) {
        var tag = i18n.speechTag();
        utterance.lang = tag;
        var voice = voiceFor(tag);
        if (voice) utterance.voice = voice;
      }

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

  function reset() { fired = {}; cancelScheduled(); cancelSpeech(); }

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
    voiceFor: voiceFor,
    sayOnce: sayOnce,
    cancelSpeech: cancelSpeech,
    fireOnce: fireOnce,
    scheduleOnce: scheduleOnce,
    cancelScheduled: cancelScheduled,
    scheduledCount: function () { return scheduled.length; },
    reset: reset
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
