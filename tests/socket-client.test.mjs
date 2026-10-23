import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {connectMatch} from '../src/socket-network.js';
import {createMatchService} from '../server/matches.mjs';
const server=createMatchService({autoTimers:false,logger:{info(){}}});
class SimulatedWebSocket{
  constructor(){
    this.readyState=0;this.events=new EventEmitter();
    this.backend=new EventEmitter();this.backend.readyState=1;this.backend.bufferedAmount=0;
    this.backend.send=raw=>queueMicrotask(()=>this.events.emit('message',{data:raw}));
    this.backend.close=()=>this.close();
    server.attach(this.backend);
    queueMicrotask(()=>{this.readyState=1;this.events.emit('open',{});});
  }
  addEventListener(type,callback){this.events.on(type,callback);}
  send(raw){this.backend.emit('message',raw);}
  close(){if(this.readyState===3)return;this.readyState=3;this.backend.readyState=3;this.backend.emit('close');queueMicrotask(()=>this.events.emit('close',{}));}
}
let host,joiner;
try{
  let dmUpdates=0,partyUpdates=0;
  host=await connectMatch({endpoint:'ws://localhost:8787',role:'dm',WebSocketImpl:SimulatedWebSocket,onState:()=>dmUpdates++});
  assert.match(host.code,/^[A-Z2-9]{6}$/);
  joiner=await connectMatch({endpoint:'ws://localhost:8787',role:'party',code:host.code,slot:0,name:'Browser Party',WebSocketImpl:SimulatedWebSocket,onState:()=>partyUpdates++});
  assert.equal(joiner.slot,0);
  let room=server.rooms.get(host.code);
  const first=room.game.players[0].x;
  joiner.sendInput({mx:1,my:0,aimX:1200,aimY:500});
  for(let i=0;i<12;i++)server.step();
  server.broadcast();
  await new Promise(r=>setTimeout(r,0));
  assert.ok(room.game.players[0].x>first);
  assert.ok(dmUpdates>=2&&partyUpdates>=2);
  const existing=room.game.enemies.length;
  host.spawn('grunt',1,6350,1000);
  assert.equal(room.game.enemies.length,existing+1);
  joiner.close();host.close();
  console.log('✓ Real browser-client protocol matched against the server room implementation');
  console.log('✓ Host, join, movement, server snapshots and DM spawn work in simulated socket transport');
}finally{joiner?.close();host?.close();server.stop()}
