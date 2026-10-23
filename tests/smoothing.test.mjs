import assert from 'node:assert/strict';
import {createGame,spawnEnemy} from '../src/engine.js';
import {createMatchService} from '../server/matches.mjs';
import {receiveEntityMotion,tweenPosition,predictStep,newPrediction} from '../src/prediction.js';
import {EventEmitter} from 'node:events';

// Variable packet intervals must be smoothed, without extrapolating forever.
const positions=new Map();
receiveEntityMotion(positions,[{id:'remote',x:100,y:100}],0);
receiveEntityMotion(positions,[{id:'remote',x:150,y:100}],47);
receiveEntityMotion(positions,[{id:'remote',x:230,y:100}],145);
const a=tweenPosition(positions.get('remote'),174);
const b=tweenPosition(positions.get('remote'),222);
assert.ok(a.x>a.y&&b.x>a.x&&b.x<230,'buffered motion increases smoothly between arrivals');
assert.deepEqual(tweenPosition(positions.get('remote'),1000),{x:230,y:100},'no endless prediction after packet loss');
receiveEntityMotion(positions,[{id:'remote',x:1700,y:100}],170);
assert.deepEqual(tweenPosition(positions.get('remote'),170),{x:1700,y:100},'large teleports never interpolate across whole map');

// Smooth local prediction advances with each display frame, independent of 30Hz inputs.
const g=createGame(),player=g.players[0],pos=newPrediction(player);
for(let n=0;n<60;n++)predictStep(pos,player,{mx:1,my:0},1/60);
assert.ok(pos.x>player.x+200&&pos.x<player.x+240,'60fps movement prediction matches game speed');

// Nearby Party interest filtering does not change the DM's complete view or army count.
const service=createMatchService({autoTimers:false,logger:{info(){}}});
class Client extends EventEmitter{
 constructor(){super();this.readyState=1;this.bufferedAmount=0;this.packets=[];service.attach(this);}
 send(raw){this.packets.push(JSON.parse(raw));}
 write(packet){this.emit('message',JSON.stringify(packet));}
 latest(type){return this.packets.filter(p=>p.type===type).at(-1);}
}
const dm=new Client();dm.write({type:'host'});
const party=new Client();party.write({type:'join',code:dm.latest('welcome').code,slot:0,name:'Near Player'});
const room=service.rooms.get(dm.latest('welcome').code);
for(let i=0;i<90;i++)spawnEnemy(room.game,i%3,'grunt',6000-i*12);
service.broadcast();
const full=dm.latest('snapshot'),near=party.latest('snapshot');
assert.equal(full.state.enemies.length,room.game.enemies.length);
assert.ok(near.state.enemies.length<full.state.enemies.length,'party receives less remote state');
assert.equal(near.state.enemyCount,full.state.enemies.length,'UI retains actual army size');
assert.deepEqual(near.state.players,full.state.players,'all heroes remain globally visible');
assert.equal(near.seq,full.seq);
service.stop();
console.log('✓ R02.1 smooth remote interpolation, 60fps prediction, bounded extrapolation');
console.log('✓ 20Hz snapshots preserve DM full view and filter Party interest areas');
