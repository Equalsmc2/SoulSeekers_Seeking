# SoulSeekers Seeking — R1.1 Repair Candidate

- Repaired loadout onboarding and server checks; persisted one equipped dodge/weapon and blocked mid-match swaps.
- Improved Pages/Render server endpoint selection and bounded connection retries with diagnostic messages.
- Ported V22.4 melee weapon geometry, modeled all weapon types, improved melee arc/spell/trail/projectile visuals, and introduced contextual resource HUD.
- Captured server-authoritative particle/trail/pop-up effects in extraction and serialized bounded visual events.
- Added bounded sequenced input replay, authoritative input acknowledgments, small correction smoothing, limited local responsive visuals, separate buffered remote interpolation.
- Cached live room textures to reduce per-frame terrain canvas work; introduced F3 diagnostics.
- Added loadout/ack regression tests and separate actual seven-WebSocket software-latency test at ~110ms RTT and ±15ms jitter.
- Retained R1's connected cards, camps, Tarot, seven-soul extraction, monster commands and timeout.
- Unfinished: definitive visual and cross-browser certification, full WAN gameplay benchmark, restart persistence; see `REPAIR_TEST_REPORT.md`.
