# RESEARCH-NOTES.md

Output of the mandatory research phase (PRD Section 3). Completed **2026-09-01**.

**Bottom line up front:** there is no officially published march-time formula for Kingshot,
and the community sources that do publish one **disagree by a factor of ~2 on the single
most important constant**. Nothing in this document should be treated as ground truth.
RallySync is therefore built so that *measured* march times always beat *calculated* ones,
and every calculated number carries a visible confidence badge.

---

## 1. Source quality warning (read this first)

Every source found is an unattributed community/SEO site. None cite a primary source, none
show their fitting data, and several appear to echo each other's wording nearly verbatim —
which means "three sources agree" may really be one source repeated three times. Century
Games (the developer) publishes no march formula in the in-game help or Help Center.

Treat the constants below as **starting hypotheses for calibration**, not facts.

---

## 2. What multiple sources agree on

| Claim | Confidence | Sources |
|---|---|---|
| Distance is **straight-line Euclidean** in tiles: `sqrt((x2-x1)^2 + (y2-y1)^2)` | Medium-high — two independent tools state it; no source proposes Chebyshev/Manhattan | kingshotguide.org, KingshotPro Map Planner |
| March time scales **inversely with `1 + MarchSpeedUp%`** | Medium-high | Both of the above, plus KingshotPro Rally Planner |
| A **Relic inside the Forbidden Zone** near the King's Castle significantly slows any march passing near it | Medium — described qualitatively, never quantified | kingshotmastery.com Castle Battle guide, kingshotguide.org |
| The **Ruins** are a separate chokepoint with a heavy march-speed penalty | Medium — qualitative only | wizardstower.com Ruins guide |
| Standard alliance practice: slowest march launches first, everyone else offsets to match | High — this is just arithmetic, and it is what every rally timer does | Multiple rally timers |

---

## 3. What sources DISAGREE on — unresolved

### 3.1 Baseline seconds-per-tile (the critical constant)

Two mutually incompatible models are published.

**Model A — "coefficient" model.** The kingshotguide.org March Sync Timer states the
normal-zone formula as `round(distance / speed + 3.2)` with a normal-zone coefficient of
**0.360** and a forbidden/red-zone coefficient of **0.185**. Reading
`speed = coefficient x (1 + MarchSpeedUp%)` tiles/second, this implies:

- normal zone: `1 / 0.360` = **2.778 s/tile** at 100% speed, plus a **+3.2 s** fixed offset
- red zone: `1 / 0.185` = **5.405 s/tile** at 100% speed (~1.95x slower than normal)

**Model B — "6 seconds per tile" model.** The KingshotPro Map Planner states "roughly 6
seconds per tile at 100% march speed", divided by the speed multiplier, with **no fixed
offset** and no zone handling at all.

**These differ by ~2.16x on a long march.** Neither shows its data. This disagreement is not
resolvable from public sources — it can only be settled by measuring a real march.

> **Consequence for the app:** both models ship as selectable presets in Calibration, both
> badged UNVERIFIED, and the app pushes hard toward replacing them with measured data.

### 3.2 The "ceiling model" for the red zone — NOT IMPLEMENTABLE AS PUBLISHED

kingshotguide.org says the red zone "uses the community-fit ceiling model" but **never
defines it**. No page found anywhere states the equation, its parameters, or its fitting
data. The PRD (Section 2) quotes this same phrase, inherited from the same source.

**Decision:** RallySync does **not** implement a fake "ceiling model". Guessing an equation
and labelling it with a real-sounding name would be exactly the false confidence PRD
Section 14 warns against. Instead the red zone uses the same tunable affine form as every
other zone, with its own slower `secPerTile`, plus an optional geometric `segmented` model
(Section 5) that is physically motivated rather than invented.

### 3.3 Troop type

**No source found addresses whether troop type changes march speed.** Guides consistently
describe infantry as "slow" and cavalry as "fast", but that language is about *battlefield*
positioning in combat, not world-map march time. No calculator asks for troop type.

**Decision (confirmed with the user):** `troopType` is **dropped** from the data model
entirely. It is not stored, not displayed, and not in the calculation signature. If
calibration data ever shows a per-type split, it can be reintroduced as a multiplier.

### 3.4 Rally gather time

Not documented in any source found. **Resolved by the user from direct play:** a Castle
rally has a **fixed 5-minute (300 s) assembly window, and the march departs at the 5-minute
mark whether or not the rally filled.** This is treated as an exact constant, not an
estimate, and is configurable per target for non-castle cases.

