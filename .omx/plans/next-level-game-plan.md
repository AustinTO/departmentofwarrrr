# Department of WARRR: next-level game improvement plan

Status: current-priority roadmap, 2026-10-28. This plan synthesizes the gameplay, humor/content, and presentation audits in this directory and was reconciled against current implementation boundaries. It proposes work; it does not claim playability, balance, accessibility, or device performance is runtime-verified.

## Product identity and design rule

Department of WARRR is a satirical arcade campaign about perverse defense procurement incentives. The player makes operational decisions under pressure, spends expensive munitions against cheap threats, manages readiness and delayed deliveries, then watches contractor wealth appear as McLean real estate. The central joke is the gap between an official explanation and an absurd material outcome. Keep the institution deadpan: it renames, funds, or schedules a hearing about the absurdity rather than acknowledging it.

The identity already has strong anchors: “EXPENSIVE INTERCEPTS. CHEAP THREATS. SOMEBODY GETS A MANSION.” on the title screen; “DEFEND THE FLOATING POWERPOINT” and “DEFEND THE STRATEGIC SNACK BAR” in scenario text; and the mansion/procurement contrast in `src/game/ProcurementSystem.ts` and `src/data/mansions.ts`. Preserve these, while reducing repetition of the same spend/profit/mansion punchline in every surface.

**Core loop:** choose doctrine → defend a scenario with costly tactical tools → review readiness and stock → select/complete a procurement contract → see what delivered and when → see contractor profit manifest as an estate → face a hearing/production consequence → adapt for the next fiscal year.

**Player promise:** every decision has a visible operational consequence, every reward has a reachable use, and every report explains how the institution justifies what the player caused. Mansions remain the primary satirical score; readiness is the survival pressure; active/reserve inventory, production capacity, and delivery time make the strategic choices legible.

## Evidence boundary

The three audits are code/content inspections, not complete playtests. They did not establish that the game is fun, balanced, accessible, or performant on physical devices. The presentation audit did not launch the game or test assistive technology. Existing PINBALL evaluation notes include headless/browser checks but explicitly lack the physical-device performance and multi-player fun evidence needed to close those gates. Treat all criteria below as proposed acceptance gates until measured.

The audits include an earlier working-tree snapshot with uncommitted edits to combat, the weapon wheel, and 3D pinball files. The dated implementation matrix below records what is now present in the current working tree and separates it from remaining validation. This plan makes no source changes.

## Priority order

1. **P0 — Procurement settlement and board progression (implemented; validation open).** Procurement hits draft a contract; campaign cost/profit and delivery settle only on explicit authorization. Discarding an unapproved draft records no cost, profit, or units. Authorization is guarded against repeat settlement in the same FY. The live 3D game reads saved board selection, provides a board selector, respects unlocks, and switches geometry/rules. Remaining work is to verify the settlement summary against every ledger and delivery path in a complete campaign run, including save/reload and failure exits.
2. **P1 — Consequential annual choices (implemented in core paths; balance/usability validation open).** Readiness previews the next scenario; combat presents scenario objective and grading; procurement displays contract preview and settlement; hearing events provide choices with effects recorded in event history and callbacks used by generated press releases. Remaining work is to assess whether these signals are understandable and whether wave/weapon/ally tradeoffs are fair in play.
3. **P2 — Seeded replay and board/scenario variation (implemented baseline; depth and validation open).** Doctrine cards use the seeded campaign RNG; five scenarios cycle with a seed offset. This seed does not drive pinball physics. Three board shells vary upper-board bumper/scoop geometry and associated rules while sharing the protected shooter lane, ramps, and lower playfield/flippers. Hearing choices and campaign callbacks are implemented. Remaining work is playtesting scenario and board distinction, checking recap accuracy across runs, and validating the implemented metric-based commendations.

