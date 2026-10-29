# R03.1 acceptance test — Bigger Jungles / Boston Districts

This update changes playable geography and static art, not the R02.2 online networking protocol. Start a *new match* after Render deploys.

## Deployment confirmation

1. Extract the whole ZIP and run `SYNC_TO_GITHUB.bat`.
2. Commit and push in GitHub Desktop, wait until Render and GitHub Pages have finished deploying.
3. Hard refresh. Verify the header reads `PROTOTYPE R03.1 · BOSTON EXPANDED`.
4. Use a fresh DM room code and two *visible* browser windows when testing network movement.

## Party / map traversal

- **Upper jungle — The Hollow Common:** enter from any connector; follow the center path and both outside paths. Loop back through at least two smaller vertical crossing paths. Visit the Swan Pond, Silent Memorial and Bandstand. Confirm park planters stop movement and shots.
- **Lower jungle — The Underworks:** follow the three transit/service trails; change routes through the interior crossings. Visit the Red Line Depot, Blackout Substation and Fort Point Freight yard. Cargo cover should stop movement and shots.
- **High-value cache:** open the violet-marked Memorial Frequency Cache or Substation Lockbox with F. Each rewards **220 gold and 130 XP**. Regular chests still reward 90 gold and 55 XP.
- **Shops:** Common Night Market and Underworks Exchange remain accessible. Open B when near a shop and purchase an item.
- **Lanes:** check Beacon Hill brick lane, Civic/Downtown middle lane, and South Boston industrial lane for different visual textures and abandoned car cover.
- **Objectives:** defeat fort bosses, break at least four forts, reach and attack the DM Tower. The match can be won in offline Party training.

## DM

- Deploy grunts/brutes/snipers on open lane/jungle floor, but not inside trees' planter covers, freight crates, parked vehicles or buildings.
- Possess a grunt, move through an upper or lower jungle, and issue cross-town right-click orders to troops.
- Confirm no persistent unit wall trapping on road centerlines or jungle center/trail crossings.

## Performance

- Watch FPS, P95 frame time, hitch count, NET/s, RTT, and jitter while a large group of troops fights near jungle cover.
- The map is cached once as a static 6800×2000 Canvas; geometry and art should not be regenerated every frame. New solid cover uses the same deterministic rectangles for prediction and server collision.
- Local Node regression tests cover the map, engine, mock canvas rendering, prediction, lobby protocol, startup and networking. A real public Render + seven-player stress test is **not** certified by those local tests.
