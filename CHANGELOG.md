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