4. **P3 — Unify presentation, accessibility, and device quality.** Establish shared scene UI rules, improve outcome feedback and semantic access, then tune mobile performance from physical-device measurements.
5. **P4 — Expand content and visual variety.** Add scenario/enemy/character/estate/board content after the mechanics support distinct play and after baseline art/load/performance budgets are known.

**Verification snapshot (2026-10-28):** 129 tests across 16 files, including 33 focused geometry/physics tests; production build passes with a large-chunk warning. Headless smoke stalled. No physical-device or human-play evidence. These results establish automated/build status only, not feel, balance, or mobile performance.

## Implementation and evidence status — 2026-10-28

| Area | Implemented in current code | Still open |
| --- | --- | --- |
| Procurement settlement | Draft-only bumper effects; explicit authorize/discard; repeated same-FY settlement guard; visible settlement details; emergency target maps to extra balls. | End-to-end campaign reconciliation for every exit, save/reload, queue, and delivery case; headless smoke did not complete. |
| Board progression and diversity | Saved selection and unlocks feed the active 3D game; selector applies board geometry and rules. Three upper-board bumper/scoop variants share shooter lane, ramps, and lower playfield/flippers. | Confirm progression/migration and gameplay distinction in completed runs; physical-device and human-play evidence. |
| Choices and replay | Five seeded-cycle combat scenarios; seeded doctrine ordering; readiness preview; scenario objectives; consequence-bearing hearing choices/history; run-aware press-release callbacks and metric-based leaderboard commendations. | Balance and comprehension playtests; verify recap attribution across representative runs; validate commendations and determine whether further scenario/rule breadth is warranted. |

## Delivery phases

### Phase 0 — Baseline, contract map, and evidence plan

**Purpose:** establish a reproducible starting point and trace what campaign values mean before changing balance.

**Inspect:** `src/state/RunState.ts`, `src/game/ProcurementSystem.ts`, `src/game/ProductionSystem.ts`, `src/scenes/ReadinessScene.ts`, `src/scenes/ProcurementScene.ts`, `src/pinball3d/Procurement3DGame.ts`, `src/game/PinballBoards.ts`, `src/game/WaveDirector.ts`, `src/game/CombatSystem.ts`, and current tests.

**Work:** document campaign accounting boundaries: when burn, profit, contract units, queue entries, delivery, active/reserve stock, readiness, and mansion thresholds change. Capture a known first-year route and a representative later year in browser at target viewport sizes. Record device/browser/DPR and distinguish static code claims from observed runtime behavior. Treat current tests/build as baseline, not as proof of subjective quality.

**Acceptance:** an accounting table identifies each mutation and its visible UI/result; one FY walkthrough records each scene transition and resource delta; baseline screenshots cover title, doctrine, combat, readiness, procurement, mansion, event, and press release at 360×800 and 390×844; current build/tests and known failures are recorded.

**Relative cost:** S. **Dependencies:** none.

### Phase 1 — Make board progression real (P0)

**Purpose:** fulfill the existing board unlock promise rather than add new unlock content.

**Files:** `src/game/PinballBoards.ts`, `src/state/RunState.ts`, `src/scenes/ReadinessScene.ts` or a focused board-select step, `src/scenes/ProcurementScene.ts`, `src/pinball3d/Procurement3DGame.ts`, `src/pinball3d/TableView.ts`, `src/pinball3d/table.ts`, and focused tests.

**Work:** pass `selectedBoard` from persisted run state into the active 3D game. Present available boards and clear lock requirements before procurement. Ensure locked boards cannot be selected and defaults migrate safely for existing saves. Give each selectable board one real, testable gameplay distinction using a small, reviewable contract (for example geometry/target layout, hazard exposure, or a rules/objective modifier). Existing names/art/thresholds can anchor the themes, but do not build a general table editor or many variants yet.

**Acceptance:** each unlocked board can be selected and selection survives reload; locked boards reject selection; the active 3D view and collision/rules use the selected ID; each board has at least one automated/measurable distinction; board selection does not reset campaign state; save migration has a test for old/missing selection fields.

