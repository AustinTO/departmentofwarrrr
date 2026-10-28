# Next-level presentation audit

Date: 2026-10-28
Scope: read-only code and asset inventory review of visuals, UI, audio, feedback, accessibility, mobile layout, and performance architecture. This is not a played-impressions review: no game was launched or played as part of this audit. Where the repository contains QA/evaluation notes, those are identified as documented evidence rather than independently reproduced observations.

## Current status — 2026-10-28

This audit remains an inspection rather than runtime or device evidence. The current verification snapshot reports 129 tests across 16 files, 33 geometry checks, and a passing production build with a large-chunk warning. The headless smoke stalled; no physical-device performance or human-play evidence is available. Treat the device/accessibility acceptance criteria below as open gates.

## Executive assessment

There are already deliberate presentation systems in the game, particularly the title screen, combat effects, mansion art, and the DOM-based 3D procurement pinball. The opportunity is to make those systems feel like one polished game and to ensure the readability and control quality hold across mobile sizes, accessibility settings, and real devices. A strong next step is a coherent visual language across campaign scenes, paired with clearer cause-and-effect feedback during combat and more accessible equivalents to canvas interactions.

## What is implemented

- Phaser uses a portrait 1080×1920 logical canvas with FIT scaling and center alignment; browser/native lifecycle pause/resume handling is present. See [main.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/main.ts:33) and [main.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/main.ts:60).
- The title screen combines key art, dark readability overlays, a moving grid sweep and beacon, campaign status, large menu targets, and menu music. See [TitleScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/TitleScene.ts:11), [TitleScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/TitleScene.ts:41), and [TitleScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/TitleScene.ts:76).
- Combat has scenario-specific art, HUD panels, weapon icon sheets, hit effects, particles, combo/restraint feedback, and bounded pools for money sprites and popups. See [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:103), [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:132), [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:140), [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:452), and [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:480).
- Audio has separate music and SFX volumes, persisted preferences, and shared music/SFX assets. See [AudioManager.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/managers/AudioManager.ts:23), [AudioManager.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/managers/AudioManager.ts:35), and [GameSettings.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/managers/GameSettings.ts:12).
- The 3D procurement pinball uses a DOM shell with scoreboard, status readout, control hints, safe-area padding, and accessible labels. It has touch pointer capture, a DPR cap, ResizeObserver sizing, context-loss handling, and pause/sound/camera controls. See [Procurement3DGame.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/Procurement3DGame.ts:48), [Procurement3DGame.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/Procurement3DGame.ts:71), [Procurement3DGame.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/Procurement3DGame.ts:89), [pinball.css](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/pinball.css:16), [pinball.css](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/pinball.css:93), and [pinball.css](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/pinball.css:151).
- The mansion screen visualizes campaign outcomes with estate and infrastructure artwork, scrollable district content, and a visible next-year action. See [MansionScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/MansionScene.ts:16), [MansionScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/MansionScene.ts:35), and [MansionScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/MansionScene.ts:63).

## Concrete improvement opportunities

### 1. Unify the campaign presentation

The global stylesheet still contains starter-template variables and selectors (`.hero`, `#next-steps`, `#docs`, etc.) rather than a game-wide UI system. See [style.css](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/style.css:1), [style.css](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/style.css:120), and [style.css](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/style.css:159). Phaser scenes construct many elements independently. The title has deliberate cyan/gold military-console framing, while combat HUD and other scenes use individually chosen labels, sizes, and panels. A shared palette, type scale, spacing, panel/button recipes, icon treatment, and consistent pressed/selected/focus states would make scene changes feel authored as one game.

Combat labels illustrate the need to check legibility: HUD labels are 24 logical pixels, while weapon wheel support labels are 11–17 logical pixels in the 1080-wide world. See [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:461) and [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:491). These should be evaluated at actual CSS display size on phones, not only at logical canvas resolution.

### 2. Make action feedback tell a clearer story

Combat already has a good FX foundation: projectiles, explosions, hit-stop, shake, combos, restraint, and pooled score popups. A consistent visual/audio grammar can make each action easier to understand: show whether a threat was intercepted, leaked, jammed, or hit; call out resource/ammo cost; make combo and objective progress persistent enough to read; and reserve large effects for meaningful outcomes. The goal is clarity and satisfaction, not simply adding more particles or screen shake. Reduced-motion and quiet modes should preserve the same information.

### 3. Extend accessibility beyond the pinball mode

Most campaign navigation and controls are Phaser canvas objects with pointer handlers. For example, title actions use rectangle pointerdown handlers, and combat offers keyboard shortcuts alongside touch/pointer actions. See [TitleScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/TitleScene.ts:100), [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:174), and [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:186). Canvas objects do not automatically provide browser semantics, keyboard focus order, or screen-reader status updates. Consider a small semantic DOM layer for primary navigation, settings, status announcements, and key combat actions, while retaining canvas as the visual surface.

