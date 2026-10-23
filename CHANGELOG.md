# SoulSeekers: Seeking — R02 / Server-authoritative networking

## R02 new architecture
- Removed Firebase RTDB world writes from online play and the DM-browser authoritative simulation.
- Added Node.js authoritative simulation at 30Hz, with WebSocket inputs and 12 snapshot updates/second.
- Added server-validated Party slots and DM-only control, enemy deployment, commands, boss possession, anti-stale snapshot send queue.
- Added reconnect tokens, roster update, room codes, server URL field, shareable invite links and `/health` endpoint.
- Host browser can close without freezing simulation (session may be reclaimed while server process lives).
- Server match clock waits for first Party member to join.
- Preserved offline modes, map, mechanics and GitHub Desktop BAT workflow.
- Retained Firebase config for future account/persistent lobby integration; no longer a live match dependency.

## Limitations and test status
- Rooms are memory-only, cleared on server restart; no hardened authentication, multi-server routing or persistence.
- Unit engine, game start/render, client socket protocol, permissions and disconnect/reclaim tested locally with mock sockets.
- `ws` package must be installed with `npm install`; live service and actual cross-device latency not yet verified in this environment.
- Deadlock-inspired branching Boston map is intentionally deferred to a later separate update.
