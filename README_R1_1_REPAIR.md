# SoulSeekers: Seeking — Integrated R1.1 Repair Candidate

This is the **complete replaceable source project**. It is NOT a claim of browser-certified final quality. It preserves R1's connected DM + six-Party gameplay and repairs the loadout flow, V22.4 presentation adapters, prediction acknowledgments, and Render onboarding.

## Start locally (Windows)

1. Extract this ZIP. Open the `SoulSeekers_Integrated` folder, which contains `package.json`.
2. Install Node.js 20+ if needed.
3. Run `npm ci` from Command Prompt or Terminal (requires access to npm), then `npm start`. For a development-only environment without npm access, the project has a basic uncompressed WebSocket fallback; Render production **requires** the `ws` dependency.
4. Open **http://localhost:8787/dungeon.html**.
5. DM clicks **Create Session** and builds a dungeon. Party members join with the code; each selects **character → one dodge → one weapon**, then clicks **Ready to Play** once connected. The DM locks seven reachable souls and starts.

The official Render URL used in onboarding is **https://soulseekers-seeking.onrender.com**. GitHub Pages (`https://equalsmc2.github.io`) serves static HTML only. The Party/DM must connect to the Render game **server**, never to the Pages URL for WebSockets. If hosting the page directly on Render, the local origin is accepted. Render's free plan can sleep and lose live matches on restart.

## Repairs implemented

- Server-validated one-weapon/one-dodge loadout; cannot ready without it. Loadout persisted on the Party seat and preserved after reconnect. No Q or Z/X switching during gameplay. `R` remains weapon-specific reload/special; `Space` activates the chosen dodge.
- Character-specific selection screens show name, description, cooldown and range plus previews. Both weapon and dodge selection must happen before joining; Party only readies after the server confirms.
- V22.4's melee model geometry and all twelve weapon model variants are rendered in the live dungeon. Sweeps, ranged aiming, projectile tracers, spell-zone fills, trails, and server-fed particle bursts are rendered through `src/v22-presentation.js`. V22.4-level visual parity is **not yet browser certified**.
- Local immediate feedback for attack/cast and limited early dodge visuals. Authoritative snapshots include per-Party `ackInputSeq`; client replays bounded outstanding movement inputs, smoothly corrects small divergence, and resets on large divergence or active server dodge modes. Remote actors retain the original buffered timestamp interpolation. Server still owns HP, damage, cooldowns, movement collision, resources, and wins.
- Room art is cached on the live client to avoid rebuilding the procedural room on every animation frame. V22.4-style gold-and-charcoal resource HUD and F3 diagnostics were added.
- Pages origin rejected as a server URL; Pages-hosted clients default to the known Render endpoint. Connection status displays server-wake-up, retry, terminal failure, and actionable error messages rather than indefinite silent reconnect.

## Performance and troubleshooting

Press **F3** during a match to inspect browser frame time, snapshot spacing, measured RTT, prediction-correction distance, reset count, and interpolation delay. Compare with V22.4 using the same character, the same action and the same display resolution; note which differences are visual versus input delay, jitter, or authoritative correction.

- `npm test` — historical R1 tests plus new loadout/ack tests; recorded **35/35 passes**.
- `npm run test:lag` — 1 DM + 6 real local WebSocket clients with induced 55±15ms one-way delay; check `NETWORK_LAG_QA_RESULTS.json`.
- `npm run benchmark` — server-side, CPU-only 30-second synthetic scenario. This **does not** measure browser FPS or live Render latency.
- `node tools/browser-qa.mjs` — optional Chromium visual QA with Playwright installed; run locally. In the build environment, Chromium navigation to the local server was blocked by environment network policy, so this has **not** passed here. Firefox is likewise unverified.

## GitHub Desktop and Render (manual only)

**Nothing was changed or deployed to GitHub, Render, or Firebase in producing this archive.**

1. Open your checked-out repository in GitHub Desktop, preferably create a new branch `r1-1-repair-review`.
2. Copy the **contents** of this archive's `SoulSeekers_Integrated` folder into the repository root. Do not add an extra nesting level, `.zip`, or `node_modules`.
3. Inspect changed files and run `npm ci`, `npm test`, `npm run test:lag` and a full local browser visual/feel test.
4. Commit/push **only if you approve**, remembering `render.yaml` currently has auto-deployment enabled on commit. Pushing to an auto-deploy branch may change Render automatically.
5. Render: Node web service, repository root, build `npm ci --omit=dev` (or existing `render.yaml`), start `npm start`, `/health` for health check; Node 20+; use HTTPS and WSS for Pages-hosted play.
6. On GitHub Pages, serve **all** frontend assets including `src/v22-presentation.js` and shared `.mjs` files. Refresh browser caches after publishing. Do not modify Firebase rules; multiplayer combat stays on the Node WebSocket server.

**Known risks:** no browser visual certification, no Firefox verification, Render free-plan cold starts and lost sessions after restart, no server persistence, no 40-minute six-human WAN match, some remaining V22.4 effects have adapted rather than identical display. Read `KNOWN_LIMITATIONS.md` and `REPAIR_TEST_REPORT.md`.
