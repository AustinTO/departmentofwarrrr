# Major Game Improvements Plan

> Procurement update — 2026-09-11: [PINBALL_3D_IMPLEMENTATION_PLAN.md](../../PINBALL_3D_IMPLEMENTATION_PLAN.md) supersedes Milestone 2 and procurement-specific delivery gates in this older roadmap. Transition procurement to Three.js + Rapier 3D on `procurement-3d-pinball`; Planck remains on `main` for comparison/rollback. Twelve targets, multiball and broader content remain post-vertical-slice work; combat/mansion goals are unchanged.

## Current status — 2026-10-28

This is a historical proposal; its baseline and milestones predate the current implementation. The active procurement route is Three.js + Rapier, with explicit draft authorization/discard, board selection/unlocks, emergency extra-ball behavior, and three upper-board bumper/scoop layouts sharing protected shooter lane, ramps, and lower playfield. Seeded doctrine ordering and five-scenario cycle, consequence-bearing hearing choices, and run-aware press-release callbacks are also present. The target counts and feature expansions below remain proposals unless the current-status table in [next-level-game-plan.md](next-level-game-plan.md) identifies them as implemented. Current evidence: 129 tests / 16 files, including 33 focused geometry/physics tests; build passes with a large-chunk warning; headless smoke stalled; no device or human-play evidence.

## Product goal

Turn Department of WARRR from a functional satirical arcade prototype into a replayable mobile campaign where each 4–7 minute run produces tactical choices, escalating visual absurdity, and a memorable procurement/mansion story.

## Current baseline

