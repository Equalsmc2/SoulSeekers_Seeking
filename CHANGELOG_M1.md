# M1 integration changes — October 29, 2026

**Added:** `dungeon.html`, `dungeon.css`, `src/dungeon-ui.js`, `shared/dungeon/{rules,session}.mjs`, `server/dungeon-service.mjs`, `server/ws-local-fallback.mjs`, `tests/dungeon-m1.test.mjs`, `tests/dungeon-wire.test.mjs`, `START_DUNGEON_M1.bat`, `START_DUNGEON_M1.sh`, `M1_README.md`, `references/` source and handoff documents.

**Modified:** `server/index.mjs` (second WebSocket route, M1 service, browser-accessible shared constants, production `ws` + optional local fallback); `index.html` (new dungeon entry link); `package.json` (M1 test script/version label).

**Unmodified legacy subsystems:** original `server/matches.mjs`, old combat simulation, HUD/engine modules, `SYNC_TO_GITHUB.bat`, Render YAML, Firebase settings, 14 legacy tests.

No GitHub/Render/Firebase action executed.
