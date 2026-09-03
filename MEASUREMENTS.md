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

### Lead A — marches 1 to 15

| | |
|---|---|
| Rally lead | **X:536 Y:740**, "TS", alliance [FUN]DirtyDevils, power 211,470,069 |
| March Speed Up | **+25%** — stated for the original set, **never verified in game** |
| Troops | "Same troops every time" (confirmed); Apex 86,105 / 34,442 / 51,663 |

### Lead B — marches 16 onward

**2026-09-03.** A second account, which is the first chance to vary the speed multiplier —
the single biggest untested assumption in this file.

| | |
|---|---|
| Rally lead | **X:973 Y:437**, "T S's", alliance [Uhh]Dueschbags, power 1,117,454 |
| March Speed Up | **+5%** (stated) |
| Kingdom | #1527, the same map as Lead A |

Confirmed in game: jumping to X:833 Y:577 showed a **197km** bubble, and the Euclidean
distance from 973,437 is 197.99 — so the origin is right and the metric is unchanged.

**Lead B is a different player**, not just a different buff: different troops, heroes, power
and alliance. So it is a **separate regime** by construction, exactly like the day boundary in
6d. Its readings must be fitted on their own, and only *ratios* between the two leads mean
anything.

### Common to both

| | |
|---|---|
| Time source | **The pre-deploy timer on the rally/hero screen**, for every reading. Verified by deploying once or twice and confirming the timer matched the real march. An earlier note in this file said these were read from the march bar after departure; that was wrong and is corrected here. |
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
| 8 | WHITESNAKE722 [HZN]HORIZON | X:448 Y:756 | **Enemy** player town | 97 s (current model) | rally screen read `00:03:33` | **213 s** |
| 9 | Titan Roc (Lv.8 Terror) | X:585 Y:776 | Terror, open map | 67 s (current model) | rally screen read `00:01:12` | **72 s** |
| 10 | [OCW]Badland HQ | X:154 Y:592 | Enemy HQ — attack | 684 s (march 5, same target) | rally screen read `00:12:57` | **777 s** |
| 11 | [KHQ]Dora2mon | X:503 Y:1141 | **Enemy** player city | — | rally screen read `00:12:47` | **767 s** |
| 12 | Great Moose (Lv.3 Beast) | X:500 Y:1143 | Beast, open map | — | rally screen read `00:05:56` | **356 s** |
| 13 | Cheetah (Lv.13 Beast) | X:396 Y:597 | Beast — **solo attack**, not a rally | 187 s (monster line) | attack screen read `00:03:21` | **201 s** |
| 14 | WHITESNAKE722 [HZN]HORIZON | X:448 Y:756 | Enemy city — **solo attack** | 213 s (its own rally, minutes earlier) | attack screen read `00:03:33` | **213 s** |
| 15 | [HZN]Plains HQ | X:443 Y:753 | Enemy HQ — rally | 220.9 s (structure line) | rally screen read `00:03:42` | **222 s** |

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
| 9 | +49 | +36 | 60.80 | 85 | 49 | 0.735 | 72 s | 0.844 t/s | 1.184 |
| 10 | −382 | −148 | 409.67 | 530 | 382 | 0.387 | 777 s | 0.527 t/s | 1.897 |
| 11 | −33 | +401 | 402.36 | 434 | 401 | 0.082 | 767 s | 0.525 t/s | 1.906 |
| 12 | −36 | +403 | 404.60 | 439 | 403 | 0.089 | 356 s | 1.137 t/s | 0.880 |
| 13 | −140 | −143 | 200.12 | 283 | 143 | **0.979** | 201 s | 0.996 t/s | 1.004 |
| 14 | −88 | +16 | 89.44 | 104 | 88 | 0.182 | 213 s | 0.420 t/s | 2.381 |
| 15 | −93 | +13 | 93.90 | 106 | 93 | 0.140 | 222 s | 0.423 t/s | 2.364 |

