# Integration acceptance checklist

## Source/provenance
- [ ] Code assembled from verified site R03.5, combat V19.2, DM R05.4; versions shown in menu and documentation
- [ ] Existing site 14 Node test suites continue to pass
- [ ] New game executable locally and exported as complete ZIP with working `SYNC_TO_GITHUB.bat`

## DM building and cards
- [ ] Every round begins with EMPTY build grid; correct starting hands 16 Room / 5 Tarot / 6 Poker
- [ ] Placing a card does NOT draw a replacement
- [ ] Room rotation updates walls, doors, door matching, collision
- [ ] All 7 souls reachable from Entrance before locking; cannot start invalid dungeon
- [ ] 8 redraw credits max, up to 3 selected cards; credits and hand persist across reconnections
- [ ] Tarot room modifiers work, Poker suits/ranks affect enemies

## DM live gameplay
- [ ] Can summon, select, move/hunt/hold-order, possess and attack with a monster
- [ ] Other monsters keep AI orders during DM possession or tab background
- [ ] Monster pathing through large connected room modules and around obstacles
- [ ] DM actions rejected when performed by non-DM client

## Party objectives/camps
- [ ] Up to 6 distinct Party characters concurrently join the SAME dungeon world
- [ ] All seven souls can be collected and extracted at Entrance before server timer expires
- [ ] Fog of war reveals only explored rooms; no leaking hidden room data in Party snapshots
- [ ] Captured camp displays SEALED and spawns NEITHER hostile NOR allied reinforcements
- [ ] Existing hostile creatures remain hostile after Party sealing camp
- [ ] DM monster can reclaim camp; hostile spawns resume
- [ ] 40-min server-authoritative timer ends in DM win if extraction incomplete

## Combat and balance
- [ ] Every character has 2 weapons / 2 dodges and appropriate Level-3 class spells and resources
- [ ] Proper swept melee hitbox follows blade sprite; mouse-direction melee blocking
- [ ] Auto reload; Shift scoped look-ahead matches weapon range
- [ ] LOS spells blocked by walls and no slot spent if cast invalid; out-of-range spells clamp to max distance
- [ ] Deadweight avoids bullets during dive/crawl but not melee; Castling cannot swap with gun bullets
- [ ] Weapon fire/spellcast exclusive; dodge/recovery prevents either
- [ ] Asya SP and Ctrl rest work under server resource accounting

## Performance and deployment
- [ ] Server sim at stable fixed 30Hz, filters snapshots ~20Hz with clocks and interpolation
- [ ] Two Zen windows and 7 clients tested without high RTT rubber-banding or frame hitches
- [ ] Server remains authoritative with DM tab minimized; reconnect works
- [ ] GitHub Pages static client and Render Node WebSocket service deploy as before
- [ ] No Firebase battle-state sync; no live account changes without approval
- [ ] Release notes distinguish locally verified tests from live tests
