# Installation and sharing

## Local server

Run `npm ci`, then `npm start` from the extracted folder containing package.json. Open `http://localhost:8787/dungeon.html`. Default bind is `0.0.0.0:8787`; `HOST` and `PORT` environment variables can override it. Keep the process running. `npm test` runs the regression/integration suite; `npm run benchmark` runs a synthetic load measurement. No database or Firebase setup is required for dungeon mode.

## GitHub Desktop → Render

This document describes actions for you to perform. Nothing has been pushed or deployed by the assistant.

1. In GitHub Desktop, open your intended repository and create a review branch. Copy this folder's contents into its root (package.json, server/, shared/, src/, assets/ and HTML/CSS alongside each other). Do not copy an extra nested ZIP folder or node_modules.
2. Review the changed files in GitHub Desktop, especially the new shared dungeon modules, entry HTML and server routing. Run `npm ci`, `npm test` and a local browser session first.
3. Commit the reviewed files. Publish/push only when you choose. The supplied legacy SYNC_TO_GITHUB.bat can commit/push; it was not executed. GitHub Desktop gives a clearer review step.
4. On your Render Node Web Service, use the repository root, build command `npm ci --omit=dev`, start command `npm start`, health path `/health`. Keep one server instance for this in-memory room service. Set `NODE_ENV=production`; production refuses to use the development WebSocket fallback when the ws dependency is missing.
5. Use the service's HTTPS URL directly: `https://YOUR-SERVICE/dungeon.html`. It serves both the frontend and `/dungeon-ws`, which is the simplest sharing arrangement. Set up a host that remains awake for a full match; a process restart or sleeping service destroys in-memory sessions.
6. Create the DM room from that public HTTPS page. Click COPY ROOM to copy an invitation link. Friends open it, enter names, and reserve distinct heroes. The invitation contains the room/server address, not the DM token.

The retained render.yaml is a starting configuration. Review its automatic-deploy and hosting settings before enabling it. No infrastructure settings or hosting costs were changed here.

## Optional GitHub Pages frontend

Serve the complete static root through Pages, including `src/`, `shared/dungeon/rules.mjs`, `combat-data.mjs`, `physics.mjs`, and `motion.mjs`. The root entry forwards to dungeon.html; old Boston mode is `/index.html?legacy=1`. On the dungeon connection screen, enter your Render **HTTPS** server URL before creating/joining the room. The client converts it to `wss://…/dungeon-ws`. Keep frontend and backend on the same release; refresh stale cached pages after updating both.

GitHub Pages alone cannot run the authoritative Node server. HTTPS pages need a secure WSS game endpoint. Firebase is not a substitute for this socket server.

## Troubleshooting

- **Connection refused:** start the Node server; verify port and URL. Refresh if the launcher opened the browser before server startup.
- **Friend cannot join localhost:** localhost points to their own computer. Share your LAN address or a public HTTPS service address instead.
- **Character reserved:** use the original tab to reconnect, or select a different unclaimed hero before start. Opening the same token in another tab transfers ownership and stops the old tab from reclaiming it repeatedly.
- **Start disabled/rejected:** lock seven reachable souls; all reserved players must be online and ready.
- **Room code lost after deployment:** sessions are currently in memory. Deploy between matches.
- **Jitter:** check the visible round-trip latency, close duplicate game tabs, avoid a sleeping/overloaded host, and use a host near the group. Local simulation optimization cannot remove internet latency.

Desktop keyboard/mouse is the supported playing interface. Mobile can view responsive HUDs, but full touch combat controls are not implemented.