The viewport currently disables user zoom and the body prevents touch gestures globally. See [index.html](/home/austin/Documents/trae_projects/DepartmentofWarrrr/index.html:5) and [index.html](/home/austin/Documents/trae_projects/DepartmentofWarrrr/index.html:24). Revisit this with accessibility testing; ensure any game gesture handling does not unnecessarily remove browser zoom for surrounding UI. Add visible focus, non-color-only state cues, text sizing, reduced-motion support, contrast checks, and clear labels/states.

### 4. Make mobile behavior intentional and measurable

The fixed portrait canvas is an understandable game design choice, but on landscape screens FIT can shrink the playfield substantially. Define whether landscape should show rotation guidance, use a layout variant, or remain supported as-is. Check logical hit targets after canvas scaling and keep controls inside safe display bounds. The pinball DOM shell already handles safe areas independently; its CSS can be a model for responsive campaign wrappers.

### 5. Measure performance on actual target hardware

There are promising optimizations: combat has bounded pools for common cosmetic objects; the 3D pinball caps pixel ratio at 1.5 and monitors frame intervals. See [CombatScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/CombatScene.ts:140) and [Procurement3DGame.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/Procurement3DGame.ts:76), [Procurement3DGame.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/pinball3d/Procurement3DGame.ts:535). Profile combat bursts and 3D scenes on representative Android/iOS hardware, measure memory over repeated transitions, and use tiered shadow/effect/DPR settings where measurements justify them. Desktop emulation is not mobile performance evidence.

### 6. Audit loaded assets and visual consistency

Sprite sheet metadata is centralized in [Sprites.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/game/Sprites.ts:3), which is a good foundation. Scene backgrounds and standalone image paths are loaded in [PreloaderScene.ts](/home/austin/Documents/trae_projects/DepartmentofWarrrr/src/scenes/PreloaderScene.ts:80). The repository inventory visibly includes many `public/assets` assets and sheets; verify all configured legacy/root paths exist and load successfully, and remove stale unused assets only after proving they are unused. Scene art, typography, and UI chrome should share one material and lighting language.

## Proposed phases and measurable criteria

### Phase 0 — Capture baseline and inventory

Capture all intended scenes at 360×800, 390×844, tablet portrait, and narrow landscape. Inventory requested versus present assets and record browser/WebView, device, DPR, and orientation. Criteria: every primary scene has a baseline capture; zero required asset-load errors; responsive behavior is documented; each major action/control is enumerated.

### Phase 1 — Visual language and reusable scene UI

Define color, type, spacing, button/panel/icon recipes, and selected/pressed/disabled/focus states. Apply them across title, doctrine, combat, readiness, procurement, mansion, event, press release, and leaderboard. Criteria: consistent hierarchy and action styling across scenes; no clipping/overlap in target-size captures; touch targets at least 44 CSS pixels where practical; text contrast of at least 4.5:1 for normal text and 3:1 for large text; review before/after captures at real device display size.

### Phase 2 — Feedback and accessibility

Provide concise persistent action/resource outcomes, keyboard focus and accessible names/states for major controls, announcements for important status changes, reduced-motion behavior, and adjustable text where it matters. Criteria: main navigation and settings work with keyboard alone; every primary action has a name and visible focus; critical state is not conveyed by color alone; status is announced by assistive technology; TalkBack and desktop keyboard checks pass; reduced-motion mode removes nonessential loops and shake while preserving feedback.

### Phase 3 — Mobile and performance polish

Choose orientation behavior, verify safe bounds and touch interactions, profile real hardware, then add tiered rendering/pooling only where the profile points to bottlenecks. Criteria: a 30-minute representative mid-range Android WebView run without crash or monotonic memory growth; 3D pinball p95 frame interval ≤20 ms and p99 ≤33.4 ms on named hardware; combat meets the selected frame target during a dense FX burst; touch-to-visible-response p95 ≤50 ms; no stuck controls after pause/background/resize/orientation transitions.

## Evidence limits and aspirational criteria

`PINBALL_3D_EVALUATION.md` says the 3D procurement scene is implemented but comparative verification remains incomplete. It documents headless Chrome playthrough and touch-gesture checks, while explicitly noting no physical-phone performance or five-player fun study. See [PINBALL_3D_EVALUATION.md](/home/austin/Documents/trae_projects/DepartmentofWarrrr/PINBALL_3D_EVALUATION.md:3). The file's mobile FPS, input latency, art readability, and player preference thresholds are proposed acceptance criteria, not completed results. See [PINBALL_3D_EVALUATION.md](/home/austin/Documents/trae_projects/DepartmentofWarrrr/PINBALL_3D_EVALUATION.md:19) through [PINBALL_3D_EVALUATION.md](/home/austin/Documents/trae_projects/DepartmentofWarrrr/PINBALL_3D_EVALUATION.md:27). This audit did not launch the game, inspect runtime screenshots, test assistive technology, or form played impressions. Recommendations above are architecture/code-based opportunities, not claims that current gameplay feels good or bad.
