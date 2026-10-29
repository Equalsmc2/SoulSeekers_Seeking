import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {DungeonSession} from '../shared/dungeon/session.mjs';
import {createDungeonService} from '../server/dungeon-service.mjs';
import {ROOM_COUNTS,DEAL,ROOM_LOOKUP,doors,connected,mayPlace,dungeonValidation,xy,coords,pokerInfo,TAROT} from '../shared/dungeon/rules.mjs';
class Client extends EventEmitter{constructor(s){super();this.readyState=1;this.packets=[];s.attach(this);}send(raw){this.packets.push(JSON.parse(raw));}write(data){this.emit('message',JSON.stringify(data));}latest(type){return this.packets.filter(p=>p.type===type).at(-1);}close(){this.readyState=3;this.emit('close');}}
const dmSession=new DungeonSession({random:n=>0});
assert.equal(Object.values(ROOM_COUNTS).reduce((a,b)=>a+b,0),40);
assert.deepEqual(Object.fromEntries(Object.entries(dmSession.hand).map(([k,a])=>[k,a.length])),DEAL);
assert.equal(dmSession.deck.room.length,24);assert.equal(dmSession.deck.tarot.length,17);assert.equal(dmSession.deck.poker.length,46);
assert.equal(dmSession.redrawCredits,8);assert.equal(Object.keys(dmSession.board).length,0);
assert.equal(dmSession.snapshot('party').board,undefined);assert.equal(dmSession.snapshot('party').hand,undefined);
assert.equal(pokerInfo('SA').monster,'stalker');assert.equal(pokerInfo('H2').tier,1);assert.equal(TAROT.length,22);
const entrance=dmSession.hand.room.find(c=>c.id==='entry');
assert.throws(()=>dmSession.placeRoom({cardUid:dmSession.hand.room.find(c=>c.id!=='entry').uid,x:0,y:0}),/Entrance/);
dmSession.placeRoom({cardUid:entrance.uid,x:0,y:0});
assert.equal(dmSession.hand.room.length,15);assert.equal(dmSession.deck.room.length,24,'no free card drawn');
assert.equal(dmSession.board['0,0'].cardUid,entrance.uid);
const available=dmSession.hand.room.find(c=>c.id!=='entry');
const handCopy=dmSession.hand.room.length;
assert.throws(()=>dmSession.placeRoom({cardUid:available.uid,x:25,y:25}),/connect/i);
assert.equal(dmSession.hand.room.length,handCopy);
const batch=dmSession.hand.room.filter(c=>c.id!=='entry').slice(0,3).map(c=>({kind:'room',cardUid:c.uid}));
const oldCards=batch.map(s=>s.cardUid);dmSession.rerollSelected({selections:batch});
assert.equal(dmSession.redrawCredits,5);assert.equal(dmSession.hand.room.length,handCopy);assert.equal(dmSession.discard.room.length,3);
assert.equal(dmSession.deck.room.length,21);assert.ok(oldCards.every(uid=>!dmSession.hand.room.some(c=>c.uid===uid)));
assert.throws(()=>dmSession.undoRoom(),/No edit/, 'rerolls cannot be undone');
assert.throws(()=>dmSession.rerollSelected({selections:[...batch,batch[0]]}),/one to three/);
assert.throws(()=>dmSession.rerollSelected({selections:[batch[0]]}),/not in your hand/);
const tar=dmSession.hand.tarot[0];dmSession.applyTarot({cardUid:tar.uid,key:'0,0'});assert.equal(dmSession.board['0,0'].tarot.uid,tar.uid);
dmSession.undoRoom();assert.equal(dmSession.board['0,0'].tarot,null);assert.ok(dmSession.hand.tarot.some(c=>c.uid===tar.uid));
assert.throws(()=>dmSession.placeCamp({cardUid:dmSession.hand.poker[0].uid,key:'0,0'}),/non-Entrance/);
assert.throws(()=>dmSession.placeSoul({key:'0,0'}),/non-Entrance/);
assert.throws(()=>dmSession.lockDungeon(),/seven souls/i);
// Place seven extra rooms and exactly seven souls, testing real per-card doorway geometry.
function findPlacement(s){const board=s.board;for(const card of s.hand.room){for(let turn=0;turn<4;turn++){const copy={...card,rot:(card.rot+turn)%4};for(const key of Object.keys(board)){const [x,y]=coords(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(!mayPlace(board,x+dx,y+dy,copy))return {card,x:x+dx,y:y+dy,turn};}}}}return null;}
let made=0;for(let j=0;j<7;j++){
 let pick=findPlacement(dmSession);assert.ok(pick,'source-hand room should connect to reachable layout');
 for(let r=0;r<pick.turn;r++)dmSession.rotateCard({cardUid:pick.card.uid});
 dmSession.placeRoom({cardUid:pick.card.uid,x:pick.x,y:pick.y});
 dmSession.placeSoul({key:xy(pick.x,pick.y)});made++;
}
assert.equal(made,7);assert.equal(connected(dmSession.board).size,8);assert.ok(dungeonValidation(dmSession.board).ready);
assert.equal(dmSession.hand.room.length,8);dmSession.lockDungeon();assert.equal(dmSession.phase,'LOCKED');
assert.throws(()=>dmSession.removeRoom({key:'0,0'}),/BUILD/);dmSession.unlockDungeon();assert.equal(dmSession.phase,'BUILD');
// Transport-level tests: all seven clients share state, DM-only actions, state hidden from Party.
const now={value:5000};const srv=createDungeonService({autoTimers:false,now:()=>now.value,logger:{info(){}}});
try{
 const dm=new Client(srv);dm.write({type:'hostRoom'});const w=dm.latest('welcome');assert.match(w.code,/^[A-HJ-NP-Z2-9]{6}$/);
 assert.equal(w.state.phase,'BUILD');assert.equal(Object.keys(w.state.board).length,0);
 const party=Array.from({length:6},(_,slot)=>{const c=new Client(srv);c.write({type:'joinParty',code:w.code,slot,name:`Player${slot}`});return c;});
 assert.equal(dm.latest('state').roster.length,6);
 for(const [slot,p] of party.entries()){const join=p.latest('welcome');assert.equal(join.slot,slot);assert.equal(join.state.board,undefined);assert.equal(join.state.hand,undefined);assert.equal(JSON.stringify(p.packets).includes(w.token),false);}
 const intruder=new Client(srv);intruder.write({type:'joinParty',code:w.code,slot:0,name:'Bad'});assert.match(intruder.latest('error').message,/reserved/);
 const original=srv.rooms.get(w.code).dungeon;
 const card=original.hand.room.find(c=>c.id==='entry');
 party[0].write({type:'placeRoom',seq:1,cardUid:card.uid,x:0,y:0});assert.match(party[0].latest('error').message,/Dungeon Master/);assert.equal(Object.keys(original.board).length,0);
 dm.write({type:'placeRoom',seq:1,cardUid:card.uid,x:0,y:0});assert.equal(Object.keys(original.board).length,1);
 dm.write({type:'placeRoom',seq:1,cardUid:card.uid,x:1,y:0});assert.equal(dm.latest('ack').duplicate,true);assert.equal(Object.keys(original.board).length,1);
 dm.write({type:'placeSoul',seq:2,key:'0,0'});assert.match(dm.latest('error').message,/non-Entrance/);
 dm.write({type:'lockDungeon',seq:3});assert.match(dm.latest('error').message,/seven souls/);
 srv.broadcast();assert.equal(party[1].latest('state').state.board,undefined);assert.equal(party[1].latest('state').state.hand,undefined);
 dm.close();now.value+=10000;srv.step();const resumed=new Client(srv);resumed.write({type:'rejoin',code:w.code,token:w.token});assert.equal(resumed.latest('welcome').role,'dm');
 resumed.write({type:'removeRoom',seq:1,key:'0,0'});assert.equal(resumed.latest('ack').duplicate,true,'replay rejected across DM reconnect');assert.equal(Object.keys(original.board).length,1);
 resumed.write({type:'removeRoom',seq:4,key:'0,0'});assert.equal(Object.keys(original.board).length,0);
 party[2].close();const token=party[2].latest('welcome').token;const rejoinder=new Client(srv);rejoinder.write({type:'joinParty',code:w.code,slot:2,token});assert.equal(rejoinder.latest('welcome').slot,2);
 const wrongDM=new Client(srv);wrongDM.write({type:'rejoin',code:w.code,token:'fake'});assert.match(wrongDM.latest('error').message,/token/);
 for(const p of party)if(p.readyState===1)p.close();rejoinder.close();resumed.close();now.value+=121000;srv.clearInactive();assert.equal(srv.rooms.size,0,'inactive room cleaned up');
 console.log('✓ M1 room geometry, finite decks, exact-card undo and 7 reachable souls');
 console.log('✓ M1 six Party slots, filtered lobby snapshots, reconnect, anti-spoof, idempotent seq');
}finally{srv.stop();}
