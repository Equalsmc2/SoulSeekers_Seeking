# SoulSeekers: Seeking — R02.2 / Network Stability

**R02.2 is a complete source-code update to the SoulSeekers: Seeking browser prototype.** It replaces Firebase Realtime Database combat snapshots and the DM browser-hosted game loop with a Node.js/WebSocket simulation server. Offline practice is preserved. The game is still a prototype, not a finished competitive MOBA or a proven low-latency production deployment.

## R02.2 targeted stutter and desync polish

- **Server-timestamped snapshots:** actors and projectiles interpolate on the 30 Hz simulation timeline, rather than relying on irregular browser packet arrival times.
- **Adaptive presentation buffer:** keeps remote actors moving through modest network jitter, gently correcting playback rate without rewinding the display clock. Buffering adds a small amount of visual delay to *remote* entities; the local player still has immediate visual prediction.
- **Less local rubber-banding:** the client's position reconciliation estimates the normal one-way network travel before deciding something needs correcting. Large authoritative corrections, deaths and respawns still win over client prediction.
- **Fixed timestep scheduler:** replaces the old ceil-based tick catch-up that could unintentionally double-step after a slightly late timer callback; limits expensive catch-up bursts if Render stalls.
- **Stronger diagnostics:** FPS, P95 frame time (95th percentile over the recent frame window), hitch count, network snapshots/second, ping RTT and update jitter. Sustained low frame rates still trigger resolution scaling.
- The server remains at **30 simulation ticks/s** and sends at most **20 snapshots/s**; the DM is not the simulation host. R02.2 preserves R02.1's interest filtering, map, inventory, roles and Firebase configuration.
- Existing Render web service + GitHub Pages configuration can be **updated in place** by running the included `SYNC_TO_GITHUB.bat` and pushing to GitHub. **Do not make a new Firebase project, repository or Render service.**

Read `R02_2_NETWORK_ACCEPTANCE.md` for the two-window testing procedure. **Eight local suites pass, including packet-jitter and tick-drift regression tests. Real multiplayer on your Render deployment still needs testing.**

## Play it

### Easiest online route — Render (browser only after deployment)

1. Extract R02.2, run `SYNC_TO_GITHUB.bat` and push using GitHub Desktop as usual.
2. Follow [`R02_SERVER_SETUP.md`](R02_SERVER_SETUP.md) to connect the same GitHub repo to a **Render Web Service**. Build command `npm install --omit=dev`; start command `npm start`.
3. Render gives you a URL like `https://soulseekers-seeking-server.onrender.com`. **Open this URL directly to play**: the Node server also serves the browser game. It automatically knows its own WebSocket address.
4. DM clicks **HOST AS DM** and **COPY INVITE LINK**; Party players open the link, select a unique character, enter a name and click **JOIN AS PARTY**. The room code is generated, not a password.
5. Or use your existing GitHub Pages game URL: paste the Render HTTPS URL into **GAME SERVER URL** (saved in this browser), or use the DM’s invite link which fills it automatically.

**This build has not been deployed to your account.** You must create the Render service; GitHub Pages alone cannot host Node WebSockets. Your existing Firebase settings do not need changing.

### Local online test (requires Node.js 20+)

- Double-click `START_GAME_SERVER.bat` on Windows. First run performs `npm install`, so an Internet connection is needed. Leave the terminal open and visit `http://localhost:8787` in two browser windows.
- Or run `npm install`, `npm start`, then open `http://localhost:8787`.
- Local game server listens on port 8787. You can test two tabs in Zen; the DM tab no longer runs the simulation, though browser background throttling can affect each tab's *rendering* and input sampling.

### Offline training

`START_LOCAL.bat` (Python server) or Phoenix Code Live Preview still works for **PLAY AS PARTY** / **PLAY AS DM** with no server or Firebase connection. Offline practice is local; it does not demonstrate multiplayer networking.

## What R02 changes

