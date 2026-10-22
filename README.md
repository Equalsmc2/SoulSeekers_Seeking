# SOULSEEKERS: SEEKING — R01.4

A playable **prototype** of a browser-based, six-Party-vs-one-Dungeon-Master, top-down Boston-themed shooter. It is a **separate project** from the SoulSeekers companion website.

**Status:** R01.4 includes improved lobby diagnostics. Offline training mode and the core game loop are implemented. Firebase online room code is wired for a prototype, but needs your own Firebase configuration, deployed Realtime Database rules, and multi-device testing. This is NOT production-grade netcode or a finished content-complete game.

## 1. Run locally first (no login / no Firebase needed)

**Phoenix Code / PHCode (recommended if you used it for the SoulSeekers site):**
1. Unzip the whole package into a new folder, for example `SoulSeekers_Seeking`.
2. Open this folder in Phoenix Code.
3. Open `index.html` and use **Live Preview**.
4. Choose **Play as Party** or **Play as DM**. Training mode requires no Firebase configuration.

**Alternative (Windows):** Double-click `START_LOCAL.bat` if Python is installed, or run `py -3 -m http.server 8000` in the folder and visit `http://localhost:8000/`.

Do **not** just double-click index.html from File Explorer: the browser's `file://` module restrictions may block script imports.

## 2. What is playable in R01?

- A fictionalized Boston **6,800 × 2,000-unit** battlefield with **three named lanes** and **two connected jungle belts**.
- **Six Party slots**, three named prototype characters (Asya, Jeanette, Alex), and three deliberately **unassigned** SoulSeeker placeholders. In solo Party mode, five teammates are AI-controlled; in solo DM mode, all six are AI-controlled.
- **Six forts** (two per lane), each protected by a boss. Kill the boss to expose the fort; destroy **four forts** to make the DM Tower vulnerable. Destroy the tower to win.
- **20-minute match clock**. If the tower survives until zero, the DM wins.
- Real-time local top-down WASD movement, mouse-aimed projectiles, shots hitting enemies and scenery, Q area spell, E purchasable area spell, and space dash.
- Experience, levels, gold, chest loot, two jungle shops, item purchases, plus a **Resident Evil-inspired 8×5 grid inventory** with shaped items and rotation.
- A DM resource (Threat) that regenerates, deployed Grunts/Brutes/Snipers, waves, an army move order, and direct enemy possession/control (including bosses).
- Pan/zoom camera, health bars, minimap, UI with player information and combat feed.

This is placeholder/vector art, not yet your existing SoulSeekers character portraits/animations or a geographically faithful Boston environment. Named character Q abilities are currently prototypes. Legendary Actions and full D&D spell slots/metamagic are **not yet** implemented. Actual server-side anti-cheat, final balancing, sound, polished animation, and collision/pathfinding need later iterations.

## 3. Controls

| Party | Control |
|---|---|
| Move | `W A S D` |
| Aim / fire | Mouse / hold left click |
| Q spell (prototype burst) | `Q` |
| Bought Echo Nova spell | `E` after buying Extra Spell Slot |
| Dash | `Space` |
| Loot nearby chest | `F` |
| Scroll sidebar to shop | `B` |
| Toggle inventory | `I` |
| Select inventory piece | Click it |
| Reposition piece | Click target empty grid cell |
| Rotate selected piece | `R` |
| Zoom camera | Mouse wheel |

| DM | Control |
|---|---|
| Deploy enemy | Select reinforcement button, then **click desired valid world position** (must be at least 650 world units from west boundary, not inside building) |
| Pick lane | North / Center / South controls (for managing the front) |
| Possess enemy | Click any enemy in view, including bosses |
| Move possessed enemy | `W A S D` |
| Shoot as possessed enemy | Hold left click |
| Release enemy or cancel placement | `Esc` |
| Order ordinary enemies toward position | Right click the battlefield |
| Pan free camera (not possessed) | Arrow keys |
| Jump to position | Click minimap (not possessed) |
| Zoom camera | Mouse wheel |

## 4. Firebase multiplayer (Web App already configured in R01.3)

You may use an entirely new Firebase project to avoid accidental interaction with the SoulSeekers companion site's existing Auth/Firestore data and security rules. GitHub Pages hosts the static HTML/CSS/JS. Firebase supplies auth, room membership, state snapshots, and player inputs.

