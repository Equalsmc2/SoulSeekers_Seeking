"""Reproducible extraction of V22.4 pure data and simulation, with explicit multiplayer adapters."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
s=(root/'references/Party_latest_user_upload_V22_4.html').read_text()
def fn(name):
 m=re.search(r'^  function '+name+r'\(.*?^  }',s,re.M|re.S)
 if not m: raise ValueError(name)
 return m[0]
data=s[s.index('  const clamp ='):s.index('  const world =')]
names=['clamp','vlen','norm','norm0','lerp','smoothStep01','colors','defs','groundMotion','dodgeBalance','classBooks','weaponCatalog','potionPhases','enchants','meleeProfiles','meleeModelTips','meleeContactStarts','BLOCK_HALF_ANGLE','SHORT_REST_TIME','LONG_REST_TIME','knightSquares']
(root/'shared/dungeon/combat-data.mjs').write_text('// Extracted from authoritative Party V22.4. Run tools/extract-combat.py to reproduce.\n'+data+'\nexport { '+','.join(names)+' };\n')
selected='aim axis hitRect segmentHitsRect spellTargetPoint applyGroundMovement applyHoverMovement createSlot cancelRestOnDamage finishRest chooseDodge selectWeapon startMode knightLanding castleTarget thrustStageTwo steerForeclosure rewindSample absorbEchoProjectile segmentDistance detectIncomingShot triggerShutter dodgePressed endRewind endSignal beginSecondStep finishMode stopWeaponHold beginReload autoReloadIfEmpty spawnWeaponShot applyDamageToPlayer applyDamageToAlly damageTower meleeAttack meleeAttackPose meleeBladeSegment nearestSegmentPoint flashClearPath updateMeleeCollision applyDazzle attackOnce explodeDrone fireFocusedCamera potionLandingPoint throwLockedPotion resolvePotion endSneak specialMelee pressReloadOrSpecial magic damageArea friendlyBulletCollision hostileBulletCollision hostileMeleeHit updateWeapon update'.split()
body='\n'.join(fn(n) for n in selected)
# Browser-only presentation is removed; gameplay effects remain serialized by the arena.
body=re.sub(r'^.*(?:ui\.|document\.).*\n','',body,flags=re.M)
body=body[:body.index('    // Hostile turrets')]+'''\n  }\n'''
# An ally is another controller, never an offline dummy or a second simulated turn.
start=body.index('    for (const a of allies) {',body.index('  function update(dt)'))
end=body.index('    const inp = moveInput();',start)
body=body[:start]+body[end:]
body=body.replace("p.hp = 100; p.x = 810; p.y = 575; p.vx = 0; p.vy = 0;", "p.respawn = 3; p.vx = 0; p.vy = 0; cancelWeaponHold(); keys.clear();")
body=body.replace("TEST RESET · HEALTH RESTORED", "DOWN · RETURNING TO ENTRANCE")
body=body.replace("p.x = end.x; p.y = end.y; p.vx = 0; p.vy = 0;", "if (solidAt(end.x,end.y,p.r)) { p.mode=null; p.dodgeCD=0; return false; } p.x = end.x; p.y = end.y; p.vx = 0; p.vy = 0;")
body=body.replace("for (let i = 0; i < effects.length; i++) if (effects[i].t > 0 && ['decoy', 'frost', 'gravity'].includes(effects[i].kind)) check('SPELL', effects[i]);", "for(const e of (typeof arena.effects==='function'?arena.effects():effects)) if(e.t>0 && ['decoy','frost','gravity'].includes(e.kind)) check('SPELL',e);")
body=body.replace('shots.push({', 'shots.push({ ownerSlot:ci,')
body=body.replace('(spellResources.empowered ? 1.45 : 1)', '(spellResources.empowered && spellResources.points>0 ? 1.45 : 1)')
body=body.replace('let dmg = 9;', 'let dmg = b.damage || 9;')
body=body.replace('const target = def.speed * mult * buffMult;', 'const target = def.speed * mult * buffMult * arena.speedMultiplier(player);')
body=body.replace('damageTower(t, 32, \'RAM\');', "p.data.rammed ||= new Set(); if(p.data.rammed.has(t.id)) continue; p.data.rammed.add(t.id); damageTower(t, 32, 'RAM');")
body=body.replace('if (restOn) cancelRestOnDamage();', 'lastDamage = simT; if (restOn) cancelRestOnDamage();')
body=body.replace('if (restClock >= LONG_REST_TIME) {', 'if (restClock >= LONG_REST_TIME && longRestsLeft > 0) {\n      longRestsLeft--;')
body=body.replace('if (t.hp > 0 && vlen(t.x - x, t.y - y) < r && (!checkSight || !spellSightBlocked({ x, y }, t)))', 'if (t.hp > 0 && vlen(t.x - x, t.y - y) < r && !spellSightBlocked({ x, y }, t))')
body=body.replace('const pt = potionLandingPoint(w);', 'const pt = potionLandingPoint(w); if(spellSightBlocked(player,pt)) return;')
# Source update weapon allows held attack; rest and cast/dodge arbitration stays authoritative.
body=body.replace('if (mouse.down && !player.mode', 'if (!restOn && mouse.down && !mouse.castDown && player.castLock<=0 && !player.mode')
init=s[s.index('    player = {',s.index('  function resetWorld')):s.index('    simT = 0;',s.index('  function resetWorld'))]
header='''import * as D from './combat-data.mjs';
import {solid,moveCircle as geometryMove,lineBlocked} from './physics.mjs';
const {'''+','.join(names)+'''}=D;
export function createCombat(arena,character,x,y){
 let ci=character, slot=0, spell=0, simT=0, player;
 let towers=arena.monsters, allies=[], shots=arena.shots, effects=[], crates=arena.crates, rectangles=arena.rectangles;
 const mines=[];
 let teamAttack=false,weaponSlot=0,weaponStates=weaponCatalog.map(row=>row.map(w=>({ammo:w.mag??-1,reloading:0,special:0}))),weaponFX=[],weaponHold=0,weaponChargeMode=false;
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
 const spawnParticles=()=>{},addTrail=()=>{},addPopup=()=>{};
 let notice='';const showToast=t=>{notice=t;};
 function cancelWeaponHold(){mouse.down=false;weaponHold=0;weaponChargeMode=false;}
 function startRest(){if(restOn||player.mode||player.rec>0||simT-lastDamage<5||arena.monsters.some(m=>m.hp>0&&vlen(m.x-player.x,m.y-player.y)<350))return;restOn=true;restClock=0;cancelWeaponHold();}
 function tickRest(dt){if(!restOn)return;if(moveInput().x||moveInput().y||simT-lastDamage<5||arena.monsters.some(m=>m.hp>0&&vlen(m.x-player.x,m.y-player.y)<350)){restOn=false;restClock=0;return;}restClock=Math.min(4.3,restClock+dt);player.vx=player.vy=0;}
'''
footer='''
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
 function action(v){if(player.hp<=0)return;if(v.action==='weapon')selectWeapon(1-weaponSlot);else if(v.action==='reload')pressReloadOrSpecial();else if(v.action==='dodgeChoice'&&[0,1].includes(v.index))chooseDodge(v.index);else if(v.action==='spell'&&Number.isInteger(v.index)&&book[v.index])spell=v.index;
 else if(v.action==='empower'&&ci===0&&spellResources.points>0)spellResources.empowered=!spellResources.empowered;
 else if(v.action==='slot'&&[1,2].includes(v.level))createSlot(v.level);
 else if(v.action==='convert'&&ci===0&&spellResources.slots[1]>0&&spellResources.points<3){spellResources.slots[1]--;spellResources.points++;}}
 return {player,keys,input,action,get effects(){return effects;},get weaponFX(){return weaponFX;},
 sync(){allies=arena.heroes.filter(h=>h!==player);},
 step(dt){simT+=player.hp<=0?dt:0;if(player.hp<=0){player.respawn-=dt;if(player.respawn<=0){player.hp=100;player.x=arena.entry.x;player.y=arena.entry.y;player.inv=1.5;player.mode=null;player.data={};}return;}
 update(dt);for(const f of effects)f.t-=dt;effects=effects.filter(f=>f.t>0);},
 damage:applyDamageToPlayer,melee:hostileMeleeHit,
 hit(b){if(player.hp<=0)return false;if(absorbEchoProjectile(b))return true;return b.team==='enemy'?hostileBulletCollision(b):friendlyBulletCollision(b);},
 incoming(b){if(player.mode==='shutterArmed'&&detectIncomingShot(player,b))triggerShutter(player,b);},
 snapshot(){return {id:player.id,slot:ci,x:player.x,y:player.y,vx:player.vx,vy:player.vy,hp:player.hp,r:16,aim:rawAim(),mode:player.mode,rec:player.rec,inv:player.inv,respawn:player.respawn,dodgeCD:player.dodgeCD,dodgeTotal:player.dodgeTotal,dodge:slot,weapon:weaponSlot,spell,ammo:weaponStates[ci],resources:spellResources,guard,restClock,shortRestsLeft,longRestsLeft,notice,enchant:player.enchant,potionIdx:player.potionIdx,sneakT:player.sneakT,drone:player.drone,c4:player.c4,ghost:player.data.proj,scope:scopeActive(),speed:defs[ci].speed*arena.speedMultiplier(player)*(hasteT>0?1.22:1)*(player.counterBuffT>0?1.25:1)};}
 };
}
'''
(root/'shared/dungeon/combat.mjs').write_text('// V22.4 mechanics extracted into one isolated controller per server-owned hero.\n'+header+body+init+footer)

(root/'shared/dungeon/motion.mjs').write_text("import {groundMotion,vlen,clamp} from './combat-data.mjs';\nexport function stepMotion(p,ci,input,dt,maximum,precision,angle,effects=[]){const aim=()=>angle;\n"+fn('applyGroundMovement')+'\n'+fn('applyHoverMovement')+"\nif(ci===0)applyHoverMovement(p,input,dt,maximum,precision);else applyGroundMovement(p,ci,input,dt,maximum,precision);\n}\n")