### 3.5 Does the game show march time before you commit?

**Resolved by the user from direct play: no.** The march duration is only visible *after*
the rally assembly window ends and the march actually begins. This is the single most
important product finding in this document — see Section 4.

---

## 4. Accuracy strategy: measurement beats formula

Because a march's true duration becomes visible in-game once it departs, every real march is
a free, exact data point. RallySync exploits this with a three-tier priority chain,
evaluated per rally lead per target:

1. **MEASURED (exact).** A recorded real march time for this exact (lead, target) pair. Used
   verbatim; no formula involved. Same city, same target, same speed stat produces the same
   march time every event, so one observation makes that pair permanently exact.
2. **CALIBRATED (fitted).** No pair measurement, but the target's zone has >= 1 calibration
   sample. Zone constants are least-squares fitted to the samples and used.
3. **ESTIMATED (unverified).** Neither of the above. Research-phase defaults from Section
   3.1 are used and the result is badged UNVERIFIED.

Every result row shows which tier produced it. A lead whose march time is measured is exact;
the disclaimer and safety-buffer advice apply to tiers 2 and 3.

**Staleness:** a measurement is invalidated automatically whenever the lead's coordinates or
March Speed Up % change, or the target's coordinates change, since those inputs define it.

---

## 5. Zone model decisions

Zone constants live in editable config (`js/zones.js` defaults -> localStorage), never inline
in calculation functions, per PRD Section 10.

| Zone key | Default model | Default constants | Confidence |
|---|---|---|---|
| `general` | affine | 2.778 s/tile, +3.2 s | UNVERIFIED (Model A). Covers Outposts, Sanctuaries and Fortresses, which sit outside the Forbidden Zone — see 5.3 |
| `castle_relic` | affine | 5.405 s/tile, +3.2 s | UNVERIFIED (Model A red-zone coefficient) |
| `turret` | affine | 2.778 s/tile, +3.2 s | UNVERIFIED — assumed same as general; turrets sitting inside the Forbidden Zone may behave as `castle_relic`, unknown |
| `ruins` | affine | 5.405 s/tile, +3.2 s | **GUESS** — no source quantifies the Ruins penalty at all. Copied from the red-zone value purely as a placeholder. Calibrate before trusting. |

**Two formula types are implemented:**

- `affine`: `t = secPerTile * distance / (1 + speedPct/100) + offset`. Covers Model A, Model
  B (`secPerTile: 6, offset: 0`), flat-penalty zones (large `offset`), and pure linear
  (`offset: 0`).
- `segmented`: physically-motivated model for the route-dependent case. Computes the length
  of the straight line from origin to target that falls inside a circle of radius `r` centred
  on the Relic, charges that portion at `secPerTileInside` and the remainder at
  `secPerTileOutside`. Parameters (relic x/y, radius, both rates) are all tunable.

### 5.1 The zone belongs to the target — RESOLVED

Initially both readings were supported: a zone tag on the target, plus a per-lead
"my route crosses the Relic" override.

**Resolved by the user from direct play: the King's Castle is always inside the Forbidden
Zone, so the penalty is a property of the destination, not of who is marching.** The
per-lead override has been removed entirely — a rally lead is just their name, coordinates
and March Speed Up %. `resolveMarchSeconds` reads the zone from the target and nothing else.

This also removed a whole class of user error: there is no longer a checkbox that silently
changes one person's march model.

### 5.2 Multi-zone routes (PRD Section 15 edge case)

**Decision: use the worse (slowest) single zone, and flag the row for manual review.** Not
summed. Rationale: penalties are expressed as *rates* (s/tile), not additive time costs, so
summing two rates would double-charge the same tiles and is definitely wrong. Taking the
slower rate is the conservative choice — it errs toward launching early, which is
recoverable, rather than late, which is not. When the `segmented` model is enabled for a
zone it handles overlap correctly by construction and no flag is raised.

### 5.3 Outposts, Sanctuaries and Fortresses

