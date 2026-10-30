/** M1 dungeon transport. R03.5's socket patterns preserved; no browser owns mutations. */
import {randomBytes} from 'node:crypto';
import {DungeonSession} from '../shared/dungeon/session.mjs';
import {CHARS} from '../shared/dungeon/rules.mjs';
import {DungeonRuntime} from '../shared/dungeon/runtime.mjs';
const CHARS_CODE='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode=()=>Array.from(randomBytes(6),n=>CHARS_CODE[n%CHARS_CODE.length]).join('');
const makeToken=()=>randomBytes(24).toString('base64url');
const ready=ws=>ws?.readyState===1;
const send=(ws,msg)=>{if(!ready(ws))return;try{ws.send(JSON.stringify(msg));}catch{}};
const safeName=v=>String(v||'Seeker').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,24)||'Seeker';
const ACTIONS=new Set(['beginBuild','rotateCard','placeRoom','moveRoom','rotateRoom','removeRoom','applyTarot','placeCamp','clearSpecial','placeSoul','rerollSelected','undoRoom','lockDungeon','unlockDungeon','newRound','startMatch','dmSummon','dmOrder','dmPossess','dmRelease','partyAttack','partyCast','partyDodge','partyWeapon','partyDodgeSelect','partyReload','partyPotion']);
export function createDungeonService({now=()=>Date.now(),logger=console,autoTimers=true}={}){
 const rooms=new Map(),clients=new Set();let clock=0,ticks=0,interval=null,cleanup=null;
 const view=room=>room.party.map((p,slot)=>p?{slot,name:p.name,character:CHARS[slot].name,connected:ready(p.ws)}:null).filter(Boolean);
 function sendState(room,ws,role,slot=null,type='state'){
   const msg={type,code:room.code,role,slot,state:room.dungeon.snapshot(role),world:room.runtime?.snapshot(role,slot)||null,roster:view(room),dmConnected:ready(room.dm.ws),serverTimeMs:now(),tickRate:30,snapshotRate:20,stateSeq:room.stateSeq};
   send(ws,msg);
 }
 function notify(room){room.stateSeq++;if(ready(room.dm.ws))sendState(room,room.dm.ws,'dm');for(let i=0;i<6;i++)if(ready(room.party[i]?.ws))sendState(room,room.party[i].ws,'party',i);}
 function detach(ws){const c=ws._dungeon;if(!c)return;ws._dungeon=null;const room=rooms.get(c.code);if(!room)return;const member=c.role==='dm'?room.dm:room.party[c.slot];if(member?.ws===ws){member.ws=null;member.seenAt=now();if(c.role==='party')room.runtime?.removePlayer(c.slot);else if(room.runtime)room.runtime.dmInput={x:0,y:0};}room.lastPresence=now();notify(room);}
 function reject(ws,message,seq){send(ws,{type:'error',message,seq:Number.isSafeInteger(seq)?seq:null});}
 function claim(ws,room,role,slot,member){if(ready(member.ws)&&member.ws!==ws){const old=member.ws;old._dungeon=null;send(old,{type:'error',message:'This session was resumed in another tab'});try{old.close(4001,'Session resumed');}catch{}}member.ws=ws;member.seenAt=now();room.lastPresence=now();ws._dungeon={code:room.code,role,slot};send(ws,{type:'welcome',code:room.code,token:member.token,role,slot,lastCommandSeq:member.lastSeq,state:room.dungeon.snapshot(role),world:room.runtime?.snapshot(role,slot)||null,roster:view(room),stateSeq:room.stateSeq,tickRate:30,snapshotRate:20,serverTimeMs:now()});notify(room);}
 function host(ws){if(ws._dungeon)return reject(ws,'Already joined');if(rooms.size>=40)return reject(ws,'Server room capacity reached');let code;do{code=makeCode();}while(rooms.has(code));const dm={ws:null,token:makeToken(),seenAt:now(),lastSeq:-1};const room={code,dungeon:new DungeonSession(),runtime:null,dm,party:Array(6).fill(null),createdAt:now(),lastPresence:now(),stateSeq:0};rooms.set(code,room);claim(ws,room,'dm',null,dm);logger.info?.('[dungeon] room hosted '+code);}
 function findRoom(ws,msg){const code=String(msg.code||'').trim().toUpperCase().replace(/[\s-]/g,'');const room=rooms.get(code);if(!room)reject(ws,'Room not found');return room;}
 function join(ws,msg){if(ws._dungeon)return reject(ws,'Already joined');const room=findRoom(ws,msg);if(!room)return;const slot=Number(msg.slot);if(!Number.isInteger(slot)||slot<0||slot>=6)return reject(ws,'Choose one of six characters');const existing=room.party[slot];if(existing&&existing.token!==msg.token)return reject(ws,'That character is already reserved');const member=existing||{name:safeName(msg.name),token:makeToken(),ws:null,seenAt:now(),lastSeq:-1};room.party[slot]=member;if(room.runtime)room.runtime.addPlayer(slot);claim(ws,room,'party',slot,member);}
 function rejoin(ws,msg){if(ws._dungeon)return reject(ws,'Already joined');const room=findRoom(ws,msg);if(!room)return;if(room.dm.token!==msg.token)return reject(ws,'Invalid or expired DM token');claim(ws,room,'dm',null,room.dm);}
 function command(ws,msg){
   const c=ws._dungeon;if(!c)return reject(ws,'Host or join a dungeon first',msg.seq);
   const room=rooms.get(c.code);if(!room)return reject(ws,'Room no longer exists',msg.seq);
   const member=c.role==='dm'?room.dm:room.party[c.slot];if(!member||member.ws!==ws)return reject(ws,'Session no longer owns this connection',msg.seq);
   if(msg.type==='playerInput'){
     if(c.role!=='party'||!room.runtime)return reject(ws,'Movement requires an active Party hero');
     room.runtime.input(c.slot,msg);return;
   }
   if(msg.type==='dmInput'){
     if(c.role!=='dm'||!room.runtime)return reject(ws,'DM controls require an active match');
     try{room.runtime.dmAction('dmInput',msg);}catch(e){reject(ws,e.message);}return;
   }
   if(!ACTIONS.has(msg.type))return reject(ws,'Unknown dungeon action',msg.seq);
   const partyAction=msg.type.startsWith('party');
   if((c.role==='dm')===partyAction)return reject(ws,partyAction?'Only Party players may use hero controls':'Only the Dungeon Master may use dungeon commands',msg.seq);
   if(!Number.isSafeInteger(msg.seq)||msg.seq<0)return reject(ws,'Command requires a non-negative sequence number',msg.seq);
   if(msg.seq<=member.lastSeq){send(ws,{type:'ack',seq:msg.seq,duplicate:true,version:room.dungeon.version});return;}
   member.lastSeq=msg.seq;
   try{
     if(msg.type==='newRound') {room.dungeon.reset();room.runtime=null;}
     else if(msg.type==='startMatch'){
       if(room.dungeon.phase!=='LOCKED')throw Error('Lock a valid dungeon before starting');
       if(!room.party.some(Boolean))throw Error('At least one Party player must join');
       room.runtime=new DungeonRuntime(room.dungeon.board,{now});
       room.party.forEach((p,i)=>{if(p)room.runtime.addPlayer(i);});
       room.dungeon.phase='ACTIVE';room.dungeon.commit();
       room.runtime.log('The dungeon opens. Collect seven souls and escape.');
     }
     else if(msg.type==='beginBuild'){
       if(room.dungeon.phase==='LOCKED')room.dungeon.unlockDungeon();else if(room.dungeon.phase!=='BUILD')throw Error('Match has already begun');
     }
     else if(partyAction){if(room.dungeon.phase!=='ACTIVE'||!room.runtime)throw Error('Party action requires an active match');room.runtime.partyAction(c.slot,msg.type,msg);}
     else if(['dmSummon','dmOrder','dmPossess','dmRelease'].includes(msg.type)){
       if(room.dungeon.phase!=='ACTIVE'||!room.runtime)throw Error('DM command requires an active match');room.runtime.dmAction(msg.type,msg);
     }
     else room.dungeon[msg.type](msg);
     send(ws,{type:'ack',seq:msg.seq,version:room.dungeon.version});notify(room);
   }catch(err){reject(ws,err?.message||'Invalid gameplay action',msg.seq);}
 }
 function attach(ws){clients.add(ws);ws._dungeon=null;ws.on('message',raw=>{let msg;try{msg=JSON.parse(String(raw));}catch{return reject(ws,'Malformed JSON');}if(!msg||typeof msg!=='object'||Array.isArray(msg))return reject(ws,'Invalid packet');if(msg.type==='hostRoom')host(ws);else if(msg.type==='joinParty')join(ws,msg);else if(msg.type==='rejoin')rejoin(ws,msg);else if(msg.type==='ping')send(ws,{type:'pong',at:msg.at,serverTimeMs:now()});else command(ws,msg);});ws.on('close',()=>{detach(ws);clients.delete(ws);});ws.on('error',()=>{detach(ws);clients.delete(ws);});}
 function step(){ticks++;for(const room of rooms.values())if(room.runtime){room.runtime.update(1/30);if(room.runtime.result&&room.dungeon.phase==='ACTIVE'){room.dungeon.phase='ENDED';room.dungeon.commit();notify(room);}}}
 function broadcast(){for(const room of rooms.values()){
   if(ready(room.dm.ws))sendState(room,room.dm.ws,'dm');
   for(let i=0;i<6;i++)if(ready(room.party[i]?.ws))sendState(room,room.party[i].ws,'party',i);
 }}
 function clearInactive(){for(const [id,r] of rooms)if(!ready(r.dm.ws)&&!r.party.some(p=>ready(p?.ws))&&now()-r.lastPresence>120000)rooms.delete(id);}
 function start(){if(interval)return;interval=setInterval(step,1000/30);interval.unref?.();clock=setInterval(broadcast,50);clock.unref?.();cleanup=setInterval(clearInactive,10000);cleanup.unref?.();}
 function stop(){for(const t of [interval,clock,cleanup])if(t)clearInterval(t);interval=clock=cleanup=null;}
 if(autoTimers)start();return {attach,rooms,clients,step,broadcast,clearInactive,stop,start,get ticks(){return ticks;}};
}
