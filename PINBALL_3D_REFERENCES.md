# Pinball 3D reference findings

Inspected 2026-09-11: repository pages/readmes and linked official architecture/API documentation. These are architectural observations, not runtime benchmarks or exhaustive source audits. No external code, models or textures were copied. The original Godot direction has been superseded by Three.js + Rapier for the procurement migration on this branch.

| Reference | Observation and adaptation | Boundary |
| --- | --- | --- |
| [Demolishun/GodotPinballMachine](https://github.com/Demolishun/GodotPinballMachine) | Root separates board, controls, levels, moving_objects and textures. Keep similarly discoverable mechanics/input/table/assets boundaries in TypeScript. | Learning project; no root license shown in inspected listing. Do not copy assets/code without verified permission. |
| [VPE](https://github.com/freezy/VisualPinball.Engine) | Unity toolkit with table authoring and custom pinball simulation. Primary architectural reference, not our runtime or physics port. | Repository declares GPL-3.0; no source copying. |
| [pinball-construction-kit](https://github.com/freezy/pinball-construction-kit) | README identifies an unmaintained 2015 Unreal project; Content/Source/Config organization reinforces separation of authored content and runtime. Use construction-kit composition as inspiration only. | MIT stated in repository; no assets/code imported and no Unreal architecture adopted. |
| [libre-pinball](https://github.com/Calinou/libre-pinball) | Historical Godot project separates scenes/scripts/resources/media and exposes launcher, paddles, restart and FPS controls. A useful reminder to keep a small table immediately playable/debuggable. | Old engine.cfg project; not a modern foundation. Inspect per-asset licenses before any future reuse. |

## VPE lessons that shape this plan

[Unity Components](https://docs.visualpinball.org/creators-guide/editor/unity-components.html) separates item identity, generated meshes, colliders and animation. Adapt that ownership with a typed component spec generating both Three meshes and Rapier shapes; avoid introducing a generic component framework.

[Flippers](https://docs.visualpinball.org/creators-guide/manual/mechanisms/flippers.html) exposes physical tuning and procedural/custom meshes. Its custom-mesh warning is critical: replacing visuals can still leave old colliders. Our replacement skins must preserve structural dimensions or regenerate both representations. 3D alone does not prevent drift.

[Gamelogic Engine](https://docs.visualpinball.org/creators-guide/manual/gamelogic-engine.html) distinguishes rules decisions from mechanical simulation. Our mechanical events feed local rules and eventually a procurement adapter. [Wire Manager](https://docs.visualpinball.org/creators-guide/editor/wire-manager.html) highlights direct control paths and flipper lag; our input reaches mechanisms before UI/rules processing.

## Browser-native implementation references

[Three.js documentation](https://threejs.org/docs/) provides curves, procedural geometries, scene objects and perspective/orthographic cameras. The design uses these as rendering building blocks; the shared sampler is our explicit alignment contract.

[Rapier getting started](https://rapier.rs/docs/user_guides/javascript/getting_started_js/) documents asynchronous WASM initialization. Prove Vite production and Capacitor offline loading before table work. [Rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/) documents dynamic and kinematic behavior; use that distinction for the flipper bake-off. [Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/) provides primitive/mesh shapes, sensors and interaction groups. Keep shape complexity low and validate event/group behavior in tests.

Exact package versions remain to be selected and pinned at implementation. This research does not establish performance, flipper quality, or release readiness.
