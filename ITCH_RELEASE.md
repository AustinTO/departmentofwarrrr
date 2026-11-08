# Department of WARRR: browser donation release

This release variant is a **candidate**, not evidence that the current version has passed QA.

## Build

1. Install Node 24+ and pnpm 10. From the repository root run `pnpm install --frozen-lockfile`.
2. Run `pnpm run build:itch`. This runs TypeScript checks and Vite with `--base=./`, generating relative script/style/asset URLs inside `dist/`.
3. In `dist/` archive the **contents**, not the parent folder: `cd dist && zip -r ../department-of-warrr-html5.zip .`. Verify the ZIP root contains `index.html`.
4. Open itch.io → Create new game → **Kind of Game: HTML**. Upload the ZIP and preview using itch.io's embedded player. Validate Phaser startup, 3D Rapier WASM load, audio permission/unmute, loading scenes, touch/keyboard input, game-state save after reload, and viewport scaling. Test offline separately for native builds.
5. For browser play, choose **free with optional donations** and a suggested $2.99 support amount. itch.io does not currently put its embedded HTML game behind a required payment. Payments require seller settings, and donors choose whether to support. Do not claim a purchased/supporter entitlement in-game.
6. Only mark the page public after the full campaign scene flow is checked and the game/art/audio licenses permit distribution. Add a clear parody disclosure, screenshots of **real gameplay**, controls, privacy/support text and a concise description.

## Distribution-specific notes

- This is not a native paid PC or mobile build; use a separate downloadable package if selling access.
- No payment credentials, ad SDKs, tokens or customer data should be embedded in the web build.
- If external asset paths still start with `/` they may break in the itch.io iframe despite the relative Vite output. Inspect network requests during preview and correct any such paths before publishing.
- Keep game localStorage key versioning stable to avoid discarding saves in future updates. Cross-origin hosting changes may mean existing saves do not migrate automatically.
- Keep normal Android `pnpm run build` path unchanged.

Sources:
- https://itch.io/docs/creators/html5
- https://itch.io/docs/creators/payments
