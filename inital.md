You are the lead implementation team for a satirical 2D arcade/strategy game called **Department of WARRR**.

Your job is to begin building the game immediately, starting with a playable graybox prototype and progressing through strict gameplay validation gates before adding polish.

Do not overengineer. Do not add systems because they sound impressive. Do not spend time on final art before the core game is fun.

The project succeeds only if the underlying gameplay is genuinely enjoyable.

# PRODUCT SUMMARY

**Department of WARRR** is a political satire game about perverse procurement incentives, excessive spending, depleted military readiness, long replacement timelines for expensive munitions, and defense-industry wealth visibly manifesting as an ever-growing collection of luxury mansions around McLean, Virginia.

The player is effectively trying to:

> Waste expensive munitions on cheap threats, create shortages, raid readiness from other theaters, generate procurement emergencies, win bloated contracts through an arcade pinball system, wait years for replacements, and build as many contractor mansions as possible before global military readiness collapses.

The game must make this system mechanically fun rather than relying on walls of political jokes.

The central gameplay loop is:

**Cheap threat → expensive response → stockpile depletion → readiness loss → capability gap → emergency procurement → long delivery queue → contractor profit → McLean mansion → repeat**

The player's primary score is:

**CONTRACTOR MANSIONS BUILT**

The player's effective health bar is:

**GLOBAL MILITARY READINESS**

The main limiting strategic resources are:

* Current munition inventory
* Theater-level readiness
* Production capacity
* Replacement lead time

The most important systemic contrast is:

> **Money moves fast. Munitions move slowly. Mansions move fastest.**

# REQUIRED TECH STACK

Use:

* **TypeScript**
* **Phaser 4.x**
* **Vite**
* **Phaser Arcade Physics** for combat
* **Phaser Matter Physics** for procurement pinball
* **Vitest** for simulation/unit tests
* **Playwright** for basic game-flow browser testing
* **Zod** for validating data-driven game content
* Local browser persistence initially
* A persistence abstraction so storage can later migrate cleanly
* **Capacitor** only after the browser prototype passes the mobile performance gate

Do NOT introduce:

* React unless an actual later need is demonstrated
* Expo / React Native
* Flutter
* Redux
* authentication
* a backend
* databases
* multiplayer
* real-time political feeds
* microservices
* unnecessary state-management frameworks

The game should initially be a static web application.

The architecture must remain compatible with eventual Android/iOS packaging through Capacitor.

# DISPLAY TARGET

Design mobile-first.

Primary logical orientation:

**Portrait 9:16**

Suggested logical resolution:

**1080 × 1920**

Scale responsively.

Desktop should center the portrait game viewport and may use decorative side areas later.

The game should be usable with:

* touch
* mouse

Keyboard shortcuts may be added for development/debugging.

# CORE ARCHITECTURE

Keep gameplay simulation separate from rendering.

Phaser scenes should handle:

* rendering
* animation
* input
* audio
* screen transitions

Pure TypeScript systems should handle:

* economy
* readiness
* inventory
* production
* procurement calculations
* mansion creation rules
* events
* progression
* scoring

Suggested architecture:

```text
Phaser Scenes
     |
     v
GameController
     |
     +-- CombatSystem
     +-- InventorySystem
     +-- ReadinessSystem
     +-- ProductionSystem
     +-- ProcurementSystem
     +-- EconomySystem
     +-- MansionSystem
     +-- EventSystem
     +-- ProgressionSystem
     |
     v
   RunState
```

Do not bury important simulation logic inside scene files.

# SUGGESTED PROJECT STRUCTURE

