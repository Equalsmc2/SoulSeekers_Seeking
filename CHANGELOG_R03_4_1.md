# R03.4.1 — Correct the accidental Kenney map inheritance

- Removed all Kenney map tile rendering paths and deleted city tile atlas and renderer from package.
- Restored the game's native Boston procedural/vector renderer, using the same lane, jungle and collision coordinates.
- Kept ACT III SoulSeekers main menu, HUD, character cards, inventory, shops and DM interface.
- Preserved online server and simulation code and maps.
- Updated GitHub sync BAT to remove exactly the known old asset files when deploying.
- Bumped HTML, JS and CSS versions to avoid cached R03.4 displaying old assets.
