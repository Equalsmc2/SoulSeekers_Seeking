import assert from 'node:assert/strict';
import {createPlaybackClock,tweenPosition,receiveEntityMotion,newPrediction,reconcileWithLatency} from '../src/prediction.js';
import {createGame} from '../src/engine.js';
import {createMatchService} from '../server/matches.mjs';
import {EventEmitter} from 'node:events';

// Server time must be the only motion-sample clock. Late, uneven packet
// deliveries may change buffer size, but must not reverse playback time.
const timeline=createPlaybackClock();
const motion=new Map();
const received=[];
for(let index=0;index<35;index++){
  const simMs=index*50;
  // 0–45 ms irregular network jitter with occasional coalesced deliveries.
  const burst=[8,34,5,17,46,1,26,7,22,13][index%10];
  received.push({time:simMs+burst,simMs,x:180+simMs*.27});
}
received.sort((a,b)=>a.time-b.time);
let seq=0,renderTime=0,previousPlay=-Infinity,previousX=-Infinity,maxStep=0;
while(renderTime<=2200){
  while(seq<received.length&&received[seq].time<=renderTime){
    const packet=received[seq++];
    timeline.receive(packet.simMs,packet.time);
    receiveEntityMotion(motion,[{id:'runner',x:packet.x,y:0}],packet.simMs);
  }
  const playback=timeline.advance(1000/60);
  if(playback!==null){
    assert.ok(playback>=previousPlay,'playhead never rewinds on bursty packets');
    previousPlay=playback;
    const sampled=tweenPosition(motion.get('runner'),playback,0);
    assert.ok(sampled.x>=previousX-0.001,'remote motion cannot go backwards');
    if(previousX!==-Infinity)maxStep=Math.max(maxStep,sampled.x-previousX);
    previousX=sampled.x;
  }
  renderTime+=1000/60;
}
assert.ok(maxStep<28,`a packet burst must not cause a large position correction (${maxStep})`);
assert.ok(timeline.jitter>0,'clock detects packet timing jitter');
assert.ok(timeline.delay>=100&&timeline.delay<=205,'adaptive buffer remains bounded');

// A normal one-way delay is not a position error. Keep movement responsive.
const player=createGame().players[0],pred=newPrediction(player);
pred.x+=235*.08;
const before=pred.x;
reconcileWithLatency(pred,player,{mx:1,my:0},.08);
assert.ok(Math.abs(pred.x-before)<1,'authoritative snapshot lag must not tug a correctly predicted moving player backwards');
reconcileWithLatency(pred,{...player,hp:0},{mx:1,my:0},.08);
assert.equal(pred.x,player.x,'death must reset visual prediction immediately');

// A near-ideal pair of callbacks (~16 + ~17 ms) is ONE sim tick,
// not two (an intermittent bug in the older ceil(delta/tick) scheduler).
const svc=createMatchService({autoTimers:false,logger:{info(){}}});
class Fake extends EventEmitter {
  constructor(){super();this.readyState=1;this.bufferedAmount=0;this.out=[];svc.attach(this);}
  send(raw){this.out.push(JSON.parse(raw));}
  write(msg){this.emit('message',JSON.stringify(msg));}
  latest(type){return this.out.filter(p=>p.type===type).at(-1);}
}
try{
  const dm=new Fake();dm.write({type:'host'});
  const party=new Fake();party.write({type:'join',code:dm.latest('welcome').code,slot:0,name:'Test'});
  const room=svc.rooms.get(dm.latest('welcome').code);
  assert.equal(svc.advanceTimer(16),0);
  assert.equal(svc.advanceTimer(18),1);
  assert.equal(room.ticks,1);
  assert.equal(svc.advanceTimer(32),0);
  assert.equal(svc.advanceTimer(2),1);
  assert.equal(room.ticks,2);
  let elapsed=0;
  for(let i=0;i<150;i++){
    const ms=[28,38,33,36,31,34][i%6];
    elapsed+=ms;svc.advanceTimer(ms);
  }
  assert.ok(Math.abs(room.ticks-(elapsed+68)/1000*30)<1.1,'fixed-tick count tracks elapsed wall time');
  svc.broadcast();
  const a=dm.latest('snapshot'),b=party.latest('snapshot');
  assert.equal(a.serverTimeMs,b.serverTimeMs);
  assert.equal(a.serverTimeMs,Math.round(room.ticks*1000/30));
  assert.equal(dm.latest('welcome').serverTimeMs,0);
  const before=room.ticks;
  svc.advanceTimer(500);
  assert.ok(room.ticks-before<=4,'a long process pause may not start a catch-up spiral');
}finally{svc.stop();}
console.log('✓ R02.2 server-clock motion remains monotonic through irregular snapshot delivery');
console.log('✓ Local prediction compensates normal one-way latency without backwards corrections');
console.log('✓ Fixed-timestep scheduler tracks wall clock and bounds delayed callbacks');