Diagonality is `min(|dx|,|dy|) / max(|dx|,|dy|)`: 0 is a straight line along an axis, 1 is a
perfect 45°. March 7 is the only genuinely diagonal march in the whole set.

## 2b. Table A2 — Lead B, from X:973 Y:437

A second lead means a second origin, so these are kept apart from Table A rather than mixed
into it. Distances below are measured from **973,437**, not 536,740.

| # | Target | To | Target type | Predicted | Reported | Actual |
|---|---|---|---|---|---|---|
| 16 | Gray Wolf (Lv.1 Beast) | X:976 Y:449 | Beast — solo attack | — | attack screen read `00:00:24` | **24 s** |

## 3b. Table B2 — Lead B geometry

| # | dx | dy | Euclidean | Manhattan | Chebyshev | Diagonality | Actual | Implied speed (d/t) | s per tile |
|---|---|---|---|---|---|---|---|---|---|
| 16 | +3 | +12 | 12.37 | 15 | 12 | 0.250 | 24 s | 0.515 t/s | 1.940 |

**Note on finding targets for Lead B.** The in-game monster search is **city-relative, not
view-relative**: it always returns the nearest monster to your own city, however far away the
map is scrolled. So it can only ever supply *short-range* monsters, and mid-range readings
have to come from player structures reached by the coordinate jump.

---

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

The lead's coordinates were verified rather than assumed. A coordinate jump to 536,740
rendered as empty grass, which looked like the city had been moved. It has not:

- **Directly** - tapping the city opens its panel, which reads **X:536 Y:740**, name **TS**,
  alliance **[FUN]DirtyDevils**.
- Indirectly, before that - the neighbouring city **Ashborn reads X:538 Y:740** and sits
  exactly two tiles of screen offset along the +X isometric axis from "My City".

The origin is unchanged and the empty tile was a map-loading artifact. Every distance in this
file is measured from 536,740.

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

## 6c. The overhead belongs to the ACTION, not the distance

**2026-09-02.** March 9 settles what march 8 opened. A Lv.8 Terror was rallied at 60.8 tiles
and the screen read **1:12 (72 s)**, against 67 s from the shipped open-map line. A Terror is
directly comparable to march 1, which was also a Terror and also a rally.

| the two Terror rallies | distance | observed |
|---|---|---|
| march 1 (2026-09-02, earlier) | 29.73 t | 34.5 s |
| march 9 (2026-09-02, rally screen) | 60.80 t | 72 s |

A line through both is `t = 1.207 x d - 1.4`, against the shipped `t = 1.050 x d + 3.2`. Close,
with **no large constant** — so nothing global slowed down between the old set and today.

That kills the two hypotheses from 6b outright:

- **Not a uniform slowdown.** A 2.19x factor would have made this Terror take 147 s. It took 72.
- **Not a rally overhead.** Marches 1 and 9 are both rallies and both carry ~0 s of constant.

What is left is the **target**. Measuring march 8's excess against both lines:

| march | target | distance | observed | pure travel | overhead |
|---|---|---|---|---|---|
| 2 | friendly base | 34.18 t | 39 s | 39.1 s | **-0.1 s** |
| 9 | Terror | 60.80 t | 72 s | ~72 s | **~0 s** |
| 8 | **enemy** player town | 89.44 t | 213 s | 97-107 s | **+106 to +116 s** |

March 2 was `T S - FUN base`, and the lead's own alliance is confirmed from the city panel as
**[FUN]DirtyDevils** — so that march was **friendly**. March 8 was `[HZN]HORIZON`, an **enemy**.
That is the variable that was hiding: not town versus base, but **friendly versus enemy**.

### The law that now fits everything

`t = rate x distance / speedMultiplier + overhead(action)`

with the overhead set by what you are doing, not how far:

