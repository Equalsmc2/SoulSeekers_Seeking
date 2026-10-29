# Provenance and verification — 2026-10-29

## GitHub current Seeking website
- GitHub repo: https://github.com/Equalsmc2/SoulSeekers_Seeking
- Main branch commit: `2425f7b7b2345c7ddf3e84aab15ceeea9654faa3` (commit message `m`; committed 2026-10-29 01:07:17 UTC).
- Live GitHub source `index.html` has `R03.5` version label.
- The saved R03.5 ZIP is **byte-for-byte verified** against GitHub blobs for the checked key files below (git blob SHA1 match):

| File | Matching Git blob SHA1 |
|---|---|
| `index.html` | `ae660460deac4560abef5b443ad641ab82d80e8d` |
| `package.json` | `ef26a432372f9cbb696cdd3ba2d8cbd4e44f898c` |
| `src/main.js` | `cea50e996e7ac8cca857898647c46f92fa77c10a` |
| `server/matches.mjs` | `70d21ca13e32131e189e3d46da8a62e9702f3291` |
| `clean-hud.css` | `863e730e8fe4dee6ad66be34424027a0f3686bec` |
| `src/engine.js` | `491ace3c58110fbd590436c6bb9e2ae3c4acbd37` |

The archive is sourced from the user's saved R03.5 release, not a fresh full repository zip download; critical current-code files have been matched to GitHub. Do not interpret the check as a byte-by-byte comparison of *every* file.

## Local test evidence
- Site R03.5: `npm test` ran successfully in the handoff container on 2026-10-29: 14 tests passed, 0 failed. Original test log in `04_HANDOFF_DOCUMENTS/SITE_R03_5_TEST_OUTPUT.txt`.
- Party V19.2: the release includes its own `SoulSeekers_V19_2_README.txt` with the prior browser test details; no new live seven-player test performed here.
- DM R05.4: `TEST_RESULTS.md` inside DM source documents prior Chromium checks; this is local single-browser code. No new seven-player online benchmark here.

## Three releases included
- `01_LATEST_SEEKING_SITE_R03_5`: full website plus WebSocket server, tests, assets, README, Render config, BAT sync scripts.
- `02_LATEST_PARTY_LAB_V19_2`: newest standalone Party combat/magic HTML, README, screenshot.
- `03_LATEST_DM_COMMANDER_R05_4`: newest standalone DM build/command prototype, README, screenshots, test results.
- `05_ORIGINAL_RELEASE_ZIPS`: unmodified user-owned release archives for preservation.

## Non-verified
- Real Render performance of any future merged game.
- Seven-player networking with dungeon cards/Party V19.2 systems.
- Combat balance for actual 40-minute matches.
- User's current live hosted deployment status beyond the GitHub main branch review.
