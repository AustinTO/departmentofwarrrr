# Procurement 3D architecture

Status: implementation now lives in `src/pinball3d/` (2026-09-12). `table.ts` owns shared shape data; `PinballPhysics.ts` owns Rapier; `TableView.ts` renders those shapes and decoration; `Procurement3DGame.ts` owns input/HUD/rules; the small Phaser `ProcurementScene` owns campaign navigation. The remaining sections describe the original design targets where not superseded here.

Current controls: invisible lower-left/right touch zones, a visible physical plunger dragged downward and released, A/D or arrows for flippers, Space held/released for keyboard launch, P/Escape pause and F2 debug. Touch roles stay attached to pointer IDs; cancellation releases them. The canvas occupies most of the phone screen with a compact scoreboard and status strip. Original green enamel, military star, chrome edges, cyan ramp guards and a raised title plaque are built around actual 3D geometry. Ramp flooring is a generated indexed static trimesh with internal-edge correction, not separate convex floor tiles; guards and structure remain simple hulls/primitives. Physics runs at 120 Hz with CCD and explicit tolerances; mobile profiling remains outstanding.

## Ownership and layout

Use `src/pinball3d/{components,geometry,physics,tables/procurement,rules,host,input,render,debug,tests}` and `public/assets/pinball3d/{textures,models,audio}`. Create folders when needed. Generic components never import campaign state, Phaser scenes, or procurement labels. Procurement recipes provide IDs, transforms, parameters and art bindings.

`PinballMode` owns its Three scene/camera/renderer, Rapier world/event queue, components, input, rules and disposal. A small host adapter owns entry/exit from Phaser. Components are TypeScript factories, not separate authored physics and artwork files:

```ts
// Contract sketch; concrete engine types are selected during implementation.
interface ComponentSpec {
  id: string;
  kind: string;
  position: readonly [number, number, number]; // metres, table-local
  rotation: readonly [number, number, number, number]; // quaternion
}
interface PinballComponent {
  id: string;
  beforePhysics(dt: number): void;
  syncVisuals(alpha: number): void;
  dispose(): void;
}
```

Use discriminated typed specifications per component, finite/range validation and named tuning presets. A component owns its Three Group, Rapier handles and material references. Generate initial meshes/colliders from the same spec, then copy dynamic body transforms to visuals after physics. Never read gameplay collision positions from interpolated render transforms. Static edits rebuild both outputs atomically while paused; reject invalid edits before destroying the prior component. Shared resources have explicit ownership so disposing one bumper does not dispose everyone's material.

## Coordinates and physics starting values

These are experimental defaults, not measured winners. One unit = one metre, seconds, kilograms and radians internally. World +Y is up; table-local +X is right, +Z points toward the drain; origin is playfield centre. Tilt the entire static table frame +6.5 degrees around X so the back (-Z) is higher. Transform spawns and hinge axes into world space once. Never parent simulation to a moving render transform. No non-uniform body scaling.

Start with a 0.60 × 1.20 m deck, 0.03 m thickness; ball radius 0.0135 m, mass 0.080 kg; gravity `(0,-9.81,0)`. Start friction 0.15, restitution 0.35, linear damping 0.02 and angular damping 0.05, then tune surface-specific materials. Record Rapier combine rules, solver settings, package version and timestep with every physics measurement. Use collider mass explicitly rather than accidentally adding density-derived mass twice.

Dynamic ball: CCD enabled, rotation unlocked. Record speed distribution; begin stress tests through 12 m/s and above at 18 m/s. A safety cap, if needed, is explicit and counted; it must not hide failed collision tests. Choose skin/contact tolerances relative to ball radius (initial candidate 0.0005 m), validate supported APIs in the pinned Rapier version. No Godot collision-margin settings carry over automatically.

One fixed-step accumulator starts at 1/60 s; compare 1/120 s. Input is latched before each step, mechanisms advance, world steps, queued collision events are consumed, rules update, then rendering interpolates previous/current transforms. Limit catch-up to four steps per render and log dropped time. Clear accumulator and held inputs on background/pause/resume; never fast-forward a suspended table. No competing independent physics/render clocks. Fixed stepping is repeatable-test infrastructure, not a promise of cross-browser bitwise determinism.

