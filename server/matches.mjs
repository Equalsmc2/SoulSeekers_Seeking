/** SOULSEEKERS / SEEKING R02 — match simulation is owned by this process.
 * Transport independent: callers supply WebSocket-compatible clients.
 * Does not trust clients with game state, slot ownership, currency or DM powers.
 */
import {randomBytes} from 'node:crypto';
import {createGame,tick,dmSpawn} from '../src/engine.js';
import {WORLD,clamp} from '../src/data.js';
import {networkSnapshot} from '../src/sync.js';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code=()=>Array.from(randomBytes(6),b=>ALPHABET[b%ALPHABET.length]).join('');
const token=()=>randomBytes(24).toString('base64url');
const finite=(value,fallback=0,min=-1e7,max=1e7)=>Number.isFinite(Number(value))?clamp(Number(value),min,max):fallback;
const cleanName=name=>String(name||'Seeker').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,24)||'Seeker';
const cleanInput=a=>({
  mx:finite(a?.mx,0,-1,1),my:finite(a?.my,0,-1,1),
  aimX:finite(a?.aimX,0,0,WORLD.width),aimY:finite(a?.aimY,0,0,WORLD.height),
  fire:a?.fire===true,ability:a?.ability===true,echo:a?.echo===true,dash:a?.dash===true,
  actionSeq:Math.floor(finite(a?.actionSeq,0,0,1000000000)),
  action:cleanAction(a?.action)
});
const cleanAction=a=>{
  if(!a||typeof a!=='object')return null;
  if(a.type==='buy'&&['bandage','vest','lens','boots','battery','spell'].includes(a.item))return {type:'buy',item:a.item};
  if(a.type==='chest')return {type:'chest'};
  if(a.type==='item'&&typeof a.id==='string')return {type:'item',id:a.id.slice(0,50)};
  if(a.type==='moveItem'&&typeof a.id==='string')return {type:'moveItem',id:a.id.slice(0,50),x:Math.floor(finite(a.x,0,-10,20)),y:Math.floor(finite(a.y,0,-10,20)),rotate:a.rotate===true};
  return null;
};
const ROOMS_MAX=40;
const IDLE_ROOM_MS=120000;
const DROP_SESSION_MS=75000;
const ready=ws=>ws?.readyState===1;
function send(ws,msg){if(!ready(ws))return false;try{ws.send(JSON.stringify(msg));return true;}catch{return false;}}
export function createMatchService({now=()=>Date.now(),logger=console,autoTimers=true}={}){
  const rooms=new Map(),clients=new Set();
  let tickTimer=null,sendTimer=null,cleanupTimer=null,lastTick=now(),tickAccumulator=0;
  const members=room=>room.party.map((p,slot)=>p?({slot,name:p.name,connected:ready(p.ws)}):null).filter(Boolean);
  function welcome(ws,room,role,slot,secret){
    send(ws,{type:'welcome',code:room.code,role,slot,token:secret,state:networkSnapshot(room.game),slots:members(room),tickRate:30,snapshotRate:20,seq:room.snapshotSeq||0,serverTimeMs:Math.round(room.ticks*1000/30)});
    notifyRoster(room);
  }
  function notifyRoster(room){const packet={type:'roster',slots:members(room),dmConnected:ready(room.dm.ws)};
    if(ready(room.dm.ws))send(room.dm.ws,packet);
    for(const p of room.party)if(ready(p?.ws))send(p.ws,packet);
  }
  function detach(ws){
    const c=ws._seeking;if(!c)return;
    ws._seeking=null;const room=rooms.get(c.code);
    if(room){if(c.role==='dm'&&room.dm.ws===ws){room.dm.ws=null;room.dm.lastSeen=now();}
      if(c.role==='party'&&room.party[c.slot]?.ws===ws){room.party[c.slot].ws=null;room.party[c.slot].lastSeen=now();delete room.inputs[c.slot];}
      notifyRoster(room);
    }
  }
  function host(ws){
    if(ws._seeking)return send(ws,{type:'error',message:'Already in a match.'});
    if(rooms.size>=ROOMS_MAX)return send(ws,{type:'error',message:'Game server is full. Try again later.'});
    let id;do{id=code();}while(rooms.has(id));
    const secret=token(),room={code:id,game:createGame(),dm:{token:secret,ws,lastSeen:now()},party:Array(6).fill(null),inputs:{},dmInput:null,createdAt:now(),lastMemberAt:now(),ticks:0,snapshotSeq:0,started:false};
    rooms.set(id,room);ws._seeking={code:id,role:'dm'};welcome(ws,room,'dm',null,secret);
    send(ws,{type:'event',message:'Room created. Match clock starts when the first Party member joins.'});
    logger.info?.(`[rooms] ${id} created`);
  }
  function join(ws,msg){
    if(ws._seeking)return send(ws,{type:'error',message:'Already in a match.'});
    const id=String(msg.code||'').toUpperCase().trim().replace(/[\s-]/g,'');
    const room=rooms.get(id);
    if(!room)return send(ws,{type:'error',message:'Room not found. Copy the DM room code.'});
    if(room.game.status==='finished')return send(ws,{type:'error',message:'That match has ended. Create a new room.'});
    const slot=Number(msg.slot);
    if(!Number.isInteger(slot)||slot<0||slot>5)return send(ws,{type:'error',message:'Select a character.'});
    const existing=room.party[slot],provided=String(msg.token||'');
    if(existing&&existing.token!==provided)return send(ws,{type:'error',message:'That character has already been reserved. Pick another.'});
    if(ready(existing?.ws)){const old=existing.ws;old._seeking=null;send(old,{type:'error',message:'Your character was resumed in another tab.'});old.close(4001,'Session resumed');}
    const player=existing||{token:token(),name:cleanName(msg.name),ws:null,lastSeen:now()};
    player.ws=ws;player.lastSeen=now();room.party[slot]=player;
    ws._seeking={code:id,role:'party',slot};room.lastMemberAt=now();room.started=true;
    welcome(ws,room,'party',slot,player.token);
  }
  function rejoinDM(ws,msg){
    if(ws._seeking)return send(ws,{type:'error',message:'Already in a match.'});
    const room=rooms.get(String(msg.code||''));
    if(!room||room.dm.token!==msg.token)return send(ws,{type:'error',message:'DM session expired or invalid. Host a new room.'});
    if(ready(room.dm.ws)){const old=room.dm.ws;old._seeking=null;send(old,{type:'error',message:'DM resumed in another window.'});old.close(4001,'Session resumed');}
    room.dm.ws=ws;room.dm.lastSeen=now();ws._seeking={code:room.code,role:'dm'};
    welcome(ws,room,'dm',null,room.dm.token);
  }
  function command(ws,msg){
    const c=ws._seeking;if(!c)return send(ws,{type:'error',message:'Join or host a match first.'});
    const room=rooms.get(c.code);if(!room)return send(ws,{type:'error',message:'Match no longer exists.'});
    if(c.role==='party'){
      if(room.party[c.slot]?.ws!==ws)return;
      if(msg.type==='input')room.inputs[c.slot]=cleanInput(msg.input);
      return;
    }
    if(room.dm.ws!==ws)return;
    if(msg.type==='dmInput'){
      const d=msg.input||{};
      const possession=typeof d.possess==='string'&&room.game.enemies.some(e=>e.id===d.possess&&e.hp>0)?d.possess:null;
      room.dmInput={possess:possession,mx:finite(d.mx,0,-1,1),my:finite(d.my,0,-1,1),aimX:finite(d.aimX,0,0,WORLD.width),aimY:finite(d.aimY,0,0,WORLD.height),fire:d.fire===true};
    }else if(msg.type==='dmSpawn'){
      const lane=Number(msg.lane),kind=String(msg.kind||''),x=finite(msg.x,0),y=finite(msg.y,0);
      if(dmSpawn(room.game,lane,kind,x,y))send(ws,{type:'event',message:`${kind.toUpperCase()} deployed.`});
      else send(ws,{type:'event',message:'Could not deploy: blocked, invalid or insufficient threat.'});
    }else if(msg.type==='dmOrder'){
      const x=finite(msg.x,0,0,WORLD.width),y=finite(msg.y,0,0,WORLD.height);
      for(const e of room.game.enemies)if(e.kind!=='boss'){e.orderX=x;e.orderY=y;}
      send(ws,{type:'event',message:'Army move order received.'});
    }
  }
  function accept(ws,raw){
    try{
      const message=JSON.parse(String(raw));
      if(!message||typeof message!=='object'||typeof message.type!=='string')return;
      if(message.type==='host')return host(ws);
      if(message.type==='join')return join(ws,message);
      if(message.type==='rejoinDM')return rejoinDM(ws,message);
      if(message.type==='ping')return send(ws,{type:'pong',at:message.at,serverAt:now()});
      command(ws,message);
    }catch(e){send(ws,{type:'error',message:'Malformed game message.'});}
  }
  function attach(ws){
    clients.add(ws);ws.on('message',raw=>accept(ws,raw));
    ws.on('close',()=>{detach(ws);clients.delete(ws);});
    ws.on('error',()=>{ /* close handler performs cleanup */ });
    send(ws,{type:'hello',version:'R02.2'});
  }
  function step(delta=1/30){
    const dt=clamp(delta,0,0.08);
    for(const room of rooms.values()){
      if(room.game.status!=='running'||!room.started)continue;
      const inputs={};
      for(let i=0;i<6;i++)if(ready(room.party[i]?.ws))inputs[i]=room.inputs[i]||{mx:0,my:0};
      tick(room.game,dt,inputs,ready(room.dm.ws)?room.dmInput:null);
      room.ticks++;
    }
  }
  function broadcast(){
    for(const room of rooms.values()){
      const full=networkSnapshot(room.game),seq=++room.snapshotSeq;
      // The DM needs the complete battlefield. Each Party player only needs
      // nearby projectiles/enemies/effects; retain every player and fort globally.
      const timestamp=Math.round(room.ticks*1000/30);
      const dmPacket=JSON.stringify({type:'snapshot',seq,serverTimeMs:timestamp,state:full});
      if(ready(room.dm.ws)&&(room.dm.ws.bufferedAmount||0)<128000){
        try{room.dm.ws.send(dmPacket);}catch{}
      }
      for(let i=0;i<room.party.length;i++){
        const ws=room.party[i]?.ws;
        if(!ready(ws)||(ws.bufferedAmount||0)>128000)continue;
        const hero=room.game.players[i];
        const near=o=>Math.abs(o.x-hero.x)<1800&&Math.abs(o.y-hero.y)<1300;
        const state={...full,enemyCount:full.enemies.length,
          enemies:full.enemies.filter(near),bullets:full.bullets.filter(near),effects:full.effects.filter(near)};
        try{ws.send(JSON.stringify({type:'snapshot',seq,serverTimeMs:timestamp,state}));}catch{}
      }
    }
  }
  function cleanup(){for(const [id,r] of rooms){
    const active=ready(r.dm.ws)||r.party.some(p=>ready(p?.ws));
    if(active){r.lastMemberAt=now();}
    // Disconnected seats expire, and matches with no connected humans eventually go away.
    r.party.forEach((p,i)=>{if(p&&!ready(p.ws)&&now()-p.lastSeen>DROP_SESSION_MS)r.party[i]=null;});
    if(!active&&now()-r.lastMemberAt>IDLE_ROOM_MS)rooms.delete(id);
  }}
  // Fixed timestep accumulator: don't double-step on a 34 ms timer callback,
  // and don't simulate imaginary extra time on early timer callbacks.
  function advanceTimer(deltaMs){
    tickAccumulator+=clamp(deltaMs,0,125)/1000;
    let steps=0;
    const fixed=1/30;
    while(tickAccumulator+1e-9>=fixed && steps<4){step(fixed);tickAccumulator-=fixed;steps++;}
    // If the host was CPU-starved, discard an excessive backlog rather than
    // forcing an expensive spiral that delays broadcasts and worsens latency.
    if(steps===4 && tickAccumulator>fixed*2)tickAccumulator=fixed*2;
    return steps;
  }
  function start(){if(tickTimer)return;lastTick=now();tickAccumulator=0;
    tickTimer=setInterval(()=>{const current=now(),delta=Math.max(0,current-lastTick);lastTick=current;
      advanceTimer(delta);
    },1000/30);
    sendTimer=setInterval(broadcast,1000/20);
    cleanupTimer=setInterval(cleanup,5000);
  }
  function stop(){for(const t of [tickTimer,sendTimer,cleanupTimer])if(t)clearInterval(t);tickTimer=sendTimer=cleanupTimer=null;}
  if(autoTimers)start();
  return {attach,accept,rooms,step,advanceTimer,broadcast,cleanup,start,stop,clients};
}
