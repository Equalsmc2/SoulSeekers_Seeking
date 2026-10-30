import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createDungeonService} from '../server/dungeon-service.mjs';
import {validateLoadout} from '../shared/dungeon/loadout.mjs';
import {DungeonMatch} from '../shared/dungeon/match.mjs';
import {fixture} from './dungeon-game.test.mjs';
import {weaponCatalog,defs} from '../shared/dungeon/combat-data.mjs';

class Peer extends EventEmitter{
  constructor(service){super();this.readyState=1;this.out=[];service.attach(this);}
  send(value){this.out.push(JSON.parse(value));}
  write(value){this.emit('message',JSON.stringify(value));}
  last(type){return this.out.filter(v=>v.type===type).at(-1);}
}
test('strict exactly-one loadout validation',()=>{
 for(const bad of [null,{},[],{weapon:0},{dodge:0},{weapon:2,dodge:0},{weapon:0,dodge:2},{weapon:'0',dodge:1},{weapon:NaN,dodge:1}]) assert.throws(()=>validateLoadout(bad));
 assert.deepEqual(validateLoadout({weapon:1,dodge:0,clientHp:90000}),{weapon:1,dodge:0});
});
test('six seats persist unique weapons/dodges, reject mid-match changes and reconnect retains original',()=>{
 let now=1000;const service=createDungeonService({autoTimers:false,logger:{},now:()=>now});const dm=new Peer(service);dm.write({type:'hostRoom'});const code=dm.last('welcome').code,room=service.rooms.get(code),players=[];
 for(let i=0;i<6;i++){
  const p=new Peer(service);p.write({type:'joinParty',code,slot:i,name:'Hero '+i});const token=p.last('welcome').token;
  p.write({type:'setReady',ready:true,seq:1});assert.match(p.last('error').message,/Choose/);
  p.write({type:'setLoadout',loadout:{weapon:i%2,dodge:(i+1)%2},seq:2});assert.equal(room.party[i].loadout.weapon,i%2);
  p.write({type:'setReady',ready:true,seq:3});assert.equal(room.party[i].ready,true);
  players.push({p,token});
 }
 const dungeon=fixture();dungeon.lockDungeon();room.dungeon=dungeon;dm.write({type:'startMatch',seq:4});assert.equal(room.match?.heroes.length,6);
 for(let i=0;i<6;i++){
  const hero=room.match.controllers.get(i).snapshot();assert.equal(hero.weapon,i%2);assert.equal(hero.dodge,(i+1)%2);
  assert.equal(weaponCatalog[i][hero.weapon].name,weaponCatalog[i][i%2].name);
  assert.equal(defs[i].dodge[hero.dodge][0],defs[i].dodge[(i+1)%2][0]);
 }
 players[0].p.write({type:'partyAction',seq:4,action:'weapon'});assert.match(players[0].p.last('error').message,/locked/i);
 players[0].p.write({type:'partyAction',seq:5,action:'dodgeChoice',index:1});assert.match(players[0].p.last('error').message,/locked/i);
 players[0].p.write({type:'setLoadout',seq:6,loadout:{weapon:0,dodge:0}});assert.match(players[0].p.last('error').message,/locked/i);
 assert.equal(room.match.controllers.get(0).snapshot().dodge,1);
 players[0].p.emit('close');const returning=new Peer(service);returning.write({type:'joinParty',code,slot:0,token:players[0].token,loadout:{weapon:0,dodge:0}});assert.equal(returning.last('welcome').roster.find(p=>p.slot===0).loadout.dodge,1);
 assert.equal(room.match.controllers.get(0).snapshot().dodge,1);service.stop();
});
test('server explicitly acknowledges newest input seq without using client positions',()=>{
 const d=fixture();d.lockDungeon();const m=new DungeonMatch(d,[{loadout:{weapon:1,dodge:1}}],1000),p=m.controllers.get(0).player;
 m.input(0,{inputSeq:11,keys:['KeyD'],aimX:400,aimY:0,x:999999,hp:99999},1000);
 assert.equal(m.snapshot('party',0).heroes[0].ackInputSeq,11);
 m.input(0,{inputSeq:10,keys:['KeyA']},1001);assert.deepEqual([...m.controllers.get(0).keys],['KeyD']);
 for(let t=0;t<10;t++)m.tick(1/30,1000+t*33);assert.ok(p.x<300&&p.hp===100);
 m.input(0,{inputSeq:12,keys:[]},1450);assert.equal(m.snapshot('party',0).heroes[0].ackInputSeq,12);
});
