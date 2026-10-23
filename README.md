# SoulSeekers: Seeking — R03 / Boston: The Blackout

**R03 adds a completely redesigned playable Boston-inspired map to the R02.2 dedicated-server prototype.** It preserves the networking improvements from R02.2 (30Hz authoritative simulation, 20Hz server snapshots, local prediction, buffered interpolation, frame-time diagnostics). No new Firebase project, GitHub repository, or Render service is necessary.

## What is new

- **Three continuous curved lanes**: all six Seekers enter at the central Party staging area, split toward Beacon Hill / Downtown Crossing / South End, and **converge toward the DM Tower**. This is a stylized supernatural Boston, *not* a geospatially accurate street map.
- **Two jungle travel corridors** between the lanes, with greenways, loot chests and two shops, and **six cross-town connectors** for rotations between lanes.
- **Boston atmosphere**: stylized Charles River crossing, brick and slate rooftop blocks, brownstones, street lights, marked roads, transit T signs, park routes, Seaport docks and supernatural signal anomalies. All scenery is built from deterministic Canvas geometry (no downloaded image dependencies).
- **Functional game geometry**: forts and bosses align with curved roads; AI teammates and enemy waves follow the branches; shop and chest placement stays reachable; DM right-click march orders path along mapped lanes and connectors rather than attempting to go straight through walls.
- **Map preview**: `MAP_OVERVIEW.png` shows the entire layout. In-game minimap is updated to the new branch/converge routes.
- **No rewrite of networking or combat**: existing inventory, gold, leveling, DM possession, enemy spawning and the win condition (destroy four forts to expose the DM Tower) are retained.

## Install (existing GitHub + Render workflow)

1. Extract the entire **R03 ZIP** into a new folder.
2. Double-click **`SYNC_TO_GITHUB.bat`** from that extracted folder. Confirm the saved GitHub Desktop repository path, press **Y** to copy files, then choose **1** for GitHub Desktop.
3. In GitHub Desktop, **Commit to main**, then **Push origin**.
4. Allow your existing Render Web Service to redeploy and show **Live**. If playing from GitHub Pages, allow it to publish too. Do not create a second server.
5. Open the game in a fresh browser window, or hard-refresh with **Ctrl + Shift + R**. Confirm the header says **`PROTOTYPE R03 · BOSTON BLACKOUT`** before testing.
6. Start a **new** DM room and join as Party. Render restarts clear in-memory room sessions.

**No Firebase settings need changing.** The `firebase-config.js` and legacy `database.rules.json` are included only to preserve your existing setup; R03 live combat and lobbies use the Node WebSocket game server, not Firebase snapshots.

## Offline testing

- `START_LOCAL.bat` launches a static website using Python; select **PLAY AS PARTY** or **PLAY AS DM**. Alternatively open `index.html` with an editor's Live Preview.
- `START_GAME_SERVER.bat` starts the dedicated Node server at `http://localhost:8787` for local multiplayer (requires Node 20+ and Internet for first `npm install`).
- `npm install` then `npm test` runs all game/server/network/map regression suites.
- Game controls: **WASD** movement, mouse to aim/fire, **Q/E** abilities, Space dash, F loot chest, I inventory. DM: choose a troop, click to deploy; click an enemy to possess; right-click to march; click minimap to reposition the DM camera.

## What is preserved

- Six Party slots (Asya, Jeanette, Alex, plus three unassigned placeholders), one DM.
- Six boss-defended forts, twenty-minute match, shop and chest economy, inventory, spells and respawns.
- Node WebSocket simulation, cached Canvas background, network diagnostics, Render deployment and GitHub sync BAT.

## Limitations / testing status

- The map is a clean, gameplay-first *prototype*, not final hand-painted Boston artwork. City labels and geography are deliberately reimagined to match the game flow.
- Local browser training render and nine Node test suites passed; tests include AI victory, no blocked road centerlines, and cross-map DM navigation. A 108-enemy 10-second engine sample completed without exceeding the 30Hz tick budget in this environment. **Real Render deployment and 7-player latency/CPU performance have not been verified here.**
- Server sessions live in RAM. Render restarts/spin-downs reset matches. Room-code sessions are not hardened competitive matchmaking.
- Graphics use a cached 6800×2000 world canvas; lower-memory devices may require further performance adjustments.

See `R03_MAP_TEST_PLAN.md` for a walkthrough. `R02_SERVER_SETUP.md` remains available for anyone deploying a server for the first time.
