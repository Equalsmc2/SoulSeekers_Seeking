# R03.4 — Soul Seekers ACT III UI alignment

Source of visual language: **Soul_Seekers_V40_10_ASYA_THREE_SOUNDS_NO_DOUBLE_FULL_WEBSITE.zip** (user's prior SoulSeekers website). The game now reuses the website's Soul Seal SVG and a licensed-for-this-project Boston banner image from that same supplied website package.

## Visual decisions
- ACT III typography, scarlet diagonal editorial accents, ivory panels, charcoal background, teal used for operational feedback, larger character identities.
- Soul Seekers crest at top; slim status rail; branded game lobby with Boston photo and large ACT III type.
- Consistent styling for Party and DM dashboards, HP/XP, match timer, fort/tower status, 8×5 inventory, shops, unit summons, combat feed, victory overlay, room-code and server controls.
- All original DOM IDs and JS handlers preserved; only markup wrappers/labels and CSS changed. No additional JavaScript render loop, particle effects, CSS animation loop, or full-screen backdrop filter.
- Honor small screens and `prefers-reduced-motion`.

## Verification
1. Extract ZIP, start `START_LOCAL.bat`, choose Party and DM offline training separately.
2. Test hero selection and role buttons; check in-game inventory (I), shop (B), DM summon buttons and lane selection.
3. To confirm live connectivity, use the existing Render server URL and host/join in different browser windows.
4. Performance monitor remains displayed, networking and collision unchanged. Running `npm test` tests game logic separately; browser test checks the CSS UI.

No Firebase setup changes. Current source is R03.3; this release is **R03.4 visual UI**.
