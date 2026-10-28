# Procurement 3D pinball implementation plan

Status (2026-10-28): the Three.js + Rapier procurement implementation is in place. The sequence below is retained as a record of the implementation and remaining acceptance work, rather than a proposed build plan. Latest recorded verification is 129 tests across 16 files plus a passing production build; device and player-study gates remain open. Branch: `procurement-3d-pinball`.

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

1. **Host, scale and table — implemented.** The Phaser host enters the async Three/Rapier game; shared geometry and board selection feed the renderer and physics. Physics runs at 120 Hz. Actual incline, launch, drain and airborne ball motion are covered in automated tests.
2. **Geometry and board variants — implemented.** Each `BoardLayout` generates shared visual/physical parts. Three layouts vary upper-playfield bumper placement and contract-award location while tests protect the common shooter, ramp, flippers, drain and lower geometry.
3. **Playable procurement slice — implemented.** The table includes flippers, bumpers, targets, ramp, teleport features, plunger, drain and local scoring. Contract authorization settles once through `ProcurementSystem`; UI reports authorized units, cost, profit and delivery fiscal year. Settlement and delivery behavior have regression coverage.
4. **Input, presentation and lifecycle — implemented in code; manual device checks remain.** Touch/keyboard controls, board switching, pause and disposal exist. Device/WebView lifecycle and touch latency evidence are still needed.
5. **Remaining acceptance work.** Complete physical-device performance, comparative Planck measurements, independent authoring exercise, player fun/readability study, and remaining manual lifecycle checks. Track evidence and open gates in [evaluation](PINBALL_3D_EVALUATION.md).

Steps 3–5 are sequential physics prerequisites. Art asset preparation and fixture design may run independently after component contracts are stable. One owner integrates host lifecycle and performs final verification; do not split the same component's mesh and collider between independent owners.

## Verification and decision

Use `pnpm exec vitest run` and `pnpm run build` for current regression/type checking. The repository has no dedicated lint script; report that gap instead of claiming lint passed. Add focused geometry, rules-event, flipper-feed and lifecycle tests during implementation, plus browser/WebView checks. Do not treat a headless physics pass as mobile/render/playability evidence.

The automated implementation gates pass at the latest recorded revision. Physical-device, comparative and fun gates in [evaluation](PINBALL_3D_EVALUATION.md) are not yet complete; do not mark the comparative study or release readiness complete until their evidence is recorded.

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
