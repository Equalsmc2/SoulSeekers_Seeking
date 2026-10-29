# SOULSEEKERS: SEEKING — CANONICAL MASTER GAME SPECIFICATION
**As of:** 2026-10-29. This describes current intended behavior and three separate tested code bases, not an already integrated product.

## 0. One-sentence vision
A modern supernatural Boston browser game where **six SoulSeekers** try to collect **seven souls** and extract from a card-built dungeon within **40 minutes**, against **one human Dungeon Master** who designed the dungeon and can summon, command, and possess monsters.

## 1. Source precedence (very important)
- **Website, UI, deployment, existing dedicated networking** → R03.5 website in `01_LATEST_SEEKING_SITE_R03_5`. Verified current GitHub `main` commit `2425f7b7b2345c7ddf3e84aab15ceeea9654faa3` and matching index, package, main JS, server matches, engine, clean-HUD CSS blob SHAs.
- **Party movement, weapons, dodges, spells, rest** → V19.2 Party lab in `02_LATEST_PARTY_LAB_V19_2`.
- **Dungeon generation, DM commander, card economy, camps** → R05.4 DM lab in `03_LATEST_DM_COMMANDER_R05_4`.
- **Where mechanics conflict:** explicit newer user intent and newer relevant lab wins. Do not copy obsolete R03.5 controls or fixed-lane victory conditions into final dungeon mode.

## 2. Gameplay loop and victory
1. Round starts in an untimed **DM Build Phase** on a **blank canvas**. DM gets limited card hands, can place/rotate/connect modular room cards, apply Tarot to rooms, place poker monster camps, place exactly 7 souls, and validate reachable entrances/souls.
2. DM locks dungeon. Six distinct Party character slots join shared session (can have fewer for testing). The **40:00 real-elapsed-time match clock** starts on active gameplay, not building. Server owns time.
3. Party explores dungeon (fog of war / undiscovered rooms hidden from Party), fights hostile AI and DM-possessed monsters, shuts down enemy camp spawning by capturing/sealing camps, collects 7 souls, and returns to the entrance.
4. DM places monsters within constraints, issues autonomous orders, and directly controls/possesses one monster at a time. DM can reclaim sealed camps with monsters; enemy camp spawning resumes.
5. **Party win:** collects seven souls and extracts at the Entrance before clock expires. **DM win:** time runs out before extraction. Define match termination on server; do not leave client-only authority.
6. New round resets decks/cards/souls and returns to new blank dungeon build canvas.

## 3. Dungeon spatial model / art
- **Large 960 x 960 world-unit room cards** in the standalone DM prototype. Each room has floors, solid outer walls, matching doorway slots, and combat obstacles with collision. Clean geometry first; no need to create final room illustration assets yet.
- Doors and room rotation are **logical**: rotating by right-click or R changes door direction, obstacles/collision, path graph, and corresponding art geometry. Place only at matching connected exits; show valid/invalid destinations before placement.
- Blank canvas every round; DM left-click card then click destination OR drag-and-drop, right-click to rotate, drag placed room to reposition, Space+drag pan, wheel zoom; verify accessibility and no disconnected soul rooms.
- The provided Pinterest/card-tile references are stylistic targets only, not assets to copy. Final visual direction: richly illustrated modular rooms with clean, consistent human-like top-down geometry, but the current prototype intentionally uses simple floors, walls, and obstacles.
- Locations should feel like supernatural Boston underground; the old three-lane Boston city map is a **legacy reference**, not the map to keep in this new dungeon mode.

## 4. DM's three decks / strict economy
### Deck 1 — ROOMS
- 40 room cards total exist in the prototype's reserve+hand economy, with exactly **16 cards dealt once** to DM at the start of a round (includes Entrance).
- No automatic refill when placing. Played cards leave the hand. Removing a placed room/undo returns **the exact same card**. Rooms must obey wall/door geometry, no overlap, and entrance connectivity.
### Deck 2 — TAROT
- **22 Major Arcana**, with **5 cards dealt once** each round. One card can apply a room modifier such as speed, hazard, damage, healing, cap rate, or spawn effects (actual rules/details are in R05.4 source). Played cards are not automatically replaced.
### Deck 3 — POKER CAMPS
- Standard **52 poker cards**, with **6 dealt once** each round. Place camps in eligible rooms; cards determine spawned enemies: Spades/Stalker, Hearts/Grunt, Diamonds/Ranger, Clubs/Brute. Rank affects strength/spawn cadence. Played cards are not automatically replaced.
### Rerolls
- DM starts with **8 total replacement credits** and can select **up to 3 cards at once** for a redraw. Each replaced card costs one credit; replaced card goes to discard, replacement draws from that specific deck's remaining supply. No free replenishment. Keep card economy and discarded cards server-side to prevent client exploits.

