# Next-Level Humor and Content Audit

## Current status — 2026-10-28

This remains a historical code/content audit, not playtest evidence. Current implementation includes five scenarios with seeded fiscal-year offset and seeded doctrine-card ordering. Seeded choices do not affect pinball physics. Board variety now includes three upper-board bumper/scoop layouts over shared protected shooter lane, ramps, and lower playfield; claims below that imply no distinct board layout should be treated as superseded. Reactive writing and hearing trade-offs remain roadmap proposals unless separately verified. Current verification reported: 129 tests across 16 files, geometry checks (33), and production build pass with a large-chunk warning; headless smoke stalled, with no physical-device or human-play evidence.

Read-only content audit of the current game, grounded in source as of 2026-10-28. This report separates **existing facts** from **proposals**. No gameplay/code edits were made.

## Overall read

**Existing facts.** The game already has a clear satirical premise: overreact to cheap threats, burn public money, generate contractor profit, and turn the proceeds into McLean mansions. The title spells out the core joke (“EXPENSIVE INTERCEPTS. CHEAP THREATS. SOMEBODY GETS A MANSION.”) ([TitleScene.ts:36-39](../../src/scenes/TitleScene.ts#L36)). Its strongest jokes are institutional euphemism colliding with petty luxury: “DEFEND THE FLOATING POWERPOINT” and “DEFEND THE STRATEGIC SNACK BAR” ([CombatScenarios.ts:18-53](../../src/game/CombatScenarios.ts#L18)); “MISSILE POOL ESTATE” / “WATER FEATURE: CLASSIFIED” ([mansions.ts:28-36](../../src/data/mansions.ts#L28)); and “capability arrives late, mansions arrive early” ([ProcurementSystem.ts:94-104](../../src/game/ProcurementSystem.ts#L94)).

**Assessment.** The voice is recognizable but the joke engine is currently narrow and often repeats the same spending/profit/mansion punchline. Deepen the institutional world around the already-good premise: make characters react to the player's choices, make the annual campaign tell a continuing story, give each scenario/enemy/board a distinct comedic identity, and let unlocks and scorecards reward funny play styles as well as raw burn.

## Findings and recommendations

### 1. Identity and voice

**Existing facts.** The opening promises a satire of defense procurement ([TitleScene.ts:71-73](../../src/scenes/TitleScene.ts#L71)). The voice works best when official language stays perfectly straight while the underlying detail becomes ridiculous: e.g. the “single, unplugged Etch A Sketch” accounting system ([NewsHeadlines.ts:3-16](../../src/helpers/NewsHeadlines.ts#L3)), or the black-budget transfer described as “a black ledger” ([Procurement3DGame.ts:322-339](../../src/pinball3d/Procurement3DGame.ts#L322)). Other jokes use broad one-liners (“Fast, loud, and annoying. Like a lobbyist at 5pm.”) ([config.ts:183-190](../../src/game/config.ts#L183)).

**Proposal.** Use one consistent comedy rule: the institution never admits absurdity; it renames it, funds it, or schedules a hearing about it. Prefer specific procedural details and escalating consequences over generic “this is silly” punchlines. This preserves the deadpan bureaucratic voice and gives writers a reliable filter.

**Sample lines (proposals).**
- Threat briefing: “Unidentified object has been assessed as a strategic opportunity. Procurement requests a larger radar.”
- Overkill popup: “THREAT NEUTRALIZED. COST PER THREAT: CLASSIFIED.”
- Low readiness: “Readiness is down to 12%. The dashboard has been rotated to landscape.”
- New mansion: “The residence is complete. Its defensive perimeter is larger than the neighboring municipality.”

### 2. Character and story

**Existing facts.** Five fictional composite characters have distinct job titles and short combat/procurement line arrays: Peter Kegsbreath, General Ledger, Miranda Margin, Senator Addington, and Avery Audit ([Characters.ts:13-70](../../src/game/Characters.ts#L13)). `characterLine` randomly picks one line per call ([Characters.ts:72-75](../../src/game/Characters.ts#L72)). In active combat UI, Peter appears when switching weapons and Avery appears after friendly fire ([CombatScene.ts:582-602](../../src/scenes/CombatScene.ts#L582), [CombatScene.ts:1092-1109](../../src/scenes/CombatScene.ts#L1092)). The procurement lines and three other characters are not called from scenes found in the source search. The campaign itself advances through doctrine → combat → readiness/procurement/mansion → random hearing → press release → next FY; the yearly event is a random selection of five one-button choices ([EventScene.ts:28-104](../../src/scenes/EventScene.ts#L28)).

**Proposal.** Give each character an identifiable comic function, then surface the cast at the natural beats where their expertise is funniest: Miranda comments on the procurement pinball table and profit totals; Addington offers event choices/election-safe explanations; Ledger gives readiness and delivery excuses; Avery reacts to audit, friendly-fire, and spending milestones; Peter frames campaign openings and year-end claims. Use compact callback dialogue and occasional two-character exchanges rather than long cutscenes. Track a few run flags (allied contacts spared/shot, money spent, contracts delayed, audit hits) so callbacks can refer to what actually happened.

**Sample lines (proposals).**
- Miranda after a huge purchase: “At that price, it should intercept the invoice too.”
- Ledger on a late shipment: “The capability is in transit. The paperwork has arrived.”
- Addington at a hearing: “My district supports the program, especially the portion located in my district.”
- Avery on a clean audit: “I found the number. It was under ‘miscellaneous confidence.’”
- Peter after an expensive victory: “The threat is gone. The fiscal-year precedent is permanent.”

### 3. Writing and reactive systems

**Existing facts.** News headlines are a fixed set of 13 entries ([NewsHeadlines.ts:3-16](../../src/helpers/NewsHeadlines.ts#L3)). Press releases use one of three fixed templates and always report FY, total burn, profit, and mansions, regardless of the run's most notable events ([PressReleaseGenerator.ts:5-18](../../src/helpers/PressReleaseGenerator.ts#L5), [PressReleaseGenerator.ts:30-42](../../src/helpers/PressReleaseGenerator.ts#L30)). Random events currently choose one option and apply a reward, with no meaningful choice or response ([EventScene.ts:28-104](../../src/scenes/EventScene.ts#L28)).

**Proposal.** Turn the existing “random content” surfaces into reactive content rather than merely adding lots more static lines:
1. Add template slots keyed to actual campaign metrics and recent events (most expensive intercept, most missed threats, friendly-fire count, readiness band, delivery backlog, audits hit, mansion district).
2. Give each hearing at least two choices with a funny trade-off and a later callback; a tiny set of reusable effects can support many text variants.
3. Let headlines react to unlocks and campaign state, and avoid selecting the same headline/template twice in a short window.
4. Vary line delivery by event category and character so a line is not repeated back-to-back; optionally mark line IDs as one-time milestones.

**Sample reactive release (proposal).** “Department Reports Readiness Gains After Reclassifying Three Missing Batteries as ‘Forward-Looking.’ Contractors post record profits; auditors request the new dictionary.” Follow with actual values and the specific run detail (e.g. “The 11th interceptor was used against balloons”).

### 4. Enemy and scenario variety

**Existing facts.** There are seven threat types. Four are already comic reframings (mower, scooter, balloons, friendly courier); mystery and hypersonic threats provide a straighter escalation ([config.ts:11-20](../../src/game/config.ts#L11), [config.ts:174-231](../../src/game/config.ts#L174)). Five scenario cards rotate deterministically by fiscal year, including the same “strategic snack” premise in both island defense and strike ([CombatScenarios.ts:18-81](../../src/game/CombatScenarios.ts#L18), [CombatScenarios.ts:83-84](../../src/game/CombatScenarios.ts#L83)). The wave director uses a single shared set of threat weights, only adjusting lawn-mower frequency and spawn interval as intensity rises; scenario `threatBias` is defined but not used in the inspected WaveDirector ([CombatScenarios.ts:3-16](../../src/game/CombatScenarios.ts#L3), [WaveDirector.ts:21-56](../../src/game/WaveDirector.ts#L21)).

**Proposal.** Make each theater's threat mix and briefing joke reinforce its setting. Add nonviolent nuisance/false-positive classes and rare “administrative boss” encounters (e.g. a paperwork swarm, a decoy with a media escort, a balloon formally recognized as a partner nation), rather than simply scaling speed/health. Give each scenario a short intro, local objective twist, unique after-action summary, and scenario-specific callout pool. Revisit “snack depot” so the same joke does not carry two scenarios.

**Sample scenario seeds (proposals).**
- Carrier group: “Protect the floating PowerPoint from a hostile revision history.”
- Homeland: “Keep the budget hearing on schedule; the threat is a live amendment.”
- Desert test range: “Secure the runway before the ribbon-cutting committee lands.”
- Rare false alarm: “Weather balloon requests diplomatic immunity.”

### 5. Campaign, rewards, and replay variety

**Existing facts.** The campaign tracks FY, burn, contractor profit, readiness, mansions, doctrine, delivery queue, and unlocks ([RunState.ts:20-33](../../src/state/RunState.ts#L20)). Weapon and pinball-board unlocks are awarded at FY or mansion thresholds ([RunState.ts:109-134](../../src/state/RunState.ts#L109), [config.ts:151-171](../../src/game/config.ts#L151), [PinballBoards.ts:585-635](../../src/game/PinballBoards.ts#L585)). Mansion districts and infrastructure unlock as the estate expands ([mansions.ts:39-55](../../src/data/mansions.ts#L39), [MansionScene.ts:63-76](../../src/scenes/MansionScene.ts#L63)). Mansion variants are selected deterministically by index within a district ([MansionSystem.ts:37-46](../../src/game/MansionSystem.ts#L37), [MansionSystem.ts:66-70](../../src/game/MansionSystem.ts#L66)). The score screen explicitly ranks spending ([LeaderboardScene.ts:19-27](../../src/scenes/LeaderboardScene.ts#L19)); sharing currently only includes FY, mansion count, and burn ([LeaderboardScene.ts:50-55](../../src/scenes/LeaderboardScene.ts#L50)). All three pinball boards currently share the same `LIVE_BUMPERS` and table, despite distinct names/art/unlock points ([PinballBoards.ts:585-615](../../src/game/PinballBoards.ts#L585)).

**Proposal.** Make each year feel like an episode in an escalating scandal: public rationale, private beneficiaries, one consequence carried forward. Give rewards a comic reveal (weapon unlock certificate, mansion plaque, contractor press quote) as well as mechanical value. Track a few optional “commendations” for alternate play: most restraint, most cost-effective defense, most audacious overspend, longest delivery delay, most suspiciously clean ledger. Preserve the spend-high leaderboard as one category, and add these parallel categories so replay invites different behavior. Give the audit/stadium pinball boards different bumpers/rules/readouts; their art and unlocks already promise distinct satirical experiences.

**Sample achievements (proposals).**
- “Austerity Event”: finish a year with the lowest burn in the department's history; award a plaque reading “Temporarily Under Review.”
- “Comprehensive Overmatch”: spend 100× the threat value on one interception; achievement text: “The invoice survived.”
- “Diplomatic Immunity”: spare every allied courier; the courier service sends a fruit basket, valued at $480,000.
- “Audit Trail”: hit every audit/efficiency opportunity; unlock Avery's “I have concerns” portrait.
- “No Bid, No Problem”: complete the pinball no-bid ramp; Miranda calls it “a competitive process with one competitor.”

## Priority order

1. **High impact / low risk:** extend the existing line banks and headlines; wire unused characters into already-existing moments; make press releases/headlines use actual run stats; add no-repeat behavior. This creates freshness without changing the campaign structure.
2. **High impact / moderate scope:** make hearing events actual two-choice trade-offs and add small persistent callbacks. This turns campaign years into authored episodes and makes decisions legible.
3. **High impact / larger scope:** scenario-specific threat mixes/objectives and unique board mechanics. The system already has scenario `threatBias` plus three named boards; connecting those promises to play should yield substantial replay variety.
4. **Polish:** enrich achievement/share text and mansion/unlock reveal cards with run-specific details.

## Suggested tone guardrails

- Keep the target on fictionalized institutions, incentives, and euphemisms; avoid making real victims or nationalities the punchline.
- Make the absurdity specific to procurement, budgeting, readiness, lobbying, and self-justifying reports.
- Avoid repeating “money becomes mansion” in every line; reserve it as the campaign's central payoff, then vary the local joke (delay, paperwork, metrics, prestige, interagency rivalry).
- Make outcomes observable: the press release should lie about something the player actually did, and a later character should remember it.
