# Procurement 3D planning entry

## Current status — 2026-10-28

The migration is implemented in the current working tree; “migration implementation pending” below is historical. Current code includes the Three.js + Rapier procurement route, a selectable/unlock-aware board flow, explicit authorization/discard settlement, and three board geometry/rule variants with shared shooter lane, ramps, and lower playfield. Automated/build snapshot: 129 tests across 16 files, including 33 focused geometry/physics tests; production build passes with a large-chunk warning. Headless smoke stalled. Physical-device performance and human-play validation remain open. See the canonical implementation and evaluation docs for the remaining evidence gates.

Canonical tracked plan: [PINBALL_3D_IMPLEMENTATION_PLAN.md](../../PINBALL_3D_IMPLEMENTATION_PLAN.md).

Architecture: [PINBALL_3D_ARCHITECTURE.md](../../PINBALL_3D_ARCHITECTURE.md).
Evaluation: [PINBALL_3D_EVALUATION.md](../../PINBALL_3D_EVALUATION.md).
Research: [PINBALL_3D_REFERENCES.md](../../PINBALL_3D_REFERENCES.md).

Decision: Three.js + Rapier 3D, TypeScript, as the procurement implementation on this branch. Godot proposal superseded. Planck remains on `main` as comparison/rollback reference. Preserve pre-existing work.