**Relative cost:** M. **Dependencies:** Phase 0; implementation should check active uncommitted pinball changes before editing.

### Phase 2 — Reconcile procurement and campaign economy (P0)

**Purpose:** make every dollar/unit/date on the machine explainable and consequential.

**Files:** `src/game/ProcurementSystem.ts`, `src/game/ProductionSystem.ts`, `src/state/RunState.ts`, `src/scenes/ReadinessScene.ts`, `src/scenes/ProcurementScene.ts`, `src/pinball3d/Procurement3DGame.ts`, and tests.

**Work:** define the settlement point and make it atomic/idempotent. A table exit must explicitly authorize, discard, or return to play; never silently retain burn/profit while dropping the associated contract. Before authorization, show contract type, units, total cost, contractor profit, delivery year, and destination (active theater or reserve). At settlement, record one procurement result per FY and reconcile it with campaign burn/profit and the production queue. Make delivered units visible and reachable from the next readiness/combat choice; state whether they arrived in active stock or reserve. Align emergency target IDs with their promised effect, or remove that promise until connected. Add an end-of-table settlement card and ensure it reconciles exactly to the campaign ledger.

**Acceptance:** repeated authorization cannot double award; cancel/exit behavior is explicit and preserves balanced ledger semantics; every contract item has a visible quantity, price, margin/profit, date, and destination; delivery timing and active/reserve placement are covered by tests; at least one next-year combat/loadout choice changes because of a delivered contract; the emergency target's displayed effect matches runtime behavior; the end card and campaign totals reconcile.

**Relative cost:** M. **Dependencies:** Phase 0; coordinate with Phase 1 when passing selected board data.

### Phase 3 — Make combat choices fair and legible (P1)

**Purpose:** turn weapon selection, restraint, and wave pacing into tactical decisions rather than accidental cost differences or input burden.

**Files:** `src/game/WaveDirector.ts`, `src/game/CombatScenarios.ts`, `src/game/CombatSystem.ts`, `src/game/config.ts`, `src/scenes/CombatScene.ts`, `src/game/WeaponWheel.ts`, and tests.

**Work:** calibrate spawn budgets by elapsed time and fiscal year; `fy` intensity currently grows 50% annually and the ramp uses a 90-second denominator despite a 60-second combat window. Bound on-screen pressure and explicitly explain END YEAR consequences so leaving early cannot accidentally produce a superior grade/reward. Give weapons distinct matchup niches; decide whether configured range is a true constraint and make targeting/UI agree. Reconcile doctrine unlimited-ammo status with wheel labels, keep zero-stock weapons unavailable, and tune Vulcan auto-fire/jammer coverage so active manual choice matters. Make allies recognizable before targeting and reward positive restraint behavior (timing/protected lanes/objective progress) rather than only passive non-engagement. Replace the nearly binary grade outcome with an explainable breakdown across readiness/survival, restraint, efficiency, and chain; define severity for friendly fire clearly.

**Acceptance:** recorded/simulated early, mid, and late FY spawns/damage stay within a declared band and designed screen capacity; each weapon has a scenario where it is the useful/effective choice; range and ammo behavior match config/UI; no limited weapon fires at zero stock; ally state is identifiable before resolution; restraint can be earned through an active action; grade card attributes its result and one incidental friendly hit does not erase a strong run absent a stated severity rule; early-exit reward/grade is intentional and displayed.

**Relative cost:** L. **Dependencies:** Phase 0; Phase 2 economy definitions constrain weapon cost tuning.

### Phase 4 — Turn intermissions into planning, not waiting (P1)

**Purpose:** give inventory and delivery choices an understandable link to the next scenario.

**Files:** `src/scenes/ReadinessScene.ts`, `src/state/RunState.ts`, `src/game/CombatScenarios.ts`, `src/game/ProductionSystem.ts`, `src/state/RunState.test.ts` and readiness-focused tests.

