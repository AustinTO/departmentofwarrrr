# Development Status

## Current status — 2026-10-28

The current working tree delivers three gameplay priorities in code: (1) procurement exactly-once authorization, discard behavior, active-stock handling, and board-specific rules plus geometry; (2) combat grading, early-exit handling and weapon-range behavior; and (3) a persisted seeded random stream, saved event choices, reactive press releases and commendations. Regression tests cover these systems. These are code-complete to the extent covered by automated coverage; player feel and device behavior remain unverified.

The procurement board selector now builds three board layouts (`appropriations`, `audit_chamber`, `supplemental_stadium`) with changed bumper/feature placement and shared render/physics geometry. Geometry tests cover diversity while preserving protected geometry. This is a tested geometry result, not evidence of human playability or mobile performance.

## Verification evidence

- Full automated suite: **PASS — 129 tests across 16 files**.
- Focused procurement geometry suite: **PASS — 33 tests**.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- No dependencies were added for this work.

These results are automated/headless verification. No hands-on gameplay session or mobile/device validation has been completed. A prior headless smoke attempt stalled; it is not a passing end-to-end result. In particular, do not infer that the full Combat → Readiness → Procurement → Mansion loop, touch controls, runtime lifecycle, subjective game feel, or device frame rate have been verified.

## Done in code; further evidence pending

- Procurement exactly-once authorization and discard paths, active-stock handling, and board-specific rules/geometry.
- Combat grading, early-exit handling and weapon-range behavior.
- Persisted seeded randomness, saved event choices, reactive press releases and commendations.
- Three procurement board layouts and shared physical/visual geometry diversity.
- Automated regression and geometry coverage, production build, and whitespace validation.

## Remaining gates / next actions

1. Run a hands-on browser play session through multiple combat waves and all three procurement boards; record usability, balance and any runtime errors.
2. Validate touch interaction, orientation/resizing, background/resume and disposal on a real mobile device or representative WebView.
3. Measure device frame time and startup/loading behavior; compare to the project’s mobile target.
4. Complete and record the integrated campaign loop, including contract completion and return to the campaign.

Keep code-completion and these human/device gates separate in sprint reporting. No current acceptance claim should exceed the evidence above.

## Historical note — 2026-08-27 / 2026-09-11

Earlier notes described a Planck-era graybox and a Procurement crash, and the September migration plan described the Three.js/Rapier work as proposed. Those entries are historical snapshots and are superseded by the current implementation and verification state above. They remain useful as history, not as current blockers or proof of current playability.
