#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -d node_modules/ws ]; then npm ci --omit=dev; fi
printf 'Open http://localhost:8787/dungeon.html\nKeep this terminal open while playing.\n'
exec node server/index.mjs
