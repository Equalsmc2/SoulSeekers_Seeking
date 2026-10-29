# SoulSeekers: Seeking — R03.3 Boston Map Polish

## October 23, 2026

- Reworked three road layers with continuous smooth curves, accurate curbs, edge details, and intentional lane paint.
- Improved six lane-to-lane connections with consistent pavement and pedestrian crossings.
- Added Charles River bridge structures; priority ordering keeps the road surface above river tiles.
- Redesigned rooftops as consistent pixel-art building footprints with individual architectural details.
- Converted Hollow Common into landscaped walking paths, meeting courts and flower gardens.
- Added rail sidings, ballast/ties, service lanes, and industrial maintenance detailing to the Underworks.
- Reduced repeated clutter and introduced restrained blackout color grading / streetlights.
- Updated version tags and visual preview files.
- Kept collision geometry, pathing, game logic, Firebase settings, GitHub BAT, and dedicated server unchanged.
- No new npm dependencies.

# R03.2 — Consistent Kenney City Tile Art

- Replaced generated-looking primitive buildings, terrain, sidewalks, and roads
  with art directly from the supplied Kenney Roguelike Modern City 2.0 tileset.
- Created a reusable 16×16 sprite atlas renderer with deterministic placement
  and nearest-neighbor scaling, keeping image loading nonblocking.
- Converted Common jungle terrain, pond, trails and foliage, and the Underworks
  industrial depot, freight, rail and street clutter into tile-art scenes.
- Converted collidable park cover, cargo and abandoned vehicles to sprite art.
- Converted forts and chests to match the new art direction.
- Preserved server/client shared geometry and R02.2 networking improvements.
- Added actual-renderer map previews and the CC0 license.

No changes to match balance, lane geometry, jungle widths, game server or Firebase.

---

# SoulSeekers: Seeking — R03.1 Boston Expanded

## R03.1 (October 23, 2026)

- Expand the two jungles into collision-clear combat regions up to **480 units wide**, versus R03's 207-unit jungle strips (roughly **2.3× wider** in the fully separated lane sections).
- Add **three distinct traversable trails and six interior return connectors in each jungle**, retaining all six cross-town road connectors.
- Design a haunted **Boston Common / Public Garden** north jungle with a Swan Pond, Silent Memorial, Bandstand, old park lamps, gardens and cover planters.
- Design a **Red Line / Fort Point industrial underworks** south jungle with depot, maintenance rails, blackout substation, freight yard and solid cargo cover.
- Separate the three main roads by **brick historic north**, **civic downtown center**, and **industrial south** surface colors and details.
- Build fifteen solid abandoned vehicle covers on the main lanes. Server collision, bullets, DM deployment and local player prediction share the same cover geometry.
- Increase loot chests from **10 to 16**, including two unique high-value caches (**220 gold / 130 XP** each, versus ordinary **90 gold / 55 XP**).
- Update minimap, building footprints, static world rendering and district naming without touching R02.2's networking architecture.
- Include new high-resolution `MAP_OVERVIEW.png` and `R03_1_MAP_TEST_PLAN.md`.
- **Nine local Node test suites passed**; live 7-player Render performance is still unverified.

---

# SoulSeekers: Seeking — R03 Boston: The Blackout

## R03 (October 23, 2026)

- Rebuild the city streets into a three-lane central-spawn → spread → reconverge map, including northern/central/southern routes and 2 jungle shortcuts.
- Implement 6 cross-town links, collision-matched deterministic buildings and Boston-inspired rooftops/parks/river crossings/transit landmarks.
- Move all 6 forts and bosses, 2 shops and 10 chests to accessible gameplay locations along the curved roads.
- Align incoming enemy waves, AI pathing, DM spawns, fort fighting and minimap geometry with the new map.
- Make DM army march orders use waypoints and cross-town connectors instead of running through blocks.
- Add map travel, loot access and AI navigation regression tests and a browser map render smoke test.
- Preserve all R02.2 network stability work and the existing GitHub/Render deployment flow.

## Earlier history

# SoulSeekers: Seeking — R02.2 Network Stability

## R02.2 (October 23, 2026)

- Use server simulation time in snapshots for remote heroes, enemies, possessed NPCs and bullets. Fix interpolation speeding up or slowing down with WebSocket packet arrival jitter.
- Introduce bounded, adaptive visual playback clock (slight remote display delay, monotonic timeline, controlled catch-up).
- Account for ordinary one-way network delay in client prediction reconciliation to reduce local rubber-banding.
- Replace server timer's occasional accidental double-step with a bounded fixed-timestep accumulator.
- Add P95 frame time and per-window hitch count beside existing FPS, NET/s, RTT and NET JITTER metrics.
- Preserve 30Hz authoritative simulation, 20Hz snapshots, Party interest filtering, all game content and the GitHub sync BAT.
- Add deterministic tests for packet burst timing, monotonic interpolation, one-way lag compensation and stable server ticks.
- **8 local test suites pass.** A real Zen + Render run is still required to confirm perceived smoothness.

## Prior release

# SoulSeekers: Seeking — R02.1 / Smooth Multiplayer

## Changes since R02

- Local character prediction now advances in `requestAnimationFrame` so rendered movement is no longer limited by a 30Hz input timer.
- Remote heroes, enemies, DM possession and projectiles interpolate from a bounded history of arriving snapshots, with at most 55ms extrapolation.
- Network update rate increased from 12 to 20 snapshots/second; simulation stays at 30 ticks/second to limit server CPU usage.
- Server sends each Party client enemies/projectiles/effects from around their position rather than the entire map. DM continues receiving full battlefield state. Army counter remains global.
- Server snapshot sequence advances even before combat begins; client discards old or duplicate packets.
- Added in-game performance HUD: browser FPS, network updates/second, RTT and update jitter, including warning flags.
- Auto quality scaling adjusts canvas pixel density after sustained low FPS and restores it only after sustained high FPS.
- Increased threshold for per-message compression; favors consistent response time on small messages.
- Preserves all R02 gameplay, Firebase config, Render server, offline modes and GitHub sync BAT.

## Tests

7 local test suites pass: engine, prediction, rendering mock, dedicated server, network protocol, offline startup, and new smoothing/interest-filter tests. No public Render or real Zen two-window network benchmark was performed in this environment.

## Deployment

Push the ZIP through GitHub Desktop as usual. If you already deployed the Render Web Service and enabled auto deploy, that existing service will rebuild from the new commit. Render restarts clear active match rooms in this prototype, so make a **new room** after the update.

## Unchanged limitation

A Render free instance may have variable resources/latency. No client patch can guarantee 60fps on every device or eliminate real network delays. The diagnostic readout is intended to identify what is still limiting smoothness in live tests.

## R03.5 — Clean Field UI
- Replaced the permanent right sidebar with compact player/DM overlays; restored full-width gameplay view.
- Added toggleable inventory, shop, combat feed, and optional FPS/network diagnostics; see `CHANGELOG_R03_5.md`.
- Kept R03.4.2 gold identity, native Boston map rendering, all multiplayer/game systems, and GitHub sync.
