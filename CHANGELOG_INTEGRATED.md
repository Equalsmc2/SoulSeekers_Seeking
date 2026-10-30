# Integrated R1 — October 29, 2026

- Extended M1 BUILD/LOCKED to ACTIVE/ENDED; 40-minute wall-clock server deadline, seven soul claims, Entrance interaction and immutable winner.
- Extracted authoritative V22.4 data and gameplay functions into isolated per-hero server controllers. Shared geometry replaces the test arena; actual monsters replace practice turrets; allies are other human-owned heroes. No DOM or browser frame loop executes on the server.
- Added four DM monster types, threat/caps, commands, possession, clear-floor validation, radius-aware navigation, hostile Poker waves, uncontested camp sealing/recapture and all Tarot modifier categories.
- Added shared room exploration and explicit packet allowlists; no hands, hidden room cards, undiscovered monsters or hidden Tarot are sent to Party clients.
- Added live role-specific browser HUDs, V22.4 input mapping, resource/SP controls, spell selection, weapon/dodge choices, Knight landing markers, melee/area telegraphs, actual game results and new-round controls.
- Added shared motion math for client prediction, server-clock remote interpolation, input expiry, fixed-step accumulator, 60Hz combat substeps, 20Hz snapshots, latency display, packet caps and output backpressure.
- Optimized room-obstacle caching, local nearest-node lookup, reusable navigation routes and a per-frame pathfinding budget after the initial 45-hunting-monster stress case exposed stalls.
- Preserved finite M1 deck/undo/reroll validation, source references, original legacy assets and regression tests. No source deck auto-refill was introduced.
- Added real seven-socket integration, combat/geometry/camp/clock/security tests, browser QA script and a reproducible benchmark.
- Added Windows/macOS/Linux playing launchers and explicit GitHub Desktop/Render sharing instructions. No external resources were modified.

## Main file changes

| Files | Responsibility |
|---|---|
| shared/dungeon/combat-data.mjs | V22.4 character, weapon, spell, potion, augment and dodge values |
| shared/dungeon/combat.mjs | Extracted per-hero authoritative combat and resources |
| shared/dungeon/motion.mjs | Shared source movement math for prediction |
| shared/dungeon/physics.mjs | Rotated obstacles, walls, doors, swept collision, LOS and cached navigation |
| shared/dungeon/match.mjs | Lifecycle, visibility, DM/AI, camps/Tarot, projectiles and objectives |
| server/dungeon-service.mjs | Live protocol, ready/start, ownership, reconnect, fixed ticking and snapshots |
| server/index.mjs | Integrated default entry and explicit public-module allowlist |
| src/dungeon-ui.js | Retained builder/lobby plus active-game handoff |
| src/dungeon-live.js | Live inputs, predicted/interpolated renderer and role HUDs |
| dungeon.html / dungeon.css / index.html | Entry, readiness/start controls and responsive live layout |
| tools/extract-combat.py | Reproducible source extraction with documented multiplayer adapters |
| tools/benchmark.mjs / tests/dungeon-*.test.mjs | New verification plus retained baseline tests |

The root README is current. Files explicitly labeled M1 or R03 are historical reference material.
