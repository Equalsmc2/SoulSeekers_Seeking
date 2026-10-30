# R1.1 Repair Candidate — added limitations

The original R1 statements below are historical. **R1.1 now adds locked loadouts, source-derived weapon visuals, bounded normal-movement input replay, local speculative effects, and a more informative connection screen.** Real-browser visual fidelity and network feel are **not certified**. F3 reveals live diagnostics. Particle traffic increases snapshot size and CPU cost versus R1. The 110ms+ jitter test uses actual seven local sockets with software-injected delay, not real WAN routing. One repeated run exhibited severe ~0.5s snapshot stalls under host contention, although subsequent runs recovered; real-world stability remains unverified. Browser QA navigation was blocked in the build environment; Firefox not tested. Render remains ephemeral, including loss of in-memory rooms on sleep/restart.

See `REPAIR_TEST_REPORT.md` for the measurements and limitations.

---

# Honest release boundaries — Integrated R1

## Implemented and connected

The dungeon builder, six unique seats, readiness, active clock, authoritative V22.4 character controllers, DM summons/orders/possession, camp spawning/sealing/recapture, Tarot modifiers, shared exploration, souls/extraction, timeout, reconnect and new-round path execute in the same server match. All 12 weapon and dodge choices and all 43 spell entries are present. No mechanic is implemented by embedding a standalone lab.

## Unfinished or not certified

- **Durable saves/crash recovery:** not implemented. A Node restart discards rooms; no multi-instance state sharing exists. Keep one persistent server instance per room service and deploy between matches.
- **Internet playtesting:** not performed on your live Render/GitHub/Firebase resources. Seven real local WebSocket clients and seven Chromium browser contexts were tested. Six humans have not played a full 40-minute competitive session; balance, long-latency behavior, and low-end-device frame rates still need field testing.
- **Firefox/Safari and touch:** not browser-certified here. Chromium was exercised; desktop keyboard/mouse is the supported control model. There are no touch movement/aim sticks or controller bindings.
- **Visual/audio parity:** the integrated renderer uses clean procedural rooms, colored actors, weapon direction, swept melee, spell zones, projectiles, camp rings and HUDs. It does not reproduce every decorative particle, detailed weapon model, camera-shake animation, or sound effect from the standalone labs. Mechanics were prioritized over decorative parity.
- **Prediction scope:** normal movement is predicted locally. Dodges, teleports, projectile creation and damage wait for authoritative results; high RTT can still be felt. Remote actors deliberately use an approximately 100–205ms interpolation buffer to absorb jitter. No speculative hit confirmation or server rewind/lag compensation is implemented.
- **Competitive hardening:** role/phase checks, private tokens, command deduplication, packet limits, input rate limits, backpressure, secret filtering and input expiry are implemented. This is not a security audit or an anti-DDoS service. Tokens are browser-tab session credentials; there are no user accounts, matchmaking, spectator role, or reconnect UI for a completely lost browser session.
- **Disconnected lobby seats:** a reservation persists while the room exists. Resume the original tab/token, or create a new room if a reserved player is permanently unavailable before start. No GM seat-kick/reassignment UI is included.
- **Renderer terrain:** room collision follows rotated source geometry. Dark unexplored room frontiers can briefly limit local prediction until the next authoritative reveal; no secret geometry is sent in advance to hide this boundary.

## Deliberate changes from the offline labs

Friendly fire off; three-second Entrance respawn; two long rests per match with interruption/safety gates; valid-floor Knight landing; obstruction for blasts/potions; Foreclosure damages each ram target once per charge rather than once every simulation frame; camp dismissal cannot generate threat. Weapon reach uses source scope/hip-fire caps independently of a browser's physical viewport. These are documented server integration decisions, not hidden missing mechanics.

The source spells are approximations: some similarly named D&D abilities are instant bursts, short wards or simple decoys. Their source behavior was retained rather than expanded into a new tabletop rules engine.
