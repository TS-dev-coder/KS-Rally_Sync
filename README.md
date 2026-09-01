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

1. **Leads** — add each player who opens rallies: name, city X/Y, March Speed Up %.
2. **Targets** — fill in your kingdom's Castle and turret coordinates once.
3. **Calculate** — pick a target, pick who is marching, set the landing time. Launch times
   appear immediately, sorted by who has to act first, with a live countdown each.
4. **Copy for Discord** — pastes a monospaced table into chat.

Every screen with a game value on it has a collapsible **"Where do I find this?"** panel
with the in-game steps.

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

```
landing time
  − march time          (measured, or from the zone formula)
  = departure time
  − rally window        (Castle rallies march at exactly 5:00, filled or not)
  = when to TAP the rally button
```

All internal math is UTC epoch milliseconds at full precision; rounding happens only at the
display step. Times show in UTC (what the game runs on) and in your browser's local zone.
If your device clock drifts, correct it under **More → Clock correction** — a phone two
seconds off silently ruins every result.

## Layout

```
index.html               markup and script order
css/styles.css           the whole design system
js/dom.js                DOM and time-formatting helpers
js/zones.js              zone definitions and default constants
js/calculations.js       pure march-time and launch-time math
js/storage.js            localStorage with a memory fallback
js/state.js              app state and persistence
js/guide.js              in-game "where to find this" instructions
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