**Work:** show active-theater inventory, reserve, queued deliveries and ETA, likely next scenario demand, and post-transfer results before confirming. Support deliberate transfer quantities rather than only fixed batches; show any readiness risk/cost in both directions and apply the same documented rule both directions. Surface available board selection as a usable progression reward in this planning period. Explain a no-transfer choice as a valid option.

**Acceptance:** a player can predict the resulting stock/readiness before confirming transfer; active, reserve, and queued stock are distinguishable; delivery arrival is visible and correctly allocated; transfer rules are symmetric or the intentional asymmetry is stated and shown; there is no stale inventory display after confirming; board selection is reachable without resetting campaign state.

**Relative cost:** M. **Dependencies:** Phase 1 and Phase 2.

### Phase 5 — Add replayable run structure and authored campaign callbacks (P2)

**Purpose:** make repeat runs teachable and campaign years feel like episodes in one escalating scandal.

**Files:** `src/state/RunState.ts`, `src/game/CombatScenarios.ts`, `src/game/WaveDirector.ts`, `src/scenes/DoctrineScene.ts`, `src/scenes/EventScene.ts`, `src/scenes/PressReleaseScene.ts`, `src/helpers/PressReleaseGenerator.ts`, `src/helpers/NewsHeadlines.ts`, `src/game/Characters.ts`, `src/scenes/LeaderboardScene.ts`, `src/game/PinballBoards.ts`.

**Work:** add a persisted run seed and route relevant random selection through it so scenario/event/wave behavior can be reproduced. Show the seed and useful dimensions in the run recap/leaderboard. Make current event cards offer at least two clear tradeoffs and carry a small consequence or callback into later years. Extend scenario `threatBias` into distinct authored mixes/objectives; inspect its existing CombatScene spawn integration before changing the director; give each board a ruleset/mechanic that fits its name, within Phase 1's small scope. Expand character appearances at existing natural beats before writing a large cast bank. Ensure headlines, press releases, and hearing dialogue derive from real run metrics and avoid immediate repeats. Record a few reliable flags/metrics (allied contacts spared/hit, overspend, delays, audit/effect choices) for later callbacks. Only then add optional commendations for restraint, efficiency, delay, and overmatch as alternate replay goals.

**Proposed dialogue/copy examples** (new copy, not implemented):

- Threat briefing: “Unidentified object assessed as a strategic opportunity. Procurement requests a larger radar.”
- Overkill result: “THREAT NEUTRALIZED. COST PER THREAT: CLASSIFIED.”
- Low readiness: “Readiness is down to 12%. The dashboard has been rotated to landscape.”
- Delivery update: “The capability is in transit. The paperwork has arrived.”
- Overspend press release: “The 11th interceptor was used against balloons. Officials call the expenditure ‘precedent-setting.’”
- Hearing choice: “Protect the audit trail” (less profit, higher readiness confidence) or “Reclassify the discrepancy” (more contractor margin, more audit pressure next FY).
- Mansion reveal: “Residence complete. Its defensive perimeter is larger than the neighboring municipality.”

**Acceptance:** given a seed, scenario/event selection and authored wave choices reproduce; the seed is visible in a recap; hearings provide two understandable options with stated tradeoffs and one effect is observable later; scenario threat mix/objective differs measurably; press release references true run events/metrics; content avoids a recently used headline/template and does not repeat the same callback back-to-back; optional commendations are deterministic and don't replace mansion score.

**Relative cost:** L. **Dependencies:** Phases 2–4 so callbacks refer to trustworthy outcomes and choices.

### Phase 6 — Shared presentation and accessible feedback (P3)

**Purpose:** make the authored game feel like one readable product across campaign scenes and input modes.

**Files:** `src/style.css`, `index.html`, `src/scenes/TitleScene.ts`, `src/scenes/DoctrineScene.ts`, `src/scenes/CombatScene.ts`, `src/scenes/ReadinessScene.ts`, `src/scenes/MansionScene.ts`, `src/scenes/EventScene.ts`, `src/scenes/PressReleaseScene.ts`, `src/scenes/LeaderboardScene.ts`, `src/pinball3d/pinball.css`, `src/managers/GameSettings.ts`, and relevant UI helpers.