```text
department-of-warrr/
|
+-- src/
|   +-- game/
|   |   +-- Game.ts
|   |   +-- config.ts
|   |   +-- events.ts
|   |
|   +-- scenes/
|   |   +-- BootScene.ts
|   |   +-- MenuScene.ts
|   |   +-- DoctrineScene.ts
|   |   +-- CombatScene.ts
|   |   +-- ReadinessScene.ts
|   |   +-- ProcurementScene.ts
|   |   +-- MansionScene.ts
|   |   +-- ResultsScene.ts
|   |
|   +-- systems/
|   |   +-- CombatSystem.ts
|   |   +-- EconomySystem.ts
|   |   +-- InventorySystem.ts
|   |   +-- ReadinessSystem.ts
|   |   +-- ProductionSystem.ts
|   |   +-- ProcurementSystem.ts
|   |   +-- MansionSystem.ts
|   |   +-- EventSystem.ts
|   |   +-- ProgressionSystem.ts
|   |
|   +-- entities/
|   |   +-- threats/
|   |   +-- weapons/
|   |   +-- effects/
|   |
|   +-- data/
|   |   +-- threats.json
|   |   +-- weapons.json
|   |   +-- doctrines.json
|   |   +-- programs.json
|   |   +-- events.json
|   |   +-- mansions.json
|   |   +-- ranks.json
|   |
|   +-- state/
|   |   +-- RunState.ts
|   |   +-- SaveState.ts
|   |   +-- PersistenceAdapter.ts
|   |
|   +-- ui/
|
+-- assets/
|   +-- atlases/
|   +-- audio/
|   +-- fonts/
|   +-- maps/
|   +-- raw/
|
+-- tests/
+-- public/
```

# CORE GAME LOOP

A run consists of multiple fictional **Fiscal Years**.

Each Fiscal Year should eventually contain:

1. Doctrine choice
2. Threat/combat phase
3. Theater readiness/reallocation phase
4. Procurement pinball phase
5. Production/replenishment update
6. Contractor payout
7. McLean construction payoff
8. Optional short event/hearing
9. Next Fiscal Year

Target complete run length later:

**10–18 minutes**

Do not implement the entire loop immediately.

Follow the prototype gates below.

# HUD

Keep the permanent HUD extremely readable.

Permanent values:

**TAXPAYER BURN**

Example:

`$18.4B`

**MANSIONS**

Example:

`12`

**GLOBAL READINESS**

Example:

`58%`

Contextual values may appear during specific phases, such as:

* interceptor inventory
* production lead time
* current procurement request
* procurement pressure
* theater readiness

Avoid persistent meter overload.

# COMBAT GAMEPLAY

Combat is the highest-priority system.

The player protects a military target at the bottom of a portrait battlefield while inexpensive drones and occasional serious threats enter from above and the sides.

The primary premium interceptor should behave approximately like **Missile Command**:

1. Player taps a point in space.
2. Interceptor launches toward that point.
3. It detonates in an airburst.
4. The blast radius can destroy multiple threats.

This creates:

* aiming
* prediction
* chain kills
* timing
* misses
* crowd control
* meaningful skill

Do not simply make premium missiles "tap enemy to delete enemy."

# MVP WEAPONS

Start prototype with three.

Eventually MVP uses four.

## Rotary Defense Gun

Approximate fictional engagement cost:

`$500`

Characteristics:

* efficient
* short range
* skill intensive
* tiny procurement benefit

## Counter-Drone Jammer

Approximate fictional cost:

`$8,000`

Characteristics:

* area effect
* temporarily disables compatible drones
* cooldown
* highly efficient
* poor for grift scoring

## Freedom Interceptor

Approximate fictional unit cost:

`$4.2M`

Characteristics:

* finite inventory
* long range
* large explosion radius
* slow replacement
* large Procurement Pressure reward

## Freedom Interceptor Block II

Approximate fictional unit cost:

`$11.8M`

Characteristics:

* enormous blast
* extremely limited inventory
* very slow replacement
* intentionally excessive
* excellent combo/scoring potential

All numbers are fictional gameplay abstractions and should remain easy to tune from data.

# MVP THREAT TYPES

Eventually implement six.

## Lawn-Mower Drone

* slow
* predictable
* approximate fictional value around $900

## Scooter Drone

* fast
* weaving
* approximately $4K

## Decoy

* appears threatening
* low actual value

## Swarm Drone

* arrives in clustered groups
* encourages airburst chains

## Mystery Contact

* identity temporarily unknown
* can be engaged immediately
* may later prove embarrassingly harmless

## Actual Dangerous Missile

* fast
* genuinely threatening
* requires serious response
* prevents efficient cheap defense from always being the obvious answer

Threat value exists primarily to calculate economic absurdity.

# OVERMATCH SYSTEM

