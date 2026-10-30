# R1.1 Repair update

The 25-test R1 result below is historical. The current repair candidate passed **35 tests**, including the loadout server enforcement and input-acknowledgment checks. An injected-latency seven-peer local WebSocket harness also passed. Browser visual certification was **not performed**, since Chromium blocked local navigation. See `REPAIR_TEST_REPORT.md` and `NETWORK_LAG_QA_RESULTS.json`.

---

# Integrated R1 verification

The final packaged source passed `npm test`: **25 tests, 25 passes, zero failures**, approximately 2.96 seconds on Node v24.22.1. Node test counts include historical file-level tests as well as new named tests. See TEST_RESULTS_INTEGRATED.txt for the complete output.

## Connected gameplay coverage

- Six character controllers execute all 12 weapon choices, 12 dodges and 43 spell entries. Tests cover resource ownership, death/respawn, defense cases, collision and obstruction; this is not exhaustive balance or animation parity certification.
- A real seven-client WebSocket test builds a dungeon using card commands, places camp/Tarot, locks, readies six players, starts, exercises independent movement, combat, possession, orders and reconnect, traverses using movement commands, seals a camp, verifies sealed spawning stops, recaptures it with DM monsters and verifies spawning resumes, collects seven souls and extracts.
- The traversal test uses an accelerated injected server clock and authorized DM dismiss commands to control combat interference. It does not represent six human opponents playing a full-duration match.
- Tests cover deadline loss, immutable end state, private fog/card data, rejected role/phase commands, replay sequence rejection, stale-input expiry, camp faction/sealing behavior, finite card rules and Tarot modifiers.

## Browser verification

Seven independent Chromium contexts joined one real server: one DM and six Party members. Browser automation exercised the builder, ready/start UI, player movement, weapon/dodge inputs, DM summon/select/possess controls and active rendering. Result: zero browser errors; Party moved 169.82 world units during the movement sample. A 1.5-second animation-frame sample measured 61 callbacks/second (91 frames). This short local sample is not a GPU performance guarantee. See BROWSER_RESULTS.txt.

Optional reproduction from the project folder: `npm install --no-save playwright`, `npx playwright install chromium`, then `node tools/browser-qa.mjs`. This runs a local server on port 8790 and writes two screenshots. The recorded run used the same scenario with the environment-provided Playwright and Chromium binary. Browser dependencies are not required to play.

## Performance measurement

Run `npm run benchmark`. The recorded local scenario used 16 rooms, six firing/moving heroes, 45 initial hunting monsters and seven filtered snapshots on two of every three ticks for 30 simulated seconds. Mean tick plus snapshot work: **1.25ms**; p95 **2.12ms**; p99 **2.92ms**; maximum **7.48ms** against a 33.33ms server tick budget. Mean Party snapshot: 10,602 bytes. See PERFORMANCE_RESULTS.json.

Cached navigation, bounded path requests, a fixed server step, local normal-movement prediction, remote interpolation, stale-input release and WebSocket backpressure are active. Network latency, server sizing, browser hardware and crowded combat still affect experience; WAN/Render testing was not performed.

## Not tested

Live deployment, Safari/Firefox, touch controls, a full six-human 40-minute competitive match, slow devices and long-distance internet conditions. See KNOWN_LIMITATIONS.md for remaining functionality and deliberate source-integration differences. No live resources were changed.
