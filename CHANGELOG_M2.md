# M2 Integration Alpha — Changes since M1

**New:** `shared/combat/loadouts.mjs`, `shared/dungeon/runtime.mjs`, `src/dungeon-play.js`, `tests/dungeon-play.test.mjs`, `M2_README.md`, `CHANGELOG_M2.md`, `START_DUNGEON_M2.bat/.sh`.

**Updated:** `server/dungeon-service.mjs` (ACTIVE and ENDED phases, role-safe gameplay commands, 30-Hz runtime ticks, filtered snapshot payloads), `server/index.mjs` (serve the shared combat definitions), `dungeon.html`/`dungeon.css` (live field and HUD), `src/dungeon-ui.js` (phase handoff and controls), `index.html` (M2 navigation label), `package.json` (version and tests).

**Retained:** the original R03.5 source/server and 14 legacy test suites, full M1 finite-card build/edit/undo rules, 7-player lobby/rejoin rules, bundled prototype references and all existing local/GitHub Desktop/Render scripts. The newest uploaded Party V22.4 and DM R05.3 HTML files are bit-for-bit identical to the preceding uploads; bundled source references already preserve them.

**Limitations:** The M2 alpha offers playable server-owned combat approximations, not the entire original standalone labs. See `M2_README.md` for feature parity and unverified browser performance caveats.
