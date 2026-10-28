# Implementation Tasks

## Current sprint status — 2026-10-28

The current implementation delivers three gameplay priorities: (1) procurement exactly-once authorization, discard behavior, active-stock handling, and board-specific rules plus geometry; (2) combat grading, early-exit handling and weapon-range behavior; and (3) persisted seeded randomness, saved event choices, reactive press releases and commendations. Automated verification passes (129 tests / 16 files, focused geometry 33 tests, production build and `git diff --check`). This establishes code and regression coverage only. Human playtesting and real-device validation are still pending. See [`dev-status.md`](./dev-status.md) for evidence and gates.

### Completed in code / automated coverage

- [x] Implement procurement exactly-once authorization/discard behavior, active-stock handling, and board-specific rules and geometry with regression coverage.
- [x] Implement combat grading, early-exit handling and weapon-range behavior with regression coverage.
- [x] Persist seeded random state and event choices; implement reactive press releases and commendations with regression coverage.
- [x] Provide three selectable procurement boards with distinct layout geometry generated for rendering and physics.
- [x] Verify automated suite: 129 tests across 16 files.
- [x] Verify focused procurement geometry suite: 33 tests.
- [x] Verify `npm run build` and `git diff --check`.

### Pending evidence and follow-up

- [ ] Hands-on browser playtest across several combat waves and all three boards; record game feel, balance and runtime errors.
- [ ] Device/WebView validation for touch, resize/orientation, background/resume and repeated disposal.
- [ ] Measure real-device startup and frame time against the mobile target.
- [ ] Complete and record the integrated Combat → Readiness → Procurement → Mansion campaign loop.
- [ ] Update acceptance status only after the corresponding human/device gate has evidence.

## Sprint summary

- **Sprint 0 — Graybox Combat Prototype:** Base project and combat scene exist. The initial prototype checklist below is retained as historical scope; current status is evidenced by the completed work above and remaining playtest gates.
- **Sprint 1 — Combat Vertical Slice:** Core combat/wave and weapon variety work is implemented and covered by current regression tests. Subjective combat acceptance remains pending playtesting.
- **Sprint 2 — Readiness & Replacement:** Run state, theater, production and readiness systems are implemented; current automated coverage passes. Full integrated campaign acceptance remains pending.
- **Sprint 3 — Procurement Pinball:** Three.js + Rapier implementation and three distinct board geometry layouts are present and automated geometry/physics tests pass. Human playability and device gates remain pending.
- **Sprint 4 — Complete Vertical Slice:** Code path exists, but full loop remains pending hands-on end-to-end validation.
- **Sprints 5–9 — Content, polish and hardening:** Continue only after recording the remaining gameplay and device evidence; inspect the codebase and acceptance criteria before reopening individual items.

## Historical roadmap — 2026-08-27 / 2026-09-11

The checkbox lists below preserve the original project roadmap and planning record. Their unchecked state is not a statement that no implementation exists. In particular, old notes that there were no tests or that Procurement still crashed are superseded by the current status above; they describe an earlier snapshot only. Consult current evidence before treating any historical checkbox as active work.

### Original project milestones

#### Sprint 0: Graybox Combat Prototype
- [x] Initialize project with Vite, TypeScript, and Phaser.
- [x] Implement responsive portrait scaling.
- [x] Create combat scene and basic threats/weapons.
- [x] Implement targeting, collision and overmatch calculations.
- [x] Add basic HUD and wave/results flow.
- [ ] Verify mobile browser performance on device.

#### Sprint 1: Combat Vertical Slice
- [ ] Verify all threat behaviors and decoys against current design.
- [ ] Verify weapon unlocks and balance in a hands-on session.
- [ ] Verify escalation and Procurement Pressure feel.
- [ ] Complete visual/audio/haptics polish.

#### Sprint 2: Readiness & Replacement
- [x] Implement RunState and theater management.
- [x] Implement readiness and transfer interactions.
- [x] Implement production queues and replenishment logic.
- [ ] Validate meaningful readiness thresholds and shortages in play.

#### Sprint 3: Procurement Pinball
- [x] Implement Three.js + Rapier procurement path and selectable boards.
- [x] Add varied board geometry with shared geometry data for rendering and physics.
- [ ] Complete hands-on playability evaluation and device measurements.

#### Sprint 4: Complete Vertical Slice
- [x] Connect campaign systems in code.
- [x] Implement mansion/campaign destinations and persistence systems.
- [ ] Verify full loop manually in browser and on device.

#### Sprint 5–9: Content, polish & hardening
- [ ] Validate doctrine, random events and difficulty progression during play.
- [ ] Complete achievements/ranks and final art/audio passes as prioritized.
- [ ] Finish mobile hardening and balance tuning from playtest evidence.