**Work:** define a compact visual system (palette, type scale, spacing, panels, buttons, icon treatment, pressed/selected/disabled/focus) and apply it to primary flows. Audit asset path/load behavior before adding asset volume. Make action feedback name the result (intercept/leak/jam/ally incident), ammo/cost, objective progress, and consequence; retain critical info long enough to read. Add reduced-motion behavior that removes nonessential looping/shake but preserves meaning. Add semantic DOM controls/status announcements for primary navigation, settings, and key actions where canvas semantics are insufficient. Revisit viewport zoom/touch suppression with keyboard, screen-reader, and mobile testing. Make orientation behavior explicit and touch targets safe after responsive scaling.

**Acceptance:** all primary screens have a consistent action hierarchy and no control/text clipping at target viewports; primary hit areas are at least 44 CSS px where practical; normal text contrast ≥4.5:1 and large text ≥3:1; main navigation/settings and key actions work with keyboard alone and have visible focus/accessibility names/states; critical state is not color-only; TalkBack/desktop screen-reader status and reduced-motion checks pass; action feedback has an equivalent in quiet/reduced-motion modes.

**Relative cost:** L. **Dependencies:** Phase 0 captures; Phase 3 outcome taxonomy. Keep visual iterations small and review each against before/after captures.

### Phase 7 — Device performance and stability gate (P3)

**Purpose:** establish that presentation and physics remain usable on actual target hardware.

**Files:** `src/scenes/CombatScene.ts`, `src/pinball3d/Procurement3DGame.ts`, `src/pinball3d/PinballPhysics.ts`, `src/main.ts`, Android/Capacitor packaging as needed, and evaluation notes.

**Work:** profile dense combat, repeated scene transitions, procurement, background/resume, resize/orientation, context loss, audio interruptions, and memory on named physical mid-range Android and iOS targets where available. Change DPR/shadows/effect density/pooling only where the profile points to a bottleneck. Do not treat desktop emulation or headless physics as mobile or feel evidence.

**Acceptance:** name hardware/browser/WebView and capture frame interval distribution: procurement p95 ≤20 ms and p99 ≤33.4 ms on agreed target; combat meets a declared target during dense FX; touch-to-visible-response p95 ≤50 ms; a 30-minute representative WebView run has no crash or monotonic memory growth; controls never stick through pause/background/resize; no required asset-load errors. If hardware availability prevents an acceptance measurement, mark it unverified rather than passing by inference.

**Relative cost:** M–L. **Dependencies:** stable Phases 1–6; physical devices.

### Phase 8 — Content and estate breadth (P4)

**Purpose:** extend variety only where a real mechanic or visual milestone supports it.

**Files:** `src/game/CombatScenarios.ts`, `src/game/config.ts`, `src/game/Characters.ts`, `src/game/PinballBoards.ts`, `src/data/mansions.ts`, `src/game/MansionSystem.ts`, `src/scenes/MansionScene.ts`, `src/scenes/PreloaderScene.ts`, and `public/assets/`.

**Work:** add scenario-specific nuisance/false-positive threats and occasional administrative “boss” encounters only when they create a distinct decision. Expand mansion/development variants and infrastructure through data-driven thresholds, preserving McLean accumulation as the visual score. Make board art and mechanics match. Expand characters through reactive, state-specific moments rather than sheer line count. Budget texture atlas/load size and aggregate older estate visuals if needed. Add assets in order of gameplay need: weapon/threat readability, board indicators, estate payoff, character portraits.

**Acceptance:** each added scenario/board changes at least one measured decision/objective, not only its label; content uses validated data and has coverage for unlock/effect conditions; each mansion milestone is visible and attributable to a campaign reward; loaded asset inventory has zero broken paths and fits agreed initial-load budget; no repeated line within a short cooldown; five-player sessions show that added variety is noticed and understood.

