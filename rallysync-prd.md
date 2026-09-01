# RallySync — Kingshot Rally Timing Calculator
## Product Requirements & Development Context Document (for Claude Code)

**Read this entire document before writing any code.** Section 3 (Research Phase) is
mandatory and must be completed — with findings written to `RESEARCH-NOTES.md` — before
any implementation begins. This project's entire value proposition is *accuracy*, and
accuracy is only possible if the underlying game mechanics are verified from multiple
sources rather than assumed.

---

## 1. Project Summary

Build **RallySync**: a static, client-side web app (plain HTML/CSS/JS, no backend, no
build step required) for the mobile game **Kingshot**. It helps alliance rally leads
coordinate multiple troop rallies against a King's Castle or Turret so that marches land
either simultaneously or in a precisely staggered sequence, with zero timing gaps.

The core workflow: each rally lead has a city location (coordinates) and a personal
March Speed stat. Given a target (Castle / Turret / other structure) and a desired
landing time, the app calculates the exact UTC launch time for each rally lead so their
march arrives on schedule — accounting for the fact that march speed is **not uniform**:
it varies per player (gear/research/hero bonuses) and per zone (some areas near the
Castle slow marches passing through them).

This replaces manual mental math and "what time do I go?" chat scrambling during
live 6-hour Castle Battle / KvK events, where a 3-5 second gap between rallies can let
the enemy garrison recover and ruin the whole play.

---

## 2. Background Context (Kingshot Domain Knowledge)

Give the agent enough game context to make sound design decisions:

- **Kingshot** is a mobile kingdom-building/strategy game (Century Games). Alliances
  fight over a **King's Castle** in recurring **Castle Battle** events and in the larger
  monthly **Kingdom of Power (KvK)** event.
- Winning requires occupying the Castle. Because a single rally often isn't strong
  enough to take a heavily-garrisoned Castle, alliances coordinate **multiple rallies
  from different players** to land at the exact same second (or a tightly staggered
  sequence), overwhelming the defender before they can reinforce.
- **Turrets** surround the Castle and can be individually contested; controlling them
  gives bonuses and (if held by the same kingdom as the Castle occupier) stop damaging
  the Castle.
- **March speed is not the same for every player.** Each account has a personal "March
  Speed Up" percentage from research, gear, and hero bonuses, viewable in-game under
  **Avatar/Power → Bonus Overview → Military section**.
- **The battle zone itself is not uniform.** There is a **Relic** near/inside the King's
  Castle area that significantly slows any march passing near it. There is also a
  separate **Ruins Zone**, a chokepoint area with its own march speed penalty. Routes
  that pass through these areas take longer than flat distance/speed math would predict.
  This means march time calculation needs **different formulas per zone type**, not one
  universal formula.
