# Department of WARRR: commercial rescue and release gates

Date: 2026-11-08. This is a code-inspection plan, not playtest evidence, revenue verification, or proof that advertising/billing is integrated.

## Diagnosis

This is an unusually rich satirical hybrid of 60-second combat, intermission logistics, procurement pinball, and mansion progression. It already has five combat scenarios, three upper-pinball board variants, authored comedy, persistence, results/grades and local score sharing. The technical foundation is stronger than a typical prototype, but the product loop is demanding on the first session: players were thrown directly into timed combat, with terse green-ally warning, while end-of-combat grades auto-advanced after 3.8 seconds. There is still no demonstrated physical-device performance or human retention evidence; the latest recorded test/build success (129 tests) predates this branch.

The current package has Capacitor Android, Phaser, Three and Rapier but no integrated ads SDK, Play Billing entitlement service, analytics funnel, or consent flow. There is currently *no implemented commercial monetization*. Do not call a stub rewarded-ad callback and then grant a reward.

## Implemented in this branch

- One-time, local-device combat field guide that pauses the first 60-second wave. It explains targeting, ally identification, weapon selection, premature exit, and the campaign loop.
- Replayable field guide from pause, separate from campaign reset state. Settings migration preserves existing volume values.
- Persistent combat mission objective strip. Clearer goal regardless of random scenario choice.
- Readiness logistics redesigned from five stacked source cards and 25 small transfer targets to a single selectable supply source, five large munition rows, batch selection, and an explicit confirmation modal. Pure transfer previews and unit tests check stock/readiness consequences.
- Resolve two significant engagement bugs: defeated active theater now triggers game-over even when global average readiness is nonzero; completed fiscal years now reach the local Hall of Fame (previously only defeated runs were saved).
- Combat grade/score sheet now waits for an explicit Continue interaction (Enter on keyboard also works). The result overlay blocks combat input and the Continue action is one-shot.
- New manual-only GitHub Actions test/build workflow. No workflow runs on push.
- Regression tests for the persisted training preference. This branch has NOT been run against physical devices or the full CI suite; run the workflow and browser/mobile playtest before merging.

## Browser-first donation test (implemented packaging path, not published)

Run `pnpm run build:itch` to compile a standalone Vite build with relative URLs, specifically suitable for deployment under an itch.io HTML5 embed URL or other subpath. Zip **the files inside dist**, with `index.html` at the ZIP root, and preview the uploaded browser version before publishing. Normal `pnpm run build` and the Android Capacitor packaging path remain unchanged. A manual-only CI workflow builds both variants but does not upload or deploy.

itch.io currently permits **donations only for HTML5 games that run directly in the browser**, not a mandatory paywall on that HTML5 embed. Create a free HTML Game with optional $2.99 suggested support, and use appropriate screenshots/store copy to test whether players value the satire. For charging minimum access price instead, distribute a supported desktop/downloadable build and test it first. Seller payment setup, tax handling, licensing, and the actual storefront publication remain manual. The game still has no payment service integration.

Official instructions: https://itch.io/docs/creators/html5 and https://itch.io/docs/creators/payments.

## Daily Budget Crisis mini-run (implemented source, verification open)

The title screen offers a separate UTC-seeded quick daily run. It uses the existing 60-second combat encounter, one tradeoff decision, a reduced two-ball procurement round, and a result dossier with locally stored personal best and native-share/clipboard fallback. Daily scratch mode suppresses campaign saves, then restores the prior persisted campaign at completion or quit. Campaign Hall of Fame and daily best are separate. These are **local, editable scores** and do not claim ranked security. See `DAILY_BUDGET_CRISIS.md`.

The manual-only validation workflow now generates an HTML5 ZIP artifact after running tests, both Vite builds and a relative-path package check. Preview on itch.io before making public. No store listing, sales, telemetry, payment links or SDK integrations were created.

## Sustainable monetization experiments, in priority order

1. **Free game, voluntary rewarded ads at a genuine break only.** After combat results or at procurement setup, offer a clearly labeled opt-in ad for a modest *one-time-per-FY* convenience or bonus (e.g. one extra pinball ball, never a forced ad, never fake scarcity). The offer must be absent when ads are unavailable or consent is missing. Avoid interrupting waves, pinball, or callbacks. Implement AdMob native integration, consent gating, mobile lifecycle recovery, test IDs, reward callback semantics and an idempotent per-FY grant in separate steps. Never grant ad rewards on load/open/close, only the completed reward callback. Add anti-abuse/SSV before valuable rewards.
2. **$2.99–$3.99 one-time Supporter Edition, optionally later.** Sell cosmetic table, mansion plaque, art packs, commentary and a supporter badge; do not gate the core combat campaign, existing unlocked boards, or functional progression. If forced ads are ever introduced (not recommended now), include ad-free playback. Use Play Billing Library 8+ on Google Play, verified purchase state and restore flow. Purchased entitlements must NOT depend solely on editable RunState/localStorage.
3. **Web/desktop distribution to acquire players.** Shareable satirical scorecards and curated clips are more plausible initial growth channels than paid CPI without retention data. Offer voluntary support or a premium PC edition on an appropriate storefront, without routing Android Play in-app digital goods to external payments.
4. **Only after retention proof:** consider content packs with new board mechanics or challenge archetypes. Do not sell currently free campaigns or gameplay necessities.