| action | overhead |
|---|---|
| rally a Terror or Beast | ~0 s |
| march to a friendly base | ~3 s |
| reinforce your **own** HQ | ~22 s (march 3) |
| rally an **enemy** player city | **~110 s (march 8, new)** |
| attack an **enemy** alliance HQ | ~238 s (marches 4-6) |

The ordering is not arbitrary: the harder the target is to assault, the longer the fixed cost
before the march clock effectively starts. It is the same shape as the attack-versus-reinforce
split already found for HQs, extended to player cities.

**Still to pin down:** the enemy-city overhead rests on **one** observation, so its ~110 s
cannot yet be separated from a steeper rate, exactly as with the HQ before march 6 arrived.
One more enemy-city rally at a very different distance fixes it. The Terror rate of 1.207
versus the shipped 1.050 also wants a third Terror to confirm.

### The oracle, confirmed a second time

The Terror rally offered a **3-minute** window. A draining countdown would have read close to
`3:00`. The screen read `1:12`. Together with the same-value-at-different-elapsed-times check
in 6b, the bottom-right figure is settled as the march time.

## 6d. The same march, measured twice, is not the same

**2026-09-02, later.** March 10 re-reads **the exact target of march 5** — the enemy alliance
HQ at **X:154 Y:592**, 409.67 tiles out, same action, same lead.

| | reading |
|---|---|
| march 5, from your set at +25% | **684 s** |
| march 10, from the rally screen today | **777 s** |
| difference | **+93 s, +13.6%** |

Identical coordinates, identical target, identical action, different answer. **Conditions
changed between that set and today**, so the two are separate regimes and **must not be
pooled**. Everything in Sections 5 and 6c that mixed them is suspect.

This is the pooling trap again, in its purest form. The earlier sections were careful to
separate Terror from base, and attack from reinforce, but assumed *time* was not a variable.
It is.

### A speed change alone does not explain it

Solving each reading for the multiplier, holding the HQ model at 1.3622 s/tile and 238 s:

| reading | implied multiplier |
|---|---|
| march 5 | 1.2512 — i.e. +25%, exactly as recorded |
| march 10 | 1.0353 — i.e. +3.5% |

Self-consistent, and a tidy story: the +25% buff lapsed. But **today's Terror refuses it**.
March 9, at 60.80 tiles, took 72 s, implying a multiplier of **1.1604 (+16%)**. One march
speed cannot be +3.5% and +16% at the same moment, so a pure speed change is not the answer
either. Something else — troop composition setting the slowest unit, a hero or gear change,
an event modifier — is moving as well.

### What this costs, and what it buys

**Costs:** today still has one reading per target type, so rate and overhead remain
inseparable *within* today. Worse, the ~110 s enemy-city overhead in Section 6c was derived
by comparing a today reading against a line fitted to the older set. That comparison is now
invalid: **it should not be trusted, and it is not shipped.**

**Buys:** the rally screen makes a clean single-session dataset cheap, and a single session
holds conditions fixed by construction — which is the only way this was ever going to work.

### The next measurements, and why these ones

Re-read the three remaining known enemy HQs **today**, back to back:

| target | distance | earlier reading |
|---|---|---|
| X:504 Y:1143 | 404.27 t | 679 s |
| X:497 Y:63 | 678.12 t | 977 s |
| X:999 Y:142 | 756.29 t | 1378 s |

With march 10 that gives **four enemy-HQ points spanning 404 to 756 tiles under identical
conditions** — enough to fit rate and overhead properly for the first time, instead of
inferring one by assuming the other. The 999,142 reading also re-tests the diagonal anomaly
within a single regime, which the original pair never could.

## 6e. A clean fit at last — and target type barely matters

**2026-09-02, same session as marches 9–11.** Four readings now exist under **fixed
conditions**, and two of them are the same target type at very different ranges — the first
time that has ever been true.