Rapier interaction groups use membership/filter masks (not Three.js visibility layers). Encode and test the mutual filtering rule:

| Category | Membership bit | Filter bits |
| --- | --- | --- |
| Ball | 1 | 1 + 2 + 4 + 8 |
| Static structure | 2 | 1 + 4 |
| Moving mechanisms | 4 | 1 + 2 |
| Sensor | 8 | 1 |
| Decoration | no collider | none |

Connected flippers and their mounts explicitly exclude unwanted joint contacts. Sensors report crossings without forces. Where kinematic/fixed sensor event combinations are needed, configure and test active collision types rather than assuming defaults. Turn on only the collision/contact-force events each component needs.

## Rails and ramps

Use typed control points converted to a Three curve (CatmullRomCurve3 or cubic Bezier segments). One pure sampler produces centreline points, arc lengths and stable transported tangent/normal/binormal frames. Reject duplicate points, zero-length tangents, self-intersections and insufficient ball clearance. Banking is explicit rotation about the tangent. Height lives in the path; any start/end-height convenience setter updates that path rather than becoming another height source.

`CurvedRail`: radius/arc or path, elevation, tube radius, material, restitution and friction. Generate visible tube rings and simple Rapier capsule/cuboid segments from the same frames. Bound chord error initially to 1 mm (and always below 10% of ball radius), refine by curvature rather than fixed ultra-dense tessellation. Test capsule seams and protrusions; a smooth-looking mesh alone is insufficient.

`Ramp`: path, width (initially 0.09 m), banking, thickness, guard height, surface and physics materials. Generate a ribbon with real elevation, thickness and guards; matching short convex wedges/segments share sampled edge vertices. Compare a coarse fixed trimesh only if seams require it; never use decorative high-detail meshes or concave dynamic colliders. Blend entry/exit tangents into adjacent surfaces, reserve underpass clearance for ball diameter plus tolerance, and validate banked edge clearance. Test rollback, side entry, underside contact, top travel and exit. Sensor sequence records entry then exit for one ball; it never drives ball position.

Custom skins may replace decoration/materials. Any structural silhouette change must update the shared spec and alignment tests. A custom imported rail that ignores these dimensions recreates the original problem.

## Construction kit scope

| Component | Physical/authoring contract | Delivery |
| --- | --- | --- |
| PinballBall | Dynamic sphere, shared radius, mass, CCD and speed telemetry | Slice |
| Flipper | Shared bat shape/pivot/stops; swappable motor or kinematic drive | Slice, both variants |
| Bumper | Static contact surface, controlled outward impulse and hit cooldown | Slice, two |
| Post / Wall / StraightRail | Shared primitive dimensions and material parameters | Slice as needed |
| CurvedRail / Ramp | Shared path samples, generated mesh and simple collision | Mandatory slice |
| LaneGuide | Shared wall/rail preset with explicit opening clearance | Slice as needed |
| Gate | Real movable flap with hinge/stops and crossing sensor | Slice |
| Target | Contact face, debounced hit, optional visual response | Slice |
| Sensor / Drain | Non-solid overlap volume; once-per-ball lifecycle event | Slice |
| Plunger | Physical impulse/spawn direction, charge curve, shooter clearance | Slice |
| Spinner | Rotation and threshold events; real contact mechanism | After evidence gate |
| Kicker / Scoop | Capture/eject lifecycle, cooldown and ball ownership | After evidence gate |

Every component has semantic IDs, validated defaults, a debug representation and a focused fixture before reuse. Avoid a deep inheritance tree or making all objects active rigid bodies.

## Flipper experiment

A: dynamic Rapier rigid body with revolute joint, limits and motor/torque drive. Separate press/hold/return settings, effective mass/inertia, grip and restitution. Confirm pinned API motor support; log angle and angular velocity through impacts.

B: position-based kinematic body with bounded angular acceleration/velocity and separate press/return profiles. Set next kinematic rotation in physics steps so Rapier infers contact velocity; do not teleport or tween the render mesh. Test rotational swept-contact limitations explicitly. Avoid adding a second generic hit impulse on top of solver transfer.