1. In the [Firebase Console](https://console.firebase.google.com/), create a project and register a **Web App**.
2. In **Authentication → Sign-in method**, enable **Anonymous**. This R01 design treats whoever **creates the room** as its DM, rather than using your companion site's global DM-role permissions.
3. In **Build → Realtime Database**, create a database, copy its exact `databaseURL` (including region), and paste the whole contents of `database.rules.json` into **Realtime Database → Rules**; then **Publish**. Do not publish these rules to Firestore instead. This is a distinct service.
4. **R01.3 already has your Firebase Web App configuration** inside `firebase-config.js` for project `soulseekers-seeking`; you do not need to paste anything. Web App identifiers are normal public config values; database security must come from authentication/rules, **never** from hiding the config. You still need to enable Anonymous authentication and publish `database.rules.json` in **Realtime Database → Rules**.
5. Restart Live Preview. Choose **Host as DM** to create a six-character code. On up to six other computers/browsers, open the same published site, each select a different hero, enter the room code and join as Party.
6. **Keep the DM host's tab open.** At this prototype stage, the DM browser runs the authoritative game simulation and publishes snapshots roughly 6–7 times per second; Party clients send input around 10 times per second. This means actions and movement can look/feel delayed online compared with local training.

**IMPORTANT ONLINE LIMITATIONS:** This is a browser-host-authoritative proof of concept. Server rules ensure that only the creator UID can write the world snapshot and players can only write their own input/claim their own slot. However, the host itself is not a trusted dedicated server and input/economy safeguards are not complete. A malicious client may still manipulate its input; don't use this code for serious competitive ranking or real-money items. Room codes are discoverability aids, not a strong authentication system. Closing the DM host tab ends active simulation. Firebase traffic/bandwidth can cost money at scale; avoid long unattended sessions.

**Firebase sources:**
- [Web SDK setup](https://firebase.google.com/docs/web/setup)
- [RTDB security rules](https://firebase.google.com/docs/database/security)
- [Auth and rules](https://firebase.google.com/docs/rules/rules-and-auth)
- [RTDB onDisconnect](https://firebase.google.com/docs/reference/js/database.ondisconnect)

## 5. Deploy via your GitHub workflow

**Easy Windows sync:** Run `SYNC_TO_GITHUB.bat` from the extracted game folder and follow `GITHUB_SYNC_GUIDE.md`. The helper copies files to your GitHub Desktop clone, then lets you commit/push in Desktop or attempt a one-click Git push.

1. Create a **new GitHub repository** such as `SoulSeekers_Seeking` (recommended rather than modifying the SoulSeekers website repository).
2. Place **the files inside the ZIP directly in the repository root** — the root `index.html` is important. Do not upload a folder that contains the real root one level down.
3. Use **GitHub Desktop** to commit/push changes as you did with the companion website.
4. In repository **Settings → Pages**, select **Deploy from a branch → main → / (root)**.
5. Visit `https://YOUR-USER.github.io/SoulSeekers_Seeking/` after Pages deployment finishes.
6. If you configured Firebase, add your GitHub Pages domain to **Authentication → Settings → Authorized domains** if required for your chosen sign-in setup.

Assets and module references are **relative**, making the site safe under GitHub Pages subpaths. No Node build step or package install is required for the current frontend.

## 6. Project structure

```text
SoulSeekers_Seeking/
  index.html             Main browser game and menus
  style.css              Responsive UI
  firebase-config.js     Your Firebase Web App config (pre-filled in R01.3)
  database.rules.json    Prototype RTDB rules (publish manually)
  src/data.js            Roster, prices, world layout
  src/engine.js          Combat, waves, AI, loot, levels, towers, inventory
  src/network.js         Anonymous auth, room host, join, realtime data
  src/main.js            Rendering, controls, menus, HUD
  tests/                 Automated Node engine tests
  START_LOCAL.bat         Optional Windows local HTTP start
  SYNC_TO_GITHUB.bat      Windows GitHub Desktop import + optional commit/push
  GITHUB_SYNC_GUIDE.md    Step-by-step publishing instructions
  START_LOCAL.sh          Optional macOS/Linux local HTTP start
  README.md
  CHANGELOG.md
```

## 7. Future build order

**R02 — Battle feel and pathfinding:** hit feedback, death and respawn VFX, navmesh/blocked paths, tactical UI, more useful DM enemy commands, boss phases, lanes and cover.

**R03 — Your real party:** replace character slots with the complete SoulSeekers roster, import your art and music with permission, real spell lists, spell slots, metamagic for Asya, signature abilities for each hero; design them for *this* shooter rather than lifting tabletop balancing unchanged.

**R04 — Multiplayer reliability:** server authority (Cloud Run / dedicated room simulation), client-side prediction/interpolation, ability events, input validation, lobby ready checks, reconnects, latency compensation, server-side buying/XP rules, stale room cleanup, Firebase usage caps.

**R05 — Art and content:** coherent Boston streets/landmarks, map collision geometry, jungle encounters, boss fights with patterns, item rarities, shop progression, sound/music and UI animations. Later add spectator/caster tools and match results.

## 8. Self-checks

`node tests/engine.test.mjs` executes deterministic rule/system tests; `node --check src/main.js` and equivalent checks ensure JavaScript syntax is valid. A real browser visual QA test, Firebase credentials, hosting deployment, and cross-device online load test **must still be performed on your machine**.

## R01.4 multiplayer join troubleshooting

- The DM should choose HOST AS DM, then click the **ROOM ABCDEF · COPY** button in the top header. Share the *six-character auto-generated code*, not a chosen password.
- Party members need to open the **same current site** (after GitHub Pages deploys), choose a different hero per player, paste the code, provide their name, then press JOIN AS PARTY.
- If a Party cannot join, the R01.4 menu now displays exactly which stage fails and an actionable message. The red error is persistent; take a screenshot and share it for debugging.
- **Permission denied**: In Firebase console go to **Realtime Database → Rules** and replace the rules with the project's `database.rules.json`, then Publish. Cloud Firestore is a different database.
- **Anonymous Authentication disabled**: Firebase Authentication → Sign-in method → Anonymous → Enable.
- **Room missing**: The DM must leave the browser open, host a fresh match, and copy its newest code.
- **Slot occupied**: Choose a different character; each Hero slot is unique.
- **Cached old build**: Refresh both the Party and DM page with Ctrl+Shift+R after GitHub Pages deployment; verify the title shows R01.4.
- This release was regression-tested with a mock RTDB client; real network access and Firebase Console security rule publication cannot be simulated from this ZIP.