- There is no officially published formula for march time from the developer. Community
  tools have reverse-engineered approximations. One known example (found via research
  during this project's own scoping) uses, for the "normal" (non-relic) zone:
  `time = round(distance / speed + 3.2)` — with a separate, empirically-fitted "ceiling
  model" used for relic-affected ("red zone") paths, because that penalty is not linear.
  **Treat this as a starting hypothesis to verify/refine, not as ground truth** — see
  Section 3.

---

## 3. MANDATORY Research Phase (complete before writing any code)

Before implementing anything, do the following and write your findings to a
`RESEARCH-NOTES.md` file in the project root:

1. **Search the web** for current, verified information on:
   - "Kingshot march speed formula"
   - "Kingshot march time calculator"
   - "Kingshot King's Castle Relic slow march"
   - "Kingshot Ruins Zone march speed penalty"
   - "Kingshot troop base march speed infantry cavalry archer"
   - "Kingshot March Speed Up stat Bonus Overview"
   - Any Kingshot wiki, official help center, or community math/spreadsheet tool that
     documents march time mechanics.
2. **Cross-check every formula or constant across at least 2-3 independent sources**
   before trusting it. Community numbers can be wrong, outdated, or specific to old game
   versions — note disagreements explicitly rather than silently picking one.
3. **Identify, for each zone type**, whether the speed penalty is:
   - A flat percentage reduction,
   - A fixed added time regardless of distance,
   - Or something more complex (e.g., the "ceiling model" mentioned above).
   If sources disagree or the exact model can't be pinned down with confidence, **say so
   explicitly in RESEARCH-NOTES.md** rather than guessing a formula and presenting it as
   fact.
4. **Determine base march speed values per troop type** (infantry/cavalry/archer), if
   they differ, since the "March Speed Up %" stat is a bonus on top of a base value.
5. **Document your sources** (URLs) next to every formula/constant you plan to use, so
   the human can verify them independently.
6. **Flag anything you cannot verify with confidence** as an assumption that needs
   in-app calibration (see Section 11) rather than a hardcoded "true" value.

Do not proceed to implementation until this file exists and has been reviewed.

---

## 4. Goals

- Calculate accurate individual launch times (in UTC) for any number of rally leads so
  their marches land at a specified time, or in a staggered sequence a set number of
  seconds apart.
- Support multiple **zone types** with different, independently-tunable speed models:
  General/open map, Castle (relic-affected), Turret(s), Ruins/chokepoint.
- Let the app be corrected/calibrated against real observed in-game march times, since
  no formula here is officially guaranteed accurate (see Section 11).
- Be fast to use live, mid-battle, on a phone: minimal taps from "who's marching" to
  "here are everyone's launch times."
- Persist rally lead profiles and target coordinates locally so they don't need to be
  re-entered every event.
- Produce an easy copy/paste output (e.g., for Discord) listing each person's name and
  launch time.

## 5. Non-Goals

- No user accounts, login, or server/backend — everything runs client-side.
- No live connection to the actual game (no scraping/automation of the Kingshot app).
- No claim of official/perfect accuracy — this is a community-calibrated estimation
  tool, and the UI must say so (see Section 14).

---

## 6. Primary Use Case Flow

1. Before the event: user adds/edits rally lead profiles (name, X/Y coordinates, March
   Speed Up %, troop type) and target locations (Castle, Turret N/S/E/W, etc.) with
   their coordinates and zone type. This is a one-time setup, reused across events.
2. When it's time to coordinate a hit: user selects a target, selects which rally leads
   are participating, and either:
   - **Sync mode**: enters a single desired landing time → app outputs each person's
     individual launch time (all landing together), or
   - **Sequence mode**: enters a landing time and a stagger gap in seconds (e.g., 5s) →
     app outputs launch times so rallies land in a defined order, gapless.
3. App displays a per-person result list (name → launch time, in UTC and the viewer's
   local time), plus a "copy for Discord" button that formats it as shareable text.
4. A live synced clock (UTC) is visible on the calculation screen so users can watch the
   countdown to their own launch time in real time.

---

## 7. Zone Types (data model)

Design zones as a configurable list, not hardcoded logic, so new zones or corrected
formulas can be added later without a rewrite. Minimum set to support at launch:

| Zone key | Description | Notes |
|---|---|---|
| `general` | Open kingdom map, no known obstruction | Baseline formula |
| `castle_relic` | Inside/near the King's Castle, path affected by the Relic | Distinct, likely non-linear penalty |
| `turret` | Path to a turret structure | May or may not overlap with relic zone depending on turret position — verify in research phase |
| `ruins` | Path passing through the Ruins Zone chokepoint | Distinct penalty, separate from the Relic |

Each zone should store its own formula type and constants, editable via the Calibration
screen (Section 11) — do not hardcode magic numbers directly in calculation functions.

---

## 8. Core Data Entities (client-side storage, e.g. localStorage)

```
RallyLead {
  id, name,
  x, y,                    // coordinates
  marchSpeedUpPercent,     // from in-game Bonus Overview
  troopType                // infantry | cavalry | archer (if base speeds differ)
}

Target {
  id, name,                // e.g. "Castle", "North Turret"
  x, y,
  zoneKey                  // references Zone Types table
}

ZoneFormula {
  zoneKey,
  formulaType,             // e.g. "linear", "ceiling-fit", "flat-penalty"
  constants: { ... }       // tunable values, editable in Calibration mode
}

CalibrationSample {
  zoneKey,
  distance, speedPercent, troopType,
  observedTimeSeconds,     // real in-game result the user recorded
  dateRecorded
}
```

---

## 9. Functional Requirements

### MVP (must-have)
- [ ] Add/edit/delete Rally Lead profiles, persisted locally.
- [ ] Add/edit/delete Target locations with assigned zone type, persisted locally.
- [ ] Sync mode: one landing time → per-person launch times.
- [ ] Sequence/stagger mode: landing time + gap seconds → ordered per-person launch
      times.
- [ ] Zone-aware calculation (different formula per zone type, per Section 7).
- [ ] Results shown in both UTC and the viewer's local timezone.
- [ ] Copy-to-clipboard formatted output for sharing in Discord/chat.
- [ ] Mobile-first responsive layout — this will primarily be used on a phone during
      live events.
- [ ] Clear disclaimer that timings are community-estimated, with a recommended safety
      buffer (see Section 14).

### Nice-to-have (build after MVP is solid)
- [ ] Live synced UTC clock/countdown on the results screen.
- [ ] Calibration mode (Section 11) with an editable constants UI.
- [ ] Save/export multiple named event setups (e.g., "This week's KvK" vs. "Regular
      Castle Battle").
- [ ] Visual map-style input for coordinates (click to place) instead of typing X/Y.
- [ ] Per-zone route override — a rally lead can be manually flagged as "route crosses
      relic zone" even for a target where that's not the default, for edge cases.

---

## 10. Calculation Logic

Implement calculation as a pure function per zone type, e.g.:

```js
function calculateMarchTimeSeconds({ distance, speedPercent, zoneKey, troopType }) {
  const zone = getZoneFormula(zoneKey);
  // dispatch to the formula type verified in Section 3 research
  switch (zone.formulaType) {
    case 'linear':
      return linearModel(distance, speedPercent, zone.constants);
    case 'ceiling-fit':
      return ceilingFitModel(distance, speedPercent, zone.constants);
    // add more as research uncovers them
  }
}

function calculateLaunchTime(landingTimeUTC, marchTimeSeconds) {
  return new Date(landingTimeUTC.getTime() - marchTimeSeconds * 1000);
}
```

Keep all zone constants out of the function bodies and in the editable `ZoneFormula`
config (Section 8/11) — this is the single most important architectural decision in this
project, since formulas here are estimates that will likely need tuning after real
battle data comes in.

Distance should be calculated as straight-line: `sqrt((x2-x1)^2 + (y2-y1)^2)`, unless
research uncovers that the game uses a different distance metric (e.g., Chebyshev/grid
distance) — verify this too and note it in RESEARCH-NOTES.md.

---

## 11. Calibration Mode (critical for real accuracy)

Because no formula here is officially guaranteed, build a way to correct the model using
real observations:

- A simple form: "I marched from (x,y) to (x,y) through zone [X] with speed [Y]% and it
  actually took [Z] seconds."
- Store these as `CalibrationSample` records.
- Provide a way (even a basic manual-fit UI, or a "suggested adjustment" calculation) to
  nudge the relevant zone's constants toward matching observed samples.
- Show, per zone, how many calibration samples exist and how recently the formula was
  adjusted — so the user knows which zones are well-tested vs. still using unverified
  research-phase estimates.

This is what makes "100% accurate" achievable in practice: not a perfect formula on day
one, but a system that gets more accurate as real data comes in, with transparency about
current confidence.

---

## 12. UI/UX Requirements

- Mobile-first, thumb-friendly, usable one-handed during a live event.
- Minimal steps from opening the app to getting launch times for an already-set-up
  event — this is the core repeated action.
- High-contrast, readable-at-a-glance results (large time text, clear per-person list).
- Setup/profile management can be a secondary, less time-pressured screen.
- Use a simple tab or screen structure: **Setup** (leads/targets) → **Calculate**
  (choose target, mode, landing time) → **Results** (per-person launch times + copy
  button).
- No unnecessary animations or heavy assets — this needs to load fast on mobile data
  during an event window.

---

## 13. Technical Constraints

- Pure HTML/CSS/JS. No frameworks required; no build step; should run by opening
  `index.html` directly or via any static file host (GitHub Pages, Netlify, etc.).
- All data persistence via `localStorage` (this is a real standalone site, not a
  sandboxed artifact, so localStorage is appropriate here).
- All time math must be done in UTC internally (`Date` objects / `getTime()`), converting
  to local time only for display, to avoid timezone bugs.
- Round final displayed times sensibly but keep internal math in full precision until
  the final display step, to avoid compounding rounding errors across a chain of
  calculations.
- No external API calls needed — fully offline-capable once loaded.

---

## 14. Accuracy Strategy & Required Disclaimers

Be upfront in the UI (e.g., a small footer note or info icon) that:

- March time formulas are community-estimated, not officially published by the game
  developer.
- Users should treat results as a strong estimate and keep a 1-2 second safety buffer,
  using the in-game countdown as the final source of truth when timing is extremely
  tight.
- Accuracy improves as Calibration Mode (Section 11) collects real data — encourage
  users to log real results after events.

This honesty is a feature, not a weakness — it's what separates a trustworthy tool from
one that silently gives false confidence.

---

## 15. Edge Cases to Handle

- A rally lead's route crosses more than one special zone (e.g., Ruins then Relic) —
  decide and document how this is handled (sum penalties? use the worse one? flag for
  manual review?). Note the decision in RESEARCH-NOTES.md if the game mechanics aren't
  clear on this.
- Landing time requested is in the past relative to current time, or too soon for the
  slowest rally lead to make it — surface a clear warning, don't just show a negative
  launch time.
- Very large rosters (30+ rally leads) — results list should stay scannable (sort by
  launch time, not input order).
- Missing data (a rally lead with no speed % set) — block calculation for that person
  with a clear inline error rather than silently producing a wrong number.

---

## 16. Suggested File Structure

```
/index.html
/css/styles.css
/js/app.js              // UI wiring
/js/calculations.js      // pure calculation functions (Section 10)
/js/storage.js           // localStorage read/write helpers
/js/zones.js             // zone formula definitions (Section 7/8)
/RESEARCH-NOTES.md        // output of Section 3, keep in repo for future reference
```

---

## 17. Acceptance Criteria / Definition of Done

- [ ] RESEARCH-NOTES.md exists, cites sources, and flags unverified assumptions.
- [ ] All MVP features in Section 9 work end-to-end on a phone-sized screen.
- [ ] Zone formulas are stored as editable config, not hardcoded constants.
- [ ] Calibration mode exists and can adjust at least one zone's constants from a
      sample.
- [ ] Setup data persists across page reloads via localStorage.
- [ ] Sync mode and Sequence mode both produce correct, sorted, per-person launch times
      with no console errors.
- [ ] Accuracy disclaimer is visible in the UI.

---

## 18. Open Questions to Confirm With the User Before/During Build

- Exact list of target types to support at launch (just Castle + 4 Turrets? Others?).
- Whether troop type meaningfully changes base march speed in this game, or whether
  March Speed Up % alone (regardless of troop type) is sufficient — confirm in research
  phase and simplify the data model if troop type turns out not to matter.
- Preferred hosting method once built (static host recommendation can be given at
  handoff).