These options supersede the historical 'do not add ads' suggestion in the older draft roadmap, but *no ad or purchase UI is shipped on this branch*. Integrate only after consent, billing, testing, and policy checks are complete.

### Rough revenue sanity check (scenarios, NOT forecasts)

With a hypothetical $8 rewarded-ad eCPM, 25% of daily players opting into rewarded ads, and 1–2 completed impressions per opt-in player per day, roughly **1,667–3,334 daily active users** would be needed to gross $200 in 30 days. Fill, country mix, impression limits, seasonality, policy, churn and acquisition costs can worsen this. A $2.99 one-time purchase with an *assumed* 15% platform fee would require ~79 monthly sales before taxes/other costs. Neither model is likely to work without an audience and repeat play.

## Highest-impact next gameplay work

P0: run the manual suite and full browser campaign, collect Android frame times and screenshots (small/narrow device, landscape, multiple scene transitions), fix any control hit-zone or modal clipping. Confirm first-year objective comprehension with five new players. Record first combat completion, where they hesitate, grade readability and whether procurement is discoverable.

P1: redesign long intermission screens around a *single consequential choice and its visible payoff*. Make each fiscal year follow a recognizably different challenge beat; show an end-of-year 1-screen cause/effect recap. Improve first-year loss/recovery and explain which weapon works on which threat. Audit audio/music reuse, asset preload size, memory and WebView lifecycle. Avoid adding new currencies.

P2: build a short standalone **Daily Budget Crisis** (one scenario, one procurement table, fixed seeded loadout) playable in 3–5 minutes, with local best and shareable seed. This is the most promising acquisition/return loop alongside the full campaign. Do not fake server leaderboards or imply leaderboard integrity when all state is local.

P3: integrate minimal privacy-conscious funnel metrics (first launch, first shot, ally incident, first FY completed, procurement completed, next-day return, optional ad viewed, supporter conversion). A Cloudflare Worker plus aggregated D1 can work, but privacy/legal/age declarations must be completed before collecting data. Do not invent retention percentages from automated tests.

## Critical Android release blocker: unsupported Capacitor target combination

Current checked-in dependencies are @capacitor/android / core / cli **6.2.x**, while `android/variables.gradle` manually sets `compileSdkVersion = 36` and `targetSdkVersion = 36`. Google's August 31, 2026 rule requires target API 36+ for new Android apps and updates. However, the Capacitor supported SDK matrix pairs Capacitor **6.x with API 34**, and **8.x with API 36**; the Capacitor team explicitly does not support overriding to a different target SDK with the old major. An API-36 declaration alone is not a verified compatible build. Official references:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://next.capacitorjs.com/docs/next/android/setting-target-sdk

**Before release**, upgrade `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/app` and `@capacitor/preferences` to compatible Capacitor 8 versions and follow their migration guides; regenerate lockfile with pnpm, sync/carefully reconcile the Android Gradle project, and test Android 16/API36 plus an older supported device. Investigate WebView/WASM startup, edge-to-edge/safe area, background/resume, media/audio and 3D graphics. Do NOT ship an untested major upgrade, and do NOT present this branch as a compliant release.

Native monetization must also use supported Play Billing Library **8 or newer** at new publication/update time and a properly tested native ads adapter; Google Billing 7's new-publication/update support ended August 31, 2026. Official: https://developer.android.com/google/play/billing/deprecation-faq.

## Release decision gates

- Android device build/install, offline cold start, and repeated WebView suspend/resume.
- Game running without exceptions through title → doctrine → combat → readiness → procurement → mansion → event → next year.
- Pinball on-device performance and accuracy; no stuck inputs in interrupted calls; complete one authorized contract exactly once.
- No intrusive ads, no accidental taps that purchase/serve ads; UMP and privacy disclosures before ad personalization, age treatment according to actual audience.
- Native purchase entitlement testing with refund/reinstall/restore, order acknowledgement and idempotent rewards.
- Play Store target audience, ad declaration, Data Safety, content rating and screenshots accurate.
- Keep push-triggered GitHub Actions disabled: only workflow_dispatch for validation.

Official policy references: 
- https://support.google.com/googleplay/android-developer/answer/12271244 (Better Ads)
- https://support.google.com/googleplay/android-developer/answer/18265346 (Payments)
- https://developer.android.com/google/play/billing/deprecation-faq (Billing deadlines)
- https://developers.google.com/admob/android/next-gen/rewarded (Rewarded ads)
- https://developers.google.com/admob/android/privacy (UMP consent)
- https://support.google.com/googleplay/android-developer/answer/9893335 (Families policy)
