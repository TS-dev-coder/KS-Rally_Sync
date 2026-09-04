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

### Which build am I looking at?

The release number sits next to the title in the header, and **More → Version** shows when
the copy you are running was published — the `Last-Modified` of `index.html`, which on both
GitHub Pages and Cloudflare Pages is the moment that deploy went out.

**Check for updates** re-fetches that file past every cache and compares. If a newer deploy
is live it says so and offers a reload that bypasses the browser cache. A minute of slack is
allowed, since a deploy touches its files a few seconds apart.

### Cutting a release

Bump `VERSION` in `js/version.js`, then:

```
npm run stamp
```

That rewrites every `<script src>` and `<link href>` in `index.html` to `?v=<VERSION>`, and
it is not cosmetic. A host caches each file on its own, so without it a browser can hold a
fresh `calculate.js` beside a stale `dom.js` and the app dies on something like
`d.km is not a function` — code that is correct in every file, broken only in combination.
Stamping moves all the URLs at once, so a browser can never mix two releases.

`npm test` fails if the stamp is stale, so a forgotten bump cannot ship. The published
timestamp needs no maintenance.

### Deploying to Cloudflare Pages (recommended)

Connect this repository once and every push to `main` is live in roughly 10–30 seconds,
with the CDN purged as part of the deploy — no cache window to wait out.

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick
this repository, then:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `/` |
| Root directory | `/` |

There is no build step — Cloudflare just serves the repository as it stands.

The `_headers` file makes every response revalidate rather than sit in a cache. That sounds
expensive and is not: the browser sends its ETag and gets a ~200 byte `304 Not Modified`
back unless the file genuinely changed. Because nothing here is content-hashed, a filename
can never prove it is current, and caching hard would risk serving new HTML alongside old
JavaScript.

### Deploying to GitHub Pages

Pushing to `main` is all that is needed; the empty `.nojekyll` file tells Pages to serve the
files as they are rather than running Jekyll over them first.

A deploy is usually live in a minute or two, but can take closer to ten when the build queue
is busy — and every file is then cached for a further `max-age=600`. If a change has not
appeared, check which of the two is responsible before reaching for a hard reload:

```
curl -sI https://<user>.github.io/<repo>/css/styles.css | grep -i last-modified
```

Older than your push means the build has not deployed yet and refreshing cannot help.
Newer than your push means the build is out and it really is your browser cache.
The repo's Actions tab shows the same thing: the `pages build and deployment` job going
green is the moment it is genuinely live.

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

Distances are shown in **km**, the same unit and the same number the game itself displays when
you pan the map — one map tile is one kilometre — so the two can be compared without
converting anything.

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
- **17 languages** — every language Kingshot itself ships in, switched from a globe in the
  nav on any screen. Text, spoken callouts and the in-app guide all follow instantly, including
  the labels drawn inside the walkthrough figures. Arabic flips the whole document to RTL.
  The switcher is in the nav rather than buried in settings on purpose: the person who most
  needs it is the one who cannot read their way to a settings page.
- **Illustrated walkthrough** — More opens a seven-step guide to reading a march time out
  of Kingshot without deploying, each step drawn with the button to tap ringed and Deploy
  crossed out.

## Languages

Seventeen: the exact set Kingshot lists on the App Store. English lives in `js/i18n.js`;
each other language is one self-contained file under `js/locale/`, registered at load and
merged over English, so a missing key falls back rather than rendering blank.

```
node tools/i18n-report.js            coverage for every language
node tools/i18n-report.js de         the keys German is missing
node tools/i18n-report.js de --json  the same, as a translator's worklist
node tools/i18n-report.js --audit    placeholder mismatches and English leftovers
node tools/i18n-report.js --stale <ref>  English strings reworded since a git ref
```

`--stale` covers the one failure nothing else can. Reword an English value and every
locale still *has* that key: coverage reads 100%, the audit is clean, and sixteen files
quietly describe the old sentence. It happened to `guide.bulkPaste.step2` within an hour of
that key existing, and was caught only because a reviewer re-read the English rather than
trusting the brief. Git is already the provenance store, so run it after editing English
and re-send whatever it lists.

### Finding the game's own word

