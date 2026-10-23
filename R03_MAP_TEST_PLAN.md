# R03 acceptance checks — Boston: The Blackout

1. Confirm the top-left header says `PROTOTYPE R03 · BOSTON BLACKOUT` (not R02.2).
2. In offline Party training, start from the central spawn. Travel northeast on the Beacon Hill route or southeast on the South End route; the paths should separate as you progress eastward.
3. Use the two green jungle roads between the main streets. Find a shop in each jungle and interact with a chest near the roads; no loot location should be inside a wall.
4. Approach the first-tier and second-tier forts on each of the 3 lanes (6 total). Defeat bosses to expose their forts. Destroy 4 forts to expose the DM Tower.
5. Open offline DM training. Use the minimap and lane buttons to pan, summon reinforcements, possess one, and right-click to issue an army order that traverses the crossroads.
6. Test online on your **existing** Render service after the new GitHub commit shows Live. Two visible browser windows are okay for initial verification, but the full 6+1 stress test remains future work.
7. Monitor FPS, P95 frame time, hitch counter and network rate. If new graphics introduce hitches, include the overlay and version label in your recording.

Local verification: 9 of 9 Node test suites passed, browser training started and rendered, no old-version references in active JS entrypoint. Public deployment latency is unverified.
