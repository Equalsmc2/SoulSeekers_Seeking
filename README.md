# SoulSeekers: Seeking R03.3 — Boston Map Polish

**This is the complete, playable R03.3 build.** It preserves the R03.2
three-lane Boston map, expanded jungles, bosses, forts, DM controls,
inventories, dedicated WebSocket server, and GitHub sync BAT. No Firebase changes.


## What is new in R03.3

The city art is intentionally less noisy and more readable. This is a **visual polish update**, not a rework of game rules or netcode.

- **Street construction**: curves have consistent asphalt, curb edges, centerline paint, realistic bridge parapets and deliberate crosswalk markings.
- **Urban fabric**: single-material rooftops with cornices, hatches, skylights, vents, and subtle shop awnings. Street edges and shadow footprints are more cohesive.
- **Hollow Common**: three landscaped park promenades, planted courts, flower islands, gatherings and connected paths; key features remain traversable.
- **Underworks**: parallel steel rails, sidings, service aisles, hazard accents, and a much more recognizable freight-yard identity.
- **Blackout tone**: restrained evening grading and warm street lamps; high-contrast game actors remain readable.
- **Rendering**: static art is still cached as one background layer; multiplayer input, 30Hz server logic, and 20Hz snapshots were not modified.

**Important:** Roads, rail sidings and park paths are artistic interpretation of existing playable corridors. Visual decorations do not introduce new collision. The shared map collision and paths are unchanged from R03.2.

For visual review, open `MAP_PREVIEW.png` then `MAP_OVERVIEW.png` to zoom, or see `NORTH_GARDEN.png`, `UNDERWORKS.png` and `BEACON_CITY.png`.

## Art upgrade

- **Original source:** User-supplied Kenney Roguelike Modern City 2.0 artwork
  (Creative Commons Zero, CC0), copied to `assets/kenney/city_tiles.png`.
  License text is included in `assets/kenney/LICENSE.txt`.
- **Game renderer:** `src/city-art.js` now builds a pixel-art version of the actual
  6,800 × 2,000 world from the same server-side buildings, parks, lanes, road
  junctions, shop positions, jungle landmarks, and obstacle coordinates.
- **Artwork:** Crisp 16px tiles, drawn at 32 world units using nearest-neighbor
  sampling. Roads, sidewalks, park trails, freight routes, varied rooftops,
  cars, trees, crates, transit equipment, shop canopies and fort/chest art.
- **Performance:** The static map is still drawn once to an offscreen canvas,
  then cropped every frame; no new per-frame background tile loops.
- **Graceful fallback:** If the sprite atlas hasn't loaded yet, the previous R03.1
  map temporarily displays. The pixel-art cache replaces it on atlas load.
- **Unchanged:** Server ticking/snapshots, movement prediction, aiming, damage,
  jungle navigation, cover collision, DM possession and gameplay rules.

`MAP_OVERVIEW.png` and `MAP_PREVIEW.png` are generated from the actual
pixel-art drawing routines (not AI mockups).

## Updating GitHub / Render

Extract the full ZIP, double-click `SYNC_TO_GITHUB.bat`, choose **1**, then
**Commit to main → Push origin** in GitHub Desktop. Allow Render to redeploy,
and hard-refresh the game. The title should read **R03.3 · BOSTON MAP POLISH**.

## Visual note

The Kenney pack is retro pixel art. This is an art-direction foundation, not a
claim of final bespoke Boston artwork. The existing map geometry is unchanged.
Detailed bespoke neighborhood architecture and character sprites can follow.

---

# SoulSeekers: Seeking — R03.1 Boston Expanded

**Complete browser game + dedicated WebSocket game server.** R03.1 upgrades the R03 Boston map with much larger jungles, more distinct architecture, and more tactical play while preserving R02.2's smooth multiplayer and the working GitHub sync BAT. The stylized geography is inspired by Boston rather than geographically exact.

## New playable map

- **Three curved lanes** begin from the Party's shared western approach, fan out across town, and converge on the DM Tower.
- **Upper jungle: The Hollow Common.** A broad park district with a Public Garden-style Swan Pond, Silent Memorial, spectral Bandstand, three navigable trails, six short internal connector paths, a shop, chests and planter cover.
- **Lower jungle: The Underworks.** An equally broad transit/industrial district with a Red Line depot, blackout substation, freight yard, three separate trails, six internal connectors, a shop, chests and cargo cover.
- Each jungle reaches roughly **480 world units across** at the broadest points, compared with R03's 207-unit strip. The jungle tapers naturally near the converging ends of the map.
- **Strongly differentiated lanes:** historic brick north, civic downtown center and industrial harbor south, with 15 abandoned vehicles that block movement and shots.
- **16 chests**, including two premium signal caches rewarding 220 gold and 130 XP each. Ordinary chests still give 90 gold and 55 XP.
- Six fort/boss pairs, level progression, item purchases, 8×5 inventory, DM troops/possession, and the 20-minute win condition remain.

See `MAP_OVERVIEW.png` for the full overhead map and `R03_1_MAP_TEST_PLAN.md` for testing.

## Update your GitHub Pages + Render game

1. Extract the **whole R03.1 ZIP** into a new folder.
2. Double-click **`SYNC_TO_GITHUB.bat`** beside `index.html`. The BAT remembers the GitHub Desktop repository location from previous releases. Confirm the file copy, choose **1** for GitHub Desktop.
3. In GitHub Desktop, **Commit to main** and **Push origin**.
4. Allow **both Render and GitHub Pages** to finish deploying. Render should show **Live**.
5. In Zen, hard-refresh with **Ctrl + Shift + R** (or use a private window). Confirm `PROTOTYPE R03.1 · BOSTON EXPANDED` appears.
6. Create a **fresh DM room** and join with a new Party connection; deploys restart the in-memory match server.

There are **no new Firebase steps** and **no need to create another Render service**. R03.1 uses the existing dedicated Node WebSocket server for live combat and rooms; your historical Firebase config is preserved, not used for live snapshots.

## Local testing

- Start offline training by opening `index.html` via an editor's Live Preview, or run `START_LOCAL.bat` (Python required).
- To play locally with a server, run `START_GAME_SERVER.bat` (Node >= 20).
- Run `npm install`, then `npm test` to run the nine local test suites.

## Performance and limitations

R03.1 retains the cached 6800×2000 Canvas world, server-side 30Hz simulation, 20Hz network snapshots, local player prediction and server-timestamped interpolation from R02.2. Cover/city geometry is deterministic and shared by the client and server. A ten-second, roughly hundred-enemy engine sample completed well within the tick budget **in this environment**, but a live Render + Zen seven-player stress test remains necessary.

The map is still a stylized game prototype, not hand-painted final artwork. Decorative pond/landmark art remains walkable where no collision cover appears. Matches still reset on server restarts and are not durable competitive sessions.

