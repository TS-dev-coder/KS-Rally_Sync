# Measured marches — the raw record

Every march time actually observed in play. This is the **primary data**; `RESEARCH-NOTES.md`
argues about what it means, and `js/zones.js` carries the constants fitted to it. When those
disagree with this file, this file wins.

**Keep this file current.** Every new march measured from here on gets appended to Table A
and Table B, and the model is then re-checked against the whole set — not just the new
point. Section 7 has the template and the procedure.

Every row below was recovered from the session transcript and checked against what was
actually typed, not reconstructed from memory. Provenance is recorded per row.

---

## 1. Conditions common to every measurement

| | |
|---|---|
| Rally lead | **X:536 Y:740** (Town Center) — the same lead every time |
| March Speed Up | **+25%** on every single march |
| Troops | "Same troops every time" (confirmed) |
| Time source | "The march bar after troops departed" (confirmed) — travel only, not the rally gather window |
| Rally window used | 5m for alliance HQ; Terror options start at 3m |
| Client | Kingshot in BlueStacks; the game clock runs on UTC |

That every march shares one lead, one speed buff and one army is what makes them
comparable. It is also the largest gap in the data: **the speed multiplier has never been
varied**, so the `/1.25` divisor is assumed throughout and has never actually been tested.

---

## 2. Table A — the record as reported

"App predicted" is what RallySync displayed at the time, on whatever constants were shipped
that hour; it is kept only to show which way the model was wrong. "You reported" is verbatim.

| # | Target | To | Target type | App predicted | You reported | Actual |
|---|---|---|---|---|---|---|
| 1 | "Terror", Other / Open map | X:508 Y:730 | Terror, open map | 1m 09s (69 s) | "actual march time is 34 or 35 seconds" | **34.5 s** |
| 2 | "T S - FUN base" | X:548 Y:708 | Player base, open map | 1m 19s (79 s) | "actual time is 39 sec" | **39 s** |
| 3 | Alliance HQ (own) | X:544 Y:752 | **Own HQ — reinforcing** | 4m 14s (254 s) | "actual march 38 sec" | **38 s** |
| 4 | Alliance HQ | X:504 Y:1143 | Enemy HQ — attack | 15m 02s (902 s) | "actual 11m:19s" | **679 s** |
| 5 | Alliance HQ | X:154 Y:592 | Enemy HQ — attack | 11m 28s (688 s) | "11 24 is actual" | **684 s** |
| 6 | Alliance HQ | X:497 Y:63 | Enemy HQ — attack | 18m 53s (1133 s) | "16:17" | **977 s** |
| 7 | Alliance HQ | X:999 Y:142 | Enemy HQ — attack | 17m 42s (1062 s) | "its 22:58" | **1378 s** |
| 8 | WHITESNAKE722 [HZN]HORIZON | X:448 Y:756 | Player town, open map | 97 s (current model) | rally screen read `00:03:33` | **213 s** |

Provenance: rows 1, 2, 4, 5, 6 were pasted as chat messages. Rows **3 and 7 arrived as
queued messages sent mid-turn**, which is why a naive scan of chat messages misses them —
they are equally real. Row 3's target type was confirmed by direct question: "My own
alliance's HQ (reinforcing)". Row 7's likewise: "Yes, another alliance HQ", with "My March
Speed Up was still +25%".

---

## 3. Table B — derived geometry

Distances are from the lead at 536,740. The app's own `dist` readout agreed with the
Euclidean column on every row, and the game's map bubble confirms 1 tile = 1 km, floored.

| # | dx | dy | Euclidean | Manhattan | Chebyshev | Diagonality | Actual | Implied speed (d/t) | s per tile |
|---|---|---|---|---|---|---|---|---|---|
| 1 | −28 | −10 | 29.73 | 38 | 28 | 0.357 | 34.5 s | 0.862 t/s | 1.160 |
| 2 | +12 | −32 | 34.18 | 44 | 32 | 0.375 | 39 s | 0.876 t/s | 1.141 |
| 3 | +8 | +12 | 14.42 | 20 | 12 | 0.667 | 38 s | **0.380 t/s** | 2.635 |
| 4 | −32 | +403 | 404.27 | 435 | 403 | 0.079 | 679 s | 0.595 t/s | 1.680 |
| 5 | −382 | −148 | 409.67 | 530 | 382 | 0.387 | 684 s | 0.599 t/s | 1.670 |
| 6 | −39 | −677 | 678.12 | 716 | 677 | 0.058 | 977 s | 0.694 t/s | 1.441 |
| 7 | +463 | −598 | 756.29 | 1061 | 598 | **0.774** | 1378 s | 0.549 t/s | 1.822 |
| 8 | −88 | +16 | 89.44 | 104 | 88 | 0.182 | 213 s | 0.420 t/s | 2.381 |