**Relative cost:** L–XL depending on asset production. **Dependencies:** Phases 5–7 and playtest evidence.

## First vertical slice: one complete, reconcilable fiscal year

Implement Phases 1 and 2 as one thin end-to-end slice, with only the minimum readiness UI needed to use its result. Start from a fresh save, select a doctrine and a mechanically distinct unlocked board, play one combat wave, see readiness/inventory changes, play procurement, explicitly settle one contract, see its value/units/date/destination, then reach the next year and see the delivered stock in an actual loadout/readiness choice. Preserve a visible ledger tying the combat spend, procurement spend/profit, delivery queue, mansion threshold, and next-year stock together. This slice should not add new characters, a dozen targets, new campaign currencies, or broad asset production.

**Slice gate:** board selection is persisted and changes active mechanics; contract settlement happens exactly once; leaving/return semantics are explicit; all ledger values reconcile; at least one delivered item changes a real next-year decision; existing save migration works; focused tests cover authorization/delivery/selection; a browser walkthrough is recorded at phone-sized viewport. This gate establishes plumbing and trust before combat balance or content expansion.

## Cross-cutting risks and controls

| Risk | Control |
| --- | --- |
| More features obscure the satirical premise | Require each addition to sharpen the link among decision, official rationale, and outcome; preserve deadpan specificity and target institutions/incentives. |
| Accounting changes double-count or erase rewards | Define mutation/settlement boundaries first; use idempotency and reconciliation tests; maintain one per-FY result. |
| New progression UI masks dead rewards | End-to-end acceptance requires each unlock to change the active 3D game or be removed/disabled. |
| Balance changes interact across wave, weapon, readiness, and contract systems | Tune them in dependency order; record early/mid/late seeded runs and compare before/after. |
| Content volume increases repetition or load time | Prefer reactive templates over huge static banks; add no-repeat cooldowns and measure asset/load budgets. |
| Canvas-only UI excludes players or shrinks at mobile sizes | Test physical CSS size, keyboard, TalkBack, contrast, focus, zoom, safe areas, and reduced motion. |
| Performance criteria are inferred from desktop | Name real devices and preserve frame/memory evidence; mark unavailable checks open. |
| Parallel edits conflict with in-progress work | Inspect current working tree and audit edits before touching shared files; do not revert or overwrite unowned changes. |

## Verification approach

- **Automated:** add focused tests alongside each phase for selected board persistence/behavior; exactly-once procurement settlement, queue delivery and allocation; seeded scenario/event selection; weapon ammo/range; wave bounds; grade breakdown; old save migration; and any added data validation. Run the project build and relevant test suite after implementation. No tests were run for this planning artifact.
- **Browser flow:** exercise fresh campaign → combat → readiness → board selection → procurement → settlement → mansion/event/press release → next-year stock use; repeat with cancellation, reload, legacy save, and each board.
- **Visual/accessibility:** capture the same target viewports before/after; keyboard-only and screen-reader status passes; contrast, focus, safe-area and reduced-motion checks.
- **Physical-device:** report exact model, OS, WebView/browser, orientation and DPR; record frame intervals, input latency, crash/log output and memory through a representative session and repeated transitions.
- **Playability:** after mechanical gates stabilize, observe at least five first-time players on phones and five on desktop through two runs. Record first-shot time, accidental ally hit, control misfires, year-one completion, choice comprehension, procurement duration, and whether players can explain how a contract affected the next year. Treat this as new evidence, separate from audit/source inspection.

## Decision and scope guardrail

Do the smallest change that closes the highest-priority broken promise. First reconnect board unlocks and make procurement settlement/accounting visible and consequential. Then make combat/intermission choices fair and understandable. Add reactive campaign writing, unified presentation, and content breadth only after those systems produce trustworthy facts for the jokes to reference. Keep the mansion payoff and procurement satire central; do not replace the core loop with generic upgrade trees, decorative unlocks, or jokes that have no visible gameplay consequence.
