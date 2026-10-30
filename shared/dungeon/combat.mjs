// V22.4 mechanics extracted into one isolated controller per server-owned hero.
import * as D from './combat-data.mjs';
import {solid,moveCircle as geometryMove,lineBlocked} from './physics.mjs';
const {clamp,vlen,norm,norm0,lerp,smoothStep01,colors,defs,groundMotion,dodgeBalance,classBooks,weaponCatalog,potionPhases,enchants,meleeProfiles,meleeModelTips,meleeContactStarts,BLOCK_HALF_ANGLE,SHORT_REST_TIME,LONG_REST_TIME,knightSquares}=D;
export function createCombat(arena,character,x,y,loadout={weapon:0,dodge:0}){
 let ci=character, slot=loadout?.dodge ?? 0, spell=0, simT=0, player;
 let towers=arena.monsters, allies=[], shots=arena.shots, effects=[], crates=arena.crates, rectangles=arena.rectangles;
 const mines=[];
 let teamAttack=false,weaponSlot=loadout?.weapon ?? 0,weaponStates=weaponCatalog.map(row=>row.map(w=>({ammo:w.mag??-1,reloading:0,special:0}))),weaponFX=[],weaponHold=0,weaponChargeMode=false;
 let meleeFlip=1,meleeCombo=0,weaponSwapCD=0,guard=100,guardParryT=0,hasteT=0;
 let inputBuffer={dodge:0,attack:0,spell:0},camKick={x:0,y:0};
 let book=classBooks[ci].slots,spellResources={max:{...classBooks[ci].max},slots:{...classBooks[ci].max},points:classBooks[ci].sp,empowered:false};
 let restClock=0,restOn=false,shortRestsLeft=2,longRestsLeft=2,lastDamage=-10;
 const mouse={x:x+100,y,down:false,castDown:false},keys=new Set();
 const cursorWorld=()=>({x:mouse.x,y:mouse.y});
 const moveInput=()=>norm0((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0));
 const rawAim=()=>Math.atan2(mouse.y-player.y,mouse.x-player.x);
 const precisionWalk=()=>keys.has('ShiftLeft')&&!player.mode&&player.rec<=0;
 const stanceActive=()=>keys.has('KeyE')&&!player.mode&&player.rec<=0;
 const weaponNow=()=>weaponCatalog[ci][weaponSlot],weaponState=()=>weaponStates[ci][weaponSlot];
 const isMelee=(w=weaponNow())=>['knife','shovel','mace','crowbar'].includes(w.type);
 const isGuardWeapon=(w=weaponNow())=>isMelee(w)||w.type==='extinguisher';
 const hasScope=(w=weaponNow())=>['revolver','pistol','crossbow','drone','camera','carbine'].includes(w.type);
 const scopeActive=()=>stanceActive()&&hasScope(),guardActive=()=>stanceActive()&&isGuardWeapon();
 const spellAvailable=s=>s.level===0||(classBooks[ci].pact?spellResources.slots[2]>0:spellResources.slots[s.level]>0);
 const spellRequiresSight=s=>s.range>0&&!['bolt','missile','catapult','flame'].includes(s.fx);
 const dmgMultiplier=()=>player.counterBuffT>0?1.3:1;
 const deadweightPhasesBullets=(p=player)=>ci===2&&['proneDive','crawl'].includes(p.mode);
 const solidAt=(x,y,r=16)=>solid(arena.board,x,y,r,crates);
 const spellSightBlocked=(a,b)=>lineBlocked(arena.board,a,b,2,crates);
 const moveCircle=(e,dx,dy,opts={})=>geometryMove(arena.board,e,dx,dy,crates,opts);
 const effectiveWeaponRange=(w=weaponNow())=>w.type==='camera'?(scopeActive()?w.range:w.closeRange):hasScope(w)?w.range*(scopeActive()?1:.58):w.range;
 const updateUI=()=>{},updateWeaponUI=()=>{},refreshSpellUI=()=>{};
 const visualQueue=[];
 const spawnParticles=(x,y,count,color)=>{for(let i=0;i<Math.min(4,count);i++){const a=(i/Math.min(4,count))*Math.PI*2+simT*7;visualQueue.push({kind:'particle',x,y,vx:Math.cos(a)*65,vy:Math.sin(a)*65,c:color,r:3+((i*3)%4),t:.23+.06*(i%3),life:.4});}};
 const addTrail=(x,y,color,size=16,time=.25)=>{visualQueue.push({kind:'trail',x,y,r:size,c:color,t:time,life:time});};
 const addPopup=(x,y,text,color)=>{visualQueue.push({kind:'popup',x,y,t:.65,life:.65,c:color,text:String(text).slice(0,36)});};
 let notice='';const showToast=t=>{notice=t;};
 function cancelWeaponHold(){mouse.down=false;weaponHold=0;weaponChargeMode=false;}
 function startRest(){if(restOn||player.mode||player.rec>0||simT-lastDamage<5||arena.monsters.some(m=>m.hp>0&&vlen(m.x-player.x,m.y-player.y)<350))return;restOn=true;restClock=0;cancelWeaponHold();}
 function tickRest(dt){if(!restOn)return;if(moveInput().x||moveInput().y||simT-lastDamage<5||arena.monsters.some(m=>m.hp>0&&vlen(m.x-player.x,m.y-player.y)<350)){restOn=false;restClock=0;return;}restClock=Math.min(4.3,restClock+dt);player.vx=player.vy=0;}
  function aim() {
    for (let i = 0; i < weaponFX.length; i++) if (weaponFX[i].kind === 'melee') return weaponFX[i].a;
    return rawAim();
  }
  function axis() {
    const v = moveInput();
    if (!v.x && !v.y) { const a = rawAim(); return { x: Math.cos(a), y: Math.sin(a) }; }
    return v;
  }
  function hitRect(cx, cy, r, b) {
    const dx = cx - clamp(cx, b.x, b.x + b.w), dy = cy - clamp(cy, b.y, b.y + b.h);
    return dx * dx + dy * dy < r * r;
  }
  function segmentHitsRect(x0, y0, x1, y1, b, pad = 2) {
    let enter = 0, exit = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const checks = [[x0, dx, b.x - pad, b.x + b.w + pad], [y0, dy, b.y - pad, b.y + b.h + pad]];
    for (let i = 0; i < 2; i++) {
      const [orig, diff, min, max] = checks[i];
      if (Math.abs(diff) < 1e-9) { if (orig < min || orig > max) return false; continue; }
      let a = (min - orig) / diff, z = (max - orig) / diff;
      if (a > z) { const tmp = a; a = z; z = tmp; }
      if (a > enter) enter = a;
      if (z < exit) exit = z;
      if (enter > exit) return false;
    }
    return exit >= 0 && enter <= 1;
  }
  function spellTargetPoint(s, from = player, cursor = cursorWorld()) {
    const dx = cursor.x - from.x, dy = cursor.y - from.y, dist = Math.hypot(dx, dy), range = s.range || 0;
    if (!range) return { x: from.x, y: from.y, clamped: false };
    const travel = Math.min(dist, range);
    const dir = dist > 1e-8 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 };
    return { x: from.x + dir.x * travel, y: from.y + dir.y * travel, clamped: dist > range + 0.01 };
  }
  function applyGroundMovement(p, character, input, dt, maximum, precision) {
    const config = groundMotion[character];
    const speed = vlen(p.vx, p.vy);
    let surfaceMult = 1;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      if (e.kind === 'frost' && e.t > 0 && vlen(p.x - e.x, p.y - e.y) < e.r) { surfaceMult = 0.42; break; }
    }
    if (!input.x && !input.y) {
      const remaining = Math.max(0, speed - config.brake * surfaceMult * dt);
      if (speed > 0.0001) { p.vx *= remaining / speed; p.vy *= remaining / speed; }
      else { p.vx = 0; p.vy = 0; }
      return;
    }
    const facing = aim();
    const align = input.x * Math.cos(facing) + input.y * Math.sin(facing);
    const stanceScale = align >= 0.25 ? 1 : (align <= -0.35 ? config.backMult : config.strafeMult);
    const goal = maximum * stanceScale * (precision ? config.pace : 1);
    const dx = input.x * goal - p.vx, dy = input.y * goal - p.vy, delta = vlen(dx, dy);
    if (delta < 0.0001) return;

    const dot = speed > 0.001 ? (p.vx * input.x + p.vy * input.y) / speed : 1;
    let force = dot < -0.25 ? config.reverse * (config.pivotBoost || 1) : dot < 0.72 ? config.turn : config.launch;
    if (speed > goal + 0.5 && dot > 0.72) force = config.brake;
    if (precision && speed > goal) force = Math.max(force, config.brake);

    const k = Math.min(1, (force * surfaceMult * dt) / delta);
    p.vx += dx * k; p.vy += dy * k;
  }
  function applyHoverMovement(p, input, dt, maximum, precision, firingFactor = 1) {
    const config = groundMotion[0];
    const speed = vlen(p.vx, p.vy);
    const damping = Math.exp(-(precision ? 4.2 : 2.55) * dt);
    p.vx *= damping; p.vy *= damping;
    if (!input.x && !input.y) {
      if (vlen(p.vx, p.vy) < 1.2) { p.vx = 0; p.vy = 0; }
      return;
    }
    const dot = speed > 0.001 ? (p.vx * input.x + p.vy * input.y) / speed : 1;
    const thrust = dot < -0.25 ? config.reverse : dot < 0.72 ? config.turn : config.launch;
    const power = thrust * (precision ? 0.56 : 1) * firingFactor;
    p.vx += input.x * power * dt; p.vy += input.y * power * dt;
    const cap = maximum * (precision ? config.pace : 1);
    const now = vlen(p.vx, p.vy);
    if (now > cap) {
      const prior = vlen(p.vx - input.x * power * dt, p.vy - input.y * power * dt);
      const next = prior <= cap + 1 ? cap : Math.max(cap, now - (precision ? 600 : 360) * dt);
      p.vx *= next / now; p.vy *= next / now;
    }
  }
  function createSlot(l) {
    const cost = l === 1 ? 2 : 3;
    if (ci !== 0 || spellResources.points < cost) return;
    spellResources.points -= cost; spellResources.slots[l]++;
    showToast('SORCERY POINTS → LEVEL ' + l + ' SLOT');
    refreshSpellUI();
  }
  function cancelRestOnDamage() {
    if (!restOn) return;
    restOn = false; restClock = 0;
    showToast('REST INTERRUPTED BY DAMAGE!');
  }
  function finishRest() {
    if (!restOn) return;
    restOn = false;
    if (restClock >= LONG_REST_TIME && longRestsLeft > 0) {
      longRestsLeft--;
      spellResources.slots = { ...spellResources.max };
      spellResources.points = classBooks[ci].sp || 0;
      spellResources.empowered = false;
      shortRestsLeft = 2; player.hp = 100;
      showToast('LONG REST · ALL SLOTS, HP & SHORT RESTS RESTORED');
    } else if (restClock >= SHORT_REST_TIME) {
      if (shortRestsLeft <= 0) showToast('NO SHORT RESTS LEFT · HOLD FOR FULL LONG REST');
      else {
        shortRestsLeft--;
        if (classBooks[ci].pact) spellResources.slots[2] = spellResources.max[2];
        else if (spellResources.max[1] > 0 && spellResources.slots[1] < spellResources.max[1]) spellResources.slots[1]++;
        player.hp = Math.min(100, player.hp + 22);
        showToast('SHORT REST (' + shortRestsLeft + ' LEFT) · +22 HP & SLOT RECOVERED');
      }
    } else showToast('REST INTERRUPTED · HOLD LONGER');
    restClock = 0; refreshSpellUI();
  }
  function chooseDodge(i) {
    if (player.mode || player.rec > 0) { showToast('FINISH YOUR CURRENT DODGE FIRST'); return; }
    slot = i; player.activeSlot = i; updateUI();
    showToast('LOADOUT ' + (slot ? 'B' : 'A') + ' · ' + defs[ci].dodge[slot][0]);
  }
  function selectWeapon(i) {
    if (player.mode || player.rec > 0 || weaponSwapCD > 0) return;
    if (player.sneakT > 0) endSneak('WEAPON SWITCH');
    weaponSlot = i; cancelWeaponHold(); weaponSwapCD = 0.14; updateWeaponUI();
    showToast('WEAPON ' + (i ? 'B' : 'A') + ' · ' + weaponNow().name.toUpperCase());
  }
  function startMode(kind, duration, totalCD, dir) {
    const tunedCD = dodgeBalance[ci * 2 + slot].cd;
    player.mode = kind; player.modeT = duration; player.modeDur = duration;
    player.dodgeCD = tunedCD; player.dodgeTotal = tunedCD; player.rec = 0;
    player.dir = { ...dir }; player.data = {}; player.foxReset = false; player.secondReady = false;
  }
  function knightLanding() {
    const { x: mx, y: my } = cursorWorld();
    let score = Infinity, best = null;
    for (const [nx, ny] of knightSquares) {
      const x = player.x + nx * 72, y = player.y + ny * 72;
      const dist = vlen(mx - x, my - y);
      if (dist < score) { score = dist; best = { x, y, nx, ny, corner: { x: player.x + nx * 72, y: player.y } }; }
    }
    return best;
  }
  function castleTarget() {
    let best = null, bestDist = 300;
    const check = (type, ref) => {
      const d = vlen(ref.x - player.x, ref.y - player.y);
      if (d <= bestDist && !solidAt(ref.x, ref.y, player.r)) { bestDist = d; best = { type, ref, x: ref.x, y: ref.y }; }
    };
    for (let i = 0; i < shots.length; i++) if (shots[i].castleSpell) check('SPELL', shots[i]);
    for(const e of (typeof arena.effects==='function'?arena.effects():effects)) if(e.t>0 && ['decoy','frost','gravity'].includes(e.kind)) check('SPELL',e);
    for (let i = 0; i < mines.length; i++) check('SPELL', mines[i]);
    for (let i = 0; i < towers.length; i++) if (towers[i].hp > 0) check('ENEMY', towers[i]);
    for (let i = 0; i < allies.length; i++) if (allies[i].hp > 0) check('PLAYER', allies[i]);
    return best;
  }
  function thrustStageTwo() {
    const p = player;
    if (p.mode !== 'thrust' || p.data.phase !== 0) return;
    const a = axis(), v = vlen(p.vx, p.vy);
    const backward = (v ? ((p.vx * a.x + p.vy * a.y) / v) : 1) < -0.35;
    p.data.phase = 1; p.modeT = 0.29; p.modeDur = 0.29;
    if (backward) { p.vx = a.x * 360; p.vy = a.y * 360; showToast('REACTION THRUST · REVERSE BURN'); }
    else {
      p.vx += a.x * 480; p.vy += a.y * 480;
      const sp = vlen(p.vx, p.vy);
      if (sp > 660) { p.vx *= 660 / sp; p.vy *= 660 / sp; }
      showToast('REACTION THRUST · SECOND IGNITION');
    }
    effects.push({ x: p.x, y: p.y, r: 64, t: 0.4, c: '#83e3ad', kind: 'pulse' });
    spawnParticles(p.x, p.y, 20, '#8fefc5');
  }
  function steerForeclosure(p, input, dt, rate = 0.82) {
    if (!input.x && !input.y) return;
    const used = p.data.turnUsed || 0, remaining = Math.PI / 6 - used;
    if (remaining <= 0) return;
    const current = Math.atan2(p.dir.y, p.dir.x), target = Math.atan2(input.y, input.x);
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    const turn = Math.sign(delta) * Math.min(Math.abs(delta), rate * dt, remaining);
    p.data.turnUsed = used + Math.abs(turn);
    p.dir = { x: Math.cos(current + turn), y: Math.sin(current + turn) };
  }
  function rewindSample(history, target) {
    if (!history.length) return { x: player.x, y: player.y };
    if (target <= history[0].t) return history[0];
    if (target >= history[history.length - 1].t) return history[history.length - 1];
    for (let i = 1; i < history.length; i++) {
      if (history[i].t >= target) {
        const a = history[i - 1], b = history[i];
        const k = clamp((target - a.t) / Math.max(0.001, b.t - a.t), 0, 1);
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
      }
    }
    return history[0];
  }
  function absorbEchoProjectile(b) {
    if (b.team !== 'enemy') return false;
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      if (e.kind === 'rewindEcho' && vlen(e.x - b.x, e.y - b.y) <= e.r + b.r) {
        effects.splice(i, 1);
        spawnParticles(e.x, e.y, 14, '#c2a4ff');
        effects.push({ x: e.x, y: e.y, r: 56, t: 0.28, c: '#c2a4ff', kind: 'pulse' });
        showToast('REWIND ECHO · SHOT ABSORBED');
        return true;
      }
    }
    return false;
  }
  function segmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return vlen(px - ax - dx * t, py - ay - dy * t);
  }
  function detectIncomingShot(p, shot, horizon = 0.24) {
    if (shot.team !== 'enemy') return false;
    if ((p.x - shot.x) * shot.vx + (p.y - shot.y) * shot.vy <= 0) return false;
    return segmentDistance(p.x, p.y, shot.x, shot.y, shot.x + shot.vx * horizon, shot.y + shot.vy * horizon) < p.r + shot.r + 18;
  }
  function triggerShutter(p, shot) {
    if (p.mode !== 'shutterArmed') return false;
    const d = norm0(shot.vx, shot.vy), base = { x: -d.y, y: d.x }, wish = moveInput();
    let pick = base, best = -Infinity;
    for (const dir of [base, { x: -base.x, y: -base.y }]) {
      const test = { x: p.x, y: p.y, r: p.r, vx: 0, vy: 0 };
      const col = moveCircle(test, dir.x * 102, dir.y * 102);
      const score = vlen(test.x - p.x, test.y - p.y) + ((wish.x || wish.y) ? 12 * (wish.x * dir.x + wish.y * dir.y) : 0) - (col.wall ? 8 : 0);
      if (score > best) { best = score; pick = dir; }
    }
    p.mode = 'shutterEvade'; p.modeT = 0.20; p.modeDur = 0.20;
    p.vx = pick.x * 520; p.vy = pick.y * 520; p.inv = 0.21;
    const source = shot.owner && shot.owner.hp > 0 ? shot.owner : towers.find(t => t.hp > 0) || null;
    p.focus = source ? { target: source, t: 3 } : null;
    effects.push({ x: p.x, y: p.y, r: 48, t: 0.2, c: '#fff3c6', kind: 'shutter' });
    spawnParticles(p.x, p.y, 18, '#f7dfa0');
    showToast('SHUTTER REFLEX! · SHOOT THE MARKED TARGET');
    return true;
  }
  function dodgePressed(fromBuffer = false) {
    if (restOn) return false;
    if (player.mode === 'signal') { endSignal(); return true; }
    if (player.mode === 'rewind') { endRewind(); return true; }
    if (player.mode === 'doubleWindow') { beginSecondStep(); return true; }
    if (player.mode === 'thrust') { thrustStageTwo(); return true; }
    if (player.mode === 'crawl') { finishMode(0.12); return true; }
    if (player.mode || player.rec > 0 || player.dodgeCD > 0) {
      if (!fromBuffer) inputBuffer.dodge = 0.15;
      return false;
    }
    inputBuffer.dodge = 0;

    const a = axis(), kind = ci * 2 + slot, p = player;
    switch (kind) {
      case 0:
        startMode('signal', 0.72, 4.4, a);
        p.data.proj = { x: p.x, y: p.y, vx: a.x * 345, vy: a.y * 345 };
        p.data.origin = { x: p.x, y: p.y };
        break;
      case 1:
        startMode('rewind', 0.76, 4.9, a);
        p.data.history = p.prev.filter(pt => simT - pt.t <= 1.05);
        p.data.rewindStart = simT;
        p.data.velocity = { vx: p.vx, vy: p.vy };
        effects.push({ x: p.x, y: p.y, r: 33, t: 1.0, c: '#bda4f7', kind: 'rewindEcho' });
        showToast('REWIND ECHO · HOLD SPACE / RELEASE TO STOP');
        break;
      case 2: {
        // Knight's Move phases through walls
        const end = knightLanding();
        if (!end) break;
        startMode('knight', 0.06, 3.9, a);
        addTrail(p.x, p.y, colors[ci], 24, 0.5);
        if (solidAt(end.x,end.y,p.r)) { p.mode=null; p.dodgeCD=0; return false; } p.x = end.x; p.y = end.y; p.vx = 0; p.vy = 0;
        spawnParticles(p.x, p.y, 16, colors[ci]);
        showToast("KNIGHT'S MOVE · PHASED THROUGH WALL");
        break;
      }
      case 3: {
        const t = castleTarget();
        if (!t) { showToast('CASTLING · NEED A SPELL, ENEMY OR ALLY WITHIN 300u'); return false; }
        startMode('castleSwap', 0.17, 5.3, a);
        const ox = p.x, oy = p.y;
        p.x = t.x; p.y = t.y; t.ref.x = ox; t.ref.y = oy; p.vx = 0; p.vy = 0;
        if (t.ref.staggerT !== undefined) t.ref.staggerT = 0.6;
        spawnParticles(p.x, p.y, 18, colors[ci]);
        addTrail(ox, oy, colors[ci], 20, 0.65);
        showToast('CASTLING · SWAPPED & STAGGERED TARGET');
        break;
      }
      case 4: startMode('fox', 0.34, 3.8, a); p.vx = a.x * 690; p.vy = a.y * 690; break;
      case 5: startMode('proneDive', 0.2, 4.2, a); p.vx = a.x * 550; p.vy = a.y * 550; showToast('DEADWEIGHT · BULLETS PASS THROUGH'); break;
      case 6: startMode('barge', 0.50, 5.1, a); p.vx = a.x * 135; p.vy = a.y * 135; break;
      case 7: startMode('counter', 0.65, 4.3, a); p.vx = 0; p.vy = 0; showToast('COUNTERWEIGHT · BRACED FOR IMPACT'); break;
      case 8: startMode('doubleFirst', 0.12, 2.4, a); p.vx = a.x * 650; p.vy = a.y * 650; break;
      case 9: startMode('shutterArmed', 0.62, 4.8, a); p.vx *= 0.38; p.vy *= 0.38; showToast('SHUTTER REFLEX · ARMED'); break;
      case 10: startMode('thrust', 0.36, 3.8, a); p.vx = a.x * 365; p.vy = a.y * 365; p.data.phase = 0; showToast('REACTION THRUST · SPACE AGAIN FOR 2ND STAGE'); break;
      case 11: startMode('skim', 0.79, 4.2, a); p.vx = a.x * 555; p.vy = a.y * 555; break;
    }
    return true;
  }
  function endRewind() {
    if (player.mode !== 'rewind') return;
    const v = player.data.velocity || { vx: 0, vy: 0 };
    finishMode(0.12); player.vx = v.vx; player.vy = v.vy;
  }
  function endSignal() {
    if (player.mode !== 'signal') return;
    const g = player.data.proj;
    if (g) {
      addTrail(player.x, player.y, colors[ci], 20, 0.6);
      const ghostSp = vlen(g.vx, g.vy);
      player.x = g.x; player.y = g.y;
      player.vx = g.vx * 0.65; player.vy = g.vy * 0.65;
      spawnParticles(g.x, g.y, 16, colors[ci]);
    }
    finishMode(0.16);
  }
  function beginSecondStep() {
    const p = player, a = axis();
    p.mode = 'doubleSecond'; p.modeT = 0.14; p.modeDur = 0.14;
    p.vx = a.x * 670; p.vy = a.y * 670; p.secondReady = false;
    spawnParticles(p.x, p.y, 10, colors[ci]);
  }
  function finishMode(recovery = 0.12, keepMomentum = false) {
    const p = player;
    p.mode = null; p.modeT = 0; p.rec = recovery;
    p.data = { coastRecovery: keepMomentum };
    if (!keepMomentum && ci !== 5 && ci !== 0) { p.vx *= 0.76; p.vy *= 0.76; }
  }
  function stopWeaponHold() {
    const w = weaponNow();
    if (!mouse.down) return;
    mouse.down = false;
    if (w.type === 'camera' && (weaponChargeMode || scopeActive())) {
      fireFocusedCamera(Math.max(weaponHold, 0.15));
    }
    weaponHold = 0;
    weaponChargeMode = false;
  }
  function beginReload() {
    const w = weaponNow(), s = weaponState();
    if (s.reloading > 0 || s.ammo < 0 || s.ammo === w.mag) return false;
    if (w.type === 'drone' && player.drone) { showToast('DETONATE ACTIVE DRONE FIRST'); return false; }
    s.reloading = w.reload;
    showToast('RELOADING · ' + w.name.toUpperCase());
    return true;
  }
  function autoReloadIfEmpty(w = weaponNow(), s = weaponState()) {
    if (!(w.mag > 0) || s.ammo !== 0 || s.reloading > 0) return false;
    s.reloading = w.reload;
    showToast('AUTO RELOADING · ' + w.name.toUpperCase());
    return true;
  }
  function spawnWeaponShot(speed, range, damage, r = 4, color = '#f4dda1', extra = {}) {
    const a = extra.angleOverride ?? rawAim(), d = { x: Math.cos(a), y: Math.sin(a) }, p = player;
    shots.push({ ownerSlot:ci,
      x: p.x + d.x * 22, y: p.y + d.y * 22, vx: d.x * speed, vy: d.y * speed, r, team: 'player',
      t: Math.max(0, (Math.min(range, effectiveWeaponRange(weaponNow(), a)) - 22)) / speed,
      damage: Math.round(damage * dmgMultiplier()), c: color, castleSpell: false, weaponShot: true, ...extra
    });
    camKick.x -= d.x * 3.5; camKick.y -= d.y * 3.5;
    spawnParticles(p.x + d.x * 19, p.y + d.y * 19, 4, color);
  }
  function applyDamageToPlayer(dmg, label = '') {
    const p = player;
    if (p.inv > 0) return false;
    lastDamage = simT; if (restOn) cancelRestOnDamage();
    if (p.sneakT > 0) endSneak('DAMAGE TAKEN');
    p.hp = Math.max(0, p.hp - dmg);
    p.damageFlash = 0.16;
    addPopup(p.x, p.y, '-' + dmg, '#ff7a88');
    spawnParticles(p.x, p.y, 8, '#fa7684');
    if (p.hp === 0) {
      p.respawn = 3; p.vx = 0; p.vy = 0; cancelWeaponHold(); keys.clear();
      showToast((label ? label + ' · ' : '') + 'DOWN · RETURNING TO ENTRANCE');
    }
    return true;
  }
  function applyDamageToAlly(ally, dmg, sourceLabel = 'TEAM ATTACK') {
    if (ally.hp <= 0) return false;
    ally.hp = Math.max(0, ally.hp - dmg);
    ally.damageFlash = 0.16;
    addPopup(ally.x, ally.y, '-' + dmg, '#8ccde0');
    spawnParticles(ally.x, ally.y, 8, '#8ccde0');
    if (ally.hp === 0) { ally.respawn = 3.5; showToast(sourceLabel + ' · ALLY DOWN (RESPAWNING)'); }
    return true;
  }
  function damageTower(t, dmg, label = '') {
    t.hp = Math.max(0, t.hp - dmg);
    t.flash = 0.12;
    addPopup(t.x, t.y, (label ? label + ' -' : '-') + dmg, label ? '#fff099' : '#ffe09e');
  }
  function meleeAttack() {
    const p = player, w = weaponNow();
    if (mouse.castDown || p.castLock > 0 || p.fireCD > 0 || guardActive()) return false;
    const spec = meleeProfiles[w.type], angle = rawAim();
    if (!spec) return false;
    p.fireCD = w.cool; meleeFlip *= -1; meleeCombo++;
    const profile = { ...spec };
    let finisher = false;
    if (w.type === 'knife' && meleeCombo % 3 === 0) {
      profile.motion = 'thrust'; profile.duration = 0.255; profile.arc = 0.18; profile.active = [0.22, 0.72]; profile.damage = 35; profile.lunge = 275;
      finisher = true;
    }
    if (w.type === 'shovel' && meleeCombo % 2 === 0) {
      profile.arc = 1.38; profile.duration = 0.50; profile.active = [0.26, 0.80]; profile.damage = 40; profile.lunge = 285;
      finisher = true;
    }
    p.weaponLock = Math.max(p.weaponLock, profile.duration);
    weaponFX.push({
      kind: 'melee', type: w.type, profile, combo: meleeCombo, finisher, a: angle, r: w.range,
      side: meleeFlip, t: profile.duration, life: profile.duration,
      hits: [], impactFreeze: 0, lunged: false, braked: false, c: colors[ci]
    });
    return true;
  }
  function meleeAttackPose(fx, atU = null) {
    const spec = fx.profile, u = atU === null ? clamp((fx.life - fx.t) / fx.life, 0, 1) : clamp(atU, 0, 1);
    if (spec.motion === 'thrust') {
      const shove = smoothStep01((u - 0.13) / 0.24) * (1 - smoothStep01((u - 0.59) / 0.30));
      const base = fx.r * spec.reach * 0.54, extension = shove * fx.r * spec.reach * 0.46;
      return { u, a: fx.a + fx.side * 0.035, extension, bladeReach: base + extension, power: shove, baseReach: base };
    }
    const begin = spec.motion === 'smash' ? 0.29 : spec.motion === 'whip' ? 0.22 : 0.18;
    const end = spec.motion === 'smash' ? 0.69 : spec.motion === 'whip' ? 0.75 : 0.71;
    const strike = smoothStep01((u - begin) / (end - begin));
    const overshoot = clamp((u - end) / Math.max(0.01, 1 - end), 0, 1);
    const a = fx.a + fx.side * ((strike * 2 - 1) * spec.arc + overshoot * spec.arc * 0.13);
    const extension = spec.motion === 'whip' ? Math.sin(strike * Math.PI) * fx.r * 0.10 : 0;
    return { u, a, extension, bladeReach: fx.r * spec.reach + extension, baseReach: fx.r * spec.reach, power: strike };
  }
  function meleeBladeSegment(fx, pose) {
    const tip = pose.bladeReach;
    const start = fx.profile.motion === 'thrust' ? Math.max(12, tip - fx.r * 0.36) : tip * meleeContactStarts[fx.type];
    const ca = Math.cos(pose.a), sa = Math.sin(pose.a);
    return { x1: player.x + ca * start, y1: player.y + sa * start, x2: player.x + ca * tip, y2: player.y + sa * tip };
  }
  function nearestSegmentPoint(x, y, seg) {
    const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1, length2 = dx * dx + dy * dy;
    const t = length2 ? clamp(((x - seg.x1) * dx + (y - seg.y1) * dy) / length2, 0, 1) : 0;
    const px = seg.x1 + dx * t, py = seg.y1 + dy * t;
    return { x: px, y: py, dist: vlen(x - px, y - py) };
  }
  function flashClearPath(p, t) {
    const steps = Math.max(2, Math.ceil(vlen(t.x - p.x, t.y - p.y) / 16));
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      if (solidAt(p.x + (t.x - p.x) * f, p.y + (t.y - p.y) * f, 2)) return false;
    }
    return true;
  }
  function updateMeleeCollision(fx, previousU) {
    const spec = fx.profile, [lo, hi] = spec.active;
    const nowU = clamp((fx.life - fx.t) / fx.life, 0, 1);
    if (!fx.lunged && nowU >= lo) {
      fx.lunged = true;
      const lunge = spec.lunge || 190;
      player.vx += Math.cos(fx.a) * lunge; player.vy += Math.sin(fx.a) * lunge;
    }
    if (!fx.braked && nowU >= hi) { fx.braked = true; player.vx *= 0.38; player.vy *= 0.38; }

    const from = Math.max(lo, previousU ?? nowU), to = Math.min(hi, nowU);
    if (from > to) return;
    const a0 = meleeAttackPose(fx, from).a, a1 = meleeAttackPose(fx, to).a;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(a1 - a0) / 0.045, (to - from) / 0.023)));
    const candidates = teamAttack ? [...towers, ...allies] : towers;

    for (const target of candidates) {
      if (target.hp <= 0 || fx.hits.includes(target)) continue;
      let contact = null;
      for (let k = 0; k <= n; k++) {
        const u = from + (to - from) * (k / n), pose = meleeAttackPose(fx, u);
        const nearest = nearestSegmentPoint(target.x, target.y, meleeBladeSegment(fx, pose));
        if (nearest.dist <= target.r + spec.thickness * 0.5 && flashClearPath(player, target)) {
          contact = { ...nearest, a: pose.a }; break;
        }
      }
      if (!contact) continue;
      fx.hits.push(target);
      let damage = Math.round(spec.damage * dmgMultiplier());
      let tag = fx.finisher ? 'FINISHER' : '';
      if (fx.type === 'knife' && player.sneakT > 0) { damage += 22; tag = 'SNEAK'; endSneak('KNIFE STRIKE'); }

      const kb = fx.type === 'mace' ? 14 : (fx.finisher ? 11 : 6);
      const temp = { x: target.x, y: target.y, vx: 0, vy: 0, r: target.r };
      moveCircle(temp, Math.cos(fx.a) * kb, Math.sin(fx.a) * kb);
      target.x = temp.x; target.y = temp.y;

      if (allies.includes(target)) applyDamageToAlly(target, damage, 'FRIENDLY MELEE');
      else {
        target.fire = Math.max(0.25, target.fire + 0.25);
        damageTower(target, damage, tag);
      }
      camKick.x += Math.cos(fx.a) * (fx.finisher ? 4.5 : 2.5);
      camKick.y += Math.sin(fx.a) * (fx.finisher ? 4.5 : 2.5);
      spawnParticles(contact.x, contact.y, fx.type === 'mace' || fx.finisher ? 16 : 10, '#ffe4ac');
      weaponFX.push({ kind: 'meleeImpact', x: contact.x, y: contact.y, a: contact.a, r: fx.type === 'mace' || fx.finisher ? 26 : 16, c: '#ffedc7', life: 0.18, t: 0.18 });
      fx.impactFreeze = fx.type === 'mace' ? 0.050 : 0.027;
    }
  }
  function applyDazzle(t) {
    t.dazzled = 2;
    t.dazzleT = 4.0;
  }
  function attackOnce(fromBuffer = false) {
    if (restOn) return false;
    const p = player, w = weaponNow(), s = weaponState();
    if (mouse.castDown || p.castLock > 0 || p.fireCD > 0 || p.mode || p.rec > 0 || weaponSwapCD > 0) {
      if (!fromBuffer) inputBuffer.attack = 0.14;
      return false;
    }
    inputBuffer.attack = 0;
    if (w.type === 'drone' && p.drone) { explodeDrone(); return true; }
    if (s.reloading > 0) return false;
    if (isMelee(w)) return meleeAttack();

    p.weaponLock = Math.max(p.weaponLock, 0.20);
    if (w.type === 'potion') { throwLockedPotion(); return true; }
    if (w.type === 'camera' && scopeActive()) { weaponChargeMode = true; return true; }

    if (w.type === 'extinguisher') {
      if (guardActive()) return false;
      if (s.ammo <= 0) { autoReloadIfEmpty(w, s); return false; }
      s.ammo--; p.fireCD = w.cool;
      const a = rawAim(), half = 0.39, reach = w.range;
      const pool = teamAttack ? [...towers, ...allies] : towers;
      for (const t of pool) {
        if (t.hp <= 0) continue;
        const dist = vlen(t.x - p.x, t.y - p.y);
        const delta = Math.abs(Math.atan2(Math.sin(Math.atan2(t.y - p.y, t.x - p.x) - a), Math.cos(Math.atan2(t.y - p.y, t.x - p.x) - a)));
        if (dist < reach + t.r && delta < half + 0.06 && flashClearPath(p, t)) {
          const dmg = Math.round(6 * dmgMultiplier());
          if (allies.includes(t)) applyDamageToAlly(t, dmg, 'FOAM SPRAY');
          else { damageTower(t, dmg); t.fire += 0.20; }
          effects.push({ x: t.x, y: t.y, r: 34, t: 0.9, c: '#89dfe0', kind: 'frost' });
          spawnParticles(t.x, t.y, 2, '#b5e8df');
        }
      }
      weaponFX.push({ kind: 'foamSpray', x: p.x, y: p.y, a, r: reach, arc: half, c: '#a9ebe2', t: 0.18, life: 0.18 });
      autoReloadIfEmpty(w, s);
      return true;
    }

    if (w.type === 'camera') {
      if (s.ammo <= 0) { autoReloadIfEmpty(w, s); return false; }
      s.ammo--; p.fireCD = w.cool;
      const a = rawAim(), halfAngle = Math.PI * 55 / 180, radius = w.closeRange;
      let hit = 0;
      const pool = teamAttack ? [...towers, ...allies] : towers;
      for (const t of pool) {
        if (t.hp <= 0) continue;
        const dist = vlen(t.x - p.x, t.y - p.y), ang = Math.atan2(t.y - p.y, t.x - p.x);
        const delta = Math.abs(Math.atan2(Math.sin(ang - a), Math.cos(ang - a)));
        if (dist <= radius + t.r && delta <= halfAngle + Math.asin(Math.min(0.98, t.r / Math.max(dist, t.r + 1))) && flashClearPath(p, t)) {
          const dmg = Math.round((dist < 75 ? 42 : 25) * dmgMultiplier());
          applyDazzle(t);
          if (allies.includes(t)) applyDamageToAlly(t, dmg, 'CAMERA FLASH');
          else { damageTower(t, dmg, 'DAZZLED'); t.fire = Math.max(t.fire, 1.6); }
          spawnParticles(t.x, t.y, 14, '#fff1bd');
          hit++;
        }
      }
      weaponFX.push({ kind: 'cameraFlash', x: p.x, y: p.y, a, r: radius, arc: halfAngle, life: 0.32, t: 0.32, c: '#fff2bd' });
      spawnParticles(p.x + Math.cos(a) * 25, p.y + Math.sin(a) * 25, 10, '#fff3dc');
      showToast('WIDE FLASH · ' + hit + ' DAZZLED (Q TO PISTOL FOR +30% DMG)');
      autoReloadIfEmpty(w, s);
      return true;
    }

    if (w.type === 'drone') {
      if (s.ammo <= 0) { autoReloadIfEmpty(w, s); return false; }
      s.ammo--;
      p.drone = { x: p.x, y: p.y, ox: p.x, oy: p.y, vx: 0, vy: 0, t: 3.8, maxRange: effectiveWeaponRange(w) };
      p.fireCD = 0.25;
      autoReloadIfEmpty(w, s);
      showToast('DRONE ACTIVE · CONTACTS DETONATE AUTOMATICALLY');
      return true;
    }

    if (s.ammo <= 0) { autoReloadIfEmpty(w, s); return false; }
    s.ammo--; p.fireCD = w.cool;
    autoReloadIfEmpty(w, s);

    if (w.type === 'revolver') {
      const moving = vlen(p.vx, p.vy) > 40 && !scopeActive() && !precisionWalk();
      const spread = moving ? 0.055 : 0;
      const angle = rawAim() + (Math.random() * 2 - 1) * spread;
      if (moving) p.bloom = Math.min(0.10, (p.bloom || 0) + 0.045);
      spawnWeaponShot(1650, w.range, 44, 4, '#ffe0a5', { projectileType: 'revolver', angleOverride: angle });
    }
    if (w.type === 'carbine') {
      const baseSpread = scopeActive() ? 0.008 : 0.024;
      const angle = rawAim() + (Math.random() * 2 - 1) * (baseSpread + (p.bloom || 0));
      p.bloom = Math.min(0.14, (p.bloom || 0) + (scopeActive() ? 0.016 : 0.025));
      spawnWeaponShot(1480, w.range, 12, 3, '#f4d39a', { projectileType: 'carbine', angleOverride: angle });
    }
    if (w.type === 'pistol') spawnWeaponShot(1320, w.range, 24, 4, '#ffce95', { projectileType: 'pistol' });
    if (w.type === 'crossbow') {
      const mode = p.enchant || 0, en = enchants[mode];
      const moving = vlen(p.vx, p.vy) > 40 && !scopeActive() && !precisionWalk();
      const spread = moving ? (Math.random() * 2 - 1) * 0.035 : 0;
      if (mode === 0) spawnWeaponShot(1180, w.range, 68, 5, en.color, { projectileType: 'bolt', crossMode: 'PIERCING', pierce: 1, hitTargets: [], angleOverride: rawAim() + spread });
      if (mode === 1) for (const off of [-0.14, 0, 0.14]) spawnWeaponShot(920, 520, 24, 5, en.color, { projectileType: 'bolt', crossMode: 'SCATTER', angleOverride: rawAim() + off });
      if (mode === 2) spawnWeaponShot(880, 760, 28, 7, en.color, { projectileType: 'bolt', crossMode: 'SNARE', angleOverride: rawAim() + spread });
      if (mode === 3) spawnWeaponShot(960, w.range, 45, 6, en.color, { projectileType: 'bolt', crossMode: 'RICOCHET', bounces: 2, bouncedOnce: false, angleOverride: rawAim() + spread });
    }
    return true;
  }
  function explodeDrone() {
    const d = player.drone;
    if (!d) return;
    damageArea(d.x, d.y, 105, Math.round(75 * dmgMultiplier()), false, true);
    effects.push({ x: d.x, y: d.y, r: 105, t: 0.4, c: '#e4b67a', kind: 'pulse' });
    spawnParticles(d.x, d.y, 26, '#f7d19a');
    player.drone = null; player.fireCD = 0.25;
  }
  function fireFocusedCamera(held) {
    const w = weaponNow(), s = weaponState();
    if (w.type !== 'camera' || s.reloading > 0 || player.mode || player.rec > 0 || player.fireCD > 0) return false;
    if (s.ammo <= 0) { autoReloadIfEmpty(w, s); return false; }
    const charge = clamp(held / 0.85, 0, 1);
    player.weaponLock = Math.max(player.weaponLock, 0.22);
    const a = rawAim(), range = w.range;
    const halfAngle = 0.22 - charge * 0.13;
    const damage = Math.round((30 + charge * 50) * dmgMultiplier());
    let hit = 0;
    const pool = teamAttack ? [...towers, ...allies] : towers;
    for (const t of pool) {
      if (t.hp <= 0) continue;
      const dist = vlen(t.x - player.x, t.y - player.y), theta = Math.atan2(t.y - player.y, t.x - player.x);
      const delta = Math.abs(Math.atan2(Math.sin(theta - a), Math.cos(theta - a)));
      if (dist <= range + t.r && delta <= halfAngle + Math.asin(Math.min(0.98, t.r / Math.max(dist, t.r + 1))) && flashClearPath(player, t)) {
        applyDazzle(t);
        if (allies.includes(t)) applyDamageToAlly(t, damage, 'FOCUSED FLASH');
        else { damageTower(t, damage, 'DAZZLED'); t.fire = Math.max(t.fire, 1.8); }
        effects.push({ x: t.x, y: t.y, r: 38, t: 0.35, c: '#fff5c0', kind: 'pulse' });
        spawnParticles(t.x, t.y, 18, '#fff2b5');
        hit++;
      }
    }
    s.ammo--;
    player.fireCD = w.cool;
    camKick.x -= Math.cos(a) * 6; camKick.y -= Math.sin(a) * 6;
    weaponFX.push({ kind: 'cameraFlash', x: player.x, y: player.y, a, r: range, arc: halfAngle, focused: true, life: 0.42, t: 0.42, c: '#ffe9a9' });
    spawnParticles(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24, 14, '#fff6de');
    autoReloadIfEmpty(w, s);
    showToast('TELEPHOTO FLASH · ' + hit + ' DAZZLED · ' + damage + ' DMG');
    return true;
  }
  function potionLandingPoint(w = weaponNow()) {
    const cursor = cursorWorld(), dx = cursor.x - player.x, dy = cursor.y - player.y, dist = vlen(dx, dy);
    const travel = Math.min(dist, w.range);
    const dir = dist > 1e-5 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 };
    return { x: player.x + dir.x * travel, y: player.y + dir.y * travel };
  }
  function throwLockedPotion() {
    const w = weaponNow(), s = weaponState();
    if (s.reloading || player.rec || player.fireCD > 0) return;
    if (s.ammo <= 0) { autoReloadIfEmpty(w, s); return; }
    const phase = potionPhases[player.potionIdx % potionPhases.length];
    const pt = potionLandingPoint(w); if(spellSightBlocked(player,pt)) return;
    s.ammo--; player.fireCD = w.cool; player.weaponLock = Math.max(player.weaponLock, 0.20);
    autoReloadIfEmpty(w, s);
    weaponFX.push({ kind: 'bottle', x: player.x, y: player.y, tx: pt.x, ty: pt.y, c: phase.color, phase: phase.kind, t: 0.25, life: 0.25 });
    showToast('POTION THROWN · ' + phase.name);
  }
  function resolvePotion(fx) {
    effects.push({ x: fx.tx, y: fx.ty, r: 80, t: 0.55, c: fx.c, kind: 'pulse' });
    spawnParticles(fx.tx, fx.ty, 14, fx.c);
    if (fx.phase === 'heal') {
      if (vlen(player.x - fx.tx, player.y - fx.ty) <= 80) { player.hp = Math.min(100, player.hp + 34); addPopup(player.x, player.y, '+34 HP', '#7bdca4'); }
      for (const a of allies) if (a.hp > 0 && vlen(a.x - fx.tx, a.y - fx.ty) <= 80) { a.hp = Math.min(a.maxHp, a.hp + 34); addPopup(a.x, a.y, '+34 HP', '#7bdca4'); }
    } else if (fx.phase === 'haste') {
      if (vlen(player.x - fx.tx, player.y - fx.ty) <= 85) { hasteT = 4.5; addPopup(player.x, player.y, 'HASTE!', '#f9d77c'); }
    } else if (fx.phase === 'damage') {
      damageArea(fx.tx, fx.ty, 88, Math.round(55 * dmgMultiplier()), false, true);
    }
  }
  function endSneak(reason) {
    if (player.sneakT <= 0) return;
    player.sneakT = 0;
    weaponStates[1][0].special = Math.max(weaponStates[1][0].special, 6.0);
    spawnParticles(player.x, player.y, 10, '#f0d39c');
    showToast('SNEAK REVEALED · ' + reason);
  }
  function specialMelee() {
    const p = player, w = weaponNow(), s = weaponState(), angle = rawAim(), d = { x: Math.cos(angle), y: Math.sin(angle) };
    if (p.mode || p.rec > 0 || p.castLock > 0 || mouse.castDown) return;
    p.weaponLock = Math.max(p.weaponLock, 0.19);

    if (w.type === 'crowbar') {
      if (p.c4) {
        if (p.c4.armed > 0) { showToast('C4 ARMING · ' + p.c4.armed.toFixed(1) + 's'); return; }
        const bomb = p.c4; p.c4 = null; s.special = 6.0;
        effects.push({ x: bomb.x, y: bomb.y, r: 122, t: 0.42, c: '#edc88a', kind: 'pulse' });
        damageArea(bomb.x, bomb.y, 122, Math.round(75 * dmgMultiplier()), false, true);
        spawnParticles(bomb.x, bomb.y, 28, '#f4d8aa');
        showToast('C4 DETONATED · 122u BLAST');
        return;
      }
      if (s.special > 0) { showToast('C4 RECHARGING · ' + s.special.toFixed(1) + 's'); return; }
      const cursor = cursorWorld(), dist = Math.min(140, Math.max(42, vlen(cursor.x - p.x, cursor.y - p.y)));
      let placed = null;
      for (let r = dist; r >= 36; r -= 12) {
        const tx = p.x + d.x * r, ty = p.y + d.y * r;
        if (!solidAt(tx, ty, 14)) { placed = { x: tx, y: ty }; break; }
      }
      if (!placed) { showToast('C4 · NO SPACE TO TOSS CHARGE'); return; }
      p.c4 = { x: placed.x, y: placed.y, armed: 0.4, life: 15 };
      showToast('C4 TOSSED · R TO DETONATE');
      return;
    }

    if (s.special > 0) { showToast('SPECIAL ON COOLDOWN'); return; }

    if (w.type === 'extinguisher') {
      if (s.ammo < 10 || s.reloading > 0) { showToast('PRESSURE BURST NEEDS 10 PRESSURE'); return; }
      const reach = 225, cone = Math.PI * 53 / 180;
      let knocked = 0, deflected = 0;
      const pool = teamAttack ? [...towers, ...allies] : towers;
      for (const t of pool) {
        if (t.hp <= 0) continue;
        const dx = t.x - p.x, dy = t.y - p.y, dist = vlen(dx, dy);
        const delta = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
        if (dist > reach + t.r || delta > cone || !flashClearPath(p, t)) continue;
        const displacement = 90 * (1 - Math.min(dist / reach, 1)) + 35;
        const temp = { x: t.x, y: t.y, vx: 0, vy: 0, r: t.r };
        moveCircle(temp, d.x * displacement, d.y * displacement);
        t.x = temp.x; t.y = temp.y;
        const dmg = Math.round(14 * dmgMultiplier());
        if (allies.includes(t)) applyDamageToAlly(t, dmg, 'PRESSURE BURST');
        else { damageTower(t, dmg); t.fire = Math.max(t.fire, 1.7); }
        knocked++;
        spawnParticles(t.x, t.y, 10, '#bcece1');
      }
      for (const shot of shots) {
        if (shot.team !== 'enemy') continue;
        const dx = shot.x - p.x, dy = shot.y - p.y, dist = vlen(dx, dy);
        const delta = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
        if (dist > reach || delta > cone || !flashClearPath(p, shot)) continue;
        const speed = Math.max(420, vlen(shot.vx, shot.vy));
        shot.vx = d.x * speed; shot.vy = d.y * speed;
        shot.team = 'player'; shot.owner = null; shot.damage = 22; shot.weaponShot = true; shot.c = '#bdece6';
        deflected++;
      }
      s.ammo -= 10; s.special = 5.5;
      autoReloadIfEmpty(w, s);
      weaponFX.push({ kind: 'pressureBurst', x: p.x, y: p.y, a: angle, r: reach, arc: cone, c: '#b6e9e2', t: 0.32, life: 0.32 });
      spawnParticles(p.x + d.x * 65, p.y + d.y * 65, 18, '#b6eee6');
      showToast('PRESSURE BURST · ' + knocked + ' PUSHED / ' + deflected + ' DEFLECTED');
      return;
    }

    if (w.type === 'shovel') {
      if (crates.filter(b => b.placed).length >= 3) { showToast('MAXIMUM OF THREE DEPLOYED COVERS'); return; }
      const x = p.x + d.x * 65, y = p.y + d.y * 65;
      if (solidAt(x, y, 37)) { showToast('NO ROOM TO PLACE COVER'); return; }
      crates.push({ x: x - 27, y: y - 17, w: 54, h: 34, placed: true });
      s.special = 7;
      spawnParticles(x, y, 14, '#c5b08a');
      showToast('SHOVEL · EARTHWORK COVER');
      return;
    }

    if (w.type === 'knife') {
      if (p.sneakT > 0) { showToast('SNEAK ALREADY ACTIVE'); return; }
      p.sneakT = 5.0;
      spawnParticles(p.x, p.y, 14, '#b5d9e4');
      showToast('SNEAK ACTIVE · REVEALED ON HIT / DAMAGE / SPELL');
      return;
    }

    if (w.type === 'mace') {
      damageArea(p.x + d.x * 52, p.y + d.y * 52, 110, Math.round(50 * dmgMultiplier()), false, false);
      effects.push({ x: p.x, y: p.y, r: 120, t: 0.5, c: '#f7b77a', kind: 'pulse' });
      s.special = 5.5;
      showToast('MACE · 50 DMG GROUND SLAM');
      return;
    }
  }
  function pressReloadOrSpecial() {
    if (restOn) return;
    const w = weaponNow();
    if (w.type === 'crossbow') {
      player.enchant = (player.enchant + 1) % enchants.length;
      showToast('CROSSBOW AUGMENT · ' + enchants[player.enchant].name);
      updateWeaponUI();
      return;
    }
    if (isMelee(w) || w.type === 'extinguisher') specialMelee();
    else beginReload();
  }
  function magic(fromBuffer = false) {
    if (restOn || !player) return false;
    if (player.mode || player.rec > 0 || player.spellCD > 0 || player.weaponLock > 0 || mouse.down || weaponFX.some(f => f.kind === 'melee' && f.t > 0)) {
      if (!fromBuffer) inputBuffer.spell = 0.14;
      return false;
    }
    inputBuffer.spell = 0;
    const s = book[spell];
    if (!s) return false;
    const p = player, pos = spellTargetPoint(s), ang = rawAim(), d = { x: Math.cos(ang), y: Math.sin(ang) }, c = colors[ci], maxR = s.range;
    if (spellRequiresSight(s) && spellSightBlocked(p, pos)) { showToast(s.name.toUpperCase() + ' · LINE OF SIGHT BLOCKED'); return false; }
    if (!spellAvailable(s)) { showToast('NO ' + (classBooks[ci].pact ? 'PACT' : 'LEVEL ' + s.level) + ' SPELL SLOTS · HOLD CTRL TO REST'); return false; }
    const tx = maxR ? pos.x : p.x, ty = maxR ? pos.y : p.y;
    if (['misty', 'illusion', 'hand', 'grease', 'faerie', 'darkness'].includes(s.fx) && maxR && solidAt(tx, ty, 13)) {
      showToast('SPELL TARGET BLOCKED'); return false;
    }
    if (p.sneakT > 0) endSneak('SPELLCAST');
    if (s.level > 0) {
      if (classBooks[ci].pact) spellResources.slots[2]--;
      else spellResources.slots[s.level]--;
    }
    const power = (spellResources.empowered && spellResources.points>0 ? 1.45 : 1) * dmgMultiplier();
    if (spellResources.empowered && ci === 0 && spellResources.points >= 1) {
      spellResources.points--;
      showToast('EMPOWERED ' + s.name.toUpperCase());
    }
    spellResources.empowered = false;
    p.spellCD = s.level === 2 ? 0.92 : s.level === 1 ? 0.68 : 0.29;
    p.castLock = 0.24;

    const burst = (x, y, r, dmg, color = c, selfHazard = false) => {
      effects.push({ x, y, r, t: 0.28, c: color, kind: 'pulse' });
      damageArea(x, y, r, Math.round(dmg * power), true, selfHazard);
      spawnParticles(x, y, 8, color);
    };
    const fireBolt = (speed, damage, color = c, radius = 7) => {
      shots.push({ ownerSlot:ci,
        x: p.x + d.x * 23, y: p.y + d.y * 23, vx: d.x * speed, vy: d.y * speed,
        r: radius, team: 'player', castleSpell: true, t: Math.max(0.1, maxR / speed),
        damage: Math.round(damage * power), c: color
      });
    };

    switch (s.fx) {
      case 'sliver': case 'whispers': case 'toll': case 'chill':
        burst(tx, ty, s.fx === 'whispers' ? 78 : 54, s.fx === 'whispers' ? 29 : 19, '#a98eef'); break;
      case 'bolt': case 'missile': case 'catapult': case 'flame':
        fireBolt(s.fx === 'catapult' ? 780 : 1050, s.fx === 'missile' ? 32 : s.fx === 'catapult' ? 36 : 22, s.fx === 'flame' ? '#fff0b1' : '#e7bd75', 7); break;
      case 'shock': case 'thunder':
        burst(p.x + d.x * 65, p.y + d.y * 65, s.fx === 'thunder' ? 126 : 80, s.fx === 'thunder' ? 39 : 24, '#8adeff', false); break;
      case 'hand': case 'illusion':
        effects.push({ x: tx, y: ty, r: 25, t: 4, c: '#bda9ff', kind: 'decoy' }); break;
      case 'ward':
        p.inv = Math.max(p.inv, 1.6); effects.push({ x: p.x, y: p.y, r: 42, t: 1.6, c: '#e8cc81', kind: 'ward' }); break;
      case 'heal':
        p.hp = Math.min(100, p.hp + 32); addPopup(p.x, p.y, '+32 HP', '#9fffc8'); spawnParticles(p.x, p.y, 16, '#9fffc8'); break;
      case 'mending':
        p.hp = Math.min(100, p.hp + 10); addPopup(p.x, p.y, '+10 HP', '#9fffc8'); spawnParticles(p.x, p.y, 12, '#9fffc8'); break;
      case 'aid':
        p.hp = Math.min(100, p.hp + 28);
        for (const a of allies) if (a.hp > 0) a.hp = Math.min(a.maxHp, a.hp + 28);
        spawnParticles(p.x, p.y, 16, '#9fffc8');
        effects.push({ x: p.x, y: p.y, r: 100, t: 1.2, c: '#90f6c2', kind: 'ward' }); break;
      case 'guidance': case 'bless':
        p.inv = Math.max(p.inv, 0.7); effects.push({ x: p.x, y: p.y, r: 100, t: 1.3, c: '#f0d58a', kind: 'ward' }); break;
      case 'hex': case 'hold': case 'sleep': {
        const pool = teamAttack ? [...towers, ...allies] : towers;
        const t = pool.filter(t => t.hp > 0 && vlen(t.x - tx, t.y - ty) < 95 && !spellSightBlocked(p, t))
                      .sort((a, b) => vlen(a.x - tx, a.y - ty) - vlen(b.x - tx, b.y - ty))[0];
        if (t) {
          if (allies.includes(t)) { if (s.fx === 'hex') applyDamageToAlly(t, 12, 'HEX CURSE'); }
          else { t.fire += s.fx === 'hex' ? 1.2 : 3.1; if (s.fx === 'hex') damageTower(t, 12); }
          spawnParticles(t.x, t.y, 14, '#c698e8');
        } else effects.push({ x: tx, y: ty, r: 65, t: 0.3, c: '#c698e8', kind: 'pulse' });
        break;
      }
      case 'misty':
        if (!solidAt(tx, ty, p.r)) { p.x = tx; p.y = ty; p.vx = 0; p.vy = 0; spawnParticles(tx, ty, 18, '#d3b2ff'); } break;
      case 'shatter': burst(tx, ty, 128, 44, '#af8bf5', true); break;
      case 'darkness': effects.push({ x: tx, y: ty, r: 120, t: 4, c: '#6b5691', kind: 'gravity' }); break;
      case 'faerie': effects.push({ x: tx, y: ty, r: 110, t: 4, c: '#b69cf0', kind: 'chain' }); damageArea(tx, ty, 100, 12, true, false); break;
      case 'grease': effects.push({ x: tx, y: ty, r: 125, t: 4, c: '#88ded7', kind: 'frost' }); break;
      case 'spiritual': burst(tx, ty, 90, 40, '#ead6a2', false); break;
      case 'disguise': p.inv = Math.max(p.inv, 0.25); effects.push({ x: p.x, y: p.y, r: 22, t: 1.3, c: '#92d5d4', kind: 'ward' }); break;
    }
    refreshSpellUI();
    return true;
  }
  function damageArea(x, y, r, dmg, checkSight = false, selfDamage = false) {
    for (const t of towers) {
      if (t.hp > 0 && vlen(t.x - x, t.y - y) < r && !spellSightBlocked({ x, y }, t)) {
        damageTower(t, dmg);
        spawnParticles(t.x, t.y, 12, '#f5b65f');
      }
    }
    if (teamAttack) {
      for (const a of allies) {
        if (a.hp > 0 && vlen(a.x - x, a.y - y) < r && (!checkSight || !spellSightBlocked({ x, y }, a))) {
          applyDamageToAlly(a, Math.round(dmg), 'FRIENDLY BLAST');
        }
      }
      if (selfDamage && vlen(player.x - x, player.y - y) < r && (!checkSight || !spellSightBlocked({ x, y }, player))) {
        applyDamageToPlayer(Math.round(dmg * 0.65), 'SELF BLAST');
      }
    }
  }
  function friendlyBulletCollision(b) {
    for (const t of towers) {
      if (t.hp > 0 && vlen(t.x - b.x, t.y - b.y) < t.r + b.r) {
        if (b.hitTargets?.includes(t)) continue;
        let amount = b.damage || 14, label = '';
        if (t.dazzled > 0 && t.dazzleT > 0) {
          amount = Math.round(amount * 1.3);
          t.dazzled--;
          if (t.dazzled <= 0) t.dazzleT = 0;
          label = 'DAZZLE';
        }
        if (player.focus && player.focus.target === t && player.focus.t > 0) {
          amount += 20; player.focus = null; label = 'FOCUS';
          effects.push({ x: t.x, y: t.y, r: 42, t: 0.3, c: '#ffe0a0', kind: 'pulse' });
          showToast('SHUTTER FOCUS · +20 PRECISION DAMAGE');
        }
        damageTower(t, amount, label);
        if (b.crossMode === 'SNARE') {
          t.fire += 1.5;
          effects.push({ x: t.x, y: t.y, r: 66, t: 3.4, c: '#89dfe0', kind: 'frost' });
        }
        spawnParticles(b.x, b.y, 6, '#f5cb83');
        if (b.crossMode === 'PIERCING' && b.pierce > 0) { b.pierce--; b.hitTargets.push(t); return false; }
        return true;
      }
    }
    if (teamAttack) {
      for (const a of allies) {
        if (a.hp > 0 && vlen(a.x - b.x, a.y - b.y) < a.r + b.r) {
          if (b.hitTargets?.includes(a)) continue;
          let amount = b.damage || 14;
          if (a.dazzled > 0 && a.dazzleT > 0) { amount = Math.round(amount * 1.3); a.dazzled--; }
          applyDamageToAlly(a, amount, 'TEAM ATTACK');
          if (b.crossMode === 'PIERCING' && b.pierce > 0) { b.pierce--; b.hitTargets.push(a); return false; }
          return true;
        }
      }
      if (b.bouncedOnce && !deadweightPhasesBullets(player) && vlen(player.x - b.x, player.y - b.y) < player.r + b.r) {
        applyDamageToPlayer(Math.round((b.damage || 14) * 0.5), 'RICOCHET SELF-HIT');
        return true;
      }
    }
    return false;
  }
  function hostileBulletCollision(b) {
    const p = player;
    if (teamAttack) {
      for (const t of towers) {
        if (t !== b.owner && t.hp > 0 && vlen(t.x - b.x, t.y - b.y) < t.r + b.r) {
          damageTower(t, 9); spawnParticles(b.x, b.y, 6, '#ff9a88'); return true;
        }
      }
      for (const a of allies) {
        if (a.hp > 0 && vlen(a.x - b.x, a.y - b.y) < a.r + b.r) {
          applyDamageToAlly(a, 9, 'HOSTILE FIRE'); return true;
        }
      }
    }
    if (deadweightPhasesBullets(p)) return false;
    if (vlen(b.x - p.x, b.y - p.y) > 17 + b.r) return false;
    if (p.inv > 0) return true;
    if (p.sneakT > 0) endSneak('HIT BY PROJECTILE');

    if (p.mode === 'counter') {
      const wish = moveInput();
      const d = (wish.x || wish.y) ? wish : { x: Math.cos(rawAim()), y: Math.sin(rawAim()) };
      p.mode = 'recoil'; p.modeT = 0.28; p.modeDur = 0.28;
      p.vx = d.x * 590; p.vy = d.y * 590; p.counterBuffT = 3.0; p.inv = 0.28;
      effects.push({ x: p.x, y: p.y, r: 46, t: 0.32, c: '#ffd4a0', kind: 'pulse' });
      spawnParticles(p.x, p.y, 20, colors[ci]);
      showToast('COUNTERWEIGHT SURGE! · +30% DMG & +25% SPD (3s)');
      return true;
    }
    if (p.mode === 'signal') return false;

    let dmg = b.damage || 9;
    if (guardActive() && guard > 0) {
      const a = aim();
      const incoming = vlen(b.vx, b.vy) > 1 ? norm0(-b.vx, -b.vy) : norm0(b.x - p.x, b.y - p.y);
      if (Math.cos(a) * incoming.x + Math.sin(a) * incoming.y >= Math.cos(BLOCK_HALF_ANGLE)) {
        if (guardParryT > 0) {
          b.vx = Math.cos(a) * 520; b.vy = Math.sin(a) * 520;
          b.team = 'player'; b.owner = null; b.damage = 24; b.c = '#fff2a6'; b.t = 1.6;
          addPopup(p.x, p.y, 'PARRY!', '#fff2a6');
          spawnParticles(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, 14, '#fff2a6');
          showToast('PERFECT PARRY · SHOT REFLECTED (24 DMG)');
          return false;
        }
        dmg = 3; guard = Math.max(0, guard - 22);
        addPopup(p.x, p.y, 'BLOCKED', '#eed59b');
        spawnParticles(p.x + Math.cos(a) * 27, p.y + Math.sin(a) * 27, 6, '#eed59b');
      }
    }
    applyDamageToPlayer(dmg);
    return true;
  }
  function hostileMeleeHit(damage = 16) {
    const p = player;
    if (p.inv > 0) { showToast('MELEE STOPPED BY WARD'); return false; }
    if (p.sneakT > 0) endSneak('HIT BY MELEE');
    const dmg = Math.max(0, damage);
    applyDamageToPlayer(dmg, 'MELEE PRACTICE HIT');
    effects.push({ x: p.x, y: p.y, r: 40, t: 0.24, c: '#f19274', kind: 'pulse' });
    showToast('MELEE PRACTICE HIT · -' + dmg + ' HP');
    return true;
  }
  function updateWeapon(dt) {
    if (player.sneakT > 0) {
      player.sneakT = Math.max(0, player.sneakT - dt);
      if (player.sneakT <= 0) { player.sneakT = 0.00001; endSneak('TIMEOUT'); }
    }
    player.counterBuffT = Math.max(0, (player.counterBuffT || 0) - dt);
    guardParryT = Math.max(0, guardParryT - dt);
    player.bloom = Math.max(0, (player.bloom || 0) - dt * (mouse.down ? 0.06 : 0.24));

    const rPx = Math.round(24 + (player.bloom || 0) * 190);

    if (player.c4) {
      player.c4.armed = Math.max(0, player.c4.armed - dt);
      player.c4.life -= dt;
      if (player.c4.life <= 0) { player.c4 = null; weaponStates[0][1].special = 3.0; showToast('C4 EXPIRED · CHARGE LOST'); }
    }
    weaponSwapCD = Math.max(0, weaponSwapCD - dt);
    hasteT = Math.max(0, hasteT - dt);
    guard = Math.min(100, guard + (guardActive() ? 5 : 20) * dt);

    for (let cIdx = 0; cIdx < weaponStates.length; cIdx++) {
      const pair = weaponStates[cIdx];
      for (let wIdx = 0; wIdx < pair.length; wIdx++) {
        const s = pair[wIdx];
        s.special = Math.max(0, s.special - dt);
        if (s.reloading > 0) {
          s.reloading = Math.max(0, s.reloading - dt);
          if (s.reloading === 0) s.ammo = weaponCatalog[cIdx][wIdx].mag;
        }
      }
    }

    for (let i = weaponFX.length - 1; i >= 0; i--) {
      const fx = weaponFX[i];
      const previousU = fx.kind === 'melee' ? clamp((fx.life - fx.t) / fx.life, 0, 1) : 0;
      if (fx.kind === 'melee' && fx.impactFreeze > 0) fx.impactFreeze -= dt;
      else fx.t -= dt;
      if (fx.kind === 'melee') updateMeleeCollision(fx, previousU);
      if (fx.t <= 0) {
        if (fx.kind === 'bottle') resolvePotion(fx);
        weaponFX.splice(i, 1);
      }
    }

    if (!restOn && mouse.down && !mouse.castDown && player.castLock<=0 && !player.mode && player.rec <= 0 && weaponSwapCD <= 0) {
      const w = weaponNow(), s = weaponState();
      if (isMelee(w) && !guardActive() && player.fireCD <= 0) {
        meleeAttack();
      } else if (w.type === 'camera' && (weaponChargeMode || scopeActive()) && s.reloading <= 0 && s.ammo > 0) {
        weaponChargeMode = true;
        weaponHold += dt;
      } else if ((w.type === 'extinguisher' || w.type === 'carbine') && player.fireCD <= 0 && s.reloading <= 0) {
        attackOnce();
      }
    }

    if (player.drone) {
      const d = player.drone;
      d.t -= dt;
      const cursor = cursorWorld(), v = norm0(cursor.x - d.x, cursor.y - d.y), sp = scopeActive() ? 400 : 340;
      d.vx = lerp(d.vx, v.x * sp, 0.16); d.vy = lerp(d.vy, v.y * sp, 0.16);
      const temp = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, r: 8 };
      const col = moveCircle(temp, d.vx * dt, d.vy * dt);
      d.x = temp.x; d.y = temp.y;
      addTrail(d.x, d.y, '#dfbd73', 7, 0.12);
      const hitTarget = (teamAttack ? [...towers, ...allies] : towers).some(t => t.hp > 0 && vlen(t.x - d.x, t.y - d.y) <= t.r + 11);
      if (hitTarget || d.t <= 0 || col.wall || vlen(d.x - d.ox, d.y - d.oy) > d.maxRange) explodeDrone();
    }
  }
  function update(dt) {
    tickRest(dt);
    simT += dt;
    const p = player, def = defs[ci];
    p.weaponLock = Math.max(0, p.weaponLock - dt);
    p.castLock = Math.max(0, p.castLock - dt);

    if (inputBuffer.dodge > 0) { inputBuffer.dodge -= dt; dodgePressed(true); }
    if (inputBuffer.attack > 0) { inputBuffer.attack -= dt; attackOnce(true); }
    if (inputBuffer.spell > 0) { inputBuffer.spell -= dt; magic(true); }

    updateWeapon(dt);

    if (p.mode !== 'rewind') p.prev.push({ x: p.x, y: p.y, t: simT });
    while (p.prev.length && simT - p.prev[0].t > 1.2) p.prev.shift();
    if (p.focus) { p.focus.t -= dt; if (p.focus.t <= 0) p.focus = null; }
    p.fireCD = Math.max(0, p.fireCD - dt);
    p.firePosture = Math.max(0, p.firePosture - dt);
    if (!restOn && mouse.down && !p.mode && p.rec <= 0 && !isMelee()) p.firePosture = 0.18;
    p.spellCD = Math.max(0, p.spellCD - dt);
    p.dodgeCD = Math.max(0, p.dodgeCD - dt);
    p.rec = Math.max(0, p.rec - dt);
    p.inv = Math.max(0, p.inv - dt);
    p.damageFlash = Math.max(0, p.damageFlash - dt);

    const inp = moveInput();
    const mm = p.mode;

    if (mm) {
      p.modeT -= dt;
      switch (mm) {
        case 'signal': {
          const g = p.data.proj, a = (inp.x || inp.y) ? inp : p.dir;
          g.vx = lerp(g.vx, a.x * 345, 0.12); g.vy = lerp(g.vy, a.y * 345, 0.12);
          const gg = { x: g.x, y: g.y, vx: g.vx, vy: g.vy, r: 14 };
          moveCircle(gg, gg.vx * dt, gg.vy * dt);
          const o = p.data.origin, off = norm0(gg.x - o.x, gg.y - o.y);
          if (vlen(gg.x - o.x, gg.y - o.y) > 245) { gg.x = o.x + off.x * 245; gg.y = o.y + off.y * 245; }
          g.x = gg.x; g.y = gg.y;
          addTrail(g.x, g.y, colors[ci], 12, 0.24);
          if (!keys.has('Space') || p.modeT <= 0) endSignal();
          break;
        }
        case 'rewind': {
          const past = rewindSample(player.data.history || [], (p.data.rewindStart || simT) - (p.modeDur - p.modeT) * 1.5);
          const motion = moveCircle(p, past.x - p.x, past.y - p.y);
          addTrail(p.x, p.y, colors[ci], 16, 0.4);
          if (motion.wall || p.modeT <= 0 || !keys.has('Space')) endRewind();
          break;
        }
        case 'shutterArmed':
          applyGroundMovement(p, ci, inp, dt, def.speed * 0.66, true);
          moveCircle(p, p.vx * dt, p.vy * dt);
          if (p.modeT <= 0) { finishMode(0.12); showToast('SHUTTER REFLEX · NO THREAT'); }
          break;
        case 'shutterEvade': {
          const motion = moveCircle(p, p.vx * dt, p.vy * dt);
          p.vx *= Math.exp(-2 * dt); p.vy *= Math.exp(-2 * dt);
          addTrail(p.x, p.y, colors[ci], 16, 0.18);
          if (motion.wall || p.modeT <= 0) finishMode(0.12);
          break;
        }
        case 'knight': case 'castleSwap':
          if (p.modeT <= 0) finishMode(0.17);
          break;
        case 'fox': {
          p.vx *= Math.exp(-2.9 * dt); p.vy *= Math.exp(-2.9 * dt);
          const motion = moveCircle(p, p.vx * dt, p.vy * dt);
          addTrail(p.x, p.y, colors[ci]);
          // 28u proximity cover check for Foxhole Dive
          let nearCover = motion.wall;
          if (!nearCover) {
            for (let r of rectangles) {
              if (hitRect(p.x, p.y, p.r + 28, r)) { nearCover = true; break; }
            }
          }
          if (nearCover) {
            p.dodgeCD *= 0.40; p.foxReset = true;
            showToast('FOXHOLE COVER PROXIMITY! · 60% COOLDOWN REFUNDED');
            finishMode(0.18);
          } else if (p.modeT <= 0) finishMode(0.27);
          break;
        }
        case 'proneDive': {
          const motion = moveCircle(p, p.vx * dt, p.vy * dt);
          p.vx *= Math.exp(-8 * dt); p.vy *= Math.exp(-8 * dt);
          addTrail(p.x, p.y, colors[ci], 17, 0.25);
          if (motion.wall || p.modeT <= 0) { p.mode = 'crawl'; p.modeT = 1.55; p.vx = 0; p.vy = 0; }
          break;
        }
        case 'crawl':
          moveCircle(p, inp.x * 66 * dt, inp.y * 66 * dt);
          addTrail(p.x, p.y, colors[ci], 11, 0.12);
          if (p.modeT <= 0) finishMode(0.12);
          break;
        case 'barge': {
          const speed = Math.min(695, vlen(p.vx, p.vy) + 1015 * dt);
          steerForeclosure(p, inp, dt, 0.83);
          p.vx = p.dir.x * speed; p.vy = p.dir.y * speed;
          // Shallow wall scrape vs hard impact check
          const testX = p.x + p.vx * dt, testY = p.y + p.vy * dt;
          let hitBlock = false;
          for (let r of rectangles) if (hitRect(testX, testY, p.r, r)) { hitBlock = true; break; }
          if (hitBlock) {
            const angleOfHit = Math.abs(Math.atan2(p.vy, p.vx) - Math.atan2(0, 1));
            if (angleOfHit < 0.61) { // < 35 degrees shallow scrape
              moveCircle(p, p.vx * dt, p.vy * dt, { breakCrate: true });
              spawnParticles(p.x, p.y, 4, '#f8a56f');
            } else {
              finishMode(0.5); spawnParticles(p.x, p.y, 20, '#f8a56f'); showToast('WALL IMPACT · STAGGER');
            }
          } else {
            moveCircle(p, p.vx * dt, p.vy * dt, { breakCrate: true });
          }
          addTrail(p.x, p.y, colors[ci], 18, 0.38);
          // Ram enemies during Foreclosure for 32 DMG
          const pool = teamAttack ? [...towers, ...allies] : towers;
          for (const t of pool) {
            if (t.hp > 0 && vlen(t.x - p.x, t.y - p.y) < p.r + t.r + 12) {
              p.data.rammed ||= new Set(); if(p.data.rammed.has(t.id)) continue; p.data.rammed.add(t.id); damageTower(t, 32, 'RAM');
              spawnParticles(t.x, t.y, 14, '#ffb47a');
            }
          }
          if (p.modeT <= 0) { p.mode = 'bargeCoast'; p.modeT = 0.46; showToast('FORECLOSURE · MOMENTUM PRESERVED'); }
          break;
        }
        case 'bargeCoast': {
          const speed = vlen(p.vx, p.vy);
          steerForeclosure(p, inp, dt, 0.32);
          p.vx = p.dir.x * speed; p.vy = p.dir.y * speed;
          const motion = moveCircle(p, p.vx * dt, p.vy * dt, { breakCrate: true });
          p.vx *= Math.exp(-2.05 * dt); p.vy *= Math.exp(-2.05 * dt);
          addTrail(p.x, p.y, colors[ci], 16, 0.26);
          if (motion.wall) { finishMode(0.36); showToast('COAST COLLISION'); }
          else if (p.modeT <= 0) finishMode(0.15, true);
          break;
        }
        case 'counter':
          if (p.modeT <= 0) { finishMode(0.20); showToast('COUNTERWEIGHT · UNTRIGGERED (NO PENALTY)'); }
          break;
        case 'recoil':
          moveCircle(p, p.vx * dt, p.vy * dt);
          p.vx *= Math.exp(-5 * dt); p.vy *= Math.exp(-5 * dt);
          addTrail(p.x, p.y, colors[ci]);
          if (p.modeT <= 0) finishMode(0.14, true);
          break;
        case 'doubleFirst':
          moveCircle(p, p.vx * dt, p.vy * dt);
          p.vx *= Math.exp(-8 * dt); p.vy *= Math.exp(-8 * dt);
          addTrail(p.x, p.y, colors[ci]);
          if (p.modeT <= 0) { p.mode = 'doubleWindow'; p.modeT = 0.35; showToast('DOUBLE EXPOSURE · FLUID GLIDE WINDOW'); }
          break;
        case 'doubleWindow':
          // Smooth stride glide during double exposure window
          if (inp.x || inp.y) {
            p.vx = lerp(p.vx, inp.x * def.speed * 0.75, 8 * dt);
            p.vy = lerp(p.vy, inp.y * def.speed * 0.75, 8 * dt);
          }
          moveCircle(p, p.vx * dt, p.vy * dt);
          if (p.modeT <= 0) finishMode(0);
          break;
        case 'doubleSecond':
          moveCircle(p, p.vx * dt, p.vy * dt);
          p.vx *= Math.exp(-7 * dt); p.vy *= Math.exp(-7 * dt);
          addTrail(p.x, p.y, colors[ci]);
          if (p.modeT <= 0) finishMode(0);
          break;
        case 'thrust':
          if (p.data.phase === 0 && p.modeT <= 0) thrustStageTwo();
          moveCircle(p, p.vx * dt, p.vy * dt);
          p.vx *= Math.exp(-1.35 * dt); p.vy *= Math.exp(-1.35 * dt);
          addTrail(p.x, p.y, colors[ci], 14, 0.26);
          if (p.data.phase === 1 && p.modeT <= 0) finishMode(0.16);
          break;
        case 'skim': {
          const s = vlen(p.vx, p.vy);
          if (s > 1 && (inp.x || inp.y)) {
            const now = Math.atan2(p.vy, p.vx), wanted = Math.atan2(inp.y, inp.x);
            const turn = clamp(Math.atan2(Math.sin(wanted - now), Math.cos(wanted - now)), -2.45 * dt, 2.45 * dt);
            p.vx = Math.cos(now + turn) * s; p.vy = Math.sin(now + turn) * s;
          }
          moveCircle(p, p.vx * dt, p.vy * dt, { bank: true });
          p.vx *= Math.exp(-0.38 * dt); p.vy *= Math.exp(-0.38 * dt);
          addTrail(p.x, p.y, colors[ci], 13, 0.2);
          if (p.modeT <= 0) finishMode(0.22, true);
          break;
        }
      }
    } else if (p.rec <= 0 && !restOn) {
      const precision = precisionWalk(), guarding = guardActive(), firing = p.firePosture > 0 && !isMelee();
      const mult = (firing ? def.fireMult : 1) * (guarding ? 0.72 : 1);
      const buffMult = (hasteT > 0 ? 1.22 : 1) * (p.counterBuffT > 0 ? 1.25 : 1);
      const target = def.speed * mult * buffMult * arena.speedMultiplier(player);
      if (ci === 0) applyHoverMovement(p, inp, dt, target, precision, firing ? 0.72 : 1);
      else applyGroundMovement(p, ci, inp, dt, target, precision);
      moveCircle(p, p.vx * dt, p.vy * dt);
    } else {
      if (!restOn && (inp.x || inp.y)) {
        const strain = groundMotion[ci].launch * 0.22;
        p.vx += inp.x * strain * dt; p.vy += inp.y * strain * dt;
      }
      moveCircle(p, p.vx * dt, p.vy * dt);
      const dragRate = p.data.coastRecovery ? 2.7 : (groundMotion[ci].recDrag || 10.5);
      const drag = Math.exp(-dragRate * dt);
      p.vx *= drag; p.vy *= drag;
    }


  }
    player = {
      x: 810, y: 575, vx: 0, vy: 0, r: 16, hp: 100, inv: 0, damageFlash: 0,
      fireCD: 0, spellCD: 0, weaponLock: 0, castLock: 0, dodgeCD: 0, dodgeTotal: 0.1,
      firePosture: 0, rec: 0, mode: null, modeT: 0, modeDur: 0, prev: [],
      focus: null, anchor: null, foxReset: false, secondReady: false,
      activeSlot: slot, dir: { x: 1, y: 0 }, data: {}, enchant: 0,
      drone: null, c4: null, sneakT: 0, counterBuffT: 0, bloom: 0, potionIdx: 0
    };

 player.x=x;player.y=y;player.id='hero-'+ci;player.slot=ci;player.maxHp=100;player.respawn=0;
 const allowed=new Set(['KeyW','KeyA','KeyS','KeyD','KeyE','ShiftLeft','ControlLeft','Space','KeyF']);
 function input(v){
   if(player.hp<=0)return;
   mouse.x=Number.isFinite(v.aimX)?clamp(v.aimX,-25000,25000):player.x+100;
   mouse.y=Number.isFinite(v.aimY)?clamp(v.aimY,-25000,25000):player.y;
   const next=new Set((Array.isArray(v.keys)?v.keys:[]).filter(k=>allowed.has(k)));
   const rising=k=>next.has(k)&&!keys.has(k),falling=k=>!next.has(k)&&keys.has(k);
   const e=rising('KeyE'),sp=rising('Space'),rs=rising('ControlLeft'),rf=falling('ControlLeft');
   keys.clear();for(const k of next)keys.add(k);
   if(e){if(weaponNow().type==='potion')player.potionIdx=(player.potionIdx+1)%3;else if(isGuardWeapon()&&guard>0)guardParryT=.18;}
   if(sp)dodgePressed();if(rs)startRest();if(rf)finishRest();
   if(!next.has('Space')){endSignal();endRewind();}
   if(!v.fire&&mouse.down)stopWeaponHold();
   if(!v.cast)mouse.castDown=false;
   if(v.cast&&!mouse.castDown){mouse.castDown=true;if(!mouse.down)magic();}
   if(v.fire&&!mouse.down&&!mouse.castDown&&player.castLock<=0){mouse.down=true;weaponHold=0;weaponChargeMode=weaponNow().type==='camera'&&scopeActive();if(player.mode==='skim'&&weaponNow().type==='potion')throwLockedPotion();else if(!weaponChargeMode)attackOnce();}
 }
 function action(v){if(player.hp<=0)return;if(v.action==='reload')pressReloadOrSpecial();else if(v.action==='spell'&&Number.isInteger(v.index)&&book[v.index])spell=v.index;
 else if(v.action==='empower'&&ci===0&&spellResources.points>0)spellResources.empowered=!spellResources.empowered;
 else if(v.action==='slot'&&[1,2].includes(v.level))createSlot(v.level);
 else if(v.action==='convert'&&ci===0&&spellResources.slots[1]>0&&spellResources.points<3){spellResources.slots[1]--;spellResources.points++;}}
 return {player,keys,input,action,get effects(){return effects;},get visuals(){return visualQueue;},get weaponFX(){return weaponFX;},
 sync(){allies=arena.heroes.filter(h=>h!==player);},
 step(dt){simT+=player.hp<=0?dt:0;if(player.hp<=0){player.respawn-=dt;if(player.respawn<=0){player.hp=100;player.x=arena.entry.x;player.y=arena.entry.y;player.inv=1.5;player.mode=null;player.data={};}return;}
 update(dt);for(const f of visualQueue){f.x+=(f.vx||0)*dt;f.y+=(f.vy||0)*dt;f.t-=dt;}while(visualQueue.length>64)visualQueue.shift();for(let i=visualQueue.length-1;i>=0;i--)if(visualQueue[i].t<=0)visualQueue.splice(i,1);for(const f of effects)f.t-=dt;effects=effects.filter(f=>f.t>0);},
 damage:applyDamageToPlayer,melee:hostileMeleeHit,
 hit(b){if(player.hp<=0)return false;if(absorbEchoProjectile(b))return true;return b.team==='enemy'?hostileBulletCollision(b):friendlyBulletCollision(b);},
 incoming(b){if(player.mode==='shutterArmed'&&detectIncomingShot(player,b))triggerShutter(player,b);},
 snapshot(){return {id:player.id,slot:ci,x:player.x,y:player.y,vx:player.vx,vy:player.vy,hp:player.hp,r:16,aim:rawAim(),mode:player.mode,rec:player.rec,inv:player.inv,respawn:player.respawn,dodgeCD:player.dodgeCD,dodgeTotal:player.dodgeTotal,dodge:slot,weapon:weaponSlot,spell,ammo:weaponStates[ci],resources:spellResources,guard,restClock,shortRestsLeft,longRestsLeft,notice,enchant:player.enchant,potionIdx:player.potionIdx,sneakT:player.sneakT,drone:player.drone,c4:player.c4,ghost:player.data.proj,scope:scopeActive(),speed:defs[ci].speed*arena.speedMultiplier(player)*(hasteT>0?1.22:1)*(player.counterBuffT>0?1.25:1)};}
 };
}