The hardest part of this was not translating — it was discovering that a correct translation
can still be the wrong word. Russian «Сбор» for *rally* is this client's word for resource
*gathering*; German "Sammlung" is a dictionary translation where Kingshot uses the loanword
"Rally"; Turkish players look for **İntikal Hızı**, not the dictionary's *Yürüyüş Hızı*.

Two sources settle these, in this order:

1. **The App Store release notes, read against the English ones.** Century Games publishes the
   same notes per storefront, so one sentence — the rally-target list — gives an exact 1:1 of
   every structure name this app targets. `apps.apple.com/<cc>/app/kingshot/id6739554056`.
2. **The Help Center**, same article ID per language: `centurygames.helpshift.com/hc/<lang>/140-kingshot/`.

When they disagree, prefer the one whose context matches the string's job. Our target picker
mirrors an in-game enumeration, so the release notes' list beats an article's prose — that is
how `Sede` beat `Cuartel`, `Torre` beat `Torreta`, and 砲台 beat 砲塔.

Neither source documents the Bonus Overview menu in any language. Some things need a client.

Two rules the tests enforce, both learned the hard way:

**A key holds a whole sentence, never a fragment.** `T.t('cal.fittedTo') + n + ' samples'`
translates the prefix and leaves the tail in English, and no amount of translation fixes a
language that puts the number first. Use one key with a `{placeholder}` the translator can
move. Seventeen sites shipped broken this way before a test started rejecting the shape.

**Every rendered string goes through the dictionary.** `js/focus.js` and `js/timepicker.js`
— the full-screen countdown and the time picker — were fully English long after the rest
was translated, because the original extraction only walked `js/views/`. Worse, `focus.js`
built its spoken callouts inline even though `speech.rallyIn` and `speech.goNow` were
translated in all sixteen locales, so every non-English player heard English. The tests now
scan every module and every `speak()` call site.

`tests/i18n-sweep.test.js` renders all five tabs in all seventeen languages and fails on a
leaked `{placeholder}`, a raw key name, or a `NaN` reaching the screen. It found a real one:
the Tune tab had been printing `NaN s/tile · NaNs` for every zone, in every language
including English, because the code knew only two older model shapes.

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

The developer publishes no march-time formula. Each zone here is fitted from real marches on
that kind of target. Five of them so far, and they show something the community sources
never mention: the target type sets a fixed **overhead**, not a speed. An alliance HQ march
carries about four minutes of it, an open-map march about three seconds, while the per-tile
rate is nearly the same for both. Castle and Ruins have never been measured at
all. Where a march falls far outside what its zone was measured over, the app says so rather
than presenting a confident number. The community models that exist disagree by
roughly **2× on seconds per tile** with each other — and measured against real marches, both
are too slow, by 2× and 4× respectively. The open-map rate now shipped is fitted from actual
marches recorded in play, which agreed within half a percent. The Castle and Ruins rates are
still only inferred. See [RESEARCH-NOTES.md](RESEARCH-NOTES.md) for the measurements, the
sourcing and what remains untested.

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

`tests/i18n-sweep.test.js` boots once and switches language in place, rendering all five
tabs in all seventeen languages. It asserts on what a player would actually see — no leaked
`{placeholder}`, no raw key name on a button, no `NaN` — rather than on dictionary
bookkeeping, which is how it caught a Tune tab that had been printing `NaN` in English for
as long as the piecewise model had existed.

It also guards the two places where a translation can be correct and still break the layout:
the walkthrough figures, where SVG text neither wraps nor clips, so a long caption runs
across the button beside it; and the shareable plan block, a monospace table whose column
budgets it reads straight from the call site.

The last of these is the one worth knowing about. **Every late bug in the translation work
lived in a seam, not in a string** — a value that was perfectly good on its own and wrong
once composed with its neighbours. A Polish `{badge}` that stacked two adjectives, a Thai
`{buffer}` that repeated the frame's own verb, a Russian clause carrying the same semicolon
used to join it, an ASCII comma between two Japanese sentences. So the sweep composes those
frames with arguments they can really receive and checks the joins: doubled punctuation,
leaked placeholders, Latin marks inside non-Latin prose.

`tests/measurements.test.js` re-derives every distance in `MEASUREMENTS.md` from the raw
coordinates, so a mistyped reading fails the suite rather than quietly bending the next fit.

## Not in scope

No game connection, scraping, or automation. No accounts or server. No claim of official
accuracy — this is a community-calibrated estimation tool, and it says so in the UI.
