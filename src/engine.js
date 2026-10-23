import { WORLD, MATCH_SECONDS, HEROES, ITEMS, BUILDINGS, SHOPS, CHEST_SPOTS, clamp, dist, makeId } from './data.js?v=R021';
const INV_W=8, INV_H=5;
const shortest=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function fitsInventory(inv, item, x, y, rotated=false, except=null) {
  const def=ITEMS[item.type]; if(!def) return false;
  const w=rotated?def.h:def.w, h=rotated?def.w:def.h;
  if(x<0||y<0||x+w>INV_W||y+h>INV_H) return false;
  return !inv.some(other => {
    if(other.id===except) return false;
    const d=ITEMS[other.type], ow=other.rotated?d.h:d.w, oh=other.rotated?d.w:d.h;
    return x<other.x+ow && x+w>other.x && y<other.y+oh && y+h>other.y;
  });
}
export function addItem(p, type) {
  if(!ITEMS[type]) return false;
  for(let y=0;y<INV_H;y++) for(let x=0;x<INV_W;x++){
    const item={id:makeId('i'),type,x,y,rotated:false};
    if(fitsInventory(p.inventory,item,x,y)) {p.inventory.push(item);return true;}
  }
  return false;
}
export function moveInventory(p,id,x,y,rotate=false){
  const item=p.inventory.find(v=>v.id===id);if(!item)return false;
  const rotated=rotate?!item.rotated:item.rotated;
  if(!fitsInventory(p.inventory,item,x,y,rotated,id))return false;
  item.x=x;item.y=y;item.rotated=rotated;return true;
}
const maxHP=p=>145+p.level*15+(p.inventory.some(i=>i.type==='vest')?45:0);
const speed=p=>235*(p.inventory.some(i=>i.type==='boots')?1.18:1);
const bulletDamage=p=>(16+p.level*3)*(p.inventory.some(i=>i.type==='lens')?1.25:1);

export function createGame() {
  const g={version:1,status:'running',time:MATCH_SECONDS,winner:null,elapsed:0,waveIn:9,threat:42,towerHp:4200,towerMaxHp:4200,
    players:[],enemies:[],forts:[],bullets:[],chests:CHEST_SPOTS.map((v,i)=>({...v,id:`chest_${i}`,opened:false})),
    effects:[],log:['The crossing begins. Advance toward the DM Tower.'],lastActions:{},stats:{kills:0,forts:0}};
  for(let i=0;i<6;i++){
    const lane=i%3, px=WORLD.partyX+(Math.floor(i/3)*28),py=WORLD.lanes[lane]+(i>=3?48:-48);
    g.players.push({id:`hero_${i}`,slot:i,hero:i,x:px,y:py,spawnX:px,spawnY:py,lane,r:19,hp:160,maxHp:160,level:1,xp:0,gold:80,kills:0,deaths:0,inventory:[],spells:['q'],atkCd:0,abilityCd:0,echoCd:0,dashCd:0,respawn:0,dir:0});
  }
  for(let lane=0;lane<3;lane++)for(let tier=0;tier<2;tier++){
    const x=tier===0?2750:4740,y=WORLD.lanes[lane], id=`fort_${lane}_${tier}`,bid=`boss_${lane}_${tier}`;
    g.forts.push({id,lane,tier,x,y,hp:1600,maxHp:1600,broken:false,bossId:bid,shotCd:1.2});
    g.enemies.push({id:bid,kind:'boss',lane,x:x-80,y:y+60,r:31,hp:1600,maxHp:1600,damage:16,speed:88,range:135,atkCd:.5,homeX:x-80,homeY:y+60,possessed:false});
  }
  return g;
}