| # | target | distance | observed | s/tile |
|---|---|---|---|---|
| 9 | Terror | 60.80 t | 72 s | 1.184 |
| 8 | enemy city | 89.44 t | 213 s | 2.381 |
| 11 | enemy city | 402.36 t | 767 s | 1.906 |
| 10 | enemy HQ | 409.67 t | 777 s | 1.897 |

### The two cities fix the line

Marches 8 and 11 are both **enemy player cities**, 313 tiles apart. They give the first
affine fit that was ever actually *measured* rather than assumed:

```
t = 1.7705 x distance + 54.6      (enemy player structures, this session)
```

### And the HQ lands on it without being asked to

That line was fitted on **cities only**. The enemy **HQ** at 409.67 tiles then predicts
**779.9 s** against an actual **777 s** — out by **2.9 s**, about 0.4%.

This is the first genuine out-of-sample success anywhere in this file. Every earlier "fit"
either had as many parameters as points, or was checked against the same data it came from.

**So an enemy HQ carries no meaningful overhead over an enemy city.** A city at 402 t takes
767 s and an HQ at 410 t takes 777 s — near-identical distance, near-identical time. The
**238 s HQ overhead** fitted to the older set does **not** hold in this regime, and neither
does the ~110 s enemy-city overhead from 6c. Both were artefacts of comparing across regimes.

### Monsters are a genuinely different family

The city line predicts **162 s** for the Terror at 60.80 tiles. It took **72 s**. Forcing the
Terror onto the city rate demands an overhead of **−35.6 s**, which would have the march
finish before it began — so a monster rally does **not** share the player-structure rate.
Taken alone at zero overhead it implies **1.184 s/tile**, against 1.770 for player structures.

### The structure, as measured

Two families, not five:

| family | law |
|---|---|
| monsters (Terror, Beast) | fast — about **1.18 s/tile**, overhead ~0 |
| player structures (city **and** HQ alike) | **t = 1.77 x d + 55** |

That is much simpler than the five-tier overhead table in 6c, and unlike that table it is
measured inside one regime and validated out of sample.

**Still open:** only **one** Terror exists in this session, so its rate and overhead are not
yet separated — the 1.184 s/tile assumes zero overhead. **One more Terror at long range
closes the model.** The absolute constants are also specific to this session's conditions;
what should transfer is the *shape*: two families, affine, Euclidean distance.

## 6f. The law, as measured

**2026-09-02, one session, five readings, conditions fixed throughout.**

| # | target | distance | observed |
|---|---|---|---|
| 9 | monster (Terror) | 60.80 t | 72 s |
| 12 | monster (Beast) | 404.60 t | 356 s |
| 8 | structure (enemy city) | 89.44 t | 213 s |
| 11 | structure (enemy city) | 402.36 t | 767 s |
| 10 | structure (enemy HQ) | 409.67 t | 777 s |

### Two affine laws, split by what you are marching at

```
monsters    (Terror, Beast)        t = 0.8261 x d + 21.8
structures  (player city, HQ)      t = 1.7705 x d + 54.6
```

| # | distance | actual | predicted | error |
|---|---|---|---|---|
| 9 | 60.80 t | 72 s | 72.0 s | 0.0 s |
| 12 | 404.60 t | 356 s | 356.0 s | 0.0 s |
| 8 | 89.44 t | 213 s | 213.0 s | 0.0 s |
| 11 | 402.36 t | 767 s | 767.0 s | 0.0 s |
| **10** | **409.67 t** | **777 s** | **779.9 s** | **+2.9 s** |

Be clear about what is and is not evidence here. Each line is fitted on two points, so those
four zeros are **fitted, not predicted** — a line through two points always passes through
them. **March 10 is the only genuine test**: the structure line was fitted on *cities*, and the
*HQ* then landed on it within **2.9 s (0.4%)** without being used. That single out-of-sample
success is the whole basis for trusting the shape.

### The target sets the speed, and by a lot

