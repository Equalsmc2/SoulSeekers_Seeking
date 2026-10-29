# R03.5 — Clean Field UI

**Visual/layout change only.** Built from R03.4.2. R03.3 Boston map, original no-Kenney renderer, dedicated WebSocket game server, offline training, DM possession, and R02.2 prediction/networking code are retained.

- Removed the always-visible 342px right column; the canvas now uses the full game area.
- Replaced character stats with a compact, gold-accented operative card at the lower left.
- Inventory (I) and jungle market (B) open **mutually exclusive** drawers. The shop can be viewed anytime; purchases remain restricted by the game's normal in-range / gold checks.
- Combat feed (L) opens on demand. Performance statistics (F3) are hidden by default and still calculate normally.
- Esc closes optional drawers and still cancels DM placement/possession.
- Kept three always-available DM spawn options and lane controls in a compact DM console.
- Simplified the top header, objective timer, tower health display, button styling, status/footer, and character selection menu.
- Redesigned narrower layouts; moved minimap above the lower toolbar when a window is under 790px wide, preserving minimap click-to-pan coordinates.
- No additional animation loops, map assets, Firebase changes, or dependencies.
- Preserved SYNC_TO_GITHUB.bat and the targeted cleanup of rejected Kenney tile artifacts.

## Local verification

- Node game/regression suites (including clean HUD test).
- JavaScript syntax checks.
- Static HTML/CSS layout snapshots at 1440, 960, and 550 pixels (these are **layout mockups**, not live game captures).
- Live Render or multi-browser input and gameplay performance still require a user-side test.
