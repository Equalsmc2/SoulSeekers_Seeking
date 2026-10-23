# SoulSeekers: Seeking R02.1 — Smoothness acceptance test

**Goal:** distinguish rendering stutter, irregular network delivery and camera/prediction corrections before further map or gameplay expansion.

### Upgrade the existing installation

1. Extract `SoulSeekers_Seeking_R02_1_Smoothness_Update.zip`.
2. Run `SYNC_TO_GITHUB.bat`, confirm the remembered `SoulSeekers_Seeking` repository, choose **1**, commit and **Push origin** in GitHub Desktop.
3. Your **existing** Render Web Service normally redeploys after the push; otherwise use **Manual Deploy → Deploy latest commit**. No extra Firebase configuration, second repository or second Render service is needed.
4. Once Render shows **Live**, hard-refresh the game windows (Ctrl+Shift+R) and confirm the logo says **R02.1**.
5. Create a **new DM room** and join it as a Party member. Existing rooms reset on a server restart.

### Two-window performance test

Keep both Zen windows visible side by side (not two hidden tabs). Run these three short tests: stand still while enemies move; move in a straight line for 20 seconds; turn and shoot while DM possesses and moves a unit. Watch the small performance panel near the upper left of the battlefield.

| Readout | What it measures | What to investigate |
|---|---|---|
| FPS | Browser rendering frames per second | If sustained under 40, check graphics load, recorder, browser, hardware. Automatic canvas quality should step down after a few seconds. |
| NET/s | Server snapshots received per second | Nominal 20 during active play. Under 12 suggests slow delivery or server strain. |
| RTT | Ping round trip to Render | High RTT causes delayed effects. The local predicted player should still move promptly. |
| JITTER | Variation in network update intervals | Repeated >30ms indicates bursty updates; interpolation hides some but not all stalls. |

Use **offline training** as a control: if it stutters too, the network cannot be the only cause. If only online mode stutters despite good FPS, record the performance readout and the DM and Party movements.

### Implementation details

- 30Hz authoritative simulation; nominal 20Hz network snapshots.
- Visual player prediction runs on each animation frame; snapshots still decide real combat outcomes.
- Remote entities and bullets display from a short buffered timeline, delaying their presentation slightly to conceal jitter.
- Player snapshots carry only nearby combat actors and bullets. DM snapshots stay complete. Non-spatial shared state (forts, heroes, clock, gold, inventory) remains available to everyone.
- Browser auto-reduces canvas resolution after sustained FPS loss; this may look slightly softer on a struggling device. It restores resolution after stable high FPS.

### Known limits

This is not a guarantee of zero lag. Render free instances may experience variable CPU/network scheduling and browsers may throttle inactive windows. Dedicated performance instrumentation is a prototype diagnostic, not a full network profiler. No actual seven-player internet load test was performed while building this update.