At the same distance, same troops, same session:

| ~404 tiles | time |
|---|---|
| monster | 356 s |
| player structure | 771 s |

**2.14x slower per tile** for a player structure. That is not an overhead effect — it is the
*rate* that differs. It is also not a constant multiple of the monster time (the ratio runs
2.16–2.23 across the readings), so these are two independent laws, not one law scaled.

### What this replaces

The five-tier overhead table in 6c is **withdrawn**. It came from comparing readings across
regimes, which 6d showed is invalid. The 238 s HQ overhead and the ~110 s enemy-city overhead
were both artefacts. The real structure is simpler: **two families, each affine in Euclidean
distance.**

### What is still not established

- **Two points per line.** Only the HQ is out of sample. A third monster and a third structure
  at fresh distances would make both lines properly tested rather than merely consistent.
- **Terror and Beast are assumed to share a law.** The monster line is fitted across a Terror
  and a Beast. If those differ, that line is a blend of two.
- **The constants are session-specific.** March 5 versus march 10 proved the same march changes
  between sessions. **Only the shape should be treated as durable** — two families, affine,
  Euclidean. Absolute numbers must be re-fitted per session, which is exactly what the
  Exact time control on each result row is for.
- **Speed multiplier still never varied.** Every reading in this file, old and new, was taken
  without deliberately changing March Speed Up.

## 6g. The diagonal anomaly is probably not about diagonals

**2026-09-02, same session.** March 13 is a Lv.13 Cheetah at X:396 Y:597, 200.1 tiles out.
It is the **most diagonal march ever measured here — diagonality 0.979**, essentially a
perfect 45 degrees.

It is also a **solo attack, not a rally**: small Beasts offer only Attack. The screen read
`00:03:21`, **201 s**, and was backed out of without deploying.

| | |
|---|---|
| monster rally line predicts | 187.1 s |
| observed (solo) | **201 s** |
| difference | +13.9 s, **+7.4%** |

Two readings of that 7%, and this measurement cannot separate them: either the line is
slightly off at mid-range, or **a solo march is slightly slower than a rally**. It is the
first solo reading in this file, so there is nothing to compare it against yet.

### Why it matters more than its 7%

Back out the path length the time implies:

| | tiles |
|---|---|
| Euclidean | 200 |
| Manhattan | 283 |
| **implied by the observed time** | **217** |

That is **20% of the way** from Euclidean to Manhattan. Now compare the original anomaly:

| march | diagonality | implied path sits |
|---|---|---|
| 7 (756 t, enemy HQ) | 0.774 | **95% of the way to Manhattan** |
| **13 (200 t, Beast)** | **0.979** | **20% of the way** |

**March 13 is markedly more diagonal and behaves markedly better.** If diagonality caused the
anomaly, a near-45-degree march should be the worst case available. It is close to the best.

So the Manhattan-path explanation for march 7 is **evidence-against, not merely unproven**.
Something else made that march slow — terrain routed around, a different regime, or a
misreading — and the app is right to flag such marches rather than model a grid path.

**Caveats, honestly:** march 7 was a rally on an enemy HQ in an older regime; march 13 is a
solo attack on a Beast today. They differ in action, target family and session, so this is
suggestive rather than decisive. What would settle it is a **strongly diagonal rally on a
player structure, measured today.**

## 6h. Solo equals rally — and the monster line is wrong in the middle

**2026-09-02, ~20:00 UTC.**

### Solo and rally are the same march

WHITESNAKE722, the enemy city at X:448 Y:756, offers both. Read one minute apart with the
same troops loaded:

| action | reading |
|---|---|
| Rally | **213 s** |
| Attack (solo) | **213 s** |

**Identical.** Whatever else varies, the action of rallying does not change travel time. This
had been a live confound since march 13 and it is now closed.

### And there is no drift *within* a session

