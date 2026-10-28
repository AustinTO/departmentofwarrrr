# Playability and engagement plan

## Current status — 2026-10-28

The priorities below describe the original proposed work and are not all still pending. Current code already provides five seeded-cycle combat scenarios, seeded doctrine ordering, scenario objectives, next-scenario preview in Readiness, procurement contract/objective/settlement feedback, consequence-bearing hearing choices, campaign event history, and run-aware press-release callbacks. Procurement supports board selection and three geometry/rule variants. These implementations have automated coverage, but the headless smoke stalled and no human playtest or physical-device evidence is available. Read the current-status table in [next-level-game-plan.md](next-level-game-plan.md) before treating a proposal below as unfinished.

## Goal

Make the first campaign year understandable and satisfying, then give each later year a meaningful tactical choice and a visible reason to replay. Preserve the game's satirical defense procurement premise and its combat → readiness → procurement pinball → estate loop.

## Current state and priorities

- A campaign starts with a doctrine choice and immediately enters combat; the first combat round lasts 60 seconds and its end screen advances automatically after 3.8 seconds (`src/scenes/TitleScene.ts:53`, `src/scenes/DoctrineScene.ts:70`, `src/scenes/CombatScene.ts:160`, `src/scenes/CombatScene.ts:303`). The only in-round teaching observed is a brief allied-contact banner (`src/scenes/CombatScene.ts:209`). **Priority: first-run clarity.**
- Readiness shows inventories and fixed-batch transfers but gives little explanation of their effect on the next fight; it also offers a direct route past procurement (`src/scenes/ReadinessScene.ts:53`, `src/scenes/ReadinessScene.ts:91`, `src/scenes/ReadinessScene.ts:33`). **Priority: consequential intermission choices.**
- Procurement has three balls, contracts, objectives, combos, touch and keyboard controls, and an authorization action (`src/pinball3d/Procurement3DGame.ts:35`, `src/pinball3d/Procurement3DGame.ts:53`, `src/pinball3d/Procurement3DGame.ts:186`, `src/pinball3d/Procurement3DGame.ts:302`). **Priority: readable goals and predictable ball flow.**
- Five scenarios cycle by fiscal year, while the director raises spawn intensity over a round (`src/game/CombatScenarios.ts:18`, `src/game/CombatScenarios.ts:83`, `src/game/WaveDirector.ts:15`). Campaign unlocks and estate milestones already exist (`src/state/RunState.ts:110`, `src/scenes/MansionScene.ts:122`). **Priority: variety and progression feedback.**
- Local save and continue already exist (`src/state/RunState.ts:207`, `src/scenes/TitleScene.ts:41`). Keep save compatibility as changes are added.

## Phase 1 — Make the first year playable without explanation

1. Add a short, dismissible first-run combat lesson: tap to fire, change weapons, identify hostile versus allied contacts, and protect the base. Introduce one action at a time while the first round runs; expose a replayable help panel from pause. Keep returning players out of the lesson. Touch `src/scenes/CombatScene.ts`, `src/ui/PauseMenu.ts`, and a persisted tutorial flag in `src/state/RunState.ts`.
2. Give each combat year a visible objective and progress indicator, using the existing scenario objective and combat statistics. Replace the automatic end-screen timeout with an explicit Continue button and show why the grade was earned. Touch `src/scenes/CombatScene.ts`, `src/game/CombatScenarios.ts`, and `src/game/CombatSystem.ts`.
3. Make controls safe on a phone: check wheel, pause, and action targets against common aspect ratios; show the selected weapon, ammo, cost, and reload state at the point of choice; ensure tapping a control never fires. Touch `src/scenes/CombatScene.ts`, `src/game/WeaponWheel.ts`, and HUD layout code.

**Acceptance:** In a fresh run, a player can identify the firing action, allied contact, weapon switch, and win condition before the first year ends. At 1080×1920 and a short phone viewport, all required controls are visible and no control tap fires a weapon. The result screen stays until Continue and explains the grade in plain language.

