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
