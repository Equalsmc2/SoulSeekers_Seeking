# R01.5 — Startup recovery / cache-bust (October 21, 2026)

- Fixed dependency coupling: **offline training no longer requires Firebase modules to load** before main menu buttons work.
- Cache-busted `main.js`, `network.js`, `engine.js`, `data.js`, and `firebase-config.js`, avoiding old/new module version mismatches after GitHub Pages deployment.
- Added a plain JavaScript startup watchdog: missing JS modules now produce a visible message instead of a nonfunctional, unpopulated menu.
- Added readable initialization failures and separate `CONFIGURED / READY TO CONNECT` vs live-connected statuses.
- Kept Firebase project configuration, RTDB rules, gameplay, and corrected GitHub sync BAT unchanged otherwise.
- No Deadlock-map redesign in this stabilization release.

## R01.4 — Lobby connection diagnostics and join fixes

- R01.3 configured Firebase app retained unchanged.
- Party join now checks the host room and reads a valid initial game state before declaring the player connected and hiding the menu.
- Network failures are translated into visible and actionable messages (room missing, occupied slot, rules/permissions, anonymous auth, network errors).
- Persistent in-game warning for live snapshot/roster listener failures.
- Room-code normalization (spaces/dashes/case), keyboard Enter to join, and a visible Copy Room Code button for the DM.
- Safe Firebase initialization promise; a failed authentication attempt can be retried.
- Lobby joins can continue even if Firebase declines onDisconnect cleanup registration; failures are reported in the developer console.
- Regression tests added for valid joins, missing rooms, occupied slots, unauthorized rules, and live input routing with a mock database.
- Corrected GitHub sync BAT retained from R01.2. Gameplay rules and Boston prototype map unchanged.

**Live Firebase testing** still requires two independent browser sessions and the RTDB rules to be deployed in the user's project.

## R01.3 — Firebase Web App connected (configuration only)

- Pre-filled `firebase-config.js` with the user-provided SoulSeekers-Seeking Firebase settings, including Realtime Database URL.
- Preserved corrected R01.2 `SYNC_TO_GITHUB.bat` and existing gameplay unchanged.
- Firebase Console setup (Anonymous Auth and publishing Realtime Database rules) must still be completed independently; this update cannot apply console settings.
- Web SDK uses client-side config; no analytics initialization has been added.

## R01.2 - GitHub Sync Fix
- Fixed Windows Robocopy path quoting when the extracted ZIP source directory ends in a backslash.
- No gameplay changes.

## R01.1 — GitHub Desktop sync helper
- Added SYNC_TO_GITHUB.bat to copy the ZIP project into a cloned GitHub Desktop repository.
- Added optional automatic commit/push when Git is available.
- Added simple GitHub publishing guide. Game engine unchanged.

# CHANGELOG — SOULSEEKERS: SEEKING

## R01 — 2026-10-21 — Initial playable prototype

- New, independent static-browser game suitable for Phoenix Code Live Preview and GitHub Pages.
- 6,800 × 2,000 Boston-blackout arena with three lanes, two jungle belts, fortresses, shops, chest locations, map-blocking buildings, and a central enemy Tower.
- Six playable Party slots, optional AI teammates, top-down shooting, Q and E spells, progression, respawn.
- Six bosses, six forts, shielded tower, 20-minute timer.
- Repacking/rotating inventory, passive equipment, consumable restoratives, gold and XP.
- DM control plane with threat-spending deployment, unit possession, and march commands.
- Firebase RTDB room hosting/slot-claim/input/snapshot scaffold plus starter access rules.
- Local testing and GitHub Pages deployment instructions.

**NOT VERIFIED:** Multiplayer against a live Firebase instance and full browser visual QA.