Both use identical bat geometry and ball feeds. Compare tip/base hits, cradle release, catches, weak taps, rapid reversals and 12 m/s impacts. The winner is pending evaluation; neither theoretical realism nor perfect prescribed motion alone decides it.

## Rules, controls and browser lifecycle

Mechanical events carry component ID, ball ID, simulation tick and relevant measured impulse/direction. Use a typed union: bumper/target hit, sensor entered/exited, ramp completed, gate crossed, spinner rotated, scoop captured and ball drained. Drain is once per live ball; contact cooldowns are per ball/component. Rules own score, combo windows, ball save and missions; effects/audio consume notifications. Input drives flippers directly without waiting for scoring/UI work.

Start with isolated local procurement-themed scoring. Before campaign integration, characterize `ProcurementSystem` side effects and create a small adapter that applies each event once. Do not run sandbox results against `currentRun`; do not duplicate scoring in Rapier callbacks or rewrite the campaign economy.

The host replaces the procurement scene’s table canvas with a dedicated Three canvas and DOM HUD, with one active renderer owning input. Keep renderer contexts separate; sharing a WebGL context is out of scope. Use a generation/cancellation token for asynchronous loading and a visible loading/error state with a return-to-caller action. Cancel late initialization after exit. Pause on document visibility loss and app suspension. On exit remove listeners/DOM, cancel animation work, dispose owned geometries/materials/textures/renderer, release Rapier world/event queue, and resume the prior host only once. Handle WebGL context loss and return safely if restoration fails. Verify repeated entry and memory on WebView.

Pointer Events: capture each pointer to its initial left/right/plunger role; support simultaneous touches, release on pointercancel/lost capture/blur, and avoid stale presses after resume. Set touch-action for the game region only; HUD controls consume their own input. Keyboard: arrows or A/D, Space to charge/release, R restart, Escape pause. All physical actions respond by the next physics step. Restart resets local session; it never authorizes a campaign contract.

## Camera, art and mobile budget

Test fixed perspective (35° starting FOV), longer-lens perspective and orthographic framing at 9:16 and tall phone aspects. Preserve full flipper/drain visibility and readable ramp elevation. No camera shake that moves aiming geometry by default; provide reduced-motion/effect controls.

Art direction: bureaucratic enamel, illustrated playfield textures, green/gold money inserts and red audit warnings, readable ball highlight/shadow, stylized paperwork/mansion decorations. Structural objects retain actual 3D depth. Use opaque materials, shared atlases, baked AO/shadows, a hemisphere plus one directional light, and at most one shadow-casting light. Emissive-looking inserts must read without bloom. Defer reflections, expensive post-processing and transparent particle piles.

Start capped device pixel ratio at 1.5 (low tier 1), at most 100 draw calls/100k visible triangles and 64 MiB estimated textures; these are provisional budgets, not benchmark results. Measure payload/cold start and retained dual-context memory. Profile CPU physics, render submission and GPU time separately where supported; mark unavailable GPU timings honestly. See evaluation for frame-time and mobile gates.

Debug switches: Rapier collider lines, names/IDs, sensors, contact points/normals, speed/vector, physics ticks, render frame time, rail/ramp samples, flipper angle/velocity and active events. Add a small development DOM parameter panel with exportable typed recipe values, not an entire editor. Debug views must use live collider data and share the camera/transform conventions.

Performance measurements: **not collected**. Known physics problems: **untested**; candidate risks are ramp seams, fast rotating contacts, thin-sensor misses and scaling tolerances. Record concrete failures with recipe/version/feed in the evaluation log.

## Authoring workflow

Place a component recipe → validate scale/clearance → generate mesh and colliders → inspect overlays → run saved ball feeds → playtest on phone → skin/decorate → repeat alignment/performance tests. A rail/ramp edit must require no second collision edit. Save recipes and fixtures in Git; never hand-edit generated buffers.

API references: [Three.js documentation](https://threejs.org/docs/), [Rapier initialization](https://rapier.rs/docs/user_guides/javascript/getting_started_js/), [bodies and kinematic motion](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/), [colliders/groups/events](https://rapier.rs/docs/user_guides/javascript/colliders/). Verify exact API signatures against the versions pinned during implementation.
