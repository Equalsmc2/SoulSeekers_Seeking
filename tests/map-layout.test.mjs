import assert from 'node:assert/strict';
import {WORLD,MAP_X,MAP_FAN,BUILDINGS,SHOPS,CHEST_SPOTS,CONNECTORS,laneY,jungleY,nearestLane} from '../src/data.js';
import {createGame,tick,dmSpawn,spawnEnemy,giveMarchOrder,planMarch} from '../src/engine.js';

const rectDist=(b,p)=>Math.hypot(Math.max(0,b.x-p.x,p.x-b.x-b.w), Math.max(0,b.y-p.y,p.y-b.y-b.h));
assert.equal(MAP_X.length,MAP_FAN.length);
for(let lane=0;lane<3;lane++){
  assert.equal(laneY(WORLD.partyX,lane),1000,'every lane starts at the shared Party center');
  assert.equal(laneY(WORLD.dmX,lane),1000,'every lane ends at the shared DM center');
  for(const x of [1000,1800,2700,3700,4750]){
    assert.ok(Math.abs(laneY(x,lane)-WORLD.lanes[lane])<160,'branches must approach three independent lanes');
  }
}
for(let x=0;x<=WORLD.width;x+=34){
  assert.ok(laneY(x,0)<=laneY(x,1) && laneY(x,1)<=laneY(x,2));
  for(let lane=0;lane<3;lane++){
    const p={x,y:laneY(x,lane)};
    const blocker=BUILDINGS.find(b=>rectDist(b,p)<42);
    assert.equal(blocker,undefined,`Blocked lane ${lane} at x=${x}`);
  }
}
for(const shop of SHOPS)assert.ok(BUILDINGS.every(b=>rectDist(b,shop)>72),'shop interaction radius must not be blocked');
for(const chest of CHEST_SPOTS)assert.ok(BUILDINGS.every(b=>rectDist(b,chest)>34),'chest must be reachable');
for(const x of CONNECTORS){
  assert.ok(x>600&&x<WORLD.dmX);
  const j=jungleY(x,0);
  assert.equal(nearestLane(x,laneY(x,0)),0);
  assert.ok(laneY(x,0)<=j && j<=laneY(x,1));
}
const g=createGame();
for(const f of g.forts){
  assert.equal(f.y,laneY(f.x,f.lane),'fort matches curved route');
  const b=g.enemies.find(e=>e.id===f.bossId);
  assert.ok(b&&Math.hypot(b.x-f.x,b.y-f.y)<145,'boss near its own fort');
}
for(const p of g.players)assert.ok(Math.abs(p.y-1000)<90,'six players start in the central staging area');
for(let i=0;i<6;i++)assert.equal(g.players[i].lane,i%3);
for(let l=0;l<3;l++){const n=g.enemies.length;assert.equal(dmSpawn(g,l,'grunt',6000,laneY(6000,l)),true);assert.equal(g.enemies.length,n+1);g.threat=42;}
for(let i=0;i<24000&&g.status==='running';i++)tick(g,.05);
assert.equal(g.winner,'party','offline AI navigates the whole three-lane map and wins');
assert.equal(g.stats.forts,6);
// Cross-map DM orders must actually travel through the shortcut network.
const from={x:5500,y:laneY(5500,2)},to={x:1600,y:laneY(1600,0)};
const planned=planMarch(from,to);
assert.ok(planned.length>15,'long orders use intermediate waypoints');
assert.ok(planned.some(p=>CONNECTORS.includes(p.x)&&p.y===jungleY(p.x,0)),'march crosses the upper jungle');
const march=createGame();march.players=[];march.enemies=[];march.waveIn=1e6;
spawnEnemy(march,2,'grunt',from.x,from.y);
const unit=march.enemies[0];giveMarchOrder(unit,to.x,to.y);
for(let n=0;n<2600&&unit.nav?.length;n++)tick(march,.0333);
assert.ok(!unit.nav?.length,'cross-map march reaches the destination');
assert.ok(Math.hypot(unit.x-to.x,unit.y-to.y)<30,'unit did not get trapped in a block');
console.log('✓ R03 all three lanes start/end together, split visibly, and remain collision-clear');
console.log('✓ 6 forts, bosses, 2 shops, 10 chests and cross-town links remain accessible');
console.log('✓ DM marching orders traverse cross-town paths without wall traps');
console.log('✓ Enemy deployment follows curved lane geometry; AI can complete the map');