Diagonality is `min(|dx|,|dy|) / max(|dx|,|dy|)`: 0 is a straight line along an axis, 1 is a
perfect 45°. March 7 is the only genuinely diagonal march in the whole set.

---

## 4. Does the plain physics formula `t = d / v` work?

**No — and one pair of rows disproves it outright.**

| march | distance | time |
|---|---|---|
| 3 | 14.4 tiles | 38 s |
| 1 | 29.7 tiles | 34.5 s |

March 1 is **2.1x farther and 3.5 s faster**. `t = d/v` requires time to rise with distance,
so no value of `v` — and no per-zone or per-target `v` either — can produce that pair.
Distance alone does not determine march time.

Fitting a single best speed to all seven anyway gives 0.6035 tiles/s:

| # | distance | actual | `d/v` predicts | error |
|---|---|---|---|---|
| 1 | 29.7 | 34 s | 49 s | +15 s |
| 2 | 34.2 | 39 s | 57 s | +18 s |
| 3 | 14.4 | 38 s | 24 s | −14 s |
| 4 | 404.3 | 679 s | 670 s | −9 s |
| 5 | 409.7 | 684 s | 679 s | −5 s |
| 6 | 678.1 | 977 s | 1124 s | **+147 s** |
| 7 | 756.3 | 1378 s | 1253 s | **−125 s** |

The implied speed `d/t` ranges from **0.380 to 0.876 tiles/s — a 2.31x spread**. Splitting by
target type does not rescue it:

| group | n | implied speeds | spread |
|---|---|---|---|
| open map | 2 | 0.862, 0.876 | 1.02x — consistent |
| own HQ | 1 | 0.380 | — |
| enemy HQ | 4 | 0.595, 0.599, 0.694, 0.549 | 1.26x — not consistent |

Open map is the only group pure physics describes well, and only because both of its marches
happen to be about the same length.

---

## 5. What does fit: physics **plus a fixed startup cost**

`t = rate × d / speedMultiplier + overhead`, where the overhead depends on the *action*:

| zone | rate | overhead |
|---|---|---|
| open map (`general`) | 1.313 s/tile | 3.2 s |
| enemy HQ attack (`hq`) | 1.3622 s/tile | **238 s** |
| own HQ reinforce (`hq_own`) | 1.3622 s/tile | **22.3 s** |

| # | zone | distance | actual | predicted | error |
|---|---|---|---|---|---|
| 1 | general | 29.7 | 34.5 s | 34 s | <1 s |
| 2 | general | 34.2 | 39 s | 39 s | <1 s |
| 3 | hq_own | 14.4 | 38 s | 38 s | <1 s |
| 4 | hq | 404.3 | 679 s | 679 s | <1 s |
| 5 | hq | 409.7 | 684 s | 684 s | <1 s |
| 6 | hq | 678.1 | 977 s | 977 s | <1 s |
| 7 | hq | 756.3 | 1378 s | 1062 s | **−316 s** |

**The overhead is not a fudge factor.** Solving the axis-aligned enemy-HQ marches pairwise
for rate and intercept, without assuming either value:

| pair | implied rate | implied overhead |
|---|---|---|
| 4 & 6 | 1.3602 s/tile | 239.1 s |
| 5 & 6 | 1.3643 s/tile | 236.9 s |
| 4 & 5 | 1.1575 s/tile | 304.7 s — *ill-conditioned* |

Two independent pairs recover ~1.362 s/tile and ~238 s without being told to. The third is
unreliable and should not be read as disagreement: marches 4 and 5 are only 5 tiles apart in
distance, far too short a lever arm to separate a rate from an intercept.

The physical reading: **an HQ rally spends about 4 minutes on something that is not travel**
(assembly, gate animation), a reinforcement spends ~22 s, an open-map march ~3 s. Marching
speed itself barely moves — 1.313 vs 1.362 s/tile. It is the *action* that costs, not the
terrain.

---

## 6. The open anomaly — march 7

The only genuinely diagonal march is the only misfit, and it is slow by 316 s.

| metric for march 7 | path length | predicts | vs actual 1378 s |
|---|---|---|---|
| Euclidean | 756.3 | 1062 s | −316 s |
| Manhattan | 1061 | 1394 s | +16 s |
| **implied by the observed time** | **1046** | — | — |

The observed time implies a path of about 1046 tiles — **95% of the way from Euclidean to
Manhattan**. The same test across every march:

| # | diagonality | Euclidean | Manhattan | implied by time | matches |
|---|---|---|---|---|---|
| 1 | 0.357 | 30 | 38 | 30 | Euclidean |
| 2 | 0.375 | 34 | 44 | 34 | Euclidean |
| 3 | 0.667 | 14 | 20 | 14 | Euclidean |
| 4 | 0.079 | 404 | 435 | 405 | Euclidean |
| 5 | 0.387 | 410 | 530 | 409 | Euclidean |
| 6 | 0.058 | 678 | 716 | 678 | Euclidean |
| 7 | **0.774** | 756 | 1061 | **1046** | **Manhattan** |

