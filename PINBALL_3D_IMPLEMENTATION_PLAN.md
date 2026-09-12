# Procurement 3D pinball implementation plan

Status: proposed implementation, 2026-09-11. Branch: `procurement-3d-pinball`.
This document supersedes the Godot proposal and the procurement portion of the older major-game-improvements roadmap. This change delivers planning documents, not a working 3D prototype.

## Mission and boundaries

Replace the procurement pinball implementation on this branch with a mobile-first Three.js + Rapier 3D implementation inside the existing Vite/Phaser/Capacitor application. The Planck implementation on `main` is the comparison and rollback reference; it is not retained as a selectable mode on this branch. Do not replace combat, campaign state, persistence, or the application shell.

Prove that agents can construct, playtest, skin and decorate real table objects. One component specification must generate both visible structure and physical structure. Three.js and Rapier still have separate runtime representations: ownership and generation contracts, rather than the choice of engine alone, prevent drift.

Use WebGLRenderer initially, a fixed portrait camera, a dynamic spherical Rapier ball, real table inclination, and ordinary TypeScript factories. No Godot runtime, GDScript, PackedScenes, React, general ECS, new editor framework, or WebGPU requirement. Add only Three.js, Rapier's selected 3D package and necessary Three.js typings during implementation; record exact compatible versions and licenses in the lockfile. No packages are installed by this documentation change.

Read [reference findings](PINBALL_3D_REFERENCES.md), [architecture](PINBALL_3D_ARCHITECTURE.md) and [evaluation protocol](PINBALL_3D_EVALUATION.md) before implementation.

## Existing baseline to preserve

- `src/scenes/ProcurementScene.ts:22` already joins Planck simulation, painted table rendering, controls and procurement presentation. Its touch handling around line 508 tracks pointer identity, and authorization around line 984 guards repeated submission.
- `src/game/ProcurementPlanckPhysics.ts:7` defines mechanical events. Its ramp recovery/ejection state around lines 37–44 exposes the special handling that actual elevation should make unnecessary.
- `src/game/pinballKit/geometry.ts:4` centralizes dimensions and channel clearance. Component factories and `recipes/appropriations.ts` are useful precedents for parameterized table construction, not code to discard.
- `src/game/PinballKit.test.ts:183` and `ProcurementPlanckPhysics.test.ts:238` cover playability/channel behavior. `ProcurementSystem.test.ts` covers scoring and authorization. Existing tests are evidence of coverage, not proof of current pass status or subjective feel.
- `src/game/ProcurementSystem.ts:1` imports `currentRun`; its scoring methods mutate campaign totals. It is not an isolated pure rules engine despite its comment. The experimental sandbox must not call it against the live campaign.
- `capacitor.config.ts:6` packages `dist`. Staying in TypeScript avoids a second native game runtime but still requires Android WebView/WASM and lifecycle validation.

The branch started with uncommitted source/art changes. Preserve those changes; do not reset, stash, or include them in a documentation commit without checking ownership.

## Delivery sequence and acceptance gates

