# R1.1 Repair — measured verification and unverified items

Date: 2026-10-29/30. Source: integrated R1 user archive, internal M1 preservation and latest Party V22.4 / DM R05.3 / R05.4 references. No external repository or deployment was accessed or changed.

## Automated Node tests

`npm test`: **35 passes, 0 failures** (including earlier test coverage and new locked-loadout, resume, input acknowledgment, and anti-position-injection checks). Full log in `TEST_RESULTS_R1_1_REPAIR.txt`.

`node tools/lag-qa.mjs`: **7 actual local WebSocket peers** (1 DM, 6 Party), 30Hz server updates, 20Hz snapshots, deliberately delayed 55±15ms in **both directions**. Approximately 110ms effective RTT, measured median ping RTT across six Party sockets ~102–114ms in one run, median inter-snapshot delivery ~48–52ms. A healthy run delivered 86–87 snapshots per Party in about 4.3 seconds, with server acknowledgments for >200 sequenced input packets. An additional run under host contention dropped to 47 snapshots with p95 gaps around 0.5 seconds; the cause of that external/runtime stall was not isolated, so play feel must still be tested on target hardware. These measurements do not include browser rendering or physical WAN latency; full raw data in `NETWORK_LAG_QA_RESULTS.json`.

`npm run benchmark`: representative *warm* repeated executions: mean ~2.76–3.07ms, p95 ~5.91–7.21ms, p99 ~7.55–11.42ms, max ~10.72–17.67ms; ~16.3KB mean Party snapshot, 33.33ms budget. **A separate run showed a severe 5.5 second outlier**, demonstrating that the benchmark can experience scheduling/GC/host contention and cannot certify zero server pauses. Original R1 baseline recorded mean 1.25ms and 10.6KB Party snapshots, so visuals come with extra CPU/traffic cost.

## Browser and visual quality — NOT CERTIFIED

A seven-context automated Chromium page test was attempted. Browser navigation to `http://127.0.0.1` / `http://localhost` was blocked by the environment with `net::ERR_BLOCKED_BY_ADMINISTRATOR` before page load. The source therefore passed static syntax checks and socket tests but **has not been visually reviewed as a complete live page in this execution**. Firefox was not available for verification. No low-end GPU measurements, six-person human-play 40-minute match, or live Render test was performed.

## Manual acceptance still required

Run V22.4 and this R1.1 next to one another at matching resolution: verify each of six characters and both original weapons/dodges, projectile/weapon angles, ghost/dodge effects, scope, spell visuals, camp rings and terrain. Test Chromium and Firefox with browser frame timing, tab change/focus, and ordinary and induced 110ms RTT. Monitor for local movement corrections and compare screenshot/video before calling visual fidelity fixed. Test a complete competitive round and persistent session loss/reconnect on an approved staging Render instance, never the live production service without permission.
