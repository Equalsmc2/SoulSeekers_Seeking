// Extracted from authoritative Party V22.4. Run tools/extract-combat.py to reproduce.
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const vlen = (x, y) => Math.hypot(x, y);
  const norm = (x, y) => { const m = vlen(x, y) || 1; return { x: x / m, y: y / m }; };
  const norm0 = (x, y) => { const d = vlen(x, y); return d ? { x: x / d, y: y / d } : { x: 0, y: 0 }; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothStep01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  const colors = ['#b391e4', '#78d6e5', '#9da9ad', '#e09a75', '#e9c875', '#77c7a2'];
  const defs = [
    { name: 'ASYA', role: 'Sorcerer / Close-Range Specialist', speed: 216, accel: 980, friction: 2.55, fireMult: 0.80,
      dodge: [['SIGNAL LOSS', 'Hold Space: steer a remote ghost, release to reappear.'], ['REWIND ECHO', 'Hold Space to retrace your last 1s of movement. Leaves a projectile-absorbing echo.']] },
    { name: 'ALEXANDRA', role: 'Rogue / Arcane Chess', speed: 238, accel: 2650, friction: 18, fireMult: 0.92,
      dodge: [['KNIGHT\'S MOVE', 'Aim at one of eight visible L-shaped landing squares; phases through walls!'], ['CASTLING', 'Swap with the nearest spell, enemy, or ally within 300u and stagger them for 0.6s.']] },
    { name: 'VETERAN', role: 'Warlock / Undead Vet', speed: 181, accel: 760, friction: 11, fireMult: 0.68,
      dodge: [['FOXHOLE DIVE', 'Dive toward cover (28u proximity check). Hitting a wall refunds 60% cooldown.'], ['DEADWEIGHT', 'Dive into a crawl. Bullets pass through during dive/crawl, but melee hits still connect.']] },
    { name: 'DEBTOR', role: 'Warlock / Cult Tank', speed: 164, accel: 510, friction: 8.5, fireMult: 0.58,
      dodge: [['FORECLOSURE', 'Heavy charge (rams enemies for 32 DMG), scrapes shallow walls, smashes crates.'], ['COUNTERWEIGHT', 'Brace to absorb a shot, then surge in your WASD direction with a 3s +30% DMG/SPD buff.']] },
    { name: 'JEANETTE', role: 'Cleric / Wedding Photographer', speed: 242, accel: 1380, friction: 12.5, fireMult: 0.88,
      dodge: [['DOUBLE EXPOSURE', 'Two rapid physical jukes with smooth stride glide between steps.'], ['SHUTTER REFLEX', 'Space arms a defensive window. Incoming fire triggers a perpendicular sidestep + Focus mark.']] },
    { name: 'CHEMIST', role: 'Artificer / Long-Range Support', speed: 204, accel: 830, friction: 6, fireMult: 0.75,
      dodge: [['REACTION THRUST', 'First rocket burst; press Space again to fire a directional second stage or reverse-brake.'], ['CATALYST SKIM', 'Committed chemical drift; lob potions mid-slide and wall banks preserve speed.']] }
  ];

  const groundMotion = [
    { launch: 980,  reverse: 1220, turn: 820,  brake: 540,  pivotBoost: 1.00, recDrag: 2.55, pace: 0.52, backMult: 0.88, strafeMult: 0.94, style: 'FLOATY HOVER / LOW DRAG' },
    { launch: 2650, reverse: 3400, turn: 2800, brake: 3600, pivotBoost: 1.45, recDrag: 14.5, pace: 0.48, backMult: 0.84, strafeMult: 0.95, style: 'RAZOR-SNAPPY FOOTWORK' },
    { launch: 760,  reverse: 1120, turn: 740,  brake: 1280, pivotBoost: 1.25, recDrag: 10.5, pace: 0.50, backMult: 0.78, strafeMult: 0.88, style: 'BRACED / PLANTED BOOTS' },
    { launch: 510,  reverse: 820,  turn: 520,  brake: 920,  pivotBoost: 1.22, recDrag: 9.2,  pace: 0.50, backMult: 0.74, strafeMult: 0.84, style: 'HEAVY PLANTED TREAD' },
    { launch: 1380, reverse: 1750, turn: 1420, brake: 1850, pivotBoost: 1.18, recDrag: 11.0, pace: 0.52, backMult: 0.85, strafeMult: 0.94, style: 'BALANCED MID-PACK STRIDE' },
    { launch: 830,  reverse: 740,  turn: 690,  brake: 860,  pivotBoost: 1.00, recDrag: 5.5,  pace: 0.53, backMult: 0.80, strafeMult: 0.90, style: 'SLICK CHEMICAL DRIFT' }
  ];

  const dodgeBalance = [
    { cd: 4.4, range: '~245u',        risk: 'EXPOSED ANCHOR',            label: 'Signal Loss' },
    { cd: 4.9, range: '1s HISTORY',   risk: 'RETURN PATH',               label: 'Rewind Echo' },
    { cd: 3.9, range: '161u (WALLS)', risk: 'PHASES THROUGH WALLS',      label: "Knight's Move" },
    { cd: 5.3, range: '300u',         risk: 'TARGET STAGGER',            label: 'Castling' },
    { cd: 3.8, range: '~165u (COVER)',risk: '28u COVER PROXIMITY',       label: 'Foxhole Dive' },
    { cd: 4.2, range: 'DIVE + CRAWL', risk: 'BULLET-PHASE / MELEE VULN', label: 'Deadweight' },
    { cd: 5.1, range: 'RAMS ENEMIES', risk: 'SHALLOW WALL SCRAPE',       label: 'Foreclosure' },
    { cd: 4.3, range: 'WASD SURGE',   risk: '+30% DMG/SPD ON ABSORB',    label: 'Counterweight' },
    { cd: 2.4, range: '2 SHORT JUKES',risk: 'FLUID GLIDE WINDOW',        label: 'Double Exposure' },
    { cd: 4.8, range: 'SHORT EVADE',  risk: 'MUST ARM EARLY',            label: 'Shutter Reflex' },
    { cd: 3.8, range: 'TWO BURNS',    risk: 'DIRECTION COMMIT',          label: 'Reaction Thrust' },
    { cd: 4.2, range: 'MID-SLIDE LOB',risk: 'WIDE TURNS',                label: 'Catalyst Skim' }
  ];

  const mk = (name, level, range, fx, desc) => ({ name, level, range, fx, desc });
  const classBooks = [
    { cls: 'SORCERER · ABERRANT MIND', max: { 1: 4, 2: 2 }, sp: 3, slots: [
      mk('Mind Sliver', 0, 440, 'sliver', 'Psionic dart'), mk('Fire Bolt', 0, 640, 'bolt', 'Arcane fire'),
      mk('Shocking Grasp', 0, 120, 'shock', 'Touch lightning'), mk('Mage Hand', 0, 420, 'hand', 'Spectral decoy'),
      mk('Dissonant Whispers', 1, 490, 'whispers', 'Psychic distress'), mk('Shield', 1, 0, 'ward', 'Short defensive ward'),
      mk('Magic Missile', 1, 620, 'missile', 'Reliable arcane force'), mk('Thunderwave', 1, 0, 'thunder', 'Point-blank blast'),
      mk('Misty Step', 2, 280, 'misty', 'Short targeted blink'), mk('Hold Person', 2, 470, 'hold', 'Halt one target')
    ]},
    { cls: 'ROGUE · ARCANE TRICKSTER', max: { 1: 2, 2: 0 }, sp: 0, slots: [
      mk('Mage Hand', 0, 420, 'hand', 'Make a decoy'), mk('Mind Sliver', 0, 440, 'sliver', 'Psychic dart'),
      mk('Minor Illusion', 0, 420, 'illusion', 'Distracting apparition'), mk('Disguise Self', 1, 0, 'disguise', 'Temporarily go unnoticed'),
      mk('Silent Image', 1, 410, 'illusion', 'Create visual decoy'), mk('Sleep', 1, 390, 'sleep', 'Slows the nearest target')
    ]},
    { cls: 'WARLOCK · UNDEAD', max: { 1: 0, 2: 2 }, pact: true, sp: 0, slots: [
      mk('Eldritch Blast', 0, 720, 'bolt', 'Focused eldritch beam'), mk('Chill Touch', 0, 500, 'chill', 'Necrotic slowing dart'),
      mk('Hex', 1, 470, 'hex', 'Curse a target'), mk('Armor of Agathys', 1, 0, 'ward', 'Cold protective shell'),
      mk('Misty Step', 2, 280, 'misty', 'Reposition instantly'), mk('Hold Person', 2, 470, 'hold', 'Restrain target')
    ]},
    { cls: 'WARLOCK · CULT DEBTOR', max: { 1: 0, 2: 2 }, pact: true, sp: 0, slots: [
      mk('Eldritch Blast', 0, 720, 'bolt', 'Eldritch ray'), mk('Toll the Dead', 0, 450, 'toll', 'Necrotic curse'),
      mk('Hex', 1, 470, 'hex', 'Weakening curse'), mk('Armor of Agathys', 1, 0, 'ward', 'Pact barrier'),
      mk('Shatter', 2, 530, 'shatter', 'Concussive ring'), mk('Darkness', 2, 400, 'darkness', 'Area of obscuring shadow')
    ]},
    { cls: 'CLERIC', max: { 1: 4, 2: 2 }, sp: 0, slots: [
      mk('Sacred Flame', 0, 540, 'flame', 'Radiant strike'), mk('Guidance', 0, 0, 'guidance', 'Brief support buff'),
      mk('Thaumaturgy', 0, 380, 'hand', 'Distract a target'), mk('Cure Wounds', 1, 0, 'heal', 'Restore health'),
      mk('Guiding Bolt', 1, 640, 'bolt', 'Radiant projectile'), mk('Bless', 1, 0, 'bless', 'Inspiring support'),
      mk('Shield of Faith', 1, 0, 'ward', 'Protective ward'), mk('Spiritual Weapon', 2, 520, 'spiritual', 'Summon a striking spirit'),
      mk('Aid', 2, 0, 'aid', 'Heal yourself and an ally')
    ]},
    { cls: 'ARTIFICER · CHEMIST', max: { 1: 3, 2: 0 }, sp: 0, slots: [
      mk('Fire Bolt', 0, 640, 'bolt', 'Fire dart'), mk('Mending', 0, 0, 'mending', 'Fix cover / heal slightly'),
      mk('Cure Wounds', 1, 0, 'heal', 'Restore health'), mk('Faerie Fire', 1, 490, 'faerie', 'Mark targets'),
      mk('Grease', 1, 470, 'grease', 'Slippery control zone'), mk('Catapult', 1, 650, 'catapult', 'Launch a heavy projectile')
    ]}
  ];

  const weaponCatalog = [
    [
      { name: 'BombDrone_u_Pilot', type: 'drone', range: 495, cool: 0.35, mag: 2, reload: 2.8, desc: 'Fast 340u/s guided bomb drone (75 DMG). Detonates on enemy contact or second click. Hold E to scout.' },
      { name: 'Crowbar + C4', type: 'crowbar', range: 76, cool: 0.43, desc: 'Committed sweeps with stagger. Tap E to Parry (0.18s) or hold to block. R tosses C4 up to 140u / detonates.' }
    ],
    [
      { name: 'Kitchen Knife', type: 'knife', range: 58, cool: 0.30, desc: '22 DMG cuts + 35 DMG 3rd-hit deep lunge. R activates SNEAK (+22 DMG). Tap E to Parry / hold to block.' },
      { name: 'Scoped Revolver', type: 'revolver', range: 950, cool: 0.65, mag: 6, reload: 1.85, desc: '44 DMG heavy rounds. Moving hip-fire adds spread; hold E (Scope) or Shift for pinpoint accuracy.' }
    ],
    [
      { name: 'Combat Shovel', type: 'shovel', range: 82, cool: 0.62, desc: '33 DMG sweep; 2nd hit is a wide finisher. Tap E to Parry / hold to block; R digs cover mound.' },
      { name: 'M4 Carbine', type: 'carbine', range: 690, cool: 0.13, mag: 30, reload: 2.1, desc: 'Automatic carbine with progressive recoil bloom. Burst fire or hold E (scope) for tight accuracy.' }
    ],
    [
      { name: 'Steel Mace', type: 'mace', range: 95, cool: 0.70, desc: '48 DMG heavy smash with turret stagger. Tap E to Parry / hold to block; R triggers 50 DMG ground slam.' },
      { name: 'Fire Extinguisher', type: 'extinguisher', range: 230, cool: 0.13, mag: 24, reload: 2.5, desc: '6 DMG suppressing foam that chills targets. Tap/hold E to Parry/block. R: PRESSURE BURST.' }
    ],
    [
      { name: 'M1911 Pistol', type: 'pistol', range: 495, cool: 0.26, mag: 7, reload: 1.35, desc: 'Accurate run-and-gun sidearm (24 DMG). Deals +30% bonus DMG against Camera-Dazzled targets!' },
      { name: 'Flash Camera', type: 'camera', range: 760, closeRange: 154, cool: 1.0, mag: 5, reload: 2.0, desc: 'Applies DAZZLED (+30% Pistol DMG). Tap LMB = close flash; Hold E + LMB = 760u telephoto flash.' }
    ],
    [
      { name: 'Timing Potion', type: 'potion', range: 540, cool: 0.55, mag: 5, reload: 1.9, desc: 'Tap E to cycle Mend, Haste, or Corrosive. Lob potions mid-slide during Catalyst Skim!' },
      { name: 'Enchanted Crossbow', type: 'crossbow', range: 980, cool: 0.35, mag: 1, reload: 1.15, desc: 'High-impact bolts (68 DMG Piercing / 45 DMG Ricochet). Press R anytime to cycle augments.' }
    ]
  ];

  const potionPhases = [
    { name: 'MEND (+34 HP)', color: '#7bdca4', kind: 'heal' },
    { name: 'HASTE (+22% SPD)', color: '#f9d77c', kind: 'haste' },
    { name: 'CORROSIVE (55 DMG)', color: '#ef7b7b', kind: 'damage' }
  ];
  const enchants = [
    { name: 'PIERCING', color: '#f4e7b9' }, { name: 'SCATTER', color: '#ffc78b' },
    { name: 'SNARE', color: '#89dfe0' }, { name: 'RICOCHET', color: '#d7aaff' }
  ];

  const meleeProfiles = {
    knife:   { motion: 'slash',  duration: 0.24, active: [0.20, 0.80], arc: 0.78, damage: 22, reach: 0.92, thickness: 14, lunge: 170 },
    shovel:  { motion: 'slash',  duration: 0.46, active: [0.24, 0.82], arc: 1.15, damage: 33, reach: 0.91, thickness: 19, lunge: 235 },
    crowbar: { motion: 'slash',  duration: 0.36, active: [0.22, 0.81], arc: 1.05, damage: 28, reach: 0.93, thickness: 15, lunge: 210 },
    spear:   { motion: 'thrust', duration: 0.40, active: [0.20, 0.75], arc: 0.19, damage: 34, reach: 1.00, thickness: 14, lunge: 240 },
    mace:    { motion: 'smash',  duration: 0.56, active: [0.31, 0.83], arc: 1.05, damage: 48, reach: 0.89, thickness: 23, lunge: 295 },
    hook:    { motion: 'whip',   duration: 0.56, active: [0.27, 0.83], arc: 1.58, damage: 29, reach: 0.98, thickness: 21, lunge: 190 }
  };
  const meleeModelTips = { knife: 49, shovel: 93, crowbar: 88, spear: 122, mace: 78, hook: 140 };
  const meleeContactStarts = { knife: 0.38, shovel: 0.62, crowbar: 0.34, spear: 0.64, mace: 0.53, hook: 0.32 };
  const BLOCK_HALF_ANGLE = 55 * Math.PI / 180;
  const SHORT_REST_TIME = 1.6, LONG_REST_TIME = 4.3;
  const knightSquares = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];


export { clamp,vlen,norm,norm0,lerp,smoothStep01,colors,defs,groundMotion,dodgeBalance,classBooks,weaponCatalog,potionPhases,enchants,meleeProfiles,meleeModelTips,meleeContactStarts,BLOCK_HALF_ANGLE,SHORT_REST_TIME,LONG_REST_TIME,knightSquares };