Each successful expensive engagement should calculate:

```text
overmatchRatio = weaponCost / targetValue
```

Example:

A `$972` drone destroyed by a `$4,200,000` interceptor yields:

**OVERMATCH**

`4,321× COST RATIO`

Rapid expensive kills build combo tiers:

* OVERMATCH
* EXCESSIVE OVERMATCH
* DOMINANCE
* FULL SPECTRUM DOMINANCE

Combos multiply **Procurement Pressure**.

They should not directly generate mansions or contractor money.

# PROCUREMENT PRESSURE

Combat spending creates **Procurement Pressure**.

This represents the political/bureaucratic justification for later replacement programs.

Inputs may include:

* expensive weapons consumed
* shortages created
* overmatch ratios
* doctrine modifiers
* damaged readiness
* theater gaps

The economy needs an actual chain of causation:

**Weapon spending → shortage → procurement pressure → procurement program → contractor profit → mansion**

Do not shortcut this.

# STOCKPILE SYSTEM

Premium munitions are finite.

Inventories exist by theater.

Initial abstract theater roster:

* Active Operation
* Indo-Pacific
* Europe
* Homeland
* Strategic Reserve

Initial values can be invented for tuning.

No game value should imply an actual classified or current real-world inventory count.

After a combat phase, the player may face:

```text
ACTIVE OPERATION

6 / 40 INTERCEPTORS
```

The player can transfer inventory from another theater.

Example:

```text
INDO-PACIFIC

Current readiness: 47%
Available interceptors: 21

Transfer 12?

Resulting readiness: 35%
```

Button:

**TRANSFER ANYWAY**

This needs to be a meaningful gameplay decision.

# READINESS SYSTEM

Theaters each have readiness from 0–100.

Global readiness derives from overall theater state.

Suggested thresholds:

## 75%

Maintenance Deferred

Minor performance penalty.

## 60%

Local Shortages

Replenishment constraints begin.

## 45%

Training Reduced

Accuracy or threat-identification penalty.

## 30%

Strategic Gap

Serious threats appear more frequently.

## 15%

Critical Readiness

Reserve transfers become restricted.

## 0%

**NATIONAL SECURITY FAILURE**

Run ends.

Tune later based on playtesting.

# LONG MUNITION REPLACEMENT SYSTEM

This is a core gameplay pillar, not flavor text.

Every premium munition must track:

* current inventory
* unit cost
* annual production
* production capacity
* units currently on order
* lead time
* scheduled delivery fiscal years
* estimated full replenishment year

Example UI:

```text
FREEDOM INTERCEPTOR

Inventory: 17
Annual Requirement: 40
On Order: 61
Annual Production: 11
Next Delivery: FY29
Full Replenishment: FY34
```

The player should eventually realize that:

**ON ORDER: 61**

does not mean:

**AVAILABLE SOON**

When a premium interceptor is launched, occasionally show something like:

```text
-$4.2M
-33 DAYS OF PRODUCTION CAPACITY
```

This communicates opportunity cost clearly.

# PRODUCTION MODEL

Keep it abstract.

Do not build a detailed factory simulator.

Represent the industrial base as roughly three simplified production lines.

Example:

* Standard Interceptor Line
* Advanced Interceptor Line
* Counter-Drone Systems Line

Orders fill future production capacity.

Example:

```text
FY28   6 units
FY29  10 units
FY30  14 units
FY31  14 units
FY32  17 units
```

When capacity is overfilled:

**PRODUCTION CAPACITY EXHAUSTED**

This can create additional procurement opportunities.

Industrial capacity expansion may eventually cost enormous amounts and take multiple years to complete.

Important:

**Contractor payment may begin immediately. New actual capacity arrives years later.**

# PROCUREMENT PINBALL

This is the second major gameplay mode.

Use Phaser Matter Physics.

Portrait pinball/pachinko board.

Controls:

* left half screen = left flipper
* right half screen = right flipper
* plunger input to launch

Target duration:

**30–50 seconds**

The starting ball represents a procurement requirement.

Example:

```text
CAPABILITY GAP IDENTIFIED

Base Request:
$4.8 BILLION
```

The player then intentionally inflates it through pinball.

# GOOD PINBALL TARGETS FOR THE PLAYER