These are ordinary world-map structures outside the Castle Forbidden Zone, so they carry no
Relic penalty and use the free-form `general` model. Sources: the Kingshot Help Center
sections for [Outposts & Sanctuaries](https://centurygames.helpshift.com/hc/en/140-kingshot/faq/7450-outposts-sanctuaries/)
and [Sanctuary Battle](https://centurygames.helpshift.com/hc/en/140-kingshot/section/1738-sanctuary-battle/).

Community guidance for Sanctuary and Fortress pushes recommends **staggering rallies 10–15
seconds apart** so the first rally weakens the garrison before the second lands — which is
exactly what Sequence mode produces. Capture requires holding the structure (Outposts 15–30
minutes by level; Sanctuaries 30 minutes), but hold duration is outside this tool's scope.

---

## 6. Clock accuracy and storage durability

The game runs on UTC; all internal math is UTC epoch milliseconds, with local time derived
for display only. A device clock a few seconds off silently corrupts every result, and the
app is offline-only by design (no NTP). A manual **clock offset** setting is provided
(Settings -> "my clock is N seconds fast/slow", set by eye against the in-game event timer)
and is applied to the live clock and all countdowns. Default 0.

**Storage durability:** iOS caps script-writable storage at 7 days of non-use and will wipe
it — this affects `localStorage` and IndexedDB identically, so the storage engine choice does
not mitigate it. Mitigations shipped instead: JSON **export/import backup**, and an
**Add to Home Screen** hint (installed web apps are exempt from the 7-day cap).

---

## 6a. FIELD MEASUREMENT — both published models are wrong

**2026-09-02.** First real march recorded in play, and it contradicts both community models
by a wide margin.

| | value |
|---|---|
| Lead | X:536 Y:740, March Speed Up +25% |
| Target | "Terror", X:508 Y:730, open map |
| Euclidean distance | 29.73 tiles |
| **Observed march time** | **34–35 s** |
| Model A prediction (2.778 s/tile, shipped default) | 69.3 s — **2.01x too slow** |
| Model B prediction (6 s/tile) | 142.7 s — 4.1x too slow |
| Rate implied by the observation (offset held at 3.2 s) | **~1.32 s/tile** |

The app's arithmetic was verified correct against this case; the error is entirely in the
constant. This is the outcome Section 1 warned about — every published source is an
unattributed SEO page, and it turns out none of them match reality.

**Not yet resolved by this single sample:**

- The fixed offset cannot be fitted from one point, so 3.2 s is still inherited from Model A
  and may be wrong or may not exist at all.
- The distance metric is unconfirmed. This march is 28 across and 10 down, so Euclidean
  (29.73), Chebyshev (28) and Manhattan (38) are not far enough apart to distinguish. Two
  marches of similar length but very different shape — one near-axis, one near-diagonal —
  would settle it.

### Second measurement, and the default changed

**2026-09-02.** A second march, at a different distance and a different kind of target.

| | march 1 | march 2 |
|---|---|---|
| Distance | 29.73 tiles | 34.18 tiles |
| Speed | +25% | +25% |
| Observed | 34-35 s | 39 s |
| Rate implied (offset held at 3.2 s) | **1.3159 s/tile** | **1.3094 s/tile** |
| Shipped default predicted | 69.3 s (2.01x slow) | 79.1 s (2.03x slow) |

The two agree **within half a percent**, at different distances, and the shipped model is
out by a consistent factor of two in both. That is no longer a single anecdote, so the
default has been changed: `general` and `turret` now ship at **1.31 s/tile with a +3.2 s
offset**, which reproduces both marches to within 0.1 s.

A joint fit of both points solves the offset as well and gives 1.266 s/tile with a 4.39 s
offset. It is not used: with only two points and a +/-0.5 s reading on the first, the offset
is poorly constrained, whereas holding the community's 3.2 s makes both samples agree with
each other. A third march at a clearly longer distance would settle it properly.

**The two community models are kept as selectable presets** rather than deleted, so the
disagreement stays visible in the app instead of being quietly rewritten away.

**Still inferred, not measured:** the Castle and Ruins rates. Those are the community's own
relative claim — the Forbidden Zone running 0.360/0.185 = 1.95x slower — applied to the new
measured base. Their ratio may survive even though their absolute scale did not, but nothing
tests it yet. Calibrate before trusting a Castle march.

### Third measurement, and a confound

**2026-09-02.** A long march, and crucially a different kind of target.

| | march 1 | march 2 | march 3 |
|---|---|---|---|
| Target | **Terror** | **player base** | **alliance HQ** |
| Distance | 29.73 | 34.18 | **404.27** tiles |
| Speed | +25% | +25% | +25% |
| Observed | 34-35 s | 39 s | **679 s** (11m 19s) |
| Effective speed | 0.862 | 0.876 | **0.595** tiles/sec |

The third march is 30% slower per tile. But it is also the *only* long march **and** the
only HQ, so **distance and target type are perfectly confounded**. Two quite different
models fit all three points to within a second:

- **A — time curves with distance.** `0.86137 * d^1.14826 / speedMultiplier`, exponent above
  one, fits all three within 0.8 s.
- **B — the relationship is linear, but an HQ is its own slower zone.** Open map at
  1.313 s/tile from marches 1 and 2, HQ at 2.090 s/tile from march 3. Also fits within 1 s.

**B is shipped**, for one reason that is not a matter of taste: the
[August 2026 patch notes](https://kingshotmastery.com/blog/kingshot-august-2026-update-patch-notes)
show the game *already* varies march speed by target type, having buffed Beast Hunting and
Rally Terrors. There is documented precedent for a per-target-type rate and none whatsoever
for a super-linear distance law. B also keeps a physically sane positive offset, where
pooling the data into one line forces the intercept to **-18.4 s** — a march under 8.5 tiles
finishing before it starts, which is the classic signature of mixing two populations.

The `power` formula type remains implemented and tested, so if the deciding march below
favours A the switch is a one-line change.

**The deciding measurement: a LONG march (300-400 tiles) to a player base or a Terror.**

| | predicts a 400-tile base march |
|---|---|
| A, distance curve | **11.2 min** |
| B, per-type rate (shipped) | **7.1 min** |

Four minutes apart — impossible to confuse. Until that march exists, open map is only ever
measured at about 30 tiles, and the app flags any march far outside what its zone was
actually measured over.

### Fourth measurement — the HQ rate replicates

**2026-09-02.** A second alliance HQ march, at almost the same range as the first.

| | HQ march 1 | HQ march 2 |
|---|---|---|
| Distance | 404.27 tiles | 409.70 tiles |
| Observed | 679 s | 684 s (11m 24s) |
| Implied rate | 2.0896 s/tile | 2.0773 s/tile |

**Agreement within 0.6%.** The HQ rate is now the best-replicated number in the model, and
is refined to **2.083 s/tile**. The shipped zone predicted 688 s against an actual 684 s.

It does **not** settle the distance-versus-type question. Both candidate models were fitted
through a ~404 tile point, so both predict ~688 s here and agree with each other. Two marches
five tiles apart cannot separate them.

It also leaves HQ measured only in a narrow band around 405 tiles. That turns out to be
useful, because it creates a **second** way to settle the question:

| deciding march | per-type model (shipped) | distance-curve model |
|---|---|---|
| ~400 tiles to a **base or Terror** | 434 s | 689 s |
| ~30 tiles to an **HQ** | 53 s | 34 s |

Either one is decisive, and a nearby allied HQ may be far easier to find than a 400-tile
friendly base.

### Fifth measurement — it was never a curve, it is a fixed overhead

**2026-09-02.** A third HQ march, at 678 tiles: far beyond the previous cluster near 405.

| HQ march | distance | observed | implied rate at offset 3.2 |
|---|---|---|---|
| 1 | 404.27 | 679 s | 2.0896 s/tile |
| 2 | 409.70 | 684 s | 2.0773 s/tile |
| 3 | **678.10** | **977 s** (16m 17s) | **1.7950 s/tile** |

**The per-tile rate falls as distance grows** — the exact opposite of the power curve, which
predicted **1228 s against an actual 977 s**. A rate that falls with distance is the
signature of a large constant being divided back out, not of a curve.

Fitting the three HQ marches as a straight line with a free offset:

```
1.3622 s/tile on a 238.0 s fixed overhead   —   fits all three within 0.45 s
```

**So an HQ march is not slower per tile. It carries a roughly four-minute fixed overhead.**
Measured only near 405 tiles that overhead is indistinguishable from a steeper rate, which is
exactly the trap the earlier readings fell into.

The revealing part is what the rate becomes once the overhead is accounted for:

| zone | per-tile rate | overhead |
|---|---|---|
| Open map | 1.313 | 3.2 s |
| Alliance HQ | **1.362** | **238.0 s** |

**Within 4% of each other.** The evidence now points to the per-tile rate being roughly
universal, with the target type setting an overhead rather than a speed. Open map cannot be
hiding a large overhead: a 29.7 tile march took 34.5 s, and a 238 s overhead would have made
that impossible.

**Both earlier models are now refuted.** Not "unconfirmed" — refuted:

- The **power curve** predicted 1228 s for this march. Wrong by 251 s. The apparent curvature
  came from pooling two target types with very different overheads.
- The **higher-rate reading of HQ** predicted 1133 s. Wrong by 156 s. It fitted only because
  every HQ sample sat in a narrow band near 405 tiles.

The `power` formula type stays implemented and tested, but is marked refuted in the code.

**The deciding test for the overhead model: a SHORT march to an alliance HQ (~30 tiles).**

| model | predicts a 30-tile HQ march |
|---|---|
| Overhead (shipped) | **271 s** (~4m 31s) |
| Higher-rate reading | 53 s |
| Power curve | 34 s |

A 30 tile HQ march taking about four and a half minutes would confirm the overhead outright.

**Still untested:** every sample so far was at +25%, so the speed multiplier is assumed, not
measured — and it matters more now, because it is unknown whether the 238 s overhead scales
with speed or sits outside it. Two marches to the same target at different speeds would
settle both at once.

### Beast and Terror march speed was buffed

The [August 2026 patch notes](https://kingshotmastery.com/blog/kingshot-august-2026-update-patch-notes)
state that the default March Speed for **Beast Hunting and Rally Terrors was increased**,
which shortens those marches. Every community formula found in Section 3 predates it, and
none mention it — a plausible contributor to their being uniformly too slow.

**Untested here:** whether Beast/Terror marches now run at a *different* rate from ordinary
open-map marches. The two samples above agree with each other, but it is not known whether
either target was an actual Terror or Beast rather than a player structure. If a march on a
confirmed Terror or Beast comes out faster than 1.31 s/tile predicts, that warrants its own
zone; log one and see.

---

## 7. Open items for future calibration

- [x] Settle Model A vs Model B — see Section 6a. **Both are wrong**; the real open-map rate
      is roughly 1.32 s/tile, not 2.778 or 6.
- [x] Second open-map march recorded — see Section 6a. Default changed to 1.31 s/tile.
- [x] Third march recorded at 404 tiles — the relationship is a curve, not a line.
- [x] Distance-versus-type settled by the 678 tile HQ march: neither. It is a fixed overhead
      per target type, and the per-tile rate is roughly universal.
- [ ] **A short march (~30 tiles) to an alliance HQ.** Confirms the overhead outright: it
      should take about 4m 31s, against 53 s or 34 s under the refuted models.
- [ ] **Two marches to the same target at different speeds.** Settles whether the overhead
      scales with March Speed Up or sits outside it, and tests the speed multiplier at the
      same time. This is now the most valuable measurement available.
- [ ] A march at a **clearly different speed** (not +25%). The speed multiplier is assumed
      throughout and has never been measured.
- [ ] Any march at all on a Castle or the Ruins, neither of which has ever been measured.
- [ ] Test whether confirmed Beast/Terror targets march faster than open map after the
      August 2026 buff, which would justify a zone of their own.
- [ ] Confirm the distance metric with a near-axis vs near-diagonal pair (Section 6a).
- [ ] Quantify the Ruins penalty — currently a pure placeholder.
- [ ] Determine whether turrets inside the Forbidden Zone use the red-zone rate.
- [ ] Confirm the +3.2 s offset is real and not an artifact of Model A's fitting.
- [ ] Confirm gather time for non-Castle rally targets (Castle = 5 min confirmed).
- [ ] Confirm whether Sanctuary/Fortress/Outpost rallies use the same 5-minute window.

---

## 8. Sources

- Kingshot March Sync Timer — https://www.kingshotguide.org/calculator/kingshot-march-sync-timer
- KingshotPro Map Planner — https://kingshotpro.com/calculators/map-planner.html
- KingshotPro Rally Planner — https://kingshotpro.com/calculators/rally-planner.html
- Kingshot Castle Battle Guide — https://kingshotmastery.com/guides/kingshot-castle-battle-guide
- Kingshot Ruins Guide (The Wizard's Tower) — https://wizardstower.com/guides/kingshot/ruins
- Castle Battle, Kingshot Help Center — https://centurygames.helpshift.com/hc/en/140-kingshot/faq/9047-castle-battle-1783425489/
- Rally Timer (Kingshot Calculator) — https://www.kingshotcalculator.net/rally-timer

Sites returning HTTP 403 to automated fetch (listed for human follow-up, not used as
sources): kingshotguide.com/calculator/rally-timer,
kingshotmastery.com/strategies/rally-timing-strategy
