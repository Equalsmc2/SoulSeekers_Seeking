#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo 'SoulSeekers / Seeking — M1 Dungeon Server'
echo 'Open http://localhost:8787/dungeon.html'
exec node server/index.mjs
