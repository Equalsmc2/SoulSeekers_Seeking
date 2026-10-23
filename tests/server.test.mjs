import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createMatchService} from '../server/matches.mjs';
import {normalizeEndpoint} from '../src/socket-network.js';

class Client extends EventEmitter{
  constructor(service){super();this.readyState=1;this.bufferedAmount=0;this.packets=[];service.attach(this);}
  send(raw){this.packets.push(JSON.parse(raw));}
  write(data){this.emit('message',JSON.stringify(data));}
  latest(type){return this.packets.filter(packet=>packet.type===type).at(-1);}
  close(){this.readyState=3;this.emit('close');}
}
const service=createMatchService({autoTimers:false,logger:{info(){}}});
try{
  const dm=new Client(service);
  dm.write({type:'host'});
  const welcome=dm.latest('welcome');
  assert.match(welcome.code,/^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(welcome.state.players.length,6);
  assert.equal(service.rooms.size,1);
  const room=service.rooms.get(welcome.code);
  const party=new Client(service);
  party.write({type:'join',code:welcome.code,slot:0,name:'Test Seeker'});
  const joined=party.latest('welcome');
  assert.equal(joined.slot,0);
  assert.ok(joined.token&&joined.token!==welcome.token);
  assert.equal(dm.latest('roster').slots.length,1);

  const collision=new Client(service);
  collision.write({type:'join',code:welcome.code,slot:0,name:'Invader'});
  assert.match(collision.latest('error').message,/already been reserved/);
  assert.equal(room.party[0].ws,party);
  const player2=new Client(service);
  player2.write({type:'join',code:welcome.code,slot:1,name:'Second Seeker'});
  assert.equal(player2.latest('welcome').slot,1);

  // An ordinary Party browser cannot impersonate the DM or mutate authoritative objects.
  const enemyCount=room.game.enemies.length;
  const startingThreat=room.game.threat;
  party.write({type:'dmSpawn',lane:1,kind:'brute',x:6400,y:1000});
  party.write({type:'snapshot',state:{players:[]}});
  party.write({type:'input',slot:5,input:{mx:1,my:0,fire:false}});
  assert.equal(room.game.enemies.length,enemyCount);
  assert.equal(room.game.threat,startingThreat);
  const x=room.game.players[0].x;
  const secondX=room.game.players[1].x;
  for(let i=0;i<8;i++)service.step();
  assert.ok(room.game.players[0].x>x,'bound input must move the associated player');
  // First step AI may move other idle player; sending a bogus slot cannot control its input.
  assert.equal(room.inputs[5],undefined);
  assert.equal(room.game.players[1].x,secondX,'another connected player stays idle without its own input');

  // DM deployment and commands are server validated.
  dm.write({type:'dmSpawn',lane:1,kind:'brute',x:6250,y:1000});
  assert.equal(room.game.enemies.length,enemyCount+1);
  assert.ok(room.game.threat<startingThreat);
  dm.write({type:'dmOrder',x:3100,y:1000});
  assert.ok(room.game.enemies.some(e=>e.kind==='brute'&&e.orderX===3100));
  service.broadcast();
  const stateDM=dm.latest('snapshot'),stateParty=party.latest('snapshot');
  assert.equal(stateDM.seq,stateParty.seq);
  assert.equal(stateDM.state.enemies.length,room.game.enemies.length);
  assert.equal(JSON.stringify(stateDM).includes(joined.token),false,'state must not reveal secret reconnect tokens');

  // Disconnecting the DM no longer stops the simulation. The same DM may reclaim session.
  dm.close();
  const at=room.game.elapsed;
  for(let i=0;i<10;i++)service.step();
  assert.ok(room.game.elapsed>at,'dedicated simulation continues without the DM browser');
  const resumedDM=new Client(service);
  resumedDM.write({type:'rejoinDM',code:welcome.code,token:welcome.token});
  assert.equal(resumedDM.latest('welcome').role,'dm');
  const badDM=new Client(service);
  badDM.write({type:'rejoinDM',code:welcome.code,token:'wrong'});
  assert.match(badDM.latest('error').message,/expired or invalid/);

  // Party can resume with their server-issued secret but not guess the seat.
  party.close();
  const resumedParty=new Client(service);
  resumedParty.write({type:'join',code:welcome.code,slot:0,token:joined.token,name:'Resuming'});
  assert.equal(resumedParty.latest('welcome').slot,0);
  assert.equal(room.party[0].ws,resumedParty);

  assert.equal(normalizeEndpoint('https://seeking-demo.onrender.com'), 'wss://seeking-demo.onrender.com/ws');
  assert.equal(normalizeEndpoint('ws://localhost:8787'),'ws://localhost:8787/ws');
  assert.throws(()=>normalizeEndpoint('http://danger.example',{protocol:'https:'}),/secure/);
  console.log('✓ Match hosted independently of browsers; two joined Party seats');
  console.log('✓ Character reservation, protected commands, validated movement and snapshots');
  console.log('✓ DM disconnect continues simulation; DM and Party rejoin with session tokens');
  console.log('✓ Server address supports Render HTTPS to WSS conversion');
}finally{service.stop()}
