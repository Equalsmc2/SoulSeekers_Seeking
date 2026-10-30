# SoulSeekers: Seeking — Integrated R1

**A connected, locally tested six-Party versus one-human-DM browser game.** This is a playable release candidate, not a claim of production/WAN certification. The same `/dungeon-ws` server owns the dungeon, six characters, combat, monsters, camps, Tarot, souls and victory. No iframes, Firebase battle loop, or separate lab worlds.

## Start playing on Windows

1. Extract the entire ZIP to a normal folder. Do not run inside the ZIP.
2. Install Node.js LTS (22 or newer recommended; runtime supports 20+).
3. Double-click **START_PLAYING.bat**. It installs the WebSocket dependency on first launch.
4. Keep that console open. Open **http://localhost:8787/dungeon.html**. If the browser opens before the server is ready, refresh once.
5. One person chooses **CREATE SESSION**. Everyone else enters the room code and picks a different character. Use separate browser tabs/contexts for local testing; refresh in the same tab resumes its reserved seat.

Terminal startup (Windows, macOS, Linux):

```sh
npm ci
npm test
npm start
```

On macOS/Linux you can also run `sh START_PLAYING.sh`. The application opens at `/` or `/dungeon.html`. The old Boston lane mode remains at `/index.html?legacy=1` as a historical mode; it is not the integrated game.

## Build → ready → play

- The DM starts on a blank board. Place the Entrance first. Select a Room card, then click a green valid location. Right-click an empty destination to rotate the selected card; right-click an existing room to rotate that room. Wheel zooms; Space-drag pans; F fits the map.
- Use the Rooms, Tarot and Camps tabs. A played card leaves your hand without replacement. Opening hands are **16 / 5 / 6**, from finite **40 / 22 / 52** decks. You have **8** redraw credits, maximum **3** cards per batch.
- Place **seven souls in different reachable non-Entrance rooms** with the Souls tool. Apply Tarot and Poker camps to rooms as desired. The server validates every edit.
- Click **LOCK DUNGEON**. Every joined Party member clicks **READY TO PLAY**. The DM then clicks **START 40-MINUTE MATCH**.
- Six players are supported simultaneously, one unique hero each. Smaller parties are allowed for testing. All reserved seats must be connected and ready before start. Choose unclaimed seats before the match starts; only reserved players can reconnect once active.
- The Party must collect seven souls, return to the Entrance, and hold/tap **F** near its center before the server timer expires. Collecting the seventh soul alone does not win. The DM wins on timeout. The DM can start a new blank round after the result.

## Share it with friends

**Same Wi-Fi/LAN:** run one server and let friends open `http://YOUR-PC-LAN-IP:8787/dungeon.html`. Allow Node through your private-network firewall if Windows asks. The server URL defaults to the page's origin. Copy the room invitation after hosting; it includes the server address and code. `localhost` only works on the server computer, so generate the invitation from the LAN URL for LAN friends.

**Over the internet:** upload/review the source in your GitHub Desktop repository and run the Node server on Render or another persistent WebSocket host. See **INSTALL_AND_SHARE.md** for the exact workflow. The ZIP is complete source; it is not a public hosted game URL. No GitHub push, deployment, or Firebase change was performed for this release.

## Party controls

| Input | Action |
|---|---|
| WASD | Move your character |
| Mouse / Left button | Aim / weapon; hold where the weapon supports it |
| Right button | Cast selected spell |
| Q | Swap weapon A/B |
| E | Weapon stance: scope, parry/guard, scout, or cycle potion |
| Shift | Precision movement |
| R | Reload or weapon special; crossbow changes augment |
| Z / X | Select dodge A / B |
| Space | Dodge; hold/repress as that dodge requires |
| 1–0 or wheel | Select spell |
| Ctrl | Hold rest; release at the short/long threshold |
| F | Collect soul, hold to seal camp, extract at Entrance |
| H | Controls/help |

Asya also has visible Sorcery Point controls. Weapon/dodge descriptions and resource counts are in the HUD. F1–F6 switching, fake damage, arena reset and unilateral friendly-fire toggles are absent from the live match. Tab retains keyboard focus navigation.

## DM controls

1–4 selects Grunt/Ranger/Brute/Stalker. Click on clear floor to summon. Select tool + click selects a monster. Right-click orders it to move, or to capture a sealed camp. Hunt/Hold/Reclaim buttons issue server orders. **P** possesses/releases the selected monster; possessed WASD + left mouse controls movement/attack. Other monsters continue AI. Unpossessed WASD pans, wheel zooms, F fits.

Threat starts at 30; costs are 2/3/5/4. Up to 22 manual summons and 45 total monsters. Dismissing a manual summon refunds its cost; dismissing a camp-generated monster does not mint free threat. Camps spawn hostile waves at source Poker intervals/caps. Party sealing stops every future spawn; existing enemies stay hostile. A commanded or possessed DM monster can recapture an uncontested sealed camp.

## Explicit integration rules

- Friendly fire is **off**, server-owned. Cooperative healing and Castling with allies still work.
- Death returns the hero to Entrance after **3 seconds**, with a brief ward. It does not create an alternate DM win condition or erase collected souls.
- Short/long rests retain **1.6s / 4.3s** timing. They require five seconds without damage and no living monster within 350 units; movement, damage or an approaching enemy interrupts. Each hero gets **two long rests per match**, and two short rests replenished by a long rest. This cap is an explicit competitive adjustment to the lab's unlimited long-rest reset.
- Knight's Move may cross walls but its landing must be valid floor. Ordinary bullets are never Castling targets. Camera, potions, C4, melee and projectiles respect dungeon obstruction. Crossbow changes augments with R even while reloading.
- Shared Party exploration reveals rooms after entry. Party packets omit undiscovered rooms, their Tarot/camps/souls, hidden monsters, and all deck identities. The DM sees the whole map.
- The server runs at 30Hz with two 60Hz combat substeps; snapshots target 20Hz. Local normal movement is predicted using extracted V22.4 movement math; remote actors use a buffered server-clock timeline. Combat/resource outcomes remain server-owned.
- Disconnected input goes idle after 300ms. Refresh/reconnect uses the existing seat token. If all clients leave an active match, its process remains alive for the match; an inactive lobby/ended room expires after two minutes. A server restart loses sessions.

## Evidence and remaining limits

Read **TEST_REPORT.md**, **TEST_RESULTS_INTEGRATED.txt**, **KNOWN_LIMITATIONS.md**, and **CHANGELOG_INTEGRATED.md**. Automated real WebSockets complete build → ready → combat → possession → reconnect → camp seal/reclaim → seven souls → extraction. Seven headless browser contexts exercised actual controls. Performance measurements are local synthetic tests, not a guarantee about every internet connection or device.

The source data includes **six heroes, twelve weapons, twelve distinct dodge state machines, 43 spell entries, three potions, four crossbow augments, four monster types, and 22 Tarot definitions**. Spell behavior follows the source action-game approximations, not tabletop D&D RAW.

Older M1/R03 files and reference documents are retained for provenance and regression tests; their milestone status and obsolete E/Shift mappings are historical. This README describes the integrated build.