function collideCircleRect(x,y,r,rect) {
  const xx=clamp(x,rect.x,rect.x+rect.w),yy=clamp(y,rect.y,rect.y+rect.h);
  return (x-xx)**2+(y-yy)**2 < r*r;
}
function moveUnit(e, dx, dy,dt, spd){
  const oldX=e.x,oldY=e.y;
  e.x=clamp(e.x+dx*spd*dt,e.r+12,WORLD.width-e.r-12);
  if(BUILDINGS.some(b=>collideCircleRect(e.x,e.y,e.r,b)))e.x=oldX;
  e.y=clamp(e.y+dy*spd*dt,e.r+12,WORLD.height-e.r-12);
  if(BUILDINGS.some(b=>collideCircleRect(e.x,e.y,e.r,b)))e.y=oldY;
}
function nearest(from, objects, radius=Infinity, filter=()=>true){let best=null,d=radius;for(const o of objects){if(!filter(o))continue;const s=dist(from,o);if(s<d){d=s;best=o;}}return best;}
function effect(g,x,y,type='hit'){g.effects.push({id:makeId('fx'),x,y,type,ttl:.38});}
function spawnBullet(g, shooter, tx,ty, team, damage, color,range=560){
  const d=Math.hypot(tx-shooter.x,ty-shooter.y)||1;
  g.bullets.push({id:makeId('b'),x:shooter.x,y:shooter.y,vx:(tx-shooter.x)/d*820,vy:(ty-shooter.y)/d*820,life:range/820,team,damage,r:team==='party'?5:6,color});
}
function damagePlayer(g,p,damage) {
  if(p.respawn>0 || p.hp<=0)return;
  p.hp=Math.max(0,p.hp-damage);effect(g,p.x,p.y,'hurt');
  if(p.hp===0){p.deaths++;p.respawn=8;g.log.unshift(`${HEROES[p.hero].name} fell — redeploying in 8 seconds.`);}
}
function damageEnemy(g,e,d,source=null){
  if(e.hp<=0)return;
  e.hp=Math.max(0,e.hp-d);effect(g,e.x,e.y);
  if(e.hp===0){
    if(source){source.kills++;source.gold+=e.kind==='boss'?160:e.kind==='brute'?45:24;source.xp+=e.kind==='boss'?110:e.kind==='brute'?32:20;g.stats.kills++;}
    if(e.kind==='boss')g.log.unshift(`BOSS DEFEATED: Fort ${e.lane+1}-${e.id.slice(-1)} is exposed.`);
  }
}
function handleXp(p){while(p.xp >= p.level*90){p.xp-=p.level*90;p.level++;p.maxHp=maxHP(p);p.hp=Math.min(p.maxHp,p.hp+70);}}
function damageFort(g,f,d,source){
  if(f.broken||g.enemies.find(e=>e.id===f.bossId&&e.hp>0))return;
  f.hp=Math.max(0,f.hp-d);effect(g,f.x,f.y,'stone');
  if(f.hp===0){f.broken=true;g.stats.forts++;if(source){source.gold+=120;source.xp+=100;}g.log.unshift(`FORT FALLEN: ${f.lane+1}-${f.tier+1}.`);}
}
function shootParty(g,p,tx,ty){
  if(p.atkCd>0||p.hp<=0)return;
  const shotColor=HEROES[p.hero].color;
  spawnBullet(g,p,tx,ty,'party',bulletDamage(p),shotColor);
  p.atkCd=.22;
}
function useAbility(g,p,kind='q'){
  if(p.hp<=0)return false;
  const isEcho=kind==='e';
  if(isEcho && (!p.spells.includes('e')||p.echoCd>0))return false;
  if(!isEcho && p.abilityCd>0)return false;
  const radius=isEcho?235:175,damage=isEcho?95:64+p.level*7;
  for(const e of g.enemies)if(e.hp>0&&dist(e,p)<radius)damageEnemy(g,e,damage,p);
  for(const f of g.forts)if(!f.broken&&dist(f,p)<radius)damageFort(g,f,damage*.45,p);
  if(dist(p,{x:WORLD.dmX,y:1000})<radius)hitTower(g,damage*.4);
  effect(g,p.x,p.y,isEcho?'nova':'ability');
  if(isEcho)p.echoCd=17;else p.abilityCd=7;
  return true;
}
function hitTower(g,d){if(g.status!=='running')return;
  if(g.stats.forts<4)return;
  g.towerHp=Math.max(0,g.towerHp-d);
  if(g.towerHp===0){g.status='finished';g.winner='party';g.log.unshift('DM TOWER DESTROYED — SOULSEEKERS WIN.');}
}
export function purchase(g,slot,type){
  const p=g.players[slot],item=ITEMS[type];if(!p||!item)return {ok:false,msg:'Unknown item.'};
  if(!SHOPS.some(s=>dist(s,p)<175))return {ok:false,msg:'Get closer to a jungle shop.'};
  if(p.gold<item.price)return {ok:false,msg:'Not enough gold.'};
  if(!addItem(p,type))return {ok:false,msg:'Inventory full. Repack your equipment.'};
  p.gold-=item.price;
  if(type==='vest'){p.maxHp=maxHP(p);p.hp+=45;}
  if(type==='spell')p.spells=['q','e'];
  return {ok:true,msg:`Purchased ${item.name}.`};
}
export function useItem(g,slot,itemId){
  const p=g.players[slot],item=p?.inventory.find(i=>i.id===itemId);if(!item)return {ok:false,msg:'Item not found.'};
  if(item.type!=='bandage'&&item.type!=='battery')return {ok:false,msg:'Passive equipment stays equipped.'};
  if(p.hp<=0)return {ok:false,msg:'Cannot use while defeated.'};
  p.hp=Math.min(p.maxHp,p.hp+(item.type==='bandage'?50:60));
  p.inventory=p.inventory.filter(i=>i!==item);return {ok:true,msg:'Used restorative item.'};
}
export function openChest(g,slot){
  const p=g.players[slot];if(!p||p.hp<=0)return {ok:false,msg:'Unavailable.'};
  const chest=nearest(p,g.chests,90,c=>!c.opened);
  if(!chest)return {ok:false,msg:'No unopened chest nearby.'};
  chest.opened=true;p.gold+=90;p.xp+=55;effect(g,chest.x,chest.y,'loot');g.log.unshift(`${HEROES[p.hero].name} uncovered 90 gold.`);
  return {ok:true,msg:'+90 gold / +55 XP'};
}
export function playerAction(g,slot,action){
  if(!action)return null;
  if(action.type==='buy')return purchase(g,slot,action.item);
  if(action.type==='chest')return openChest(g,slot);
  if(action.type==='item')return useItem(g,slot,action.id);
  if(action.type==='moveItem'){
    const p=g.players[slot];
    const ok=moveInventory(p,action.id,Math.floor(action.x),Math.floor(action.y),!!action.rotate);
    return {ok,msg:ok?'Inventory rearranged.':'That placement does not fit.'};
  }
  return {ok:false,msg:'Unknown command.'};
}
export function spawnEnemy(g,lane=1,kind='grunt',x=6120,yOverride=null){
  const specs={grunt:{hp:80,damage:8,speed:105,range:100,r:15},brute:{hp:195,damage:19,speed:72,range:95,r:22},sniper:{hp:75,damage:14,speed:75,range:290,r:14}};
  if(!specs[kind]||lane<0||lane>2)return false;
  const s=specs[kind],y=yOverride===null?WORLD.lanes[lane]+(Math.random()-.5)*145:yOverride;
  g.enemies.push({id:makeId(kind),kind,lane,x,y,r:s.r,hp:s.hp,maxHp:s.hp,damage:s.damage,speed:s.speed,range:s.range,atkCd:Math.random()*.5,homeX:x,homeY:y,possessed:false});return true;
}
export function dmSpawn(g,lane,kind,x=6120,y=null){
  if(g.status!=='running')return false;
  const price={grunt:12,brute:30,sniper:24}[kind];if(!price||g.threat<price)return false;
  const yy=y===null?WORLD.lanes[lane]:y;
  if(x<650||x>WORLD.width-40||yy<40||yy>WORLD.height-40)return false;
  if(BUILDINGS.some(b=>collideCircleRect(x,yy,30,b)))return false;
  g.threat-=price;return spawnEnemy(g,lane,kind,x,yy);
}
export function fireEnemy(g,e,tx,ty){if(e.atkCd>0||e.hp<=0)return;
  spawnBullet(g,e,tx,ty,'dm',e.damage,e.kind==='boss'?'#ffac6e':'#ef7f8f',e.range+65);e.atkCd=e.kind==='sniper'?1.9:e.kind==='boss'?.65:1.1;
}
function updateBullets(g,dt){
  for(const b of g.bullets){if(b.life<=0)continue;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(BUILDINGS.some(o=>collideCircleRect(b.x,b.y,b.r,o))){b.life=0;effect(g,b.x,b.y,'stone');continue;}
    if(b.team==='party'){
      const e=nearest(b,g.enemies,22,e=>e.hp>0);if(e){damageEnemy(g,e,b.damage,g.players[b.slot]);b.life=0;continue;}
      const f=nearest(b,g.forts,39,f=>!f.broken);if(f){damageFort(g,f,b.damage,g.players[b.slot]);b.life=0;continue;}
      if(dist(b,{x:WORLD.dmX,y:1000})<65){hitTower(g,b.damage);b.life=0;continue;}
    }else{
      const p=nearest(b,g.players,22,p=>p.hp>0);if(p){damagePlayer(g,p,b.damage);b.life=0;continue;}
    }
  }
  g.bullets=g.bullets.filter(b=>b.life>0);
}
function aiPlayer(g,p,dt){
  if(p.hp<=0)return;
  const target=nearest(p,g.enemies,310,e=>e.hp>0) || nearest(p,g.forts,500,f=>!f.broken);
  const xGoal=target?.x??(g.stats.forts>=4?WORLD.dmX:Math.min(WORLD.dmX-130,p.x+240));
  const yGoal=target?.y??WORLD.lanes[p.lane];
  const vx=xGoal-p.x,vy=yGoal-p.y,d=Math.hypot(vx,vy)||1;
  if(d>175)moveUnit(p,vx/d,vy/d,dt,speed(p)*.73);
  if(target && d<490){const pre=g.bullets.length;shootParty(g,p,target.x,target.y);for(let i=pre;i<g.bullets.length;i++)g.bullets[i].slot=p.slot;}
  if(!target&&g.stats.forts>=4&&dist(p,{x:WORLD.dmX,y:1000})<500){const pre=g.bullets.length;shootParty(g,p,WORLD.dmX,1000);for(let i=pre;i<g.bullets.length;i++)g.bullets[i].slot=p.slot;}
  if(p.hp<60&&p.abilityCd<=0&&nearest(p,g.enemies,150,e=>e.hp>0))useAbility(g,p);
}
function updateEnemies(g,dt,dmInput){
  for(const e of g.enemies){if(e.hp<=0)continue;
    e.atkCd=Math.max(0,e.atkCd-dt);
    if(dmInput?.possess===e.id){
      const {mx=0,my=0,aimX=e.x-90,aimY=e.y,fire=false}=dmInput;
      const n=Math.hypot(mx,my)||1;moveUnit(e,mx/n,my/n,dt,e.speed*1.55);
      if(fire)fireEnemy(g,e,aimX,aimY);
      continue;
    }
    const target=nearest(e,g.players,e.kind==='boss'?440:420,p=>p.hp>0);
    if(target){const d=dist(e,target);if(d>e.range*.8){moveUnit(e,(target.x-e.x)/d,(target.y-e.y)/d,dt,e.speed);}if(d<e.range+35)fireEnemy(g,e,target.x,target.y);}
    else if(e.kind!=='boss'&&Number.isFinite(e.orderX)&&Number.isFinite(e.orderY)){
      const d=dist(e,{x:e.orderX,y:e.orderY});
      if(d>30)moveUnit(e,(e.orderX-e.x)/d,(e.orderY-e.y)/d,dt,e.speed);
      else {delete e.orderX;delete e.orderY;}
    }else if(e.kind==='boss'){
      const d=Math.hypot(e.homeX-e.x,e.homeY-e.y);if(d>35)moveUnit(e,(e.homeX-e.x)/d,(e.homeY-e.y)/d,dt,e.speed);
    }else{
      const dest={x:WORLD.partyX+10,y:WORLD.lanes[e.lane]},d=dist(e,dest);
      if(d>45)moveUnit(e,(dest.x-e.x)/d,(dest.y-e.y)/d,dt,e.speed*.67);
    }
  }
  g.enemies=g.enemies.filter(e=>e.hp>0);
}
function updateForts(g,dt){
  for(const f of g.forts){if(f.broken)continue;
    f.shotCd=Math.max(0,f.shotCd-dt);
    const p=nearest(f,g.players,240,p=>p.hp>0);
    if(p&&f.shotCd===0){spawnBullet(g,f,p.x,p.y,'dm',12,'#f4a689',370);f.shotCd=1.15;}
  }
}
function updateHumans(g,dt,inputs){
  for(const p of g.players){p.atkCd=Math.max(0,p.atkCd-dt);p.abilityCd=Math.max(0,p.abilityCd-dt);p.echoCd=Math.max(0,p.echoCd-dt);p.dashCd=Math.max(0,p.dashCd-dt);
    if(p.respawn>0){p.respawn-=dt;if(p.respawn<=0){p.respawn=0;p.x=p.spawnX;p.y=p.spawnY;p.hp=p.maxHp;}continue;}
    p.maxHp=maxHP(p);p.hp=Math.min(p.maxHp,p.hp+1.8*dt);
    const h=inputs[p.slot];
    if(!h){aiPlayer(g,p,dt);handleXp(p);continue;}
    const mx=clamp(Number(h.mx)||0,-1,1),my=clamp(Number(h.my)||0,-1,1),n=Math.hypot(mx,my)||1;
    moveUnit(p,mx/n,my/n,dt,speed(p)*(h.dash&&p.dashCd<=0?3.5:1));
    if(h.dash&&p.dashCd<=0)p.dashCd=5;
    if(h.fire){const pre=g.bullets.length;shootParty(g,p,h.aimX??p.x+40,h.aimY??p.y);for(let i=pre;i<g.bullets.length;i++)g.bullets[i].slot=p.slot;}
    if(h.ability)useAbility(g,p,'q');if(h.echo)useAbility(g,p,'e');
    if(h.action && (h.actionSeq||0)>(g.lastActions[p.slot]||0)){
      g.lastActions[p.slot]=h.actionSeq;const result=playerAction(g,p.slot,h.action);if(result)g.log.unshift(`${HEROES[p.hero].name}: ${result.msg}`);
    }
    handleXp(p);
  }
}
export function tick(g,dt,inputs={},dmInput=null){
  if(g.status!=='running')return;
  dt=clamp(dt,0,.08);g.time-=dt;g.elapsed+=dt;g.threat=Math.min(100,g.threat+dt*1.2);
  if(g.time<=0){g.time=0;g.status='finished';g.winner='dm';g.log.unshift('THE CLOCK EXPIRED — THE DUNGEON MASTER WINS.');return;}
  g.waveIn-=dt;if(g.waveIn<=0){g.waveIn=16;for(let lane=0;lane<3;lane++){
    if(g.enemies.filter(e=>e.kind!=='boss').length<115){spawnEnemy(g,lane,'grunt',6120);spawnEnemy(g,lane,'grunt',6070);}
  }}
  updateHumans(g,dt,inputs);updateEnemies(g,dt,dmInput);updateForts(g,dt);updateBullets(g,dt);
  for(const fx of g.effects)fx.ttl-=dt;g.effects=g.effects.filter(f=>f.ttl>0);
  g.log=g.log.slice(0,8);
}
export function serialize(g){return JSON.parse(JSON.stringify(g));}
export function teamHasShop(p){return SHOPS.some(s=>dist(s,p)<175);}
export function towerExposed(g){return g.stats.forts>=4;}
