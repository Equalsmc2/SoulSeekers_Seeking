# SoulSeekers: Seeking R02.2 — Multiplayer smoothness acceptance

## Installation

1. Extract the full `SoulSeekers_Seeking_R02_2_Network_Stability.zip` archive; do not copy files individually.
2. Run `SYNC_TO_GITHUB.bat`, choose **1** for GitHub Desktop, commit to `main` and **Push origin**.
3. Allow the **existing** Render Web Service to redeploy from GitHub. If auto-deploy is disabled, use **Manual Deploy → Deploy latest commit**. Do not create another Render service or modify Firebase.
4. After Render reports **Live**, open the game. Confirm the top banner says **PROTOTYPE R02.2**. Hard-refresh with Ctrl+Shift+R if it still says R02.1.
5. Create a **new** DM room after deployment and join using the room code or invite link. Server restarts invalidate earlier rooms.

## Run these three short tests in two visible Zen windows

1. **Movement:** Hold WASD and circle a building for 20–30 seconds in Party mode; observe the Party window and the DM's representation of the Party member.
2. **Projectiles:** Shoot toward moving NPCs while the DM spawns/possesses a moving unit. Watch for regular bullet movement, not cosmetic bullet effects.
3. **Stress:** Move and shoot while the DM issues orders and deploys a moderate enemy wave. The DM should still be able to pan and control units.

## How to interpret the overlay

| Indicator | Healthy reference (not a guarantee) | Implication when abnormal |
| --- | --- | --- |
| FPS | Near display refresh rate, e.g. ~60 | Low average = browser/GPU/CPU rendering load |
| P95 | Around 16–20 ms on a 60 Hz display | P95 > 26 ms = visible frame-time inconsistency |
| HITCHES | Near 0, recent frame >34 ms count | Repeated spikes = brief render stalls despite decent average FPS |
| NET/s | Close to 20 after joining | Under 12 for a while = delayed or skipped server snapshots |
| RTT | Preferably well below 100 ms, if possible | Network distance/congestion; input outcomes feel delayed |
| NET JITTER | Low and steady | Uneven arrival spacing; adaptive interpolation conceals some of it |

**How R02.2 differs from R02.1:** remote snapshots now use their server simulation timestamps; a small adaptive buffer plays the motion timeline forward. A regular network delay is not treated as a local movement error. The Node server's 30 Hz simulation uses a bounded fixed-timestep accumulator, and the screen displays frame-time percentiles rather than only average FPS. This can conceal brief network jitter but cannot eliminate real server stalls, poor network conditions, or low rendering performance.

## Regression tests and limits

`npm test` checks engine mechanics, prediction, startup, rendering mock, server session/permissions, simulated socket communication, previous smoothing and new clock-stability cases (8 suites). Browser rendering was not benchmarked on a live Render deployment, so the final accept/reject test is your two-window session.
