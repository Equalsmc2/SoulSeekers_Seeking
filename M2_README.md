# SOULSEEKERS: SEEKING — M2 Playable Integration Alpha

This ZIP is a **development alpha** continuing the original, unchanged R03.5 multiplayer server and M1 finite-card builder. It now includes a shared LIVE combat runtime. It is **not a 1:1 port of every V22.4 Party Lab or R05.3/R05.4 DM prototype feature**.

## Start it (Windows)

1. Extract the *entire* ZIP. Install Node.js 20+.
2. Double-click `START_DUNGEON_M2.bat` (or `npm start` from the folder). On macOS/Linux: `sh START_DUNGEON_M2.sh`.
3. In your browser, open `http://localhost:8787/dungeon.html`.
4. DM selects **CREATE SESSION** and copies the room code. Party clients choose one of six unique characters and join the same Node server using the code (do not use `file://`).
5. DM constructs a connected dungeon with one Entrance, at least seven other rooms, places 7 souls in seven non-Entrance rooms, and optionally assigns Tarot/Poker camps; **LOCK DUNGEON** then **START 40-MINUTE MATCH**.
6. Every connected Party user now joins in-world with their own character. The DM gets a monster command interface. A server-owned 40-minute timer begins immediately, with a Party win upon extracting seven collected souls at the Entrance, and a DM win at timeout.

## Live Party controls

- **WASD** move; mouse aims; **left click/hold** fire the equipped weapon (automatic reload when magazine empties), **right click** cast selected spell.
- **Q** switch weapon (two per hero), **Z / X** choose dodge, **SPACE** execute selected dodge, **R** manual reload, **E** hold guard/parry (except Chemist uses E to cycle potion effects).
- **1–0** select an individual character spell. Sorcerer, Rogue, Warlocks, Cleric, Artificer all have the named Level 3 V22.4 spell lists; resources, cooldowns, LOS, ranges are owned by the server. Spell FX and complex specials are simplified (see below).
- **F** hold near Poker camp to capture/seal it, tap near the gold diamond soul to collect, and press at Entrance after all seven to escape.
- **CTRL** hold motionless for short/long rest; rest breaks on attack, movement, incoming damage or nearby enemies. The server limits rests with cooldowns and two short-rest charges.

## Live DM controls

- **WASD** pan the map; mouse wheel zooms; **1–4** select Grunt, Ranger, Brute or Stalker. Left-click empty traversable room floor to summon using a regenerating threat pool (30 maximum).
- Left-click a monster to select; **right-click** a point to order a move, or a camp to order a recapture. Buttons under the game field issue **HOLD / HUNT / MOVE / CAPTURE / POSSESS / RELEASE**. **P** toggles possession of the selected monster. When possessed, WASD steers it on the authoritative server and its attacks remain server-resolved.
- Poker camps produce **hostile** reinforcements by suit and rank only while DM-controlled. Party capture **stops spawning entirely** (no friendly monsters); existing enemies remain hostile. DM recapture resumes hostile spawning. Tarot floor effects influence movement, healing, hazards, enemy health/damage/speed, capture, and spawn intervals.

## Architecture / authority

- Static front-end: `dungeon.html`, `dungeon.css`, `src/dungeon-ui.js` (M1 editor), `src/dungeon-play.js` (M2 gameplay). The R03.5 website stays at `index.html`.
- Server: existing `/ws` unchanged; `/dungeon-ws` houses `server/dungeon-service.mjs`, `shared/dungeon/session.mjs` and `shared/dungeon/runtime.mjs`.
- Character/weapon/spell/dodge names and numbers: `shared/combat/loadouts.mjs`, derived from the submitted Party V22.4 prototype. DM template and camp parameters remain in `shared/dungeon/rules.mjs`.
- Snapshot 20 Hz and fixed-step gameplay tick 30 Hz. Server validates world collisions, actions, resources, damage, soul count, camp ownership, deck economy and time; Party clients receive discovered-room snapshots, never the full DM map or dealt hands. Input packets are sequence checked, DM and Party mutations have token-bound replay prevention.
- Party animation includes bounded local movement prediction and server reconciliation. Game networking uses the existing dedicated WebSocket server, **not Firebase**.

## What is intentionally still an alpha

1. V22.4's highly specialized two-stage dodge choreography, remote drone physics, revolver scope, C4, throw trajectories, potion splashes, spell VFX and complex multi-step status mechanics are **not fully ported**. Current weapons and spells work through server-side simplified targeting/status/damage effects. Some utility/decoy spell effects are placeholders and need a dedicated M4 combat pass.
2. DM monster navigation uses a room graph with doorway travel, but it is **not yet sophisticated local obstacle A***. Possessed attacks currently auto-fire when within reach instead of the complete standalone direct-attack system.
3. The runtime has no persisted match checkpoints across Node restarts; a server restart loses active sessions. It is not yet tuned for 100+ monsters at real-world WSS latency.
4. Browser graphics were not independently screenshot-verified in this restricted execution environment (Chromium returned an administrator network-block error). Do not interpret passing Node tests as a verified polished 7-person GUI playthrough.
5. V22.4 item/weapon balance may require playtesting. Spectator mode, touch/mobile controls, solo bots and full performance diagnostics remain future improvements.
6. No GitHub/Render/Firebase deployment or live configuration changes were made.

## Tests

Run `npm test` for legacy R03.5, M1, and new M2 runtime tests; `npm run test:m1` for unchanged M1 tests or `npm run test:play` for new gameplay tests. See `M2_TEST_RESULTS.txt` and `CHANGELOG_M2.md`.

## GitHub Desktop / Render

Review the new source before deploying. The original `SYNC_TO_GITHUB.bat` remains present, **do not run it without intending a real repository update**. The existing `render.yaml` remains unchanged. On Render use `npm install` and `npm start`; a single Node server handles both WebSocket endpoints, while GitHub Pages can serve static HTML. The local `ws-local-fallback` exists only for restricted/offline development; production should use npm's `ws` dependency.