- **Node WebSocket game server** (`server/`) simulates movement, enemy AI, effects, damage, waves, XP, gold, boss and fort states, DM Tower victory conditions at 30 ticks/second.
- **Clients send inputs and authenticated-by-room-session commands** over WebSocket, no Firebase writes per-frame.
- **Twenty interest-filtered server snapshots per second** with visual interpolation and immediate client-side visual movement prediction, keeping the R01.7 renderer.
- **Server-bound Party slots:** up to six unique characters; DM can issue orders, possess enemies and deploy units; Party clients cannot use DM command packets.
- **Automatic socket reconnection** with a server-issued session token, including reclaiming a Party seat after refreshing the same browser tab (server match memory is temporary).
- **Room clock waits** until at least one Party member joins. Server simulation continues even if the DM tab disconnects.
- **One-click invite link:** shares server address and room code with Party players.
- **HTTP `/health` endpoint** and `render.yaml` configuration for deployment.

## What's preserved

- Six SoulSeeker roster slots (Asya, Jeanette, Alex and three placeholders), 3 lanes, 2 jungles, six boss-defended forts, DM Tower, 20-minute match clock, levels, gold, shops, chests, projectile shooting, Q and E spells, dodge, inventory grid, DM waves, direct possession.
- Offline training and current placeholder Boston-inspired map; the later Deadlock-style branching Boston redesign **is not part of this networking update**.
- GitHub Desktop batch sync BAT and Firebase configuration file.

## Firebase's role now

Your project `soulseekers-seeking` and `firebase-config.js` are **preserved but not required by the R02 multiplayer path**. Room creation, transient matchmaking and live movement now take place in Node server RAM over WebSockets. R02 does *not* yet integrate persistent Firebase accounts or saved lobby history; Firebase Auth/Firestore can be added later for identity and persistent accounts. Do not delete Firebase, but **do not expect R02 live game rooms in your Firebase Realtime Database**. The prior database rules file remains only for R01 compatibility/reference. The Render server does not need Firebase API keys or service-account credentials.

## Network and security limitations

- R02 is an early prototype using room codes and unguessable in-memory session tokens. Not ranked-game safe; there is no account-bound authorization, moderation, matchmaking service, persistence or hardened rate limiting. Do not use real-money purchases or confidential data.
- Each Render instance holds rooms in RAM. A service restart, deployment or free-plan spin-down **destroys rooms and resets matches**. Do not scale this stateful prototype beyond one server instance without distributed room state/routing.
- Game server must run on a public HTTPS/WSS-enabled platform if GitHub Pages is your site. **GitHub Pages cannot run Node**. Render currently offers a free testing web-service plan with idle spin-down; check current policies/usage limits, since first request after sleep may be slow.
- Fixed tick rate and interpolation are design targets, not guaranteed client FPS, latency or seven-player scale under every connection. Tests run with a mocked transport and code inspection; live deployment/performance remains to be measured.

## Development and tests

Node 20+ required. `npm install` then `npm test` runs engine, prediction, rendering, startup, server authorization/session and socket client/server protocol tests. Server code uses `ws` as a production WebSocket implementation; internet access is required to install it. Neither a deployed live Render service nor the real `ws` installation was available in the build environment; server transport behavior was validated with simulated WebSocket connections, not a publicly hosted match.

Project layout:

```text
index.html, style.css            Static browser game
src/main.js                      UI, rendering, local practice and online input sampler
src/socket-network.js            Browser WebSocket connect/reconnect/session messages
src/engine.js                     Shared authoritative game rules used on Node server
src/data.js                       Map, heroes, items, shared data
src/prediction.js                 Client visual movement prediction
src/sync.js                       Compact authoritative snapshots
server/index.mjs                 Node HTTP + ws WebSocket listener
server/matches.mjs               Rooms, authorization, timers and DM control
package.json, render.yaml        Server dependencies and Render deployment
SYNC_TO_GITHUB.bat               Repository copy/push helper
START_GAME_SERVER.bat             Local online game test
START_LOCAL.bat                   Offline-practice web server
firebase-config.js               Preserved R01 Firebase project config (not used by R02 combat)
database.rules.json              R01 legacy rules reference; unused for R02 multiplayer
```
