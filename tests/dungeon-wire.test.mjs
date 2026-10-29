import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
const WebSocketClass=globalThis.WebSocket??(await import('ws')).WebSocket;
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(ok=>server.close(ok));return port;}
async function waitForServer(port){for(let i=0;i<80;i++){try{const resp=await fetch(`http://127.0.0.1:${port}/health`);if(resp.ok)return;}catch{}await delay(40);}throw Error('Server did not start');}
function liveClient(port){const ws=new WebSocketClass(`ws://127.0.0.1:${port}/dungeon-ws`),messages=[];let listeners=[];ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));messages.push(m);for(const f of [...listeners])f(m);});return {ws,messages,ready:()=>new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});}),wait:(type,timeout=3000)=>new Promise((ok,no)=>{const old=messages.find(m=>m.type===type);if(old)return ok(old);let timer=setTimeout(()=>{listeners=listeners.filter(f=>f!==cb);no(Error('No '+type+' received'));},timeout);function cb(m){if(m.type===type){clearTimeout(timer);listeners=listeners.filter(f=>f!==cb);ok(m);}}listeners.push(cb);}),send:m=>ws.send(JSON.stringify(m)),close:()=>ws.close()};}
const port=await freePort();const proc=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
const sockets=[];
try{
 await waitForServer(port);
 const dm=liveClient(port);sockets.push(dm);await dm.ready();dm.send({type:'hostRoom'});const hosted=await dm.wait('welcome');
 assert.equal(hosted.state.phase,'BUILD');assert.equal(hosted.state.hand.room.length,16);
 const party=[];for(let i=0;i<6;i++){const p=liveClient(port);sockets.push(p);await p.ready();p.send({type:'joinParty',code:hosted.code,slot:i,name:'Hero'+i});const w=await p.wait('welcome');assert.equal(w.slot,i);assert.equal(w.state.board,undefined);assert.equal(w.state.hand,undefined);party.push(p);}
 const card=hosted.state.hand.room.find(c=>c.id==='entry');party[0].send({type:'placeRoom',cardUid:card.uid,x:0,y:0,seq:1});const deny=await party[0].wait('error');assert.match(deny.message,/Only the Dungeon Master/);
 dm.send({type:'placeRoom',cardUid:card.uid,x:0,y:0,seq:1});await dm.wait('ack');await delay(90);
 assert.ok(dm.messages.some(m=>m.type==='state'&&m.state?.board?.['0,0']));assert.ok(party.every(p=>p.messages.every(m=>m.state?.board===undefined)));
 const states=party[1].messages.filter(m=>m.type==='state');assert.ok(states.length>=1,'real 20Hz state broadcast');
 console.log('✓ Real Node/WebSocket 1 DM + 6 Party connections, session edit, permissions, map privacy');
}finally{for(const c of sockets){try{c.close();}catch{}}proc.kill('SIGTERM');await delay(40);}
