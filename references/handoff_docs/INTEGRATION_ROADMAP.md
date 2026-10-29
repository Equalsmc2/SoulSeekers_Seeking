# IMPLEMENTATION ROADMAP — MERGE THREE SOURCE CODE BASES

## Principle: source authority, not an iframe mosaic
Use R03.5's Node ES modules/WebSocket host as the seed of the runtime, but replace the **old static Boston-lane match model** with a **RoomGraph + MatchState** runtime. Extract logic from V19.2 and R05.4 into shared testable modules that are run on the server; do not make each connected player run an independent simulation.

### Architecture sketch
```
Browser DM (gold HUD, editor, orders, possession)
    ─────── WSS ──────┐
6 Party browser clients ── WSS ── Node match server (single authority)
                           │       match phases: BUILD -> LOCK -> PLAY -> ENDED
                           │       world: RoomGraph, collisions, fog, souls, camps,
                           │       Tarot, enemies, AI/nav, projectiles, spells,
                           │       character resources, weapons, dodges, win condition
                           ├── deterministic fixed-step sim ~30Hz
                           ├── per-player snapshots <=20Hz (interest filtering)
                           ├── player local prediction + reconciliation / interpolation
                           └── room/code/token auth & reconnect
GitHub Pages = static client; Render (or compatible Node service) = WSS match authority.
Firebase is optional for accounts/lobby metadata later, NOT the main combat transport.
```

### Concrete module split suggestion
- `shared/rules/characters.js`: six heroes, two selectable weapons/dodges, stats, server-safe input mapping.
- `shared/rules/spells.js`, `resources.js`: class spellbooks, LOS/range, spell slot state, Sorcery Points, cast-vs-attack locks, rest.
- `shared/rules/weapons.js`, `dodges.js`: deterministic server combat, melee swept hitboxes, scope constraints, projectile collision and movement, Deadweight bullet policy.
- `shared/dungeon/room-templates.js`, `geometry.js`, `room-graph.js`: rotated doors, room obstacles, traversability and nav graph, 960-unit room cards.
- `shared/dungeon/decks.js`, `tarot.js`, `camps.js`: finite room/Tarot/Poker hands, paid redraw, ownership/capture/spawn.
- `server/match-session.js`: states, joins, match clock, win condition, DM authorization, spawn budgets, seven souls.
- `server/ai.js`: monster orders, ownership, navigation through doors, possession handoff.
- `client/party-ui.js` / `client/dm-ui.js`, game canvas and local prediction.
This is suggested separation, not a demand to use exact filenames.

## Milestones (must be independently runnable)
**M0 — Verified clean base.** Keep R03.5 UI/server/server scripts and 14 existing passing tests. Capture performance baseline (FPS, P95, jitter, RTT, snapshot rate) and make sure old R03.5 site can still launch.

**M1 — Shared match protocol and dungeon state.** Server-owned `BUILD`, `LOCKED`, `ACTIVE`, `ENDED`, blank canvas at start, finite cards, card placing/rotation/undo/redraw with permission checks; multiplayer DM sees editor, Party sees lobby (no unrevealed map). Reconnect/idempotent commands; no duplicate card consumption.

**M2 — Runtime map and 7-soul objective.** Construct shared room geometry, door navigation, obstacle collisions, fog/per-party discovery; seven server-owned soul collectibles, server clock 40:00, extraction at Entrance, outcomes.

**M3 — DM combat and poker camps.** Port four monster types, summon/command/AI/possess and follow through doors. Poker type/rank generation, capture progress, sealed-camp no-spawn rule, DM recapture restart. Tarot room effects must be evaluated server-side.

**M4 — Party combat with six loadouts.** Port V19.2 movement, 12 dodge options, 12 weapons, auto reload, scoped range, 43 class spells/slots, Sorcery Points, Ctrl rest, collision/LOS; no attack plus cast overlaps. Keep local prediction and interpolation to avoid R01 lag regressions. Each of six Party users only controls their own hero.