## 5. Poker camp control (corrected rule)
- **DM-owned:** camp periodically spawns HOSTILE enemies specified by the card. Costs and balance are prototype values.
- **Party captures:** camp becomes **SEALED** and spawning immediately **stops**, including any future would-be allies. Existing hostile monsters REMAIN hostile; no side switching.
- **DM recaptures with monster (AI order or possession):** camp returns to DM ownership and hostile spawning resumes. Repeatable during the match.
- Current prototype requires nearby defenders to be cleared/contested and uses a hold-interact capture meter. Put capture progress, presence checks, and ownership updates on server.

## 6. DM gameplay (not merely a walkthrough)
- Human DM can summon Grunt, Ranger, Brute, Stalker; select monsters; order Move/Hunt/Hold; possess/release one monster and directly WASD-move/left-click attack; remaining monsters continue AI behavior. Monsters must navigate room-to-room via doors and around walls/obstacles.
- Existing R05.4 local mode has one AI Party bot and a one-character Party test mode, but final game requires six human Party clients plus DM. Enemy AI and DM orders must function even when DM browser tab is hidden or disconnects; simulation stays on dedicated server.
- DM can use prepared Tarot room modifiers and poker camps throughout match. Do not grant unlimited monsters or card draws; retain threat/spawn budget, adjust only deliberately and explain balance.

## 7. Party cast (LV3 sample builds; classes from V19.2)
| Character | Class / archetype | Weapon A | Weapon B | Dodge A | Dodge B |
|---|---|---|---|---|---|
| **Asya** | Aberrant Mind Sorcerer / close specialist | BombDrone_u_Pilot | Crowbar + C4 | Signal Loss | Rewind Echo |
| **Alexandra** | Arcane Trickster Rogue / precision | Kitchen Knife + Sneak | Scoped Revolver | Knight's Move | Castling |
| **Veteran** | Undead Warlock / balanced midrange | Combat Shovel | M4 Carbine | Foxhole Dive | Deadweight |
| **Debtor** | Cult-Debt Warlock / tank | Steel Mace | Fire Extinguisher | Foreclosure | Counterweight |
| **Jeanette** | Cleric / wedding photographer | M1911 Pistol | Flash Camera | Double Exposure | Shutter Reflex |
| **Chemist** | Artificer / long-range support | Timed Potion | Enchanted Crossbow | Reaction Thrust | Catalyst Skim |

### General movement/weapon rules
- Tactical but responsive WASD movement with character-specific acceleration, braking, friction, and turn characteristics. Asya has a *controlled hover*, not endless frictionless drift. Alexandra is unusually snappy but physically grounded. Tank weighty, Veteran deliberate, Jeanette agile, Chemist gliding.
- Mouse aim; no gun recoil physically pushing player backward; shooting movement slowdown is class/weapon-specific (Alexandra exception in the lab). **Cannot attack and cast simultaneously**. Cannot shoot or cast during dodge and recovery.
- `Shift`: Terraria-style look-ahead scope for compatible ranged weapons (weapon effective range matches actual sightline), OR directional blocking toward cursor for melee.
- `R`: manual/automatic reload for ammunition weapons; unique special for melee (Crowbar R places/then detonates C4; Kitchen Knife R Sneak; Shovel R cover); **crossbow R with FULL AMMO changes augment; R if not full reloads; E remains RESERVED**. Fire Extinguisher R Pressure Burst. Auto reload when ammo hits 0.
- Melee weapon geometry, swing arcs, active hitbox paths and blocking cone must correspond to visible animations. No accidental 360° swing and no visible hit without damage if target is eligible and unobstructed. Melee attacks must respect wall obstruction.
- Camera/Jeanette: normal wide, close-AoE flash; Shift + hold left click charge narrow long-range focused flash. Weapon spread/range must be consistent with camera look-ahead.
- Chemist Crossbow 4 behavior augments: Piercing, Scatter, Snare, Ricochet. Potion timing leads to four support effects and one damaging effect.

