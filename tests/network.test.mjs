import assert from 'node:assert/strict';
import {createGame,serialize} from '../src/engine.js';
import {hostRoomWithClient,joinRoomWithClient,normalizeRoomCode,isValidRoomCode,describeNetworkError} from '../src/network.js';

class MemoryRealtimeDatabase{
  data={};listeners=[];blockPartyRead=false;
  key(path){return path.split('/').filter(Boolean);}
  read(path){return this.key(path).reduce((val,key)=>val?.[key],this.data)??null;}
  write(path,value){
    const segments=this.key(path);let node=this.data;
    for(const key of segments.slice(0,-1))node=node[key]??={};
    if(value===null||value===undefined)delete node[segments.at(-1)];
    else node[segments.at(-1)]=structuredClone(value);
    for(const l of this.listeners){
      if(path.startsWith(l.path)||l.path.startsWith(path))l.onData({val:()=>structuredClone(this.read(l.path))});
    }
  }
  client(uid){
    const store=this;
    const ref=(_db,path)=>({path});
    function checkRead(path){if(store.blockPartyRead&&uid!=='dm'&&path.includes('/state'))throw Object.assign(new Error('Permission denied'),{code:'PERMISSION_DENIED'});}
    function checkWrite(path,value){
      const bits=path.split('/');
      if(bits[2]==='meta'||bits[2]==='state'){
        if(bits[2]==='state'&&store.read(`rooms/${bits[1]}/meta`)?.hostUid!==uid)throw Object.assign(new Error('Permission denied'),{code:'PERMISSION_DENIED'});
      }
      if(bits[2]==='slots'){
        const existing=store.read(path);
        if(value!==null&&value?.uid!==uid ||existing&&existing.uid!==uid)throw Object.assign(new Error('Permission denied'),{code:'PERMISSION_DENIED'});
      }
      if(bits[2]==='inputs'&&bits[3]!==uid)throw Object.assign(new Error('Permission denied'),{code:'PERMISSION_DENIED'});
    }
    return {
      uid,db:{},ref,
      async get(r){checkRead(r.path);return {val:()=>structuredClone(store.read(r.path))};},
      async set(r,v){checkWrite(r.path,v);store.write(r.path,v);},
      async remove(r){checkWrite(r.path,null);store.write(r.path,null);},
      async runTransaction(r,updater){
        checkRead(r.path);
        const value=updater(structuredClone(store.read(r.path)));
        if(value===undefined)return {committed:false};
        checkWrite(r.path,value);store.write(r.path,value);
        return {committed:true};
      },
      onValue(r,onData,_onError){
        const listener={path:r.path,onData};store.listeners.push(listener);
        onData({val:()=>structuredClone(store.read(r.path))});
        return ()=>{store.listeners=store.listeners.filter(l=>l!==listener)};
      },
      onDisconnect(r){return {
        async remove(){return;},async set(){return;},async cancel(){return;}
      };}
    };
  }
}
const check=async(name,fn)=>{await fn();console.log('✓',name);};
await check('Six-character room code excludes confusing letters/numbers and normalizes paste',async()=>{
 assert.ok(isValidRoomCode('ABC234'));
 assert.equal(normalizeRoomCode(' ab c-234 '),'ABC234');
 assert.ok(!isValidRoomCode('O0I111'));
});
await check('DM creates a match; Party can join from a different Firebase UID and get initial state',async()=>{
 const db=new MemoryRealtimeDatabase();let latest=null,roster={};
 const host=await hostRoomWithClient(db.client('dm'),serialize(createGame()),v=>roster=v,()=>{});
 assert.ok(isValidRoomCode(host.code));
 const party=await joinRoomWithClient(db.client('player-A'),host.code.toLowerCase(),0,'Asya',v=>latest=v,()=>{});
 assert.equal(party.code,host.code);assert.equal(latest.players.length,6);
 assert.equal(roster[0].name,'Asya');
 await party.send({mx:1,my:0,aimX:200,aimY:100});
 assert.equal(db.read(`rooms/${host.code}/inputs/player-A`).mx,1);
 const next=serialize(createGame());next.time=1199;
 await host.publish(next);assert.equal(latest.time,1199);
 await party.leave();assert.equal(db.read(`rooms/${host.code}/slots/0`),null);
 host.close();
});
await check('Two different players can choose unique character slots',async()=>{
 const db=new MemoryRealtimeDatabase();const host=await hostRoomWithClient(db.client('dm'),serialize(createGame()),()=>{},()=>{});
 const first=await joinRoomWithClient(db.client('a'),host.code,2,'Alex',()=>{},()=>{});
 await assert.rejects(joinRoomWithClient(db.client('b'),host.code,2,'Alex copy',()=>{},()=>{}),/already selected/);
 const second=await joinRoomWithClient(db.client('b'),host.code,4,'Fourth',()=>{},()=>{});
 assert.equal(db.read(`rooms/${host.code}/slots/4`).name,'Fourth');
 await first.leave();await second.leave();host.close();
});
await check('Wrong room code, invalid code and disconnected DM give meaningful errors',async()=>{
 const db=new MemoryRealtimeDatabase(),party=db.client('a');
 await assert.rejects(joinRoomWithClient(party,'p@sswd',0,'A',()=>{},()=>{}),/ROOM CODE/);
 await assert.rejects(joinRoomWithClient(party,'ABC234',0,'A',()=>{},()=>{}),/does not exist/);
 const host=await hostRoomWithClient(db.client('dm'),serialize(createGame()),()=>{},()=>{});
 db.write(`rooms/${host.code}/meta/status`,'disconnected');
 await assert.rejects(joinRoomWithClient(party,host.code,0,'A',()=>{},()=>{}),/NEW room/);
 host.close();
});
await check('Permission problem is exposed BEFORE saying player is connected',async()=>{
 const db=new MemoryRealtimeDatabase();const host=await hostRoomWithClient(db.client('dm'),serialize(createGame()),()=>{},()=>{});
 db.blockPartyRead=true;
 await assert.rejects(joinRoomWithClient(db.client('a'),host.code,0,'A',()=>{},()=>{}),/Permission denied/);
 assert.equal(db.read(`rooms/${host.code}/slots/0`),null);
 assert.match(describeNetworkError({code:'PERMISSION_DENIED'}),/database\.rules\.json/);
 host.close();
});
await check('A missing initial state blocks joins even if DM room exists',async()=>{
 const db=new MemoryRealtimeDatabase();const host=await hostRoomWithClient(db.client('dm'),serialize(createGame()),()=>{},()=>{});
 db.write(`rooms/${host.code}/state`,null);
 await assert.rejects(joinRoomWithClient(db.client('a'),host.code,0,'A',()=>{},()=>{}),/no valid game state/);
 assert.equal(db.read(`rooms/${host.code}/slots/0`),null);
 host.close();
});
console.log('All network mock tests passed.');
