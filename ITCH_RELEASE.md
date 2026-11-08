# Department of WARRR: browser donation release

This release variant is a **candidate**, not evidence that the current version has passed QA.

## Build

1. Install Node 24+ and pnpm 10. From the repository root run `pnpm install --frozen-lockfile`.
2. Run `pnpm run build:itch`. This runs TypeScript checks and Vite with `--base=./`, generating relative script/style/asset URLs inside `dist/`.
3. Run `pnpm run check:itch` to verify the generated index and required game assets are packaged with relative URLs. The **manual-only** GitHub Actions workflow now produces a downloadable `department-of-warrr-html5-preview` ZIP artifact after tests and both builds pass. No actions run automatically on push.
4. In `dist/` archive the **contents**, not the parent folder: `cd dist && zip -r ../department-of-warrr-html5.zip .`. Verify the ZIP root contains `index.html`.
5. Open itch.io → Create new game → **Kind of Game: HTML**. Upload the ZIP and preview using itch.io's embedded player. Validate Phaser startup, 3D Rapier WASM load, audio permission/unmute, loading scenes, touch/keyboard input, game-state save after reload, and viewport scaling. Test offline separately for native builds.
6. For browser play, choose **free with optional donations** and a suggested $2.99 support amount. itch.io does not currently put its embedded HTML game behind a required payment. Payments require seller settings, and donors choose whether to support. Do not claim a purchased/supporter entitlement in-game.
7. Only mark the page public after the full campaign scene flow is checked and the game/art/audio licenses permit distribution. Add a clear parody disclosure, screenshots of **real gameplay**, controls, privacy/support text and a concise description.

## Distribution-specific notes

- This is not a native paid PC or mobile build; use a separate downloadable package if selling access.
- No payment credentials, ad SDKs, tokens or customer data should be embedded in the web build.
- If external asset paths still start with `/` they may break in the itch.io iframe despite the relative Vite output. Inspect network requests during preview and correct any such paths before publishing.
- Keep game localStorage key versioning stable to avoid discarding saves in future updates. Cross-origin hosting changes may mean existing saves do not migrate automatically.
- Keep normal Android `pnpm run build` path unchanged.

Sources:
- https://itch.io/docs/creators/html5
- https://itch.io/docs/creators/payments

## The playable 3–5 minute daily challenge

The title screen now includes **Daily Budget Crisis**: a UTC-seeded 60-second combat scenario, a fast policy choice, a two-ball procurement round, and a local-only shareable dossier. The full campaign remains unchanged. This is the best browser storefront preview route because it gives new players a short complete experience and a reason to return tomorrow. Every attempt can be replayed locally on the same day.

## Suggested itch.io page copy

**Title:** Department of WARRR

**Subtitle:** Shoot down cheap threats with absurdly expensive weapons. Somebody gets a mansion.

**Short description:** A fictional defense-procurement satire where defending a base is only the beginning. Survive a minute of chaotic arcade combat, make a questionable policy decision, and play 3D procurement pinball to inflate the contract. Try the daily Budget Crisis for a quick challenge, or build your personal empire in campaign mode.

**Controls:** Tap/click a target to fire. Choose weapons in the armory wheel (Q/E or scroll on desktop). In pinball, touch the lower sides to flip (A/D or arrow keys), and drag/release the physical plunger (or Space). Pause is available during combat and pinball.

**Support:** Free to play in the browser. If the satire made you laugh, the itch.io donation option is an optional way to support development; it does not grant gameplay benefits.

**Disclosure:** Fictional satire. Not affiliated with any government or defense agency. Local scores aren't verified public rankings. Check game/art/audio rights before publishing.
