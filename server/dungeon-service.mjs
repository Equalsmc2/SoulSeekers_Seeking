/** M1 dungeon transport. R03.5's socket patterns preserved; no browser owns mutations. */
import {randomBytes} from 'node:crypto';
import {DungeonMatch} from '../shared/dungeon/match.mjs';
import {DungeonSession} from '../shared/dungeon/session.mjs';
import {CHARS} from '../shared/dungeon/rules.mjs';
import {validateLoadout} from '../shared/dungeon/loadout.mjs';
const CHARS_CODE='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode=()=>Array.from(randomBytes(6),n=>CHARS_CODE[n%CHARS_CODE.length]).join('');
const makeToken=()=>randomBytes(24).toString('base64url');
const LIVE=new Set(['startMatch','setReady','setLoadout','playerInput','partyAction','dmInput','dmSummon','dmOrder','dmPossess','dmRelease','dmDismiss']);
const ready=ws=>ws?.readyState===1;
const send=(ws,msg)=>{if(!ready(ws)||(ws.bufferedAmount||0)>256000)return;try{ws.send(JSON.stringify(msg));}catch{}};
const safeName=v=>String(v||'Seeker').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,24)||'Seeker';
const ACTIONS=new Set(['beginBuild','rotateCard','placeRoom','moveRoom','rotateRoom','removeRoom','applyTarot','placeCamp','clearSpecial','placeSoul','rerollSelected','undoRoom','lockDungeon','unlockDungeon','newRound']);
export function createDungeonService({now=()=>Date.now(),logger=console,autoTimers=true}={}){
 const rooms=new Map(),clients=new Set();let clock=0,ticks=0,interval=null,cleanup=null;
 const view=room=>room.party.map((p,slot)=>p?{slot,name:p.name,character:CHARS[slot].name,connected:ready(p.ws),ready:!!p.ready,loadout:p.loadout||null}:null).filter(Boolean);
 function sendState(room,ws,role,slot=null,type='state'){
   const msg={type,code:room.code,role,slot,state:room.match?room.match.snapshot(role,slot):room.dungeon.snapshot(role),roster:view(room),dmConnected:ready(room.dm.ws),serverTimeMs:now(),tickRate:30,snapshotRate:20,stateSeq:room.stateSeq};
   send(ws,msg);
 }
 function notify(room){room.stateSeq++;if(ready(room.dm.ws))sendState(room,room.dm.ws,'dm');for(let i=0;i<6;i++)if(ready(room.party[i]?.ws))sendState(room,room.party[i].ws,'party',i);}
 function detach(ws){const c=ws._dungeon;if(!c)return;ws._dungeon=null;const room=rooms.get(c.code);if(!room)return;const member=c.role==='dm'?room.dm:room.party[c.slot];if(member?.ws===ws){member.ws=null;member.seenAt=now();if(c.role==='party')room.match?.controllers.get(c.slot)?.input({keys:[]});else if(room.match)room.match.dmInput={};}room.lastPresence=now();notify(room);}
 function reject(ws,message,seq){send(ws,{type:'error',message,seq:Number.isSafeInteger(seq)?seq:null});}
 function claim(ws,room,role,slot,member){if(ready(member.ws)&&member.ws!==ws){const old=member.ws;old._dungeon=null;send(old,{type:'error',message:'This session was resumed in another tab'});try{old.close(4001,'Session resumed');}catch{}}member.ws=ws;member.seenAt=now();room.lastPresence=now();ws._dungeon={code:room.code,role,slot};send(ws,{type:'welcome',code:room.code,token:member.token,role,slot,lastCommandSeq:member.lastSeq,state:room.match?room.match.snapshot(role,slot):room.dungeon.snapshot(role),roster:view(room),stateSeq:room.stateSeq,tickRate:30,snapshotRate:20,serverTimeMs:now()});notify(room);}
 function host(ws){if(ws._dungeon)return reject(ws,'Already joined');if(rooms.size>=40)return reject(ws,'Server room capacity reached');let code;do{code=makeCode();}while(rooms.has(code));const dm={ws:null,token:makeToken(),seenAt:now(),lastSeq:-1};const room={code,dungeon:new DungeonSession(),dm,party:Array(6).fill(null),createdAt:now(),lastPresence:now(),stateSeq:0};rooms.set(code,room);claim(ws,room,'dm',null,dm);logger.info?.('[dungeon] room hosted '+code);}
 function findRoom(ws,msg){const code=String(msg.code||'').trim().toUpperCase().replace(/[\s-]/g,'');const room=rooms.get(code);if(!room)reject(ws,'Room not found');return room;}
 function join(ws,msg){if(ws._dungeon)return reject(ws,'Already joined');const room=findRoom(ws,msg);if(!room)return;const slot=Number(msg.slot);if(!Number.isInteger(slot)||slot<0||slot>=6)return reject(ws,'Choose one of six characters');const existing=room.party[slot];if(existing&&existing.token!==msg.token)return reject(ws,'That character is already reserved');if(!existing&&room.dungeon.phase!=='BUILD'&&room.dungeon.phase!=='LOCKED')return reject(ws,'Match already started; only reserved seats can reconnect');let joinedLoadout=null;if(!existing&&msg.loadout!==undefined){try{joinedLoadout=validateLoadout(msg.loadout);}catch(e){return reject(ws,e.message);}}const member=existing||{name:safeName(msg.name),token:makeToken(),ws:null,seenAt:now(),lastSeq:-1,loadout:joinedLoadout};room.party[slot]=member;claim(ws,room,'party',slot,member);}
 function rejoin(ws,msg){if(ws._dungeon)return reject(ws,'Already joined');const room=findRoom(ws,msg);if(!room)return;if(room.dm.token!==msg.token)return reject(ws,'Invalid or expired DM token');claim(ws,room,'dm',null,room.dm);}
 function command(ws,msg){const c=ws._dungeon;if(!c)return reject(ws,'Host or join a dungeon first',msg.seq);const room=rooms.get(c.code);if(!room)return reject(ws,'Room no longer exists',msg.seq);const member=c.role==='dm'?room.dm:room.party[c.slot];if(!member||member.ws!==ws)return reject(ws,'Session no longer owns this connection',msg.seq);
   if(!ACTIONS.has(msg.type)&&!LIVE.has(msg.type))return reject(ws,'Unknown dungeon action',msg.seq);
   if(c.role!=='dm'&&!['setReady','setLoadout','playerInput','partyAction'].includes(msg.type))return reject(ws,'Only the Dungeon Master may edit the dungeon',msg.seq);
   // Each DM token has its own monotonic sequence; survives browser/socket reconnection.
   if(!Number.isSafeInteger(msg.seq)||msg.seq<0)return reject(ws,'Command requires a non-negative sequence number',msg.seq);
   if(msg.seq<=member.lastSeq){send(ws,{type:'ack',seq:msg.seq,duplicate:true,version:room.dungeon.version});return;}
   // A rejected command also consumes its seq: retry requires a new one, cannot race stale commands.
   member.lastSeq=msg.seq;
   try{
     if(msg.type==='setLoadout'){if(c.role!=='party'||!['BUILD','LOCKED'].includes(room.dungeon.phase))throw Error('Loadouts are locked for an active match');if(member.ready)throw Error('Unready before changing your loadout');member.loadout=validateLoadout(msg.loadout);}
     else if(msg.type==='setReady'){if(c.role!=='party'||!['BUILD','LOCKED'].includes(room.dungeon.phase))throw Error('Ready is only available in the lobby');if(msg.ready===true&&!member.loadout)throw Error('Choose your weapon and dodge before readying');member.ready=msg.ready===true;}
     else if(msg.type==='startMatch'){if(!room.party.some(p=>p&&ready(p.ws)))throw Error('At least one Party player must join');if(room.party.some(p=>p&&(!p.ready||!p.loadout||!ready(p.ws))))throw Error('All reserved players must be online and ready');room.match=new DungeonMatch(room.dungeon,room.party,now());}
     else if(['playerInput','partyAction'].includes(msg.type)){if(c.role!=='party')throw Error('Party input requires a Party seat');if(!room.match||room.dungeon.phase!=='ACTIVE')throw Error('Match is not active');if(msg.type==='playerInput')room.match.input(c.slot,msg,now());else {if(['weapon','dodgeChoice'].includes(msg.action))throw Error('Loadout is locked during the match');room.match.action(c.slot,msg,now());}}
     else if(msg.type.startsWith('dm')){if(!room.match||room.dungeon.phase!=='ACTIVE')throw Error('Match is not active');room.match.dm(msg,now());}
     else if(msg.type==='newRound'){if(room.dungeon.phase==='ACTIVE')throw Error('Finish the active match first');room.match=null;room.dungeon.reset();for(const p of room.party)if(p)p.ready=false;}
     else if(msg.type==='beginBuild') {if(room.dungeon.phase==='LOCKED')room.dungeon.unlockDungeon();else if(room.dungeon.phase!=='BUILD')throw Error('Match has already begun');}
     else room.dungeon[msg.type](msg);
     if(!['playerInput','dmInput'].includes(msg.type)){send(ws,{type:'ack',seq:msg.seq,version:room.dungeon.version});notify(room);}
   }catch(err){reject(ws,err?.message||'Invalid build action',msg.seq);}
 }
 function attach(ws){clients.add(ws);ws._dungeon=null;ws.on('message',raw=>{const t=now();if(!ws._rate||t-ws._rate.at>=1000)ws._rate={at:t,n:0};if(++ws._rate.n>100||String(raw).length>8192)return;let msg;try{msg=JSON.parse(String(raw));}catch{return reject(ws,'Malformed JSON');}if(!msg||typeof msg!=='object'||Array.isArray(msg))return reject(ws,'Invalid packet');if(msg.type==='hostRoom')host(ws);else if(msg.type==='joinParty')join(ws,msg);else if(msg.type==='rejoin')rejoin(ws,msg);else if(msg.type==='ping')send(ws,{type:'pong',at:msg.at,serverTimeMs:now()});else command(ws,msg);});ws.on('close',()=>{detach(ws);clients.delete(ws);});ws.on('error',()=>{detach(ws);clients.delete(ws);});}
 function step(){ticks++;for(const room of rooms.values())if(room.match)room.match.tick(1/30,now());}
 function broadcast(){for(const room of rooms.values()){room.stateSeq++;
   if(ready(room.dm.ws))sendState(room,room.dm.ws,'dm');
   for(let i=0;i<6;i++)if(ready(room.party[i]?.ws))sendState(room,room.party[i].ws,'party',i);
 }}
 function clearInactive(){for(const [id,r] of rooms)if(!ready(r.dm.ws)&&!r.party.some(p=>ready(p?.ws))&&now()-r.lastPresence>(r.dungeon.phase==='ACTIVE'?2700000:120000))rooms.delete(id);}
 function start(){if(interval)return;let last=now(),acc=0;interval=setInterval(()=>{const t=now();acc+=Math.min(125,Math.max(0,t-last))/1000;last=t;let n=0;while(acc+1e-9>=1/30&&n++<4){step();acc-=1/30;}},1000/30);interval.unref?.();clock=setInterval(broadcast,50);clock.unref?.();cleanup=setInterval(clearInactive,10000);cleanup.unref?.();}
 function stop(){for(const t of [interval,clock,cleanup])if(t)clearInterval(t);interval=clock=cleanup=null;}
 if(autoTimers)start();return {attach,rooms,clients,step,broadcast,clearInactive,stop,start,get ticks(){return ticks;}};
}