### Dodge specifics (V19.2 is authoritative)
- Asya Signal Loss: steer a ghost projection and appear on release. Rewind Echo: manually retrace history and leave one-projectile-absorbing echo.
- Alexandra Knight's Move: eight L-shaped landing candidates, explicit aim preview. Castling: swap with nearest valid spell, enemy, or ally; **never ordinary gun bullets**.
- Veteran Foxhole Dive: dive toward cover, cooldown resets on wall collision, but landing recovery persists. Deadweight: dive then crawl; **bullets phase through both dive and crawl**, while melee still hits; bullets dangerous again after standing.
- Debtor Foreclosure: long momentum-preserving destructive charge with small (about 30° total) turning; Counterweight: reactive impact-recoil dodge.
- Jeanette Double Exposure: two manually timed physical jukes with zero end lag. Shutter Reflex: *armed* automatic physical sidestep reacting to an incoming projectile with photographer's marked-hit payoff, no automatic attack.
- Chemist Reaction Thrust: two-phase thrust, manually time second burst; Catalyst Skim: drift-steered momentum slide and wall ricochet.

## 8. Level 3 spell resources and resting (V19.2 arcade spell lists)
| Class | L1 slots | L2 slots | Special |
|---|---:|---:|---|
| Sorcerer | 4 | 2 | 3 Sorcery Points |
| Arcane Trickster Rogue | 2 | 0 | Cantrips |
| Undead Warlock | 0 | 2 (Pact) | Pact recovery on short rest |
| Cult-Debt Warlock | 0 | 2 (Pact) | Pact recovery on short rest |
| Cleric | 4 | 2 | Support and healing |
| Artificer | 3 | 0 | Support spells |

- The provided lab contains **43 sample spell entries in six class spellbooks**. They are action-game approximations inspired by tabletop classes, not a verified rules-as-written reproduction of every spell. Inspect actual `classBooks` array and effects.
- `1`–`0` select class spells, right-click casts. Any spell aimed beyond maximum range resolves **at exactly its max range** in aim direction. Instant LOS-required spells **fail at solid walls without spending a slot**; spell projectiles hit walls; LOS AoE cannot damage behind walls. Attacking and spellcasting are mutually exclusive, including sustained fire, charged weapon actions and melee swings.
- **Hold Ctrl to rest**: test charge reaches Short at **1.6 s**, Long at **4.3 s**, release chooses earned rest tier. Short in the lab restores Warlocks' Pact slots; other casters regain one 1st-level slot by explicit *Seeking house rule* and recover 22 HP. Long replenishes all normal slots, Sorcery Points and HP. In real multiplayer, require server validation and decide cooldown/interruption limits to avoid infinite in-combat resource exploits.
- Asya may empower magic with Sorcery Points, create spell slots from SP, or convert an L1 slot into SP per lab buttons/logic.

## 9. UI identity / accessibility
- SoulSeekers aesthetic = restrained **gold** (`#d9b45f`, bright `#f4d98b`), ivory, charcoal; red only danger/HP. Clean R03.5 HUD, full battlefield, compact character status, optionally opened inventory/shop and debug (F3). No cluttered permanent sidebar.
- Player sees only their explored dungeon and their own relevant information. DM sees full build and gameplay state. Separate role-specific HUDs, intuitive controls and accessible focus/hover information; never leak fogged rooms through map, packets, or DOM.
- Room/card art to be developed later; do not allow images to replace solid collision or precision geometry. Use procedural floor/wall/obstacle placeholder first.

## 10. Explicit scope/status boundaries
- R03.5 is the complete old game site + dedicated WebSocket server, with original curved-lane Boston gameplay. It has **not been ported to the dungeon mode**.
- V19.2 and DM R05.4 are **standalone local HTML labs**. Their local test successes do **not** prove the integrated 7-client multiplayer works.
- Do not modify any live repo, Firebase config, GitHub Pages, or Render service without explicit instruction. The integration must be created as files and tested first.
