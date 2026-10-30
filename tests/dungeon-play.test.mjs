import assert from 'node:assert/strict';
import {DungeonRuntime} from '../shared/dungeon/runtime.mjs';
import {HEROES,MONSTERS} from '../shared/combat/loadouts.mjs';
import {DungeonSession} from '../shared/dungeon/session.mjs';
import {createDungeonService} from '../server/dungeon-service.mjs';
import {EventEmitter} from 'node:events';
const board={'0,0':{id:'entry',rot:0,soul:false,tarot:null,camp:null}};
for(let i=1;i<=7;i++)board[`${i},0`]={id:'cross',rot:0,soul:true,tarot:null,camp:i===1?{id:'H2',kind:'poker',uid:'camp'}:null};
let now=200000;
const rt=new DungeonRuntime(board,{now:()=>now});
assert.equal(rt.snapshot('party',0).board['1,0'],undefined,'unexplored rooms hidden');
assert.equal(rt.snapshot('dm').roomCount,8,'DM sees all rooms');
assert.equal(rt.walkable(470,200),false,'non-door section of wall blocks collision');
assert.equal(rt.walkable(470,0),true,'door passage is traversable');
assert.equal(rt.walkable(500,0),true,'matching adjoining room door works');
assert.equal(rt.walkable(8000,0),false,'cannot leave placed room graph');
rt.addPlayer(0);rt.addPlayer(1);assert.equal(rt.players[0].name,'ASYA');assert.equal(HEROES.length,6);assert.equal(Object.keys(MONSTERS).length,4);
const player=rt.players[0],startX=player.x;
rt.input(0,{inputSeq:1,x:1,y:0,interact:false,aimX:500,aimY:0});
for(let i=0;i<175;i++)rt.update(1/30);
assert.ok(player.x>startX+500,'server moves hero through valid doors');assert.ok(rt.snapshot('party',0).board['1,0'],'exploration reveals actual traversed room');
const oldX=player.x;rt.input(0,{inputSeq:1,x:-1,y:0});rt.update(1/30);assert.ok(player.x>=oldX,'duplicate input sequence ignored');
rt.input(0,{inputSeq:2,x:10000,y:10000});assert.notEqual(rt.inputs[0].seq,2,'unsafe input rejected');
// Collect seven real server-owned soul entities and return to the Entrance.
for(let i=1;i<=7;i++){
 player.x=i*960;player.y=200;rt.input(0,{inputSeq:10+i,x:0,y:0,interact:true,aimX:player.x,aimY:player.y});rt.update(1/30);
 assert.equal(rt.souls.size,i);
}
player.x=0;player.y=0;rt.input(0,{inputSeq:18,x:0,y:0,interact:true,aimX:0,aimY:0});rt.update(1/30);
assert.match(rt.result,/PARTY WIN/);
// Run camp state transitions in a fresh runtime (cannot keep playing a finished match).
const camp=new DungeonRuntime(board,{now:()=>now});camp.addPlayer(0);let c=camp.camps['1,0'];let p=camp.players[0];p.x=c.x;p.y=c.y;
camp.input(0,{inputSeq:1,x:0,y:0,interact:true,aimX:p.x,aimY:p.y});for(let i=0;i<82;i++)camp.update(1/30);
assert.equal(c.owner,'dm','capture requires full hold duration');for(let i=0;i<15;i++)camp.update(1/30);assert.equal(c.owner,'party','holding F near camp seals it');
const count=camp.monsters.length;for(let i=0;i<700;i++)camp.update(1/30);assert.equal(camp.monsters.length,count,'sealed camp never creates Party monsters or enemies');
p.x=0;p.y=0;camp.input(0,{inputSeq:2,x:0,y:0,interact:false,aimX:0,aimY:0});let minion=camp.summon('grunt',c.x,c.y);camp.dmAction('dmOrder',{monsterId:minion.id,order:'capture',key:'1,0'});for(let i=0;i<110;i++)camp.update(1/30);
assert.equal(c.owner,'dm','DM monster recaptures sealed camp');for(let i=0;i<130;i++)camp.update(1/30);assert.ok(camp.monsters.length>=2,'DM recapture resumes hostile spawn');
// Basic weapons, line of sight, ammo, spell-slot and cooldown validation.
const combat=new DungeonRuntime(board,{now:()=>now});const hero=combat.addPlayer(0);hero.x=0;hero.y=0;
const target=combat.summon('brute',240,0);combat.partyAction(0,'partyAttack',{aimX:240,aimY:0});assert.ok(target.hp<target.maxHp);
assert.equal(hero.ammo[0],1,'server consumes weapon magazine');
combat.partyAction(0,'partyWeapon',{index:1});assert.equal(hero.weapon,1);
combat.partyAction(0,'partyDodgeSelect',{index:1});assert.equal(hero.dodge,1);
assert.throws(()=>combat.partyAction(0,'partyCast',{index:4,aimX:100000,aimY:0}),/Invalid aim/);
for(let i=0;i<30;i++)combat.update(1/30);const beforeSlots=hero.spellSlots[1];assert.throws(()=>combat.partyAction(0,'partyCast',{index:4,aimX:1200,aimY:0}),/Out of range/);
assert.equal(hero.spellSlots[1],beforeSlots,'out-of-range spell must not spend resources');
// Make sure expiry is derived from the Node clock, not a browser-sent timer.
now+=40*60*1000+10;const expires=new DungeonRuntime(board,{now:()=>now});now+=40*60*1000+2;expires.update(1/30);assert.match(expires.result,/DM WIN/);
// Validate network authorization and game phase transitions at transport boundary.
class Fake extends EventEmitter{constructor(s){super();this.readyState=1;this.packets=[];s.attach(this);}send(data){this.packets.push(JSON.parse(data));}write(x){this.emit('message',JSON.stringify(x));}last(t){return this.packets.filter(p=>p.type===t).at(-1);}close(){this.readyState=3;this.emit('close');}}
const svc=createDungeonService({autoTimers:false,now:()=>now,logger:{info(){}}});try{
 const dm=new Fake(svc);dm.write({type:'hostRoom'});const code=dm.last('welcome').code,room=svc.rooms.get(code);
 const party=new Fake(svc);party.write({type:'joinParty',code,slot:0});
 party.write({type:'startMatch',seq:1});assert.match(party.last('error').message,/Dungeon Master/);
 dm.write({type:'startMatch',seq:1});assert.match(dm.last('error').message,/Lock/);
 room.dungeon.board=structuredClone(board);room.dungeon.lockDungeon();
 dm.write({type:'startMatch',seq:2});assert.equal(dm.last('ack').seq,2);assert.equal(room.dungeon.phase,'ACTIVE');
 assert.equal(party.last('state').state.board,undefined);
 assert.equal(party.last('state').world.board['1,0'],undefined,'unvisited room hidden from Party');
 party.write({type:'dmSummon',seq:2,unit:'grunt',x:80,y:80});assert.match(party.last('error').message,/Dungeon Master/);
 dm.write({type:'partyWeapon',seq:3,index:1});assert.match(dm.last('error').message,/Party/);
 dm.write({type:'dmSummon',seq:4,unit:'grunt',x:120,y:0});assert.equal(room.runtime.monsters.length,1);
 dm.write({type:'dmSummon',seq:4,unit:'grunt',x:220,y:0});assert.equal(room.runtime.monsters.length,1,'duplicate summon cannot spend threat');
 party.write({type:'partyWeapon',seq:3,index:1});assert.equal(room.runtime.players[0].weapon,1);
 party.write({type:'playerInput',inputSeq:5,x:1,y:0,aimX:300,aimY:0});const x=room.runtime.players[0].x;svc.step();assert.ok(room.runtime.players[0].x>x);
 party.close();dm.close();
}finally{svc.stop();}
console.log('✓ M2 runtime: movement, privacy, 7-soul victory, expiry, camp sealing/recapture, combat/authorization');
