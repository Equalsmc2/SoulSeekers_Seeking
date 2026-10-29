# SOULSEEKERS: SEEKING — Milestone M1 (Local Integration)

**Status:** runnable multiplayer dungeon-building + six-seat waiting room; **not yet a complete playable 40-minute combat match**.

This new release keeps the entire **R03.5** website/server under the original `index.html`, `src`, and `server/matches.mjs` paths; a new **M1 dungeon mode** is accessible at **`dungeon.html`**. The legacy main menu has a prominent link to it. This is intentional so the original 14 tests and legacy preview still run while the new match model is developed without overwriting it.

## Run locally (Windows / Mac / Linux)

1. Extract the **entire ZIP** (do not open HTML directly with a `file://` path).
2. Install Node.js version 20 or newer, then double-click `START_DUNGEON_M1.bat` on Windows, or execute `./START_DUNGEON_M1.sh` from macOS/Linux, **or** run `npm start` in the extracted folder.
3. Open **http://localhost:8787/dungeon.html** in your browser.
4. In one browser window, click **CREATE SESSION** as DM. Copy the six-letter/digit code or invitation link.
5. In other windows/devices, enter the *same server URL*, room code and an unclaimed character slot, then choose **JOIN PARTY**. The DM will see up to 6 independent connected players.
6. DM: click the Entrance card, then the map; select next rooms and place them adjacent to matching doors (green square means valid; red invalid). Use **R/right-click** to rotate, **1–3** to switch decks, **S** to place/remove souls, and **F** to fit the map. **Space + drag** pans; mouse wheel zooms. Clicking a card then clicking its destination works; you may also drag a hand card onto the map or drag a placed room to another valid cell.
7. Mark up to 3 cards using ↻ and click **REPLACE MARKED** to spend limited credits. Cards are **not** replenished by playing. `Ctrl+Z` undoes a recent edit, but **cannot refund a redraw**. On eight placed and connected rooms, mark seven separate non-Entrance rooms with souls; **LOCK DUNGEON** becomes available when the graph is fully connected and seven souls are reachable.
8. Party view is an actual multiplayer lobby, intentionally **not** the dungeon preview. Cards and hidden rooms never enter Party packets. The 40:00 match clock is **not running** in BUILD or LOCKED states.

The normal site runs at the same address `/index.html` for the old Boston-lane mode; the original WebSocket service remains `/ws`; new dungeon rooms use `/dungeon-ws`.

## Online workflow

- **GitHub Pages**: upload these files to the existing repository only *after* you approve testing changes. Players open `https://<username>.github.io/<repo>/dungeon.html`. On the connection screen, set the service URL to your Render address, e.g. `https://your-service.onrender.com`. GitHub Pages serves UI assets; no combat state is put into Firebase.
- **Render**: keep your existing Node service start command `npm start` (uses `node server/index.mjs`) and install command `npm install`. The included `render.yaml` is retained unchanged. The new `/dungeon-ws` and old `/ws` run on the same dedicated server process and port.
- **GitHub Desktop**: the original `SYNC_TO_GITHUB.bat` remains included. **Do not run it until you deliberately choose to copy this build into your Git repository**: it asks before copying and offers an automatic push option. For careful review, use GitHub Desktop and inspect the diff first.
- **Local/offline dependency fallback**: normal production uses npm's maintained `ws` package. In restricted local environments where installing `ws` is impossible, `server/ws-local-fallback.mjs` supplies a minimal uncompressed WebSocket transport for development (not a drop-in production hardening replacement).

## What was integrated in M1

- Server-owned `DungeonSession` phases **BUILD → LOCKED**, with DM-only `unlockDungeon` and `newRound`. **ACTIVE** and **ENDED** are reserved for M2+ and are not simulated.
- Exact 40 Room / 22 Tarot / 52 Poker source pools; 16 Room / 5 Tarot / 6 Poker starting hands; 8 paid redraw credits, 3 per batch; no free refills; server-generated unique card IDs and decks.
- Precise tile/door masks and 90° rotation, doorway matching, board connectivity; server-side removal, move, Tarot, camp, soul placements and undo; rerolls deliberately invalidate the undo chain.
- Party cannot edit, guess card identities, or see hidden dungeon state. Six class-based unique seat reservations, token-based reconnect and DM command sequence anti-replay.
- 30Hz dedicated server scheduling framework and 20Hz WebSocket snapshots; command acknowledgements and errors; generated room codes and join links.
- Gold/charcoal context-specific DM editor and Party waiting lobby. Avatar sprite/weapon combat is **not** claimed to be merged yet.

## Source precedence / reference code

- **Original R03.5** website, Node server, assets and 14 tests remain at the repository root.
- The **separately uploaded Party HTML** is **V22.4**, newer than handoff's V19.2; both are included under `references/` for M4. No V22.4 game mechanics are claimed active in M1.
- The **separately uploaded DM HTML** self-identifies as **R05.3**, while the handoff **R05.4** adds more intuitive build controls. Both are retained as references. The ported M1 dungeon rules and counters follow the handoff R05.4 source, including 40 room cards and finite economy.
- Handoff `START_HERE.md` and all eight documents are saved under `references/`.

## Known M1 boundaries

- **No ACTIVE gameplay:** no 40:00 server match countdown, extraction, movement physics, combat, spellcasting, fog discovery, DM possession/monster AI, or camp reinforcements yet. Those are scheduled for **M2/M3/M4**.
- Tarot and Poker are **assigned to room state** but their in-combat effects and spawning deliberately wait for M3. A placed camp is not an active spawner in BUILD/LOCKED.
- The new client is a fresh multiplayer dungeon editor and lobby, not a full port of every standalone prototype visual control. The 960-unit geometry is carried over, but collision/hitbox validation requires M2/M4.
- Rooms live in the Node process only; there is no database or disk checkpointing across server restarts. A connected/reconnecting seat is retained until its room expires after 2 minutes with no clients; if a server restarts, host a new session.
- No production deployment was performed and no online Render latency, 7-browser FPS or graphical browser screenshot benchmark has been verified here. The automated *real WebSocket* integration runs seven clients against a local Node server.

## Tests

```sh
npm test                 # all 16 legacy + new suites
npm run test:m1          # only M1 rules and 7-client wire tests
```

`M1_TEST_RESULTS.txt` records the actual local run. In the working environment, 16/16 tests passed, including both the simulated server protocol and a real socket test with **one DM + six Party connections**.
