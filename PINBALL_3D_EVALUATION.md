# Procurement 3D evaluation

Status: **implemented; verification in progress, not a completed comparative study** (2026-09-12). The branch now uses Three.js 0.186.0 and Rapier 0.20.0. The original protocol below remains the longer-term evaluation target.

Current evidence: 14 actual Rapier tests cover the deck, seven launch strengths clearing the shooter exit, both flippers, wall containment, an elevated ramp completion and drain lifecycle. The full suite passed 94 tests before the latest obstacle additions. A headless Chrome playthrough earned contract value and advanced committee votes; a separate touch gesture successfully pulled and released the plunger. Captures confirmed a table-dominant 430×932 layout with invisible flipper zones, original-inspired green/star/chrome/cyan art, and a complete raised title plaque. No physical-phone performance or five-player fun study has been completed. Software-rendered Chrome frame rates are not mobile-hardware evidence.

The latest visual pass adds an Urgent Need bumper, Audit/Classified/Black Budget targets and rubber posts. End-of-pass verification is recorded in the task handoff; do not infer that the original evaluation matrix is fully passed.

## Comparison protocol

Capture Planck and 3D revisions, uncommitted changes, recipe, package versions, physics settings, device/OS/browser/WebView, resolution/DPR and effect tier. Use the same device and comparable single-ball workload, alternate order, warm up two minutes then record three ten-minute runs. Existing multiball is a separate stress case, not a reason to inflate the minimum slice.

| Dimension | Current evidence | 3D experiment / pass condition |
| --- | --- | --- |
| Agent editability | Typed kit factories and recipes exist | Independent agent changes curve radius and ramp rise/bank in ≤30 minutes with no generated geometry edits; record time and files for both modes |
| Rail authoring | Shared 2D geometry utilities exist | Ten curve variations regenerate both representations; structural deviation ≤1 mm, no missing collider segments |
| Ramp authoring | Channel tests and explicit assist/eject state exist | 100 valid entry feeds at documented energy/angle envelope: ≥95 complete physically; all low-energy feeds roll back without teleport/path assist |
| Visual/physics alignment | Painted skin plus physics output | Parameter/transform/material edits retain tolerance; dynamic visual alignment measured at physics snapshots, excluding deliberate render interpolation |
| Physics quality | Existing regression tests, fresh results pending | 1,000 feeds across rail/ramp/flipper cases at 4/8/12 m/s: zero escapes through solid geometry, NaNs or unintended drains; characterize 18 m/s separately |
| Flipper feel / fun | Touch, skill-shot and contract feedback code exists | Both variants tested; ≥4 of 5 players rate control ≥4/5 and no worse than Planck; ≥3 prefer replaying 3D after counterbalanced sessions |
| Art flexibility | Painted editorial aesthetic and assets exist | Replace skin without physics edits; ≥4/5 players identify elevated route and tracked ball position in phone captures; target silhouette remains clear with effects disabled |
| Mobile performance | Fresh device profile pending | Sustained 60 FPS target: median frame interval ≤16.9 ms, p95 ≤20 ms, p99 ≤33.4 ms; physics p95 ≤4 ms per rendered frame at selected tick rate |
| Code complexity | Scene, physics, kit and rules already separated partly | Record handwritten LOC/files, cross-layer imports, dependency bytes, generated geometry size and tuning parameters; zero mechanics imports of campaign/Phaser |
| Development speed | Baseline edit exercise pending | Compare time to first successful rail/ramp edit and time to diagnose a seeded seam failure; report failures and assistance, not only successful trials |
| Maintainability | Regression suites already present | Tests validate specs, lifecycle, event idempotency and authoring edits; another agent can reproduce a failure from saved fixture and docs |

These are proposed acceptance thresholds. If a device cannot meet them, report a failed gate; do not silently redefine stable 60 FPS. Name the available representative mid-range Android device (OnePlus 6T is referenced by the earlier roadmap, availability unverified). Include mobile Safari if iOS/browser support will be claimed; Android results do not establish iOS support.

## Required fixtures and manual checks

- Geometry: zero-length paths, tight curves, rapid banking, transformed components, minimum underpass/side clearance, ramp seams and invalid edits retaining previous geometry.
- Flippers: identical seeded feeds at both 60/120 Hz; angle/velocity traces, landing distribution, catches, weak taps, reversals, tip/base hits and impact against held bat. Twenty feeds per maneuver/variant/rate minimum.
- Sensors: fast and reverse crossings, overlaps across multiple colliders, repeated contact, ball removal and restart; exactly one logical completion/drain per valid lifecycle. Use swept segment queries if overlap events miss thin triggers, without moving the ball.
- Input: both flippers plus plunger, pointer dragged across midpoint, release outside, pointer cancellation, HUD taps, pause/background and resize; response by next simulation step, no stuck control. Measure touch-to-visible-response p95 ≤50 ms with device video where possible.
- Host: 20 enter/play/exit cycles, exit during WASM loading, failed import, offline packaged launch and context loss. No orphan mode canvases/listeners/RAF loops or duplicate campaign changes. After warmup/disposal, memory should plateau rather than grow monotonically; record browser/GPU measurement limitations.
- Fun: five players, two three-ball sessions per version, counterbalanced order. Record drain timing, intentional ramp attempts/completions, fairness, responsiveness, replay preference and visual readability. Short ball saves count as assistance and cannot satisfy unassisted ramp tests.
- Regression: existing Vitest suite and TypeScript/Vite build, then browser scene flow and Android WebView smoke tests. No claim of mobile performance from desktop emulation.

## Results log

| Experiment | Revision/device/config | Evidence artifact | Result |
| --- | --- | --- | --- |
| Existing Planck baseline | Pending | Pending | Not run in this documentation task |
| Rail/ramp geometry and feeds | Pending | Pending | Not implemented |
| Physical versus kinematic flipper | Pending | Pending | Not implemented |
| Mobile CPU/GPU/input | Pending | Pending | Not measured |
| Independent authoring exercise | Pending | Pending | Not run |
| Art and fun comparison | Pending | Pending | Not run |
| Host lifecycle / campaign adapter | Pending | Pending | Not implemented |

Store future traces/screenshots under an explicitly named evidence location and link each result here. Include failures, test counts and package/configuration changes. No invented scores or placeholder PASS labels.

## Migration decision

Current recommendation: complete the Three.js + Rapier cutover on this branch. Merge only after geometry, unassisted ramp, flipper, mobile, authoring, lifecycle and campaign integration gates pass. If evidence rejects the migration, do not merge this branch; `main` remains unchanged. Expanding the construction kit beyond the vertical slice is subsequent work.
