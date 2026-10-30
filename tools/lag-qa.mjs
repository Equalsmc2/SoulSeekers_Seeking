/** Reproducible seven-socket latency test; no live network resources accessed.
 * Injects ~55ms +/-15ms delay in both directions, approximately 110ms RTT.
 * Measures transport independently from browser rendering and input prediction.
 */
import http from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {WebSocketServer} from '../server/ws-local-fallback.mjs';
import {createDungeonService} from '../server/dungeon-service.mjs';
import {DungeonSession} from '../shared/dungeon/session.mjs';
import {mayPlace,coords,xy} from '../shared/dungeon/rules.mjs';
const ClientSocket=globalThis.WebSocket??(await import('ws')).WebSocket;
const wait=(f,max=10000)=>new Promise((resolve,reject)=>{const now=Date.now();const id=setInterval(()=>{const v=f();if(v){clearInterval(id);resolve(v);}else if(Date.now()-now>max){clearInterval(id);reject(Error('Timed out waiting for network result'));}},10);});
let serial=0;const jitter=()=>55+Math.round(Math.sin(++serial*5.123)*15);
class Peer{
 constructor(ws){this.ws=ws;this.messages=[];this.seq=0;this.pongs=[];ws.addEventListener('message',ev=>{const receiveAt=Date.now();setTimeout(()=>{const v=JSON.parse(ev.data);v._receivedAt=Date.now();if(v.type==='pong')this.pongs.push(v._receivedAt-v.at);this.messages.push(v);},jitter());});}
 write(type,fields={}){const seq=++this.seq;setTimeout(()=>{if(this.ws.readyState===1)this.ws.send(JSON.stringify({type,seq,...fields}));},jitter());return seq;}
 async ack(seq){return await wait(()=>this.messages.find(v=>v.seq===seq&&['ack','error'].includes(v.type)));}
}
async function makePeer(port,params){const ws=new ClientSocket(`ws://127.0.0.1:${port}/dungeon-ws`);await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});const peer=new Peer(ws);peer.write(params.type,params);peer.welcome=await wait(()=>peer.messages.find(v=>v.type==='welcome'));peer.seq=0;return peer;}
function build(){const d=new DungeonSession({random:()=>0}),entry=d.hand.room.find(c=>c.id==='entry');d.placeRoom({cardUid:entry.uid,x:0,y:0});for(let n=0;n<7;n++){let found;outer:for(const c of d.hand.room)for(let rotation=0;rotation<4;rotation++)for(const k of Object.keys(d.board)){const [x,y]=coords(k);for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]])if(!mayPlace(d.board,x+dx,y+dy,{...c,rot:(c.rot+rotation)%4})){found={card:c,rotation,x:x+dx,y:y+dy};break outer;}}assert.ok(found);for(let j=0;j<found.rotation;j++)d.rotateCard({cardUid:found.card.uid});d.placeRoom({cardUid:found.card.uid,x:found.x,y:found.y});d.placeSoul({key:xy(found.x,found.y)});}d.lockDungeon();return d;}
const server=http.createServer(),wss=new WebSocketServer(),service=createDungeonService({autoTimers:true,logger:{}}),peers=[];
server.on('upgrade',(req,s,head)=>wss.handleUpgrade(req,s,head,ws=>service.attach(ws)));
server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
try{
 const dm=await makePeer(port,{type:'hostRoom'});peers.push(dm);const code=dm.welcome.code,room=service.rooms.get(code);room.dungeon=build();
 for(let slot=0;slot<6;slot++){const player=await makePeer(port,{type:'joinParty',code,slot,loadout:{weapon:slot%2,dodge:(slot+1)%2},name:'Lag QA '+slot});peers.push(player);const seq=player.write('setReady',{ready:true});const ack=await player.ack(seq);assert.equal(ack.type,'ack',ack.message);}
 const seq=dm.write('startMatch');const ack=await dm.ack(seq);assert.equal(ack.type,'ack',ack.message);await wait(()=>room.match);
 // 4 seconds of full-rate input. Simulated RTT: 55ms each way, jitter +/-15ms.
 const t0=Date.now(),inputTimer=setInterval(()=>{for(let i=1;i<peers.length;i++){const p=peers[i];p.write('playerInput',{inputSeq:p.seq+1,keys:i%2?['KeyD']:['KeyS'],aimX:500,aimY:0,fire:i%2===0});}for(const p of peers)p.write('ping',{at:Date.now()});},34);
 await delay(4000);clearInterval(inputTimer);await delay(260);
 const parties=peers.slice(1),report={scenario:'1 DM + 6 Party sockets, server 30Hz, snapshot 20Hz, per-direction delay 55 +/-15 ms',simulatedRttMs:110,jitterOneWayMs:15,durationMs:Date.now()-t0,clients:peers.length,serverTicks:service.ticks,parties:parties.map((p,slot)=>{const snaps=p.messages.filter(m=>m.type==='state'&&m.state?.phase==='ACTIVE'),acked=snaps.map(m=>m.state?.heroes?.find(h=>h.slot===slot)?.ackInputSeq).filter(Number.isFinite),gaps=snaps.slice(1).map((x,i)=>x._receivedAt-snaps[i]._receivedAt);return{slot,snapshots:snaps.length,lastAckInputSeq:acked.at(-1)||0,medianDeliveryGapMs:median(gaps),p95DeliveryGapMs:pct(gaps,.95),medianPingRttMs:median(p.pongs),p95PingRttMs:pct(p.pongs,.95)};})};
 function median(v){return pct(v,.5);}function pct(v,f){const s=v.filter(Number.isFinite).sort((a,b)=>a-b);return s[Math.floor(f*(s.length-1))]??null;}
 for(const row of report.parties){assert.ok(row.snapshots>38,'Snapshots must arrive to all Party clients');assert.ok(row.lastAckInputSeq>40,'Server must acknowledge Party input');assert.ok(row.medianPingRttMs>=80&&row.medianPingRttMs<=155,'Measured RTT should reflect 110 ms emulation');}
 const location=new URL('../NETWORK_LAG_QA_RESULTS.json',import.meta.url);writeFileSync(location,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{for(const p of peers)p.ws.close();service.stop();await new Promise(r=>server.close(r));}