## Phase 2 — Give intermissions a decision and a payoff

4. Rework readiness around the *active* theater: show current stock, predicted shortage for the next scenario, transfer quantity, and the effect before confirming a transfer. Preserve the option to proceed without transferring. Touch `src/scenes/ReadinessScene.ts`, `src/state/RunState.ts`, and scenario metadata in `src/game/CombatScenarios.ts`.
5. On entering procurement, show a compact objective card with launch and flipper controls, current contract value, and the next jackpot condition. After each ball, show what changed and give a clear relaunch prompt. On authorization, show the concrete reward delivered to the campaign before leaving. Touch `src/pinball3d/Procurement3DGame.ts`, `src/pinball3d/pinball.css`, and `src/game/ProcurementSystem.ts`.
6. Add a one-screen year recap after the estate event: combat grade, inventory spent and delivered, contract value, new unlocks, and the next estate milestone. Make the next doctrine choice follow from that recap. Touch `src/scenes/MansionScene.ts`, `src/scenes/EventScene.ts`, `src/scenes/PressReleaseScene.ts`, and `src/state/RunState.ts`.

**Acceptance:** A player can predict what a transfer does before tapping it; procurement shows a goal and remaining balls throughout; the recap correctly attributes the year's rewards and remains until the player continues. Resume after a reload retains committed campaign rewards.

## Phase 3 — Add skill, variety, and replay value

7. Give each scenario a distinct, telegraphed challenge tied to existing enemies or rules: for example a decoy-heavy year, a fast swarm year, and a precision strike year. Keep a consistent core control scheme. Replace purely time-based spawn pressure with a few authored beats and a bounded adaptation rule so the first 20 seconds teach, the middle tests, and the end has a climax. Touch `src/game/CombatScenarios.ts`, `src/game/WaveDirector.ts`, and `src/scenes/CombatScene.ts`.
8. Add two or three optional contracts per year that reward different play styles, such as spare allied contacts, achieve an efficient intercept, or complete a pinball target set. Display them before play and update progress immediately. Rewards should feed existing inventory, profit, or readiness rather than add a new currency. Touch `src/game/CombatSystem.ts`, `src/game/ProcurementSystem.ts`, `src/state/RunState.ts`, and the relevant scenes.
9. Make unlocks playable on arrival: announce the new weapon or board, explain its strength in one sentence, and provide a low-stakes chance to try it in the next phase. Show upcoming unlock requirements on the campaign recap. Touch `src/game/config.ts`, `src/game/PinballBoards.ts`, `src/scenes/CombatScene.ts`, and `src/scenes/MansionScene.ts`.

**Acceptance:** Across the first five years, at least three scenarios demand noticeably different decisions; optional goals can be completed or ignored without blocking progress; every new weapon or board is introduced before its first use.

## Validation and tuning

1. Observe at least five fresh players on a phone and five on desktop. Record first-shot time, first accidental allied hit, control misfires, first-year completion, and where they hesitate. Target: four of five in each group finish year one without outside help; no repeated confusion point remains in more than one session.
2. Run short tuning passes after each phase. Target a first-year combat success rate around 70–85% for new players, an average procurement session of 2–4 minutes, and a visible change in stock/profit/readiness after each intermission. Treat these as initial tuning targets, then adjust from playtest evidence.
3. Check scene transitions, saves, combat calculations, procurement rewards, touch controls, keyboard controls, and WebGL recovery. Run the repository build and existing relevant tests after implementation. Keep existing uncommitted combat and pinball work intact while developing this plan.

## Risks and mitigations

- **Too much tutorial text:** teach during actions, keep prompts short, allow dismissal and replay.
- **Balance drift from new goals and rewards:** use existing resource types, cap payouts, and compare run outcomes before and after changes.
- **Mobile HUD crowding:** test actual narrow and short viewports before adding permanent UI.
- **Save incompatibility:** add optional fields with defaults and verify old `warrr_save_v1` data loads.
- **Scope growth:** finish and playtest Phase 1 before building optional goals or new scenario content.
