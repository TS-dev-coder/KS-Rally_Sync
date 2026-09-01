# RallySync

Rally timing for **Kingshot** Castle Battle and KvK. Works out the exact moment each rally
lead must tap their rally button so every march lands on the same second — or in a
gapless staggered sequence.

Static, client-side, offline. No accounts, no backend, no build step.

---

## Run it

Open `index.html`. That is the whole install.

It also hosts anywhere static (GitHub Pages, Netlify, Cloudflare Pages) — just upload the
folder. On a phone, use **Add to Home Screen**: iOS wipes website storage after 7 days of
non-use, and installed web apps are exempt from that.

## Use it

1. **Leads** — add each player who opens rallies: name, city X/Y, March Speed Up %. Paste a
   whole roster at once instead of adding people one at a time.
2. **Targets** — nothing is preloaded; the list is exactly what you add. As many as you hit,
   of any type, with your own names, and searchable on the Calculate screen. Pick a type
   (Castle, Turret, Sanctuary, Fortress, Outpost, Ruins) and it seeds the zone model and
   rally window; both stay editable. Three Sanctuaries with your own names is normal.
3. **Calculate** — say when rallies open and pick who is going. The slowest lead taps at that
   moment, everyone else is staggered behind them, and the landing time falls out on its own.
4. **Share** — copy a table for Discord, or send each person a link that shows only their own
   countdown.

Every screen with a game value on it has a collapsible **"Where do I find this?"** panel with
the in-game steps.

## Features

- **One time to set** — "start rallies at". The landing time is derived from whoever is
  slowest, so a plan can never ask for something impossible.
- **Sync or Sequence** — land together, or stagger by a set gap (Sanctuary and Fortress
  pushes usually want 10–15s).
- **Multiple targets in one run** — part of the roster on the Castle, the rest on a turret.
- **Target types** — add any number of each, auto-named, filterable, each with its own
  coordinates, zone model and rally window.
- **Alliance and squad grouping** — tag leads, select a whole group in one tap, and group the
  results by alliance, squad or target with committed power per group.
- **Rally capacity and power** — optional, and never part of the timing math.
- **Event setups** — save a named target/roster/mode combination and reload it next event.
- **Alarm, on by default** — a heads-up tone, a tick every second through the last five, and
  a longer tone at the launch, with vibration on mobile. Plus a full-screen GO countdown.
  Arms itself on your first tap, because browsers refuse audio before that.
- **Spoken callouts** — "TS, rally in 30 seconds", then "TS, go now", at 60 / 30 / 10 seconds
  and the moment itself. Uses your device's own voice, so it needs no assets and works
  offline. Toggle and volume under More.
- **Per-person share links** — the whole plan rides in the URL fragment, so nothing is
  uploaded anywhere and the recipient needs no setup.
- **Drag to reorder** — sequence order by drag handle or arrow keys.
- **Light and dark** — follows your system by default.

## Running in the background

Browsers deliberately starve hidden tabs: Chrome throttles their timers to once a
minute after a few minutes, and Memory Saver may discard the tab outright. iOS Safari
suspends a backgrounded tab entirely. No web page can opt out of that.

So the alarm does not depend on a timer being awake at the right moment. Every tone
within the next two and a half minutes is **booked ahead on the Web Audio clock**, which
runs on the audio thread and is never throttled — a booked tone still sounds on time even
if JavaScript is frozen solid. Ticks simply top the booking up, and the horizon is well
over twice Chrome's worst background wakeup interval, so a missed wakeup cannot leave a
gap.

On top of that, while a launch is still pending the app holds the tab open with a silent
looping track (a tab playing media is not discarded and not intensively throttled) and
takes a screen Wake Lock so a phone on the desk does not sleep. Both stop the moment the
last launch has passed. Turn it off under **More → Keep running in the background** if you
would rather have the battery.

Two honest limits: spoken callouts cannot be booked ahead, so they may be missed while the
tab is hidden; and nothing here survives the operating system killing the browser.

## Accuracy

The developer publishes no march-time formula. The community models that exist disagree by
roughly **2× on seconds per tile**, and the "ceiling model" some sites cite for the red zone
is never actually defined anywhere — so RallySync does not pretend to implement it. See
[RESEARCH-NOTES.md](RESEARCH-NOTES.md) for the full sourcing, the disagreements, and the
open questions.

Instead of guessing, the app ranks its own confidence per lead:

| Badge | Meaning |
|---|---|
| **measured** | A real march you logged for this exact lead and target. Exact. No formula involved. |
| **calibrated** | Zone constants least-squares fitted to your own recorded samples. |
| **estimated** | Unverified community defaults. Keep a safety buffer. |

Kingshot only shows a march's true duration *after* the rally departs — so read it off and
log it under **Tune → Log a real march**. That pair becomes exact from then on, and the
sample also refits the zone, improving estimates for leads who have not measured yet.

Zone constants are editable config, never baked into the calculation functions. Any zone can
be hand-tuned or reset to its research default.

## Timing chain

You set one thing: when rallies open. Everything else is derived.

```
start                                    ← the only input
  + the slowest lead's rally window
  + the slowest lead's march time
  = landing time            everyone lands here

then per person, backwards from the landing:
  landing
    − their march time      (measured, or from the zone formula)
    = departure time
    − the target's rally window   (Castle rallies march at 5:00, filled or not)
    = when they tap the rally button
```

The slowest lead taps at the start moment; faster leads wait. Add a slower player and the
whole plan shifts later by itself.

All internal math is UTC epoch milliseconds at full precision; rounding happens only at the
display step. Times show in UTC (what the game runs on) and in your browser's local zone.
If your device clock drifts, correct it under **More → Clock correction** — a phone two
seconds off silently ruins every result.

## Layout

```
index.html               markup and script order
css/styles.css           the whole design system
js/dom.js                DOM and time-formatting helpers
js/icons.js              inline SVG icon set
js/zones.js              zone definitions and default constants
js/calculations.js       pure march-time and launch-time math
js/roster-import.js      parses a pasted roster
js/share.js              encodes one person's slot into a link
js/alarm.js              WebAudio tones and vibration
js/storage.js            localStorage with a memory fallback
js/state.js              app state and persistence
js/guide.js              in-game "where to find this" instructions
js/focus.js              full-screen single-person countdown
js/dragorder.js          pointer-based drag reordering
js/views/*.js            one file per screen
js/app.js                bootstrap, tabs, one-second heartbeat
tests/                   node --test suite
RESEARCH-NOTES.md        sourcing, disagreements, open questions
```

The app itself has **zero dependencies**. Scripts are classic (not ES modules) specifically
so `index.html` works when opened straight off disk.

## Tests

```
npm install     # jsdom, for the UI tests only
npm test
```

`tests/calculations.test.js` and `tests/time.test.js` cover the math and time handling with
no dependencies. `tests/ui.test.js` boots the real `index.html` in jsdom and drives the
actual app; it skips cleanly if jsdom is not installed.

## Not in scope

No game connection, scraping, or automation. No accounts or server. No claim of official
accuracy — this is a community-calibrated estimation tool, and it says so in the UI.