- Combat has four selectable weapons and transient Peter callouts, but its HUD and selection cards are mostly static ([CombatScene.ts](../../src/scenes/CombatScene.ts#L244-L326)).
- Procurement has a single-ball, custom pinball board with eight bumper values and one combo counter ([ProcurementScene.ts](../../src/scenes/ProcurementScene.ts#L87-L145)).
- The McLean map now has unlockable districts but only repeats one mansion sprite ([MansionScene.ts](../../src/scenes/MansionScene.ts#L8-L81)).
- Mansion costs begin at $8B and increase by 28% ([RunState.ts](../../src/state/RunState.ts#L76-L89)).

## Acceptance criteria

1. A first-time player can understand each weapon's role, cost, reload, and risk within one combat wave, without external instructions.
2. Every weapon has distinct input feedback, projectile/explosion feedback, hit feedback, and an audio/haptic cue.
3. Procurement has at least 12 positive/negative targets, two skill shots, one temporary multiball-style event, and a visible contract-result card after every ball.
4. At least 10 fictional character interruptions are implemented, each conditional on game state; none remains onscreen longer than 2.5 seconds during combat.
5. McLean contains at least 20 visual mansion/development variants distributed across 6 expandable districts, with no hard mansion cap.
6. Every procurement result shows authorization, contractor profit, delivery year, units, and a one-line satirical consequence using billion/trillion formatting.
7. Android maintains a median frame time under 20 ms during a dense combat wave and a pinball multiball event on the attached OnePlus 6T.
8. Unit tests cover economy scaling, mansion thresholds, contract generation, and pinball target effects; Playwright covers doctrine → combat → readiness → procurement/McLean transitions.

## Milestone 1 — Combat that rewards bad decisions

**Files:** `src/scenes/CombatScene.ts`, `src/game/CombatSystem.ts`, `src/game/config.ts`, `src/managers/AudioManager.ts`, new `src/ui/WeaponTray.ts`.

1. Extract the current bottom controls into `WeaponTray` so selection state, cooldown arcs, ammo count, and disabled states have one owner.
2. Assign each weapon a clear combat identity:
   - Vulcan: aim-assist stream, heat meter, small rewards, rapid screen shake.
   - Jammer: cone/radius preview, disruption chain, temporary threat slowdown.
   - SM-3: precise arc, cinematic intercept, high overmatch popup.
   - SM-6: slower lock confirmation, larger blast, procurement-pressure jackpot.
3. Add aim preview, reload ring, selected-card pulse, and low-stock warning before the player fires.
4. Add conditional character interruptions: Peter for premium choices, Ledger for depleted inventory, Miranda for high overmatch, Avery for efficient choices.
5. Add lightweight haptics behind a Capacitor-safe adapter and honor the system reduced-motion setting.

## Milestone 2 — Procurement 3D experiment

Execute the [migration plan](../../PINBALL_3D_IMPLEMENTATION_PLAN.md): loading/lifecycle, physical table, flipper comparison, curved rail, elevated ramp, minimal rules/touch/art, then mobile and authoring evaluation. Replace the procurement route on this branch after evidence gates pass; do not merge until the gates pass.

### Historical content expansion backlog (after prototype evidence)

**Files:** `src/scenes/ProcurementScene.ts`, new `src/game/ProcurementSystem.ts`, new `src/game/Contract.ts`, `src/state/RunState.ts`.

1. Move contract arithmetic out of `ProcurementScene`; keep the scene responsible for input/rendering only.
2. Split targets into beneficial inflation targets and harmful efficiency targets. Examples: `SOLE SOURCE`, `REQUIREMENTS CREEP`, `CLASSIFIED ADD-ON`, versus `ACTUAL REQUIREMENTS`, `FIXED PRICE`, and `COMPETITIVE BID`.
3. Implement skill shots: launch-lane precision and an upper-board “supplemental appropriation” gate.
4. Add limited multiball during `EMERGENCY SUPPLEMENTAL`; cap ball count at 3 and reduce VFX on low-performance devices.
5. Add contract modifiers for authorization, margin, units, and delivery years—some outcomes should be financially huge but operationally disastrous.
6. After each drained ball, show a compact animated contract card; after authorization, show a full “money now/capability later” comparison.

## Milestone 3 — McLean becomes a living visual score

**Files:** `src/scenes/MansionScene.ts`, new `src/game/MansionSystem.ts`, new `src/data/mansions.ts`, `public/assets/mansions/`.

1. Replace the repeated mansion sprite with data-driven estate variants: colonial estate, brutalist compound, missile-shaped pool, classified gazebo, hearing-room wine cellar, helipad, private terminal, and country-club annex.
2. Add six districts with a zoom/pan map and animated unlock reveal: Original Estate, Cul-de-Sac, Procurement Heights, Helicopter Enclave, Country Club Corridor, Greater McLean Estate Zone.
3. Grow visible infrastructure by threshold: roads, pools, gates, helicopters, private terminal, and finally command-center encroachment.
4. Add a “new build” sequence that selects a compatible variant, labels the contractor program that paid for it, and records it in an estate ledger.
5. Make district capacity virtual/infinite: dense visual clusters summarize older estates while the active district shows individual builds.

## Milestone 4 — Asset diversity and presentation system

**Files:** `public/assets/characters/`, new `public/assets/ui/`, new `public/assets/vfx/`, `src/scenes/PreloaderScene.ts`.

1. Produce a coherent asset pack in the existing editorial-cartoon style: 5 character expressions each, 20 estate/development variants, 4 weapon HUD icons, 6 threat variants, 12 pinball target badges, 8 VFX sprites.
2. Create texture atlases and preload groups per scene to keep initial mobile load time controlled.
3. Add a scene-level “satire director” that chooses portrait, expression, line, and trigger with cooldowns so jokes do not repeat excessively.
4. Replace flat rectangles on the pinball and weapon tray with high-contrast panel assets while preserving 44px+ touch targets.

## Milestone 5 — Campaign pacing and replayability

**Files:** `src/game/WaveDirector.ts`, new `src/game/EventSystem.ts`, `src/scenes/EventScene.ts`, `src/state/RunState.ts`.

1. Create run archetypes: rapid escalation, chronic shortage, audit disaster, and contractor paradise.
2. Add 24 state-aware events that reference prior choices, current inventory, procurement delay, and estate district.
3. Add end-of-run dossiers with: mansions, readiness, taxpayer burn, contractor profit, biggest overmatch, worst delivery estimate, and most-used weapon.
4. Add unlockable satirical titles and cosmetic estate plaques; do not add paywalls, ads, or currency purchases.

## Milestone 6 — Quality gates and mobile release hardening

**Files:** `src/**/*.test.ts`, new `tests/e2e/`, `android/`.

1. Add deterministic seeded RNG to combat waves, events, and procurement target layouts for testability.
2. Add simulation tests for 100 fiscal years to catch runaway/infinite mansion loops and invalid inventory states.
3. Add Playwright flow tests for every scene transition, first contract, estate unlock, and save/restore migration.
4. Profile physical-device frame time, memory, audio interruptions, background/resume, and orientation/safe-area behavior.
5. Produce signed beta builds only after all gates pass.

## Asset production order

1. Weapon icons, threat silhouettes, impact/VFX sprites — immediate gameplay readability.
2. Pinball badges, board elements, contract-card ornamentation — second gameplay mode.
3. Mansion variants and district infrastructure — long-term visual payoff.
4. Character expressions and cut-in frames — humor/pacing polish.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Asset work increases APK size | Use atlases/WebP where compatible; budget scene assets and measure APK size each milestone. |
| Satire gets repetitive or mean-spirited | Use fictional composites, state-aware cooldowns, and target systems/incentives rather than real individuals. |
| Pinball becomes noisy/unreadable | Keep target taxonomy color-coded, cap multiball at 3, and test on the OnePlus 6T. |
| Economy becomes an unreadable wall of numbers | Always pair money with delivery time, units, readiness impact, and a visual McLean outcome. |
| Mansion count causes rendering slowdown | Render recent estates individually and aggregate older ones into district clusters. |

## Verification sequence

1. Unit tests: contract arithmetic, target effects, combo/multiball limits, mansion unlocks, save migrations.
2. Browser flow: Playwright scene transition and persistence suite.
3. Android: install debug APK, complete one full fiscal-year loop, validate no WebView errors.
4. Performance: measure combat and multiball frame-time median/p95 on the OnePlus 6T.
5. Playtest: 5 users complete two runs; capture weapon selection rate, contract-value distribution, and whether they can describe the core satire unaided.

## Recommended delivery order

Ship Milestones 1 and 2 together as the “fun-first” update, then Milestones 3 and 4 as the visual-growth update. Milestones 5 and 6 follow once the central combat → procurement → McLean loop is consistently compelling.
