# SoulSeekers: Seeking R03.4.2 — Gold UI / Clean Boston Map

Complete playable browser game, separate WebSocket game server, and GitHub Desktop sync BAT.

## This release fixes
- The accidentally inherited Kenney city tiles are **not** loaded or drawn. The game now uses the original cached vector/procedural Boston renderer from the expanded-jungle build.
- SoulSeekers branding is **gold first**, based on the V40.10 website palette: antique gold `#d9b45f`, bright gold `#f4d98b`, deep gold `#97752f`, charcoal, and ivory. Red is reserved for health and danger.
- The six heroes, HUD, inventory, shop, DM interface, offline training, game server, and game rules are preserved.
- The old tile screenshot assets and source renderer are absent from this ZIP. `MAP_OVERVIEW.png` shows the returned native renderer style.
- HTML/CSS/module cache keys are bumped to R0342 to avoid old art being retained by the browser after deployment.

## Installation
1. Extract the ZIP to a new folder.
2. Run `SYNC_TO_GITHUB.bat` (Windows). It copies this release into the existing `SoulSeekers_Seeking` GitHub Desktop repository, without deleting `.git`.
3. Choose `1` for GitHub Desktop, then **Commit to main** and **Push origin**.
4. Wait for Render and/or GitHub Pages to deploy, then hard-refresh both game windows.
5. Verify `PROTOTYPE R03.4.2 · GOLD UI / CLEAN MAP` in the header.

The BAT removes only known obsolete Kenney tile-renderer files at `src/city-art.js` and `assets/kenney/`; unrelated files and Git history are not touched.

## Testing
Run `npm test` for the 12 project test suites. Solo training runs without a live server. For online play, deploy the included Node service (see `R02_SERVER_SETUP.md`). Offline preview: launch `START_LOCAL.bat` and choose Party or DM training.

### Map and controls
Three curving roads converge, branch, and converge again. The upper jungle is the Hollow Common, and the lower jungle is the Underworks; both retain internal paths, shops, chests, cover and connections. The six forts, boss AI, and DM commands use the same coordinates as the prior build.

**Party:** WASD move, mouse aim/fire, Q spell, E Echo, Space dash, F chest, B shop, I inventory. **DM:** Select and place enemies, possess on click, right-click to command, and press Esc to release.

## Scope
No game networking or combat rules were intentionally changed. Local automated tests passed; live Render networking and a full visual/browser test still need validation on your device.

Change details: `CHANGELOG_R03_4_2.md`, `CHANGELOG_R03_4_1.md`.