These increase the procurement result:

**URGENT NEED**

**THREAT GAP**

**SOLE SOURCE**

**CONGRESSIONAL ADD-ON**

**REQUIREMENTS CHANGE**

**PROGRAM RESTRUCTURE**

**CLASSIFIED PROGRAM**

**COST OVERRUN**

Effects may modify:

* contract value
* contractor margin
* delivery time
* units ordered

# BAD PINBALL TARGETS FOR THE PLAYER

The player should try to avoid:

**AUDIT**

**COMPETITIVE BID**

**FIXED PRICE**

**CHEAPER ALTERNATIVE**

**ACTUAL REQUIREMENTS**

**OVERSIGHT**

These reduce:

* contract value
* contractor margin
* unnecessary complexity

This should be mechanically funny without explanatory text.

# DELIVERY DELAY MODIFIERS

Several pinball bumpers should also increase delivery time.

Example:

Starting program:

```text
40 interceptors
$5.2B
Delivery FY30
```

Hit:

**REQUIREMENTS CREEP**

`+$1.4B`
`+1 year`

Then:

**NEXT-GENERATION UPGRADE**

`+$3.1B`
`+2 years`

Then:

**ACCELERATED PROCUREMENT**

`+$4.7B`
`-6 months`

Final result:

```text
PROCUREMENT JACKPOT

40 INTERCEPTORS

$15.9 BILLION

DELIVERY FY33
```

That combination of larger spending and slower delivery is central to the satire.

# PROCUREMENT OUTPUT

Each completed procurement program should generate data similar to:

```ts
interface ProcurementContract {
  programId: string;

  baseRequest: number;
  finalAuthorization: number;

  unitsOrdered: number;
  deliveryDelayYears: number;

  contractorRevenue: number;
  contractorProfit: number;
  executiveWealth: number;
}
```

Use fictional economic formulas.

Do not imply real company-specific margins.

# PROCUREMENT PAYOFF SCREEN

After procurement, clearly juxtapose:

```text
CONTRACTOR PAYMENT
NOW

EXECUTIVE BONUS
THIS YEAR

MUNITIONS DELIVERED
FY33
```

This is one of the game's key jokes.

# McLEAN MANSION SYSTEM

The game does NOT build one absurd trillion-dollar mansion.

Instead, successful procurement generates fictional contractor profit and executive wealth.

That wealth causes **many plausible luxury mansions** to appear over time.

A persistent stylized McLean, Virginia neighborhood becomes the player's trophy case.

Each mansion should look individually believable:

* $5M
* $8M
* $12M
* $18M
* occasional larger estate

The satire comes from the quantity of mansions, not one impossible fantasy palace.

# MANSION CONSTRUCTION PAYOFF

When enough executive wealth is generated:

Camera moves to the McLean neighborhood.

A lot highlights.

Construction animation.

Bulldozer/crane placeholders initially.

Then:

**DING DONG**

```text
NEW CONTRACTOR MANSION

THE COST-PLUS COLONIAL

$11.4M

9 beds
13 baths
14,100 sq ft

Pool
Guest House
6-Car Garage
Wine Cellar
Pickleball Court
```

Then:

```text
MADE POSSIBLE BY

Emergency Interceptor Replenishment III

Full munition replenishment:
FY34
```

Keep this phase concise.

# PERSISTENT NEIGHBORHOOD

Mansions persist across runs.

Do not persist readiness advantages.

Persistent meta progression may include:

* mansion collection
* mansion architecture variants
* neighborhood expansion
* achievements
* ranks
* cosmetic board themes
* funny fictional development names

Possible districts:

* Contractor Court
* Overmatch Estates
* Replenishment Ridge
* Capability Gap Preserve
* Cost-Plus Commons

# MANSION ART SYSTEM

Eventually use authored modular art.

Target:

10 base mansion shells

Examples:

* Colonial
* Georgian
* French Chateau
* Modern Glass
* Mediterranean
* Neoclassical
* Transitional
* Contemporary
* Brick Estate
* McMansion Supreme

Approximately 20 accessories:

* pools
* guest houses
* gate houses
* fountains
* garages
* tennis courts
* pickleball courts
* circular drives
* pool houses
* gazebos
* landscaping
* luxury cars

