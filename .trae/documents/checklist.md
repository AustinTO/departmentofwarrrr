# Quality Assurance Checklist

## Current automated QA — 2026-10-28

- [x] Full automated suite passes: 129 tests across 16 files.
- [x] Focused procurement geometry suite passes: 33 tests.
- [x] `npm run build` passes.
- [x] `git diff --check` passes.
- [x] Three board layouts exercise distinct geometry while preserving protected shared geometry.
- [x] No dependencies added in this update.
- [ ] Hands-on browser playtest completed and recorded.
- [ ] Real-device/WebView touch and lifecycle validation completed.
- [ ] Real-device startup and frame-time measurements recorded.
- [ ] Full campaign loop exercised manually and recorded.

Headless automated results do not establish playability, mobile performance, touch quality, or lifecycle behavior. A previous headless smoke attempt stalled and does not count as end-to-end verification. See [`dev-status.md`](./dev-status.md) for the current status and next actions.

## Feature acceptance gates

### Gameplay

- [ ] **Gate A:** Combat is fun as a standalone arcade experience (human playtest required).
- [ ] **Gate B:** Stockpile shortages create meaningful strategic decisions (human playtest required).
- [ ] **Gate C:** Procurement pinball is mechanically satisfying on each board (human playtest required).
- [ ] **Gate D:** The full loop creates a compelling “one more year” drive (human playtest required).

### Procurement geometry and physics

- [x] Shared geometry and physics regression tests pass for current board layouts.
- [ ] Compare physical/kinematic flipper approaches with matched feeds and player trials.
- [ ] Validate multitouch, loading cancellation, background/resume and repeated disposal on a device/WebView.
- [ ] Record device frame-time and independent authoring evaluation.
- [ ] Verify integrated campaign flow manually before release/cutover acceptance.

### UI, accessibility and performance

- [ ] Confirm portrait layout and responsive scaling on target devices.
- [ ] Confirm touch controls at varied screen sizes and safe areas.
- [ ] Review satirical art readability across all board layouts.
- [ ] Review pause, sound/haptic/shake toggles and color-blind indicators.
- [ ] Measure frame time, memory and scene cleanup during device play.

## Historical QA notes — 2026-08-27 / 2026-09-11

Earlier QA entries reported no automated tests and an unresolved Procurement runtime crash. Those statements describe the August-era implementation and are superseded by the current automated results above; they are not current findings. The September 3D evaluation gates remain useful for human/device acceptance, but their old “implementation pending” status is historical. Current unverified gates are listed unchecked above.
