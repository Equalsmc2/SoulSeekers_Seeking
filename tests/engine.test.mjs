import assert from 'node:assert/strict';
import {createGame,tick,spawnEnemy,dmSpawn,addItem,moveInventory,fitsInventory,purchase,playerAction,towerExposed} from '../src/engine.js';
import {HEROES,WORLD,ITEMS,SHOPS} from '../src/data.js';
const check=(name,fn)=>{fn();console.log('✓',name);};
check('Battlefield has 6 heroes, 6 forts and 6 bosses',()=>{
 const g=createGame();assert.equal(g.players.length,6);assert.equal(g.forts.length,6);
 assert.equal(g.enemies.filter(e=>e.kind==='boss').length,6);
 assert.equal(g.chests.length,10);assert.equal(g.towerHp,4200);
 assert.equal(g.time,1200);assert.equal(HEROES.length,6);
});
check('Tower is shielded until 4 forts are destroyed',()=>{
 const g=createGame();assert.equal(towerExposed(g),false);g.stats.forts=3;assert.equal(towerExposed(g),false);
 g.stats.forts=4;assert.equal(towerExposed(g),true);
});
check('Grid inventory enforces shape, rotations and boundaries',()=>{
 const g=createGame();let p=g.players[0];
 assert.equal(addItem(p,'vest'),true);assert.equal(addItem(p,'lens'),true);
 assert.equal(p.inventory[0].x,0);assert.equal(p.inventory[0].y,0);
 assert.equal(fitsInventory(p.inventory,p.inventory[1],0,0),false);
 assert.equal(moveInventory(p,p.inventory[1].id,7,4),false);
 assert.equal(moveInventory(p,p.inventory[1].id,3,0,true),true);
 assert.equal(p.inventory[1].rotated,true);
});
check('Shop purchase requires proximity, gold and open inventory space',()=>{
 const g=createGame(),p=g.players[0];
 assert.equal(purchase(g,0,'bandage').ok,false);
 p.x=SHOPS[0].x;p.y=SHOPS[0].y;
 assert.equal(purchase(g,0,'bandage').ok,true);assert.equal(p.gold,30);
 assert.equal(purchase(g,0,'vest').ok,false);
});
check('Chests open once, award gold and XP',()=>{
 const g=createGame(),p=g.players[0];p.x=g.chests[0].x;p.y=g.chests[0].y;
 const first=playerAction(g,0,{type:'chest'});assert.equal(first.ok,true);assert.equal(p.gold,170);
 assert.equal(playerAction(g,0,{type:'chest'}).ok,false);
});
check('DM summons cost threat and must avoid western spawn and buildings',()=>{
 const g=createGame();assert.equal(dmSpawn(g,0,'grunt',200,350),false);
 assert.equal(dmSpawn(g,0,'brute',750,350),true);assert.equal(Math.floor(g.threat),12);
 assert.equal(dmSpawn(g,0,'brute',800,350),false);
});
check('Match advances, bullets and waves work, and timer gives DM victory',()=>{
 const g=createGame();const t=g.time;tick(g,.05);assert.ok(g.time<t);
 g.time=.01;tick(g,.05);assert.equal(g.status,'finished');assert.equal(g.winner,'dm');
});
check('AI training can reach and destroy the Tower without a human',()=>{
 const g=createGame();for(let i=0;i<24000&&g.status==='running';i++)tick(g,.05);
 assert.equal(g.winner,'party');assert.equal(g.stats.forts,6);
});
console.log('All engine tests passed.');