Use roughly six lot templates.

Do not build finished art until the complete gameplay loop has passed its fun gate.

# DOCTRINE SYSTEM

Eventually implement eight doctrine cards.

At the start of a fiscal year, show three random cards and choose one.

Examples:

## OVERMATCH

Premium weapon Procurement Pressure +30%.

Inventory consumption penalties increased.

## SHOOT FIRST

Mystery contacts immediately targetable.

Misidentification chance increased.

## PEACE THROUGH PROCUREMENT

Contractor margin increases.

Efficient weapons have longer cooldowns.

## LIMITED OPERATION

Procurement Pressure increases.

Chance of extra combat wave.

## RESTORE READINESS

Procurement authorization increases substantially.

Actual readiness restored only slightly.

## TEMPORARY EMERGENCY

Emergency-spending multiplier.

May recur in later years.

Create two additional doctrines later.

All values must be data-driven.

# EVENT SYSTEM

Eventually implement approximately twelve short events.

Events must remain fast.

Maximum:

* one short card
* one question
* two or three choices
* under ten seconds of interruption

Examples:

## SUPPLY CHAIN SHOCK

Production delay:

`+1 year`

Choice:

**Emergency Supply Initiative — $7B**

Result:

Reduces delay by approximately six months.

## CONGRESSIONAL HEARING

Question:

"Why are inventories dangerously low?"

Possible satirical answers:

* Unprecedented Threat Environment
* Previous Leadership
* Capability Investment Gap

Each modifies procurement pressure, authorization, or public confidence differently.

Do not turn this into a dialogue-heavy game.

# PACING TARGET

Eventually target approximately:

Doctrine choice:

`~8 sec`

Combat:

`60–100 sec`

Readiness:

`15–25 sec`

Procurement:

`30–50 sec`

Mansion payoff:

`5–12 sec`

Event:

`0–10 sec`

Total fiscal year:

roughly `2–3 minutes`

Average run:

approximately `5–7 fiscal years`

Target run:

`10–18 minutes`

# DIFFICULTY CURVE

Suggested progression:

## FY1

* generous stocks
* mostly simple cheap drones
* player feels powerful

## FY2

* faster drones
* decoys

## FY3

* first meaningful inventory shortage

## FY4

* production queue becomes painful

## FY5

* replacements are clearly not arriving fast enough

## FY6+

* multiple theaters approach readiness collapse
* dangerous threats become harder to cover

The late-game crisis should largely arise from the player's early behavior.

# LOSS CONDITION

Primary loss:

**Global Readiness reaches 0**

Secondary possible loss:

A catastrophic threat reaches its target while required defensive capability is unavailable.

Failure screen:

**NATIONAL SECURITY FAILURE**

Do not focus on graphic destruction.

Instead transition to the luxurious McLean neighborhood the player created.

That contrast is the point.

# RESULTS SCREEN

Track at least:

* fiscal years survived
* taxpayer money burned
* threats destroyed
* estimated total threat value
* premium interceptors fired
* average overmatch ratio
* munitions still on order
* full replenishment fiscal year
* final global readiness
* contractor profit
* mansions built this run
* lifetime mansions
* result rank

Example:

```text
YOUR LEGACY

Fiscal Years: 7

Taxpayer Burn:
$412.8B

Cheap Threats Destroyed:
1,384

Estimated Threat Value:
$4.7M

Premium Interceptors Fired:
906

Average Overmatch Ratio:
98,114 : 1

Munitions Still On Order:
277

Full Replenishment:
FY39

Global Readiness:
0%

Wars Won:
0

Contractor Profit:
$17.6B

McLEAN MANSIONS BUILT:
28
```

# SCORING

Primary score:

**Mansions built this run**

Suggested tie breakers:

1. fiscal years survived
2. contractor profit
3. taxpayer burn
4. average overmatch ratio

Readiness is not score.

Readiness is the limiting resource.

The high-level strategy should become:

> Destroy preparedness quickly enough to generate massive procurement opportunities, but slowly enough that the run continues.

# GAMEPLAY DATA MUST BE EXTERNALIZED

Values must live in JSON/TS configuration rather than scene logic.