1. **Baseline and reference record.** Run existing tests/build, record failures separately, and capture a playable Planck session and mobile measurements for comparison. Preserve fixture inputs, device/browser version and revision. Reference inspection is documented; implementation remains pending.
2. **Replacement host and loading spike.** Replace the procurement scene’s physics/render path with `src/pinball3d/`. Lazy-load Three.js and initialize Rapier asynchronously using the simplest Vite-compatible package; prefer `@dimforge/rapier3d-compat` initially and measure its payload. Prove production/offline Capacitor loading, pause/resume and cleanup before table construction. Test cancellation while WASM initializes and show a recoverable loading/error state.
3. **Scale, table and ball.** Implement shared geometry specs, inclined playfield, spawn/drain, fixed cameras and debug overlays. Compare 60/120 Hz physics at constant rendering quality. Do not lock the ball to a 2D plane. Gate: controlled release rolls downhill and airborne motion is possible without custom downhill forces.
4. **Flipper bake-off.** Build dynamic revolute-joint/motor and position-based kinematic variants behind the same component API. Test both with identical ball feeds and tick rates. Record aiming, taps, catches, impact response and input latency; choose on playability and measured stability.
5. **Curved rail and elevated ramp.** Derive mesh and collider geometry from one sampled path/frame set. Gate: edit radius/rise/bank through parameters, regenerate once, and pass alignment/clearance tests. A ball must enter, climb, cross above another reachable surface, and exit with physics alone. Failed low-energy climbs must roll back naturally. No ramp locks, teleport exits or path-following assist.
6. **Playable procurement slice.** Add two bumpers, target, sensor, physical gate, plunger, drain and two flippers. Use isolated local scoring. Three staged shots: launch skill shot, bumper inflation, target to light an elevated ramp bonus. Three balls, brief first-ball save and instant restart are rules-layer features; log any save separately from geometry success. Keep multiball and the remaining kit components deferred.
7. **Touch and art iteration.** Touch is present from the first playable build, then refined here. Add simultaneous flipper/plunger support, safe areas, pointer cancellation and keyboard parity. Apply editorial-cartoon materials, painted surface textures, emissive-looking inserts, readable elevation and restrained effects. Compare perspective/long-lens/orthographic cameras on a phone. Run visual-verdict against the chosen art/readability reference on each visual iteration and retain the verdict under `.omx/state/procurement-3d/ralph-progress.json`.
8. **Mobile and authoring evaluation.** Execute the quantitative protocol, compare against Planck, and have another agent perform the same rail/ramp edit without touching generated mesh/collider code. Stop feature expansion if fundamental ramp/flipper tests fail. Publish measurements, traces and unresolved issues in the evaluation document.
9. **Campaign integration and cutover.** Reuse existing procurement arithmetic through a narrow tested adapter, preserving its mutation semantics and exactly-once authorization. Test full readiness → 3D procurement → mansion flow, reload, cancellation and return. Cut over the branch’s procurement route to 3D once the gates pass; rollback means reverting the branch commit or returning to `main`, not shipping two selectable implementations.

Steps 3–5 are sequential physics prerequisites. Art asset preparation and fixture design may run independently after component contracts are stable. One owner integrates host lifecycle and performs final verification; do not split the same component's mesh and collider between independent owners.

## Verification and decision

Use `pnpm exec vitest run` and `pnpm run build` for current regression/type checking. The repository has no dedicated lint script; report that gap instead of claiming lint passed. Add focused geometry, rules-event, flipper-feed and lifecycle tests during implementation, plus browser/WebView checks. Do not treat a headless physics pass as mobile/render/playability evidence.

All mandatory gates in [evaluation](PINBALL_3D_EVALUATION.md) must pass before merging this branch. If 3D improves authoring but misses mobile or fun gates, reduce geometry/render cost and repeat the failing measurements; if the hypothesis still fails, do not merge and document the reason against the Planck baseline.

## Principal risks

| Risk | Mitigation |
| --- | --- |
| Separate rendering and physics drift again | One validated spec/sample set, generated outputs, alignment tolerance tests; no manual collider edits. |
| WASM payload/startup or WebView failure | Early production/offline loading gate; lazy import, cancellation and a recoverable error state before cutover. |
| Two engines consume mobile resources | Pause/hide Phaser while mode owns input; measure retained context memory; dispose mode on exit. |
| Kinematic flippers miss swept contacts | Compare physical motor variant, tick frequency and CCD using repeatable feeds; do not assume CCD solves rotation. |
| Ramp seams catch the ball | Bounded segmentation, continuous tangents, seam sweeps and rollback tests before art. |
| Campaign gains awarded twice | Local sandbox initially; characterize currentRun mutations and add adapter idempotency tests before integration. |
| Construction kit delays fun | Build slice components first, defer unused mechanics and editor features. |

## Decision record

Choose Three.js + Rapier because this branch is the procurement 3D migration target in an existing web application and TypeScript can preserve its integration and testing model. Godot would add a second runtime/toolchain; continuing Planck cannot prove real elevation. The cost is explicit browser lifecycle management and building a small authoring/debug surface. Merge only after the evidence gates pass.