**M5 — UX and multiplayer readiness.** Crisp gold/charcoal clean HUD; approachable DM build UI, contextual commands, on/off debug, spell & card indicators, test as DM / test as Party, solo bots offline. Reconnect and latency diagnostics; package source ZIP with GitHub Desktop BAT, current Render instructions; support 6+1 test and constrained mobile viewport.

## Network protocol minimum
- `hostRoom`, `joinParty`, `rejoin`, `chooseLoadout`, `beginBuild`, `selectDeckCard`, `placeRoom`, `rotateRoom`, `undoRoom`, `rerollSelected`, `applyTarot`, `placeCamp`, `placeSoul`, `lockDungeon`, `startMatch`, `playerInput`, `partyCast`, `partyWeapon`, `restInput`, `interact`, `dmSummon`, `dmOrder`, `dmPossess`, `dmRelease`, `dmCaptureOrder`.
- Every mutation: validated for role, match phase, budget, range/LOS/collisions/resources. Clients never authoritatively submit HP, souls, ammo, timer, deck size, card identity, or camp ownership.
- Per-client, per-sequence deduplication and replay protection on cards/camp captures/weapon hits. Timestamp snapshot states on server simulation clock; extrapolate only within bounded safety window.
- Snapshot payload filter by Party visibility; DM receives full world. Explicit reconnection token expiry, DM disconnect policy (server keeps sim running), empty-room cleanup.

## Key incompatibilities to reconcile before writing too much code
1. R03.5 site currently uses lanes, forts, towers, stock market-style or economy elements and different victory conditions. New dungeon mode replaces the map and win condition. Preserve performance optimizations, UI assets, and deployment—not old geometry.
2. R03.5 control mapping conflicts with V19.2 (Q spell vs Q weapon; RMB command for DM). Use role-specific remapping. Keep E unassigned as requested.
3. Standalone labs use different coordinate conventions, and browser RAF updates differ from server 30Hz. Normalize to **world units per second** and fixed dt; handle rooms across world coordinate boundaries, collision and speed caps.
4. V19.2 might use client-only state/DOM effects. Extract data/rules from draw code; server must decide damage, cooldowns, ammo, spells, souls, and guard direction.
5. DM R05.4 runs a single Party bot locally. Replace with up to six separate players; bot useful for offline testing only.
6. Avoid rendering all rooms/AI every frame. Cache static room geometry, spatial-index obstacles and monsters, show only visible active rooms; test performance in an expansive 16-room dungeon with multiple camps.
7. The 1.6/4.3 second Ctrl rest is arcade-fast. Validate that resting isn't spammed, interrupted by damage/attack/forced movement and is subject to gameplay balance decisions explicitly approved by user.
8. Source repo may contain Firebase config and a `database.rules.json`; do not move live battle state back into Firebase, leak credentials, or change the user's account.

## Tests to add
- Pure math: room rotation, door matching, flood fill, collision sweep, LOS, max range, melee sweep, projectile walls, movement invariance across frame times.
- Multiplayer: 1 DM + 6 party clients, unique hero claims, spoofed DM action rejected, reconnect/rejoin preserving world, scene clock continuous with background browser.
- Deck economy: 16/5/6 opening hands, card use not replaced, 8 credits spend correctly, invalid actions do not spend, finite reserve, undo exact card, saved/restored economy.
- Camps: DM spawn => Party seal => zero spawn/no allied spawn => existing monsters remain enemy => DM recapture => resume enemy spawning.
- Spells: right click cannot attack at same time, LOS blocks through walls, out-of-range clamps, slots/points stay consistent, rests validated.
- End-to-end: DM builds 7 reachable souls, Party collects, return to Entrance before 40:00 Party win; timeout DM win.
- Performance: 30Hz server stable with typical full dungeon/100+ monsters, ~20Hz filtered snapshots, client 60 FPS target; test on real Render server, not only Node/unit tests.

## Deliverable boundaries
Do not claim the three prototypes are already integrated. Do not silently deploy. Give full working ZIP, runnable local test path, exact files edited, migration notes for existing GitHub Desktop sync, test evidence and known caveats.