Examples:

* threat speed
* threat value
* weapon cost
* weapon inventory
* lead time
* annual production
* readiness penalties
* procurement modifiers
* doctrine effects
* event probabilities
* difficulty multipliers
* mansion thresholds

Do not hard-code balancing rules unnecessarily.

# SAVE SYSTEM

Create two conceptual saves.

## Current Run

Stores enough state to survive browser/app suspension.

## Career Save

Stores:

* lifetime mansions
* unlocks
* achievements
* high scores
* settings
* tutorial completion

Include:

```ts
saveVersion: 1
```

Create migration support early.

# REQUIRED DEBUG TOOLS

Create a hidden/dev-only debug panel early.

Must eventually support:

* add interceptors
* reduce readiness
* skip combat
* force procurement
* force mansion
* advance fiscal year
* force event
* show physics bodies
* FPS
* inspect production queues
* reset current run
* reset career save

Do not require playing ten minutes to test late-game systems.

# TESTING

Unit-test pure simulation logic.

At minimum:

* inventory cannot go negative
* transfer moves correct quantity
* theater readiness recalculates correctly
* delivery batches arrive in correct fiscal year
* full replenishment year calculation
* production capacity limits
* procurement modifier math
* mansion threshold logic
* save migration logic

Browser smoke test:

1. Boot
2. Start run
3. Enter combat
4. Finish wave
5. Enter readiness
6. Complete transfer
7. Enter procurement
8. Complete mocked procurement
9. Build mansion
10. End run
11. Reload saved state

Do not attempt automated "fun testing."

# PERFORMANCE TARGETS

Target:

* 60 FPS on modern phones
* at least roughly 45 FPS during stressful scenes on lower-end supported Android devices
* immediate-feeling touch response
* pooled projectiles/threats/particles
* bounded particle counts
* sensible texture sizes
* no unbounded object creation

Do not add Capacitor until browser performance is validated.

# ACCESSIBILITY / SETTINGS

Eventually include:

* music volume
* SFX volume
* haptic toggle
* screen-shake toggle
* reduced-motion option
* pause
* tutorial replay
* warnings that do not rely only on red/green color differences

# CONTENT / SATIRE GUARDRAILS

The game is political satire.

Use:

* fictional companies
* fictional weapons/program names
* fictional economic values
* composite characters
* broad real geography such as McLean, Virginia

Do not use:

* private real residential addresses
* actual defense-company names for wrongdoing
* claims that a specific real person's home came from a specific real procurement program
* supposedly real classified inventory numbers

Suggested disclaimer:

> A work of political satire. Programs, companies, characters, financial figures, inventories and procurement outcomes depicted in gameplay are fictionalized.

# ART DIRECTION

Eventually use:

**editorial political cartoon + retro government propaganda graphics + polished mobile arcade game**

Characteristics:

* bold outlines
* readable silhouettes
* exaggerated bureaucratic visual language
* paperwork
* stamps
* warning lights
* money effects
* absurdly expensive procurement machinery
* bright, clean, affluent McLean scenes contrasted against stressed military scenes

Do not produce final character art during initial prototype.

# CORE CHARACTERS LATER

Use fictional composite characters.

Initial set:

* Secretary of WARRR
* General Procurement
* Contractor Executive
* Congressional Appropriator
* Auditor

Avoid direct photorealistic copies of living politicians.

# AUDIO DIRECTION LATER

The signature sound chain should eventually become:

**FWOOOOSH**

**BOOM**

**KA-CHING**

and later:

**DING DONG**

The premium interceptor must sound extremely satisfying.

Procurement should be full of:

* pinball clacks
* stamps
* bells
* alarms
* paperwork
* cash sounds

Mansion completion gets a recognizable doorbell payoff.

# MVP CONTENT TARGET

Eventually ship roughly:

* 6 threats
* 4 weapons
* 8 doctrines
* 8 procurement programs
* 12 random events
* 10 mansion base structures
* 20 mansion accessory modules
* 30 mansion names
* 12 achievements
* 10 result ranks
* 20 result punchlines
* 8 hearing questions

But do not create all content up front.

# MVP MUST INCLUDE