Six marches say Euclidean. The single strongly diagonal march says Manhattan. That is
suggestive but **not settled** — it is one observation, and a march that long could equally
have been routed around impassable terrain. The app therefore keeps Euclidean and *warns* on
strongly diagonal marches rather than silently fitting a curve through one point.

**This is the top open question.** One more march with diagonality above ~0.6 decides it.

---

## 6b. The rally screen is a march-time oracle

**2026-09-02.** Reading a march time no longer requires launching anything. Tapping a target
then **Rally -> pick a window -> Hold a rally** opens the hero/troop screen, which shows a
time beside a timer icon at the bottom right. Backing out with the top-left arrow commits
nothing: no rally is created and no troops move.

That number was initially ambiguous. In the first screenshots it read `00:03:33` on a
5-minute window 82 s after the rally was held, and 300 - 87 = 213 s, so it fitted a *rally
countdown draining* exactly as well as it fitted a march time.

**It is the march time.** Re-opening the same target read `00:03:33` again, 8 s after holding
the rally instead of 82 s. A countdown cannot show the same value at two different elapsed
times. The agreement with 300 - 87 was a coincidence.

This makes measurement effectively free: any target can be priced in about six taps without
committing troops, so the sample can grow much faster than one march at a time.

### And it immediately contradicts the model

March 8 is the first reading taken this way, and it does not fit:

| | |
|---|---|
| Target | WHITESNAKE722, a player town at X:448 Y:756 |
| Distance | 89.44 tiles from the lead at 536,740 |
| Current model predicts | **97 s** |
| Rally screen reads | **213 s** — 2.19x longer |

The lead's coordinates were re-verified rather than assumed: a coordinate jump to 536,740
rendered as empty grass, which looked like the city had been moved, but the neighbouring city
**Ashborn reads X:538 Y:740** and sits exactly two tiles of screen offset along the +X
isometric axis from "My City". The origin is correct; the empty tile was a map-loading
artifact.

So march 8 is a real contradiction, not a bookkeeping error. It also cannot be reconciled with
march 2 (a player base, 34.18 tiles, 39 s) under any straight line: fitting both gives an
intercept of **-68.6 s**, which would make a short march finish before it started.

**Two explanations survive, and they are the same trap as before** — an additive constant
versus a multiplicative one:

| hypothesis | fits march 8 by | predicts for a ~10-tile rally |
|---|---|---|
| A rally carries a large **fixed overhead** (~119 s) | 1.0504 x 89.44 + **119** | ~130 s |
| A rally is **uniformly slower** (~2.19x) | 2.19 x (1.0504 x 89.44 + 3.2) | ~30 s |

The two differ by more than 4x at short range, so **one short-range rally reading decides
it**. Until then neither is shipped, and the earlier seven marches are left untouched.

**Unresolved:** it is not recorded whether the original seven were rallies or solo marches.
If they were solo, then rally and solo are simply different actions with different constants —
which would explain everything without either hypothesis above being about distance at all.
The clean test is to read the same target's time from the solo attack screen and compare, but
that route is deliberately not taken here without asking, since the instruction was to never
attack.

## 7. Adding the next measurement

Append to Table A and Table B, then re-check the model against **all** rows, not only the new
one. Every wrong model recorded in `RESEARCH-NOTES.md` came from pooling observations that
looked comparable and were not — Terror with player base, distance with target type, attack
with reinforcement. Always record what varied.

What to capture:

| field | where to read it |
|---|---|
| From / To | the app's own `from` / `to` in the result row |
| Target type | Terror, player base, enemy HQ, **own** HQ, Castle, Ruins, turret |
| March Speed Up | the lead's buff at launch — **vary this** |
| App predicted | the `march` figure the app showed |
| Actual | **the march bar after troops depart**, not the rally countdown |

To re-check a prediction:

```
node -e "require('./js/zones.js');require('./js/calculations.js');
const {calc,zones}=globalThis.RallySync;
console.log(calc.resolveMarchSeconds({lead:{x:536,y:740,marchSpeedUpPercent:25},
  target:{x:999,y:142,zoneKey:'hq'},zones:zones.defaultZoneFormulas()}));"
```

Still unmeasured, in priority order:

- [ ] **A second strongly diagonal march** (diagonality > 0.6) — decides Section 6.
- [ ] **Any march at a speed other than +25%** — the `/1.25` divisor is assumed, never tested.
- [ ] A second own-HQ reinforcement at longer range — separates its rate from its 22.3 s overhead, which one sample cannot.
- [ ] Any march at all on a **Castle** or the **Ruins** — both constants are inferred from a community ratio and have never been measured.
- [ ] A short enemy-HQ attack (~30 tiles) — confirms the 238 s overhead is flat rather than distance-dependent.