The same city read **213 s at ~16:00** and **213 s at ~20:00** on the same day. So the regime
shift recorded in 6d happened between the original set and today, **not** hour to hour. A
single day's readings can be pooled; readings from different days cannot.

### Which makes march 13 a real miss

With solo ruled out, march 13's **+7.4%** is genuine error in the monster line, not an
artefact. And the three monster readings are **not on one straight line**:

| segment | slope |
|---|---|
| Terror 60.8 t → Cheetah 200.1 t | 0.926 s/tile |
| Cheetah 200.1 t → Moose 404.6 t | 0.758 s/tile |

The slope **falls with distance**, so the relation is concave, and an affine model cannot hold
across all three. Two explanations remain, and this data cannot separate them:

**A — Terror and Beast are different targets.** Fitting the two Beasts alone gives
`t = 0.758 x d + 49.3`, which predicts the Terror at 60.8 tiles as 95.4 s against an actual
**72 s**. That would make a Terror about **24% faster** than a Beast.

**B — one monster law, but a power curve.** Fitting `t = 2.2541 x d^0.8433` on the Terror and
the Moose predicts the Cheetah at 200.1 tiles as **196.6 s** against an actual **201 s** — within
**2.2%**, with the Cheetah **not** used in the fit.

B currently fits better and is the only one with an out-of-sample check, but A is not
excluded. **One Terror at long range, or one Beast at short range, decides it.**

Note the irony: a power curve was refuted for the older data in Section 6, and is now the
better description of monsters today. Different regime, different answer — which is the
standing lesson of this file.

### What this does not touch

The **structure** line is unaffected: it is still fitted at 89 and 402 tiles and confirmed by
an HQ at 410. But it has **never been tested mid-range either**, and monsters have just shown
that the middle is exactly where an affine fit through two far-apart points fails. **A player
structure at roughly 200 tiles is now the single most valuable unmeasured reading.**

## 6i. City and HQ are one family, confirmed at both ends

**2026-09-02, ~20:05 UTC.** March 15 is the enemy **[HZN]Plains HQ** at X:443 Y:753, 93.9
tiles out, read from the rally screen.

The structure line was fitted on **two cities only**. Both HQ readings now test it without
having been used:

| out-of-sample test | distance | actual | predicted | error |
|---|---|---|---|---|
| Plains HQ | 93.90 t | 222 s | 220.9 s | **−1.1 s (−0.5%)** |
| Badland HQ | 409.67 t | 777 s | 779.9 s | **+2.9 s (+0.4%)** |

**A city and an alliance HQ march identically.** Two independent confirmations, at opposite
ends of the range, both inside half a percent. This is the best-supported claim in the file.

### The caveat that stops this being a victory

| | |
|---|---|
| line fitted at | 89.4 and 402.4 tiles |
| line tested at | 93.9 and 409.7 tiles |

Both tests sit **almost on top of the fitted anchors**. They establish that a city and an HQ
behave the same; they say **nothing** about the shape between 90 and 400 tiles.

That is exactly the trap monsters fell into. The monster line looked healthy at both of its
anchors too, and then missed by **7.4%** in the middle (6h). An affine fit through two
far-apart points *cannot* fail at those points — it is fitted there.

### The one reading that would settle it

A power curve through the same two cities is `t = 4.6307 x d^0.8520`, and it also passes
through both exactly. The two models only separate in the middle:

| distance | affine | power curve | difference |
|---|---|---|---|
| 150 t | 320.2 s | 330.9 s | 10.7 s |
| **200 t** | **408.7 s** | **422.8 s** | **14.1 s** |
| 250 t | 497.2 s | 511.3 s | 14.1 s |
| 300 t | 585.8 s | 597.3 s | 11.5 s |

About **14 s at 200 tiles — 3.4%**, and readings are exact to the second, so a single
**enemy city or HQ near 200 tiles** decides whether structures are affine or curved. Given
what monsters did, the curve should not be assumed away.

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