* satisfying combat
* airburst interceptor mechanics
* multiple weapon choices
* overmatch scoring
* limited stockpiles
* theater readiness
* inventory transfers
* production capacity
* long replacement lead times
* delivery queues
* procurement pinball
* contractor economy
* multiple McLean mansions
* persistent neighborhood
* doctrines
* short random events
* results screen
* basic achievements
* tutorial
* responsive mobile web version
* Android packaging after performance validation

# EXPLICITLY OUT OF SCOPE FOR MVP

Do not build:

* multiplayer
* user accounts
* backend-required gameplay
* live political/news feeds
* live leaderboards
* IAP
* ads
* 3D
* campaign/story mode
* complex real-world supply-chain simulator
* actual procurement databases
* dozens of weapons
* voice acting
* elaborate character dialogue
* procedural AI satire generation

# DEVELOPMENT GATES

There are four mandatory gates.

## GATE A — COMBAT IS FUN

Combat must be worth playing without procurement, mansions or political jokes.

## GATE B — SHORTAGES CREATE REAL DECISIONS

The player must understand and feel the consequences of burning limited inventories and raiding other theaters.

## GATE C — PROCUREMENT PINBALL IS FUN

The pinball board must be enjoyable even if all satirical labels are temporarily replaced by generic labels.

## GATE D — FULL LOOP CREATES "ONE MORE YEAR"

Combat → shortage → procurement → mansion must produce an immediate desire to continue.

Do not advance simply because a sprint is scheduled.

# SPRINT 0 — GRAYBOX COMBAT PROTOTYPE

Start here immediately.

Do not build other major systems yet.

Timebox:

roughly 1–2 focused development days.

Use primitive graphics.

Examples:

* circle = drone
* triangle = interceptor
* rectangle = base
* expanding circle = explosion

Implement:

* Vite project
* Phaser setup
* 9:16 scaling
* CombatScene
* one friendly base
* slow drone
* fast drone
* dangerous missile
* gun
* jammer
* Freedom Interceptor
* airburst targeting
* blast-radius collisions
* weapon switching
* finite interceptor count
* weapon costs
* target value
* taxpayer-burn counter
* overmatch ratio
* simple combo
* three-minute test wave
* restart
* mouse controls
* touch controls
* FPS/debug display

The prototype should end with something like:

```text
FISCAL YEAR COMPLETE

Threat Value Destroyed:
$38,482

Taxpayer Burn:
$121,408,000

Interceptors Remaining:
11

Production Time Consumed:
2.7 years

Procurement Pressure:
EXTREME

[DO IT AGAIN]
```

# SPRINT 0 ACCEPTANCE CRITERIA

Before moving on, verify:

* player understands basic controls in under 30 seconds
* premium interceptor feels satisfying
* gun and jammer are meaningfully different
* airburst timing creates skill expression
* chain explosions feel good
* expensive response feels intentionally rewarding in score terms
* prototype runs smoothly on at least one real mobile browser

If this is not fun:

**Stop and iterate on combat.**

Do not build mansions as a distraction.

# SPRINT 1 — COMBAT VERTICAL SLICE

After Gate A passes, implement:

* all 6 threat behaviors
* fourth weapon
* escalating wave director
* decoys
* Mystery Contact
* cooldowns
* ammo/stockpile feedback
* chain-kill tuning
* combo tiers
* Procurement Pressure
* screen shake
* hit stop
* placeholder audio
* placeholder haptics
* particles
* basic tutorial prompts

Acceptance condition:

A tester should willingly play the combat mode alone for approximately five minutes.

# SPRINT 2 — READINESS + REPLACEMENT NIGHTMARE

Implement:

* RunState
* five theaters
* inventory per theater
* readiness
* global readiness
* transfer UI
* transfer preview
* readiness threshold penalties
* production lines
* annual production
* delivery batches
* lead times
* "on order" values
* full replenishment year
* production capacity
* fiscal-year advancement

Gate B test:

The player should experience something like:

```text
ON ORDER: 67
FULL REPLENISHMENT: FY34
```

and immediately understand that the stockpile problem remains serious.

If this needs a long tutorial paragraph, redesign the UI.

# SPRINT 3 — PROCUREMENT PINBALL PROTOTYPE

