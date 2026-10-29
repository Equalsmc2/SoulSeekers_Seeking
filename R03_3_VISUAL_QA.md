# R03.3 – Visual QA and acceptance

This patch changes the static Kenney tile-art renderer and asset cache version only.

### Verify on GitHub Pages or Render

1. Confirm header reads **PROTOTYPE R03.3 · BOSTON MAP POLISH** after deployment and Ctrl + Shift + R.
2. Enter offline Party mode, travel north and south: no invisible walls caused by art and no character sprites hidden by buildings.
3. Test curves, all six cross-town roads, bridge travel, shops and high-value jungle chests.
4. With DM, spawn at least 20 enemies in both jungles; check they navigate around cover.
5. Host DM + Player online; confirm server address, lobby code, combat and inventory remain functional.
6. Watch FPS / P95 / hitches; new background is drawn into the static world cache once, not per video frame.

**Known scope:** While landmarks now read more clearly, the building placement remains the procedural R03.2 baseline. This release is not a geographically exact Boston road map and does not introduce interiors.

**Evidence:** 10 existing Node suites plus the R03.3 visual integration check; Chromium canvas preview render succeeded. Live server load testing awaits user deployment.