Implement one functional Matter-based board with:

* plunger
* two flippers
* ball
* roughly 8 useful bumpers
* roughly 4 bad-governance-corrective bumpers
* 3 result slots
* authorization multiplier
* contractor-margin modifier
* delivery-delay modifier
* sound hooks
* particles
* reset

Start example:

```text
BASE REQUIREMENT:
$4.8B
```

Possible end:

```text
PROCUREMENT JACKPOT

$13.7B AUTHORIZED

40 INTERCEPTORS ORDERED

DELIVERY:
FY33
```

Gate C:

The pinball physics and skill must remain entertaining with satirical labels removed.

# SPRINT 4 — COMPLETE VERTICAL SLICE

Now connect:

Combat
→ stockpile shortage
→ readiness transfer
→ capability gap
→ procurement request
→ pinball
→ contract
→ replacement queue
→ contractor profit
→ executive wealth
→ mansion construction

Implement only enough mansion art to prove the loop:

* 4 mansion shells
* 8 accessories
* 1 neighborhood
* property card
* save persistence
* construction placeholder animation
* signature doorbell payoff

Required moment:

```text
$14.2B AUTHORIZED

CONTRACTOR PAYMENT:
NOW

REPLACEMENT DELIVERY:
FY33
```

Then camera transitions to McLean.

A mansion finishes.

**DING DONG**

Gate D:

A tester should both understand the joke without verbal explanation and voluntarily choose:

**NEXT FISCAL YEAR**

# SPRINT 5 — ROGUELITE CONTENT

After full loop passes:

* 8 doctrines
* 8 procurement programs
* 12 events
* production shocks
* capability gaps
* hearing events
* fiscal-year difficulty progression
* achievements
* result ranks
* deterministic run seed if useful for debugging

Goal:

Two runs should meaningfully diverge.

# SPRINT 6 — ART PASS

Only now replace placeholders.

Priority:

1. combat assets
2. weapon/threat effects
3. procurement board
4. mansions
5. UI
6. world/readiness map
7. characters

Create reusable atlases and consistent file naming.

# SPRINT 7 — AUDIO, HAPTICS, COMEDY

Now add:

* final-ish weapon sounds
* explosions
* procurement pinball sounds
* stamps
* cash effects
* mansion doorbell
* construction sounds
* music loops
* haptics
* program names
* mansion names
* results jokes
* hearing jokes
* event copy
* achievement copy

Do not let comedy text slow gameplay.

# SPRINT 8 — MOBILE HARDENING

Once browser version is fun and performant:

Add Capacitor.

Test:

* Android WebView
* iOS WebView
* safe areas
* portrait locking
* pause/resume
* backgrounding
* audio interruption
* save restoration
* haptics
* back-button behavior
* offline startup
* lower-memory devices

Do not rewrite in Flutter or React Native unless measured performance proves Phaser unacceptable.

# SPRINT 9 — BALANCE ONLY

No major new features.

Collect and tune:

* run duration
* fiscal years survived
* weapon selection rates
* premium interceptor usage
* jammer/gun usage
* average readiness loss
* theater transfer frequency
* production backlog
* procurement authorization sizes
* pinball multiplier distribution
* mansion count
* death cause

Initial desired mansion outcomes:

New player:

`3–7`

Competent player:

`8–15`

Strong player:

`15–25`

Exceptional player:

`25+`

Tune based on actual play.

# REQUIRED FIRST TASK

Begin by creating the **Sprint 0 graybox combat prototype only**.

Do not begin with a title screen, backend, finished menus, finished characters or mansion art.

Create the repo/project foundation, implement the graybox combat loop, and get it playable in the browser.

When Sprint 0 is working, report:

1. What was implemented
2. Project/file structure created
3. How to run it locally
4. Controls
5. Current balancing values
6. Known issues
7. FPS/performance observations
8. Anything that does not yet meet Gate A
9. The exact next changes you recommend to improve combat fun

Do not claim a gate has passed merely because the code works.

Evaluate the gameplay critically.

The immediate priority is:

# MAKE FIRING AN ABSURDLY EXPENSIVE INTERCEPTOR AT A CHEAP DRONE FEEL AMAZING.

Everything else comes later.
