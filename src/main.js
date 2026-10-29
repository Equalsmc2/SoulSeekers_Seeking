import {cityTilesReady,drawKenneyWorld,drawKenneyFort,drawKenneyChest,onCityTilesLoaded} from './city-art.js?v=R033';
// R02: dedicated Node/WebSocket server owns online gameplay. Offline training is standalone.
import {WORLD,HEROES,ITEMS,BUILDINGS,SHOPS,CHEST_SPOTS,MAP_X,BOSTON_DISTRICTS,JUNGLES,JUNGLE_COVER,STREET_COVER,JUNGLE_LANDMARKS,JUNGLE_LOOP_CROSSINGS,jungleHalfWidth,jungleTrailY,LANE_NAMES,CONNECTORS,laneY,jungleY,nearestLane,clamp,dist} from './data.js?v=R033';
import {createGame,tick,dmSpawn,giveMarchOrder,teamHasShop,towerExposed} from './engine.js?v=R033';
import {newPrediction,predictStep,reconcileWithLatency,tweenPosition,receiveEntityMotion,createPlaybackClock} from './prediction.js?v=R033';
import {connectMatch,normalizeEndpoint,describeSocketError} from './socket-network.js?v=R033';
function normalizeRoomCode(code){return String(code??'').trim().toUpperCase().replace(/[\s-]/g,'');}
function describeNetworkError(error){return describeSocketError(error);}
function getServerAddress(){return $('gameServerUrl').value.trim();}
function readyServerInput(){
  const normalized=normalizeEndpoint(getServerAddress());
  try{localStorage.setItem('seekingServerUrl',normalized);}catch{}return normalized;
}
function checkServerConfig(){
  const params=new URLSearchParams(location.search);
  const inUrl=params.get('server');
  let stored=null;try{stored=localStorage.getItem('seekingServerUrl');}catch{}
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  const guess=local ? 'ws://localhost:8787/ws' : (location.hostname.endsWith('.onrender.com')?'wss://'+location.host+'/ws':'');
  const initial=inUrl||stored||guess;
  $('gameServerUrl').value=initial;
  const room=params.get('room');if(room)$('roomCodeInput').value=normalizeRoomCode(room);
  $('firebaseStatus').textContent=initial?'SERVER ADDRESS SET':'SERVER ADDRESS REQUIRED';
  if(!initial)menuMessage('Offline training works now. For online games, paste your Render server URL, then Host or Join.');
}
const $=id=>document.getElementById(id);
const canvas=$('gameCanvas');let ctx=canvas.getContext('2d');const screenCtx=ctx;
let worldCache=null;
onCityTilesLoaded(()=>{ worldCache=null; });
let game=null,mode='menu',net=null,activeSlot=0,selectedHero=0,lane=1,possessed=null,placementType=null;
let netInputs={},netSlots={},selectedItem=null,inventoryVisible=true,renderedWinner=null;
let actionSeq=0,pendingAction=null,lastTime=performance.now(),lastInputSend=0,lastUI=0;
let toastTimeout=null,chosenMouse={x:0,y:0,down:false,worldX:0,worldY:0},keys=new Set();
const camera={x:WORLD.partyX+280,y:1000,zoom:.95},remotePositions=new Map();
let predictedPlayer=null,renderClock=performance.now();
const motionClock=createPlaybackClock();
const frameSamples=[];
let frameCount=0,frameWindowStarted=performance.now(),displayFps=0,qualityScale=1,slowFrames=0,fastFrames=0;
let width=1000,height=700,frameId=null,simTimer=null,lastSimTime=performance.now();
let receivedStateAt=0,lastInputFingerprint='',lastDMFingerprint='',lastDMSend=0,inventoryFingerprint='',lastRenderTime=performance.now();
const INPUT_RATE=33, INPUT_HEARTBEAT=170;
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
function menuMessage(text,isError=false){
  $('menuMessage').textContent=text;
  $('menuMessage').classList.toggle('error',isError);
}
function liveNetworkError(error){
  const message=describeNetworkError(error);
  $('syncAlert').textContent=`MULTIPLAYER CONNECTION: ${message}`;
  $('syncAlert').classList.remove('hidden');
  $('connection').textContent='MULTIPLAYER SYNC ERROR';
  console.error('SoulSeekers online sync error:',error);
}
function setRoomCode(code){
  $('copyRoomCode').textContent=`ROOM ${code} · COPY`;
  $('copyRoomCode').classList.remove('hidden');$('copyInvite').classList.remove('hidden');
}

function setupChoices(){
  HEROES.forEach((h,i)=>{const b=document.createElement('button');b.type='button';b.className='hero-choice'+(i===selectedHero?' chosen':'');b.style.setProperty('--hero',h.color);
    b.innerHTML=`<div class="hero-icon">${['Ø','☾','Ⅲ','◇','✛','✦'][i]}</div><b>${h.name.toUpperCase()}</b><small>${h.role}</small>`;
    b.onclick=()=>{selectedHero=i;document.querySelectorAll('.hero-choice').forEach((el,j)=>el.classList.toggle('chosen',i===j));};$('heroChoices').append(b);});
  $('firebaseStatus').textContent='CHECKING CONFIG / OFFLINE READY';
  $('roomCodeInput').addEventListener('input',e=>{e.target.value=normalizeRoomCode(e.target.value);});
  $('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinOnline').click();});
  $('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinOnline').click();});
  $('copyRoomCode').onclick=async()=>{if(!net?.code)return;try{await navigator.clipboard.writeText(net.code);notify(`Copied room ${net.code}`);}catch{window.prompt('Copy the room code:',net.code);}};
  $('copyInvite').onclick=async()=>{if(!net?.code)return;const invite=new URL(location.href);invite.searchParams.set('server',net.endpoint);invite.searchParams.set('room',net.code);try{await navigator.clipboard.writeText(invite.toString());notify('Invite link copied!');}catch{window.prompt('Copy this invite link:',invite.toString());}};
  $('gameServerUrl').addEventListener('change',()=>{$('firebaseStatus').textContent=$('gameServerUrl').value.trim()?'SERVER ADDRESS SET':'SERVER ADDRESS REQUIRED';});
  $('dmUnits').innerHTML=[['grunt','GRUNT',12],['brute','BRUTE',30],['sniper','SNIPER',24]].map(([id,n,c])=>`<button class="dm-unit" data-unit="${id}"><span>${n}</span><b>${c} THREAT +</b></button>`).join('');
  $('dmUnits').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(!game)return;placementType=b.dataset.unit;possessed=null;notify(`Click the battlefield to deploy a ${placementType.toUpperCase()}. ESC cancels.`);});
  $('shopItems').innerHTML=Object.entries(ITEMS).map(([id,d])=>`<button class="shop-card" data-buy="${id}"><b>${d.icon} ${d.name}</b><span>${d.price} GOLD</span></button>`).join('');
  $('shopItems').querySelectorAll('button').forEach(b=>b.onclick=()=>queueAction({type:'buy',item:b.dataset.buy}));
  document.querySelectorAll('.lane').forEach(b=>b.onclick=()=>{lane=Number(b.dataset.lane);if(isDM()&&!possessed)camera.y=laneY(camera.x,lane);document.querySelectorAll('.lane').forEach(el=>el.classList.toggle('active',el===b));});
  $('toggleInventory').onclick=()=>{inventoryVisible=!inventoryVisible;$('inventoryWrap').classList.toggle('hidden',!inventoryVisible);};
  $('useItemButton').onclick=()=>{if(selectedItem)queueAction({type:'item',id:selectedItem});};
  $('soloParty').onclick=()=>startLocal('party');$('soloDM').onclick=()=>startLocal('dm');
  $('menuButton').onclick=()=>location.reload();$('endRestart').onclick=()=>location.reload();
  $('hostOnline').onclick=async()=>{
    $('hostOnline').disabled=true;
    try{
      menuMessage('Connecting to the dedicated game server...');
      motionClock.reset();remotePositions.clear();
      net=await connectMatch({endpoint:readyServerInput(),role:'dm',
        onState:acceptNetworkState,onRoster:slots=>{netSlots=slots;},
        onEvent:notify,onConnection:status=>{$('connection').textContent=status;}});
      mode='onlineDM';camera.x=5790;camera.y=1000;startSimulation();
      $('connection').textContent='GAME SERVER CONNECTED';$('roomLabel').textContent=`ROOM ${net.code} · SHARE THIS CODE`;
      setRoomCode(net.code);
      leaveMenu();notify(`Room ${net.code} created. Copy and share it with your Party.`);
    }catch(e){menuMessage(describeNetworkError(e),true);console.error('Host failed:',e);}
    finally{$('hostOnline').disabled=false;}
  };
  $('joinOnline').onclick=async()=>{
    const code=normalizeRoomCode($('roomCodeInput').value);
    $('joinOnline').disabled=true;
    try{
      menuMessage('Connecting to the dedicated game server...');
      activeSlot=selectedHero;predictedPlayer=null;remotePositions.clear();motionClock.reset();
      net=await connectMatch({endpoint:readyServerInput(),role:'party',code,slot:selectedHero,
        name:$('playerName').value||HEROES[selectedHero].name,
        onState:acceptNetworkState,onRoster:slots=>{netSlots=slots;},
        onEvent:notify,onConnection:status=>{$('connection').textContent=status;}});
      if(!game)throw new Error('Game server did not provide a match state.');
      mode='onlineParty';camera.x=WORLD.partyX+250;camera.y=laneY(camera.x,selectedHero%3);startSimulation();
      $('connection').textContent='GAME SERVER CONNECTED';$('roomLabel').textContent=`ROOM ${net.code}`;
      leaveMenu();notify('Connected to DM host. Advance with your party!');
    }catch(e){menuMessage(describeNetworkError(e),true);console.error('Join failed:',e);}
    finally{$('joinOnline').disabled=false;}
  };
}
function leaveMenu(){ $('menuLayer').classList.add('hidden');$('roleBadge').textContent=isDM()?'DUNGEON MASTER':'PARTY OPERATIVE';
  $('dmPanel').classList.toggle('hidden',!isDM());$('playerPanel').classList.toggle('hidden',isDM());
  $('controls').innerHTML=isDM()?'WASD POSSESSED ENEMY <b>·</b> CLICK ENEMY TO POSSESS <b>·</b> MOUSE FIRE <b>·</b> RIGHT CLICK TO COMMAND <b>·</b> ARROWS PAN <b>·</b> ESC RELEASE':'WASD MOVE <b>·</b> MOUSE FIRE <b>·</b> Q SPELL <b>·</b> E ECHO <b>·</b> SPACE DASH <b>·</b> F CHEST <b>·</b> B SHOP <b>·</b> I INVENTORY';
}
function acceptNetworkState(state,serverTimeMs){
  const arrived=performance.now();
  receivedStateAt=arrived;
  game=state;
  // Positions are indexed by server simulation time, NOT packet-arrival time.
  // The latter varies when Render/Zen delivers bursts of WebSocket traffic.
  const stamp=Number.isFinite(serverTimeMs)?serverTimeMs:Number(state.elapsed||0)*1000;
  motionClock.receive(stamp,arrived);
  receiveEntityMotion(remotePositions,[...(state.players||[]),...(state.enemies||[]),...(state.bullets||[])],stamp);
  if(mode==='onlineParty'){
    const server=state.players?.[activeSlot];
    if(server){
      const control=currentInput();
      // Approximate the transit time since the authoritative sample. The
      // expected in-flight movement is not an error to correct backwards.
      const oneWay=clamp((net?.latency||100)/2000+.025,.025,.17);
      predictedPlayer=reconcileWithLatency(predictedPlayer,server,control,oneWay);
    }
  }
}
function isDM(){return mode==='dm'||mode==='onlineDM';}
function isHost(){return mode==='party'||mode==='dm';}
function startLocal(role){mode=role;game=createGame();activeSlot=0;predictedPlayer=null;remotePositions.clear();
  if(role==='party' && selectedHero!==0){game.players[0].hero=selectedHero;game.players[selectedHero].hero=0;}
  camera.x=role==='dm'?5790:WORLD.partyX+250;camera.y=role==='dm'?1000:game.players[0].y;
  inventoryFingerprint='';startSimulation();
  leaveMenu();notify(role==='dm'?'The field is yours. Choose a unit to possess.':'Push the lane. Kill bosses to expose their forts.');
}
function queueAction(a){if(isDM()||mode==='menu')return;pendingAction=a;actionSeq++;}
function currentInput(){
  const p=game?.players?.[activeSlot];
  const left=keys.has('a'),right=keys.has('d'),up=keys.has('w'),down=keys.has('s');
  return {mx:Number(right)-Number(left),my:Number(down)-Number(up),fire:chosenMouse.down,
    aimX:Math.round(chosenMouse.worldX),aimY:Math.round(chosenMouse.worldY),
    ability:keys.has('q'),echo:keys.has('e'),dash:keys.has(' '),actionSeq,action:pendingAction||null};
}
function dmInput(){return {possess:possessed,mx:Number(keys.has('d'))-Number(keys.has('a')),
  my:Number(keys.has('s'))-Number(keys.has('w')),aimX:chosenMouse.worldX,aimY:chosenMouse.worldY,fire:chosenMouse.down};}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5)*qualityScale;width=Math.max(1,r.width);height=Math.max(1,r.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function scrToWorld(sx,sy){return {x:(sx-width/2)/camera.zoom+camera.x,y:(sy-height/2)/camera.zoom+camera.y};}
function refreshPointerAim(){const w=scrToWorld(chosenMouse.x,chosenMouse.y);chosenMouse.worldX=w.x;chosenMouse.worldY=w.y;}
function mouseWorld(e){const r=canvas.getBoundingClientRect();chosenMouse.x=e.clientX-r.left;chosenMouse.y=e.clientY-r.top;refreshPointerAim();}
function updateCamera(dt){if(!game)return;let tx=camera.x,ty=camera.y;
  if(!isDM()){const p=game.players?.[activeSlot];if(p){const display=entityPosition(p);tx=display.x;ty=display.y;}}
  else if(possessed){const e=game.enemies?.find(v=>v.id===possessed&&v.hp>0);if(e){const display=entityPosition(e);tx=display.x;ty=display.y;}else {possessed=null;notify('Possessed unit eliminated.');}}
  else{const v=530*dt/camera.zoom;camera.x+=(Number(keys.has('arrowright'))-Number(keys.has('arrowleft')))*v;camera.y+=(Number(keys.has('arrowdown'))-Number(keys.has('arrowup')))*v;}
  if(!isDM()||possessed){const f=Math.min(1,dt*7);camera.x+=(tx-camera.x)*f;camera.y+=(ty-camera.y)*f;}
  camera.x=clamp(camera.x,0,WORLD.width);camera.y=clamp(camera.y,0,WORLD.height);
}
// Offline training runs its own local timer; multiplayer simulation is server-owned.
// The browser's interval only samples inputs and updates UI.
function startSimulation(){
  lastSimTime=performance.now();
  frameWindowStarted=lastSimTime;frameCount=0;displayFps=0;frameSamples.length=0;
  if(simTimer===null && typeof window.setInterval==='function'){
    simTimer=window.setInterval(simulationPulse,33);
  }
}
function simulationPulse(){
  if(!game)return;
  const now=performance.now();
  refreshPointerAim();
  const elapsed=Math.max(0,(now-lastSimTime)/1000);
  lastSimTime=now;
  if(isHost()){
    // The engine clamps large dt; divide delayed pulses into safe increments.
    const simTime=Math.min(elapsed,1);
    const count=Math.max(1,Math.ceil(simTime/.055));
    const step=simTime/count;
    const inputs={};
    if(mode==='party')inputs[0]=currentInput();
    for(let i=0;i<count;i++)tick(game,step,inputs,isDM()?dmInput():null);
  }else if(mode==='onlineDM'&&net){
    const input=dmInput(),fingerprint=JSON.stringify(input);
    if(now-lastDMSend>=INPUT_RATE && (fingerprint!==lastDMFingerprint || now-lastDMSend>=INPUT_HEARTBEAT)){
      net.sendDMInput(input);lastDMSend=now;lastDMFingerprint=fingerprint;
    }
  }else if(mode==='onlineParty'&&net){
    const input=currentInput();
    const player=game.players?.[activeSlot];
    const fingerprint=JSON.stringify(input);
    if(now-lastInputSend>=INPUT_RATE && (fingerprint!==lastInputFingerprint || now-lastInputSend>=INPUT_HEARTBEAT)){
      lastInputSend=now;lastInputFingerprint=fingerprint;net.sendInput(input);
    }
  }
  // A backgrounded DM tab cannot slow the authoritative server simulation.
  if(!document.hidden && now-lastUI>=170){lastUI=now;refreshUI();}
  if(game.status==='finished'&&renderedWinner!==game.winner){
    renderedWinner=game.winner;
    $('endOverlay').classList.remove('hidden');
    $('endTitle').textContent=game.winner==='party'?'PARTY VICTORY':'DM VICTORY';
    $('endTitle').style.color=game.winner==='party'?'#79e5d4':'#e88f9c';
  }
}
function refreshUI(){if(!game)return;
  const t=Math.max(0,Math.ceil(game.time||0));$('clock').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  $('towerHp').textContent=towerExposed(game)?`${Math.ceil(game.towerHp??4200)} / ${game.towerMaxHp??4200}`:'SHIELDED';
  $('towerBar').style.width=`${100*(game.towerHp??4200)/(game.towerMaxHp??4200)}%`;
  $('victoryRule').textContent=towerExposed(game)?'The DM Tower can now take damage':'Destroy 4 of 6 forts to expose the Tower';
  const alive=(game.forts||[]).filter(f=>!f.broken).length;
  $('threat').textContent=Math.floor(game.threat||0);$('armySize').textContent=game.enemyCount??game.enemies?.length??0;$('fortCount').textContent=alive;
  $('possession').textContent=possessed?`POSSESSED: ${possessed.toUpperCase()}`:'NO UNIT POSSESSED';
  for(const b of $('dmUnits').querySelectorAll('button')){const cost={grunt:12,brute:30,sniper:24}[b.dataset.unit];b.disabled=!isDM()||game.threat<cost;}
  const p=game.players?.[activeSlot];
  if(p){const h=HEROES[p.hero]||HEROES[0];$('heroName').textContent=h.name.toUpperCase();$('heroTitle').textContent=h.title;
    $('hpText').textContent=`${Math.ceil(p.hp)}/${p.maxHp}`;$('hpBar').style.width=`${100*p.hp/p.maxHp}%`;
    $('level').textContent=String(p.level).padStart(2,'0');$('gold').textContent=Math.floor(p.gold);$('kills').textContent=p.kills;
    $('xpText').textContent=`${Math.floor(p.xp)} / ${p.level*90}`;$('xpBar').style.width=`${100*p.xp/(p.level*90)}%`;
    const shopping=teamHasShop(p);$('shopRange').textContent=shopping?'SHOP OPEN':'OUT OF RANGE';
    $('shopItems').querySelectorAll('button').forEach(b=>b.disabled=!shopping||p.gold<ITEMS[b.dataset.buy].price||p.hp<=0);
    refreshInventory(p);
  }
  $('log').innerHTML=(game.log||[]).slice(0,6).map(msg=>`<div>${escapeHTML(msg)}</div>`).join('');
  if(mode==='onlineParty'){
    const age=performance.now()-receivedStateAt;
    if(age>1600){$('connection').textContent='SERVER UPDATES DELAYED / RECONNECTING';}
    else {$('connection').textContent=`SERVER / ${Math.round(age)}ms SNAPSHOT AGE · ${net?.latency||0}ms RTT`;}
  }
  if(mode==='onlineDM'&&net){
    const age=performance.now()-receivedStateAt;
    $('connection').textContent=age>1600?'SERVER UPDATES DELAYED / RECONNECTING':`SERVER / DM ACTIVE · ${net.latency||0}ms RTT`;
  }
  const present=Array.isArray(netSlots)?netSlots.filter(s=>s.connected).length:0;
  const perf=$('perfStats');
  if(perf){
    const fps=displayFps||'–',rtt=net?.latency||0,rate=net?.snapshotRate||0,jitter=net?.jitter||0;
    const sorted=frameSamples.length>20?[...frameSamples].sort((a,b)=>a-b):[];
    const p95=sorted.length?Math.round(sorted[Math.floor((sorted.length-1)*.95)]):0;
    const hitches=frameSamples.filter(ms=>ms>34).length;
    const flags=[];
    if(p95>26)flags.push('FRAME HITCHES');
    if(displayFps>0&&displayFps<42)flags.push('LOW FPS');
    if(rate>0&&rate<12)flags.push('SLOW SERVER UPDATES');
    if(jitter>30)flags.push('UNEVEN NETWORK');
    perf.textContent=`${fps} FPS · P95 ${p95||'–'}ms · ${hitches} HITCHES · ${isHost()?'OFFLINE':rate+' NET/s · '+rtt+'ms RTT · '+jitter+'ms NET JITTER'}${flags.length?' · '+flags.join(' / '):''}`;
    perf.classList.toggle('warning',flags.length>0);
  }
  $('onlineRoster').textContent=mode==='onlineDM' ?`ROOM ${net?.code||''} / ${present} OF 6 PLAYERS JOINED`:mode==='onlineParty'?`ROOM ${net?.code||''} / ${present} PLAYERS`:'LOCAL TRAINING / AI TEAMMATES';
}
function escapeHTML(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function refreshInventory(p){
  const nextFingerprint=activeSlot+'|'+selectedItem+'|'+JSON.stringify(p.inventory||[]);
  if(inventoryFingerprint===nextFingerprint)return;
  inventoryFingerprint=nextFingerprint;
  const grid=$('invGrid');grid.replaceChildren();
  for(let y=0;y<5;y++)for(let x=0;x<8;x++){
    const cell=document.createElement('div');cell.className='inv-cell';cell.style.gridColumn=String(x+1);cell.style.gridRow=String(y+1);
    cell.onclick=()=>{
      if(!selectedItem)return;
      queueAction({type:'moveItem',id:selectedItem,x,y});
    };grid.append(cell);
  }
  for(const item of p.inventory||[]){const d=ITEMS[item.type];if(!d)continue;
    const w=item.rotated?d.h:d.w,h=item.rotated?d.w:d.h;
    const tile=document.createElement('div');tile.className='inv-item'+(item.id===selectedItem?' selected':'');tile.style.gridColumn=`${item.x+1}/span ${w}`;tile.style.gridRow=`${item.y+1}/span ${h}`;
    tile.innerHTML=`${d.icon}<small>${escapeHTML(d.name)}</small>`;
    tile.onclick=()=>{selectedItem=item.id;refreshInventory(p);};grid.append(tile);
  }
  const it=p.inventory?.find(v=>v.id===selectedItem),d=it&&ITEMS[it.type];
  $('itemInfo').textContent=d?`${d.name} (${d.w}×${d.h}): ${d.desc}`:'Select an item for details.';
  $('useItemButton').disabled=!d||!['bandage','battery'].includes(it.type);
}
function traceRoute(fn,from=0,to=WORLD.width,step=28){
  ctx.beginPath();ctx.moveTo(from,fn(from));for(let x=from+step;x<to;x+=step)ctx.lineTo(x,fn(x));ctx.lineTo(to,fn(to));
}
function routeStroke(fn,from,to,wide,color,dash=null){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=wide;ctx.lineJoin='round';ctx.lineCap='round';
  if(dash)ctx.setLineDash(dash);traceRoute(fn,from,to);ctx.stroke();ctx.restore();
}
function labelAt(x,y,a,b,color='#c3d8d3'){
  ctx.textAlign='center';ctx.fillStyle=color;ctx.font='bold 22px Consolas, monospace';ctx.fillText(a,x,y);
  if(b){ctx.fillStyle='#859da0';ctx.font='14px Consolas, monospace';ctx.fillText(b,x,y+24);}ctx.textAlign='left';
}
// R03.1 static district art is cached once and never rendered every frame.
// All geometry remains 90-degree orthographic, with collision-visible cover.
function stampedRand(n){let t=Math.sin(n*12.9898+78.233)*43758.5453;return t-Math.floor(t);}
function drawJungleDistrict(index){
  const upper=index===0;
  const from=1100,to=5780;
  ctx.save();
  // Actual buildable floor, >2x the former 207px-wide jungle corridor.
  ctx.beginPath();
  for(let x=from;x<=to;x+=24){const yy=jungleY(x,index)-jungleHalfWidth(x);if(x===from)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}
  for(let x=to;x>=from;x-=24)ctx.lineTo(x,jungleY(x,index)+jungleHalfWidth(x));
  ctx.closePath();
  ctx.fillStyle=upper?'#123c32':'#302e36';ctx.fill();
  ctx.lineWidth=6;ctx.strokeStyle=upper?'#54856d':'#876d63';ctx.stroke();
  // Warm civic stone in the Common, steel grating and concrete in the Underworks.
  for(let x=1190;x<5760;x+=68){
    const half=jungleHalfWidth(x),center=jungleY(x,index);
    for(let side=-1;side<=1;side+=2){
      const yy=center+side*(half-31);
      if(upper){
        const r=18+stampedRand(x+side*19)*17;
        ctx.fillStyle='#0d2923';ctx.beginPath();ctx.arc(x+8,yy+6,r+5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=['#2c694e','#356f55','#456c4b','#316752'][Math.floor(stampedRand(x*2+side)*4)];
        ctx.beginPath();ctx.arc(x,yy,r,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#62936c';ctx.beginPath();ctx.arc(x-r*.22,yy-r*.24,r*.42,0,Math.PI*2);ctx.fill();
      }else{
        ctx.fillStyle='#4e4141';ctx.fillRect(x-23,yy-17,56,32);
        ctx.strokeStyle='#8c6e5c';ctx.lineWidth=2;ctx.strokeRect(x-22,yy-16,54,30);
        ctx.fillStyle='#ba7544';ctx.fillRect(x+3,yy-13,4,25);
      }
    }
    // Static ground texture in large open arena areas, intentionally subtle.
    const n=stampedRand(x*7+index*51),y=center+(n-.5)*250;
    ctx.globalAlpha=upper?.22:.14;
    ctx.fillStyle=upper?'#96b49a':'#e3a175';
    ctx.fillRect(x,y,9+Math.floor(n*12),2);
    ctx.globalAlpha=1;
  }
  // Three continuous, separate loop routes through each region.
  const colors=upper?['#819b87','#adbe9b','#8caa93']:['#677077','#899297','#707a83'];
  for(let branch=-1;branch<=1;branch++){
    const fn=x=>jungleTrailY(x,index,branch);
    routeStroke(fn,1180,5720,branch===0?64:62,upper?'#334d42':'#1d292e');
    routeStroke(fn,1180,5720,branch===0?46:43,colors[branch+1]);
    routeStroke(fn,1180,5720,2,upper?'#d4dcc0':'#bd9285',upper?[12,30]:[30,14]);
  }
  // Six internal return connections create loops and shorter flanking fights.
  for(const cx of JUNGLE_LOOP_CROSSINGS){
    const top=jungleTrailY(cx,index,-1),bottom=jungleTrailY(cx,index,1);
    ctx.lineCap='round';ctx.lineWidth=52;ctx.strokeStyle=upper?'#334d42':'#1d292e';
    ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx,bottom);ctx.stroke();
    ctx.lineWidth=35;ctx.strokeStyle=upper?'#b9c5a4':'#76878c';ctx.stroke();
    ctx.lineWidth=2;ctx.strokeStyle=upper?'#dbe1be':'#e0b9a1';ctx.setLineDash([8,14]);ctx.stroke();ctx.setLineDash([]);
    for(const sy of [top,bottom]){
      ctx.fillStyle=upper?'#d1d7b5':'#e8ac84';
      for(let i=-1;i<=1;i++)ctx.fillRect(cx+i*11-3,sy-22,7,8);
    }
  }
  if(upper){
    // Boston Common / Public Garden ornaments, coherent north-jungle language.
    for(const x of [1350,2450,2950,3750,4250,5300]){
      const cy=jungleY(x,0);ctx.strokeStyle='#d8c6a2';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(x,cy,95,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#263f37';for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        const ax=x+92*Math.cos(angle),ay=cy+92*Math.sin(angle);
        ctx.fillRect(ax-13,ay-5,26,10);
      }
    }
    for(let x=1250;x<5610;x+=490){
      const cy=jungleY(x,0);ctx.fillStyle='#e4cb8b';
      for(const off of [-195,195]){
        ctx.beginPath();ctx.arc(x,cy+off,5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#7b8869';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,cy+off,13,0,Math.PI*2);ctx.stroke();
      }
    }
  }else{
    // Abandoned Red Line parallel track and yellow platform edges.
    for(const offset of [-210,211]){
      const fn=x=>jungleY(x,index)+offset;
      routeStroke(fn,1280,5650,13,'#161c23');
      routeStroke(x=>fn(x)-5,1280,5650,3,'#8d9898');
      routeStroke(x=>fn(x)+5,1280,5650,3,'#8d9898');
      for(let x=1340;x<5620;x+=38){ctx.fillStyle='#6c5648';ctx.fillRect(x,fn(x)-14,5,28);}
    }
    for(let x=1450;x<5650;x+=710){
      const cy=jungleY(x,1);
      ctx.fillStyle='#a85643';ctx.fillRect(x-6,cy-208,12,40);
      ctx.fillRect(x-6,cy+164,12,40);
      ctx.fillStyle='#e0a35d';ctx.fillRect(x-6,cy-208,12,6);ctx.fillRect(x-6,cy+198,12,6);
    }
  }
  ctx.restore();
}
function drawJungleLandmark(info){
  const {x,y,kind,name,sub}=info;
  ctx.save();
  const upper=info.jungle===0;
  // Each landmark is an instantly recognizable 90-degree top-down silhouette.
  if(kind==='pond'){
    ctx.fillStyle='#698071';ctx.beginPath();ctx.ellipse(x,y,135,105,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1c5263';ctx.beginPath();ctx.ellipse(x,y,117,87,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#70a9ae';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#baa88d';ctx.fillRect(x-140,y-13,280,26);
    ctx.strokeStyle='#e1d3b2';ctx.lineWidth=4;ctx.strokeRect(x-140,y-13,280,26);
    ctx.fillStyle='#eae0c8';ctx.beginPath();ctx.arc(x+34,y+42,14,0,Math.PI*2);ctx.fill();
  }else if(kind==='memorial'){
    ctx.fillStyle='#a5a59b';ctx.fillRect(x-98,y-76,196,152);
    ctx.strokeStyle='#e0cfb3';ctx.lineWidth=7;ctx.strokeRect(x-98,y-76,196,152);
    ctx.fillStyle='#3e5654';ctx.fillRect(x-55,y-38,110,76);
    ctx.fillStyle='#dfddd0';ctx.fillRect(x-8,y-34,16,68);
    ctx.fillRect(x-33,y-10,66,14);
    ctx.fillStyle='#d09c99';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();
  }else if(kind==='bandstand'){
    ctx.fillStyle='#4b6858';ctx.beginPath();ctx.arc(x,y,105,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d9c9a1';ctx.lineWidth=8;ctx.stroke();
    ctx.fillStyle='#a8ac99';ctx.beginPath();ctx.arc(x,y,65,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#273e35';ctx.beginPath();ctx.arc(x,y,47,0,Math.PI*2);ctx.fill();
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillStyle='#f3dca6';ctx.fillRect(x+78*Math.cos(a)-6,y+78*Math.sin(a)-6,12,12);}
  }else if(kind==='depot'){
    ctx.fillStyle='#302b36';ctx.fillRect(x-136,y-89,272,178);
    ctx.strokeStyle='#e19685';ctx.lineWidth=7;ctx.strokeRect(x-136,y-89,272,178);
    for(let k=-2;k<=2;k++){ctx.fillStyle='#8a938d';ctx.fillRect(x-132,y+k*29-2,264,4);}
    ctx.fillStyle='#e8e7de';ctx.beginPath();ctx.arc(x-90,y,27,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d34c4f';ctx.font='bold 35px Arial';ctx.textAlign='center';ctx.fillText('T',x-90,y+12);
  }else if(kind==='substation'){
    ctx.fillStyle='#3d454a';ctx.fillRect(x-127,y-90,254,180);
    ctx.strokeStyle='#c6ac74';ctx.lineWidth=7;ctx.strokeRect(x-127,y-90,254,180);
    for(let k=-1;k<=1;k++)for(const side of [-1,1]){
      ctx.fillStyle='#657f82';ctx.fillRect(x+k*70-18,y+side*44-15,36,30);
      ctx.fillStyle='#f0b767';ctx.fillRect(x+k*70-6,y+side*44-22,12,6);
    }
    ctx.strokeStyle='#f4d68f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-15,y-28);ctx.lineTo(x+6,y-28);ctx.lineTo(x-7,y+8);ctx.lineTo(x+15,y+8);ctx.stroke();
  }else if(kind==='freight'){
    ctx.fillStyle='#263a43';ctx.fillRect(x-148,y-89,296,178);
    ctx.strokeStyle='#ad7462';ctx.lineWidth=6;ctx.strokeRect(x-148,y-89,296,178);
    for(let i=0;i<4;i++){
      const bx=x-125+i*64;ctx.fillStyle=['#8b543c','#5b7c78','#8f7861','#8b5454'][i];
      ctx.fillRect(bx,y-56,55,104);
      ctx.strokeStyle='#dfb292';ctx.lineWidth=2;
      for(let t=8;t<51;t+=12){ctx.beginPath();ctx.moveTo(bx+t,y-56);ctx.lineTo(bx+t,y+48);ctx.stroke();}
    }
  }
  // Labels drawn at the edges of landmarks rather than on the playable floor.
  ctx.textAlign='center';ctx.font='bold 19px Consolas, monospace';ctx.fillStyle=upper?'#e6e8d0':'#f1c5a7';
  ctx.fillText(name,x,y-128);
  ctx.font='bold 12px Consolas, monospace';ctx.fillStyle=upper?'#abc4ab':'#bda5a0';ctx.fillText(sub,x,y-109);
  ctx.restore();
}
function drawCover(c){
  const {x,y,w,h,kind}=c;ctx.save();ctx.fillStyle='#0b1b22';ctx.fillRect(x+7,y+9,w,h);
  if(kind==='planter'){
    ctx.fillStyle='#a4a795';ctx.fillRect(x,y,w,h);ctx.fillStyle='#2c5941';ctx.fillRect(x+5,y+5,w-10,h-10);
    for(let k=0;k<3;k++){ctx.fillStyle=k===1?'#6d9165':'#457e59';ctx.beginPath();ctx.arc(x+12+k*12,y+17,11,0,Math.PI*2);ctx.fill();}
  }else{
    ctx.fillStyle='#966b56';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#c39d78';ctx.lineWidth=3;ctx.strokeRect(x+2,y+2,w-4,h-4);
    ctx.fillStyle='#554b4e';for(let k=8;k<w;k+=13)ctx.fillRect(x+k,y+2,4,h-4);
    ctx.fillStyle='#e2bd8b';ctx.fillRect(x+4,y+h/2-2,w-8,5);
  }
  ctx.restore();
}
function drawStreetCover(v){
  const {x,y,w,h,color}=v;
  ctx.save();ctx.fillStyle='#09171d';ctx.fillRect(x+6,y+8,w,h);
  ctx.fillStyle=['#85665f','#5e8190','#8c897f','#9b5e5b'][color];ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='#d0afa0';ctx.lineWidth=2;ctx.strokeRect(x+2,y+2,w-4,h-4);
  ctx.fillStyle='#324a55';ctx.fillRect(x+13,y+5,w-26,h-10);
  ctx.fillStyle='#92aab0';ctx.fillRect(x+16,y+8,12,h-16);ctx.fillRect(x+w-28,y+8,12,h-16);
  ctx.fillStyle='#d6c090';ctx.fillRect(x+w-7,y+4,6,7);ctx.fillRect(x+w-7,y+h-11,6,7);
  ctx.restore();
}
function drawBuilding(b,i){
  const {x,y,w,h}=b,kind=b.kind??i%6,d=b.district;
  const historic=d==='historic',industrial=d==='industrial',civic=d==='civic';
  const base=historic?['#96584d','#765049','#a0715c','#86604e'][kind%4]:industrial?['#566d72','#50717e','#6e675d','#61666a'][kind%4]:civic?['#69717a','#6e777b','#626d72','#7d7570'][kind%4]:['#74706a','#5d666c','#7c685f','#6c7173'][kind%4];
  ctx.fillStyle='#071720';ctx.fillRect(x+8,y+11,w,h);
  ctx.fillStyle='#a8a499';ctx.fillRect(x-6,y-7,w+12,h+14);
  ctx.fillStyle=base;ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=historic?'#cc9880':industrial?'#a2b9ba':'#b6bdba';ctx.lineWidth=3;ctx.strokeRect(x+3,y+3,w-6,h-6);
  if(historic){
    ctx.fillStyle='#54433e';ctx.fillRect(x+12,y+9,w-24,h-18);
    ctx.fillStyle='#c08b6e';for(let a=0;a<3;a++)ctx.fillRect(x+11+a*(w-23)/3,y+13,14,13);
    ctx.fillStyle='#897366';ctx.fillRect(x+w/2-15,y+h-1,30,10);
    ctx.fillStyle='#cfc2a6';ctx.fillRect(x+w-32,y+19,17,13);
  }else if(industrial){
    ctx.fillStyle='#293f49';ctx.fillRect(x+9,y+9,w-18,h-18);
    ctx.strokeStyle='#84949a';ctx.lineWidth=2;
    for(let k=14;k<w-9;k+=12){ctx.beginPath();ctx.moveTo(x+k,y+9);ctx.lineTo(x+k,y+h-9);ctx.stroke();}
    ctx.fillStyle='#dcab79';ctx.fillRect(x+8,y+h-19,24,10);
  }else{
    ctx.fillStyle='#314a56';ctx.fillRect(x+13,y+11,w-26,h-22);
    ctx.fillStyle='#71949b';ctx.fillRect(x+20,y+18,w-40,h-36);
    ctx.strokeStyle='#b0c5c3';ctx.lineWidth=2;ctx.strokeRect(x+21,y+19,w-42,h-38);
    if(civic){ctx.fillStyle='#d0b184';ctx.fillRect(x+w-31,y+8,22,13);}
  }
}

function drawWorld(){
  if(cityTilesReady()){drawKenneyWorld(ctx);return;}
  // Canvas is rendered once into the world cache. Streets, obstacles and travel
  // paths share the exact same exported geometry used by the server.
  ctx.fillStyle='#17262d';ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.fillStyle='#23343a';for(let x=0;x<WORLD.width;x+=220){for(let y=0;y<WORLD.height;y+=220){
    if(((x/220+y/220)%3)===0)ctx.fillRect(x+8,y+10,194,186);
  }}
  // Urban block paving and restrained utility markings.
  ctx.save();ctx.globalAlpha=.2;ctx.strokeStyle='#5b7171';ctx.lineWidth=2;
  for(let x=0;x<WORLD.width;x+=160){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.height);ctx.stroke();}
  for(let y=0;y<WORLD.height;y+=130){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.width,y);ctx.stroke();}ctx.restore();

  // Charles River, a piece of the Boston waterfront, and the disconnected
  // industrial harbor along the eastern edge; roads cross on actual bridges.
  ctx.fillStyle='#173b50';ctx.beginPath();ctx.moveTo(715,0);ctx.lineTo(815,0);ctx.lineTo(874,540);
  ctx.lineTo(835,1120);ctx.lineTo(887,2000);ctx.lineTo(706,2000);ctx.lineTo(730,1120);ctx.lineTo(705,600);ctx.closePath();ctx.fill();
  ctx.save();ctx.strokeStyle='#3a7585';ctx.lineWidth=5;ctx.setLineDash([42,54]);ctx.beginPath();ctx.moveTo(760,0);ctx.lineTo(790,650);ctx.lineTo(785,1390);ctx.lineTo(800,2000);ctx.stroke();ctx.restore();
  // Seaport docks and warehouse apron, beyond the second jungle.
  ctx.fillStyle='#203d46';for(let k=0;k<5;k++)ctx.fillRect(4930+k*180,45,112,64);
  ctx.fillStyle='#44636e';for(let k=0;k<5;k++)ctx.fillRect(4930+k*180,80,112,8);

  // Expansive, multi-route playable zones with separate Boston identities.
  drawJungleDistrict(0);drawJungleDistrict(1);
  // Cross-town shortcuts connect the lanes through the two jungles, giving
  // players real rotation choices instead of three isolated corridors.
  for(const [i,x] of CONNECTORS.entries()){
    const top=laneY(x,0),bottom=laneY(x,2),a=Math.min(top,bottom),b=Math.max(top,bottom);
    ctx.fillStyle='#616c6d';ctx.fillRect(x-59,a,118,b-a);
    ctx.fillStyle='#303b42';ctx.fillRect(x-51,a,102,b-a);
    ctx.save();ctx.strokeStyle='#859191';ctx.lineWidth=2;ctx.setLineDash([16,23]);ctx.beginPath();ctx.moveTo(x,a+20);ctx.lineTo(x,b-20);ctx.stroke();ctx.restore();
    // Service alley crossings have pedestrian bars near the park edges.
    for(const ly of [laneY(x,0),laneY(x,1),laneY(x,2)]){
      ctx.fillStyle='#b5b5a0';for(let c=-3;c<=3;c++)ctx.fillRect(x+c*15-5,ly-57,8,15);
    }
    if(i%2===0)labelAt(x,a-110,'↕','CROSS-TOWN','#8bb5aa');
  }

  // Continuous three-lane road network. The lanes originate at the same central
  // spawn, split to Beacon Hill / Common / South End and converge at the DM Tower.
  for(let lane=0;lane<3;lane++){
    const route=x=>laneY(x,lane);
    const surface=[['#67554e','#9f8070','#423a3b','#d8b899'],
                   ['#58636a','#748183','#293942','#d7d8c8'],
                   ['#625b57','#837973','#373b3f','#e2a97d']][lane];
    routeStroke(route,0,WORLD.width,202,surface[0]);
    routeStroke(route,0,WORLD.width,185,surface[1]);
    routeStroke(route,0,WORLD.width,169,surface[2]);
    routeStroke(route,0,WORLD.width,3,surface[3],[34,25]);
    routeStroke(x=>route(x)-72,0,WORLD.width,2,surface[3],[45,26]);
    routeStroke(x=>route(x)+72,0,WORLD.width,2,surface[3],[45,26]);
    // The historical lane gets brick seams, the harbor lane gets service paint.
    for(let bx=1190;bx<5750;bx+=lane===0?41:lane===2?260:405){
      const by=route(bx);
      if(lane===0){ctx.strokeStyle='#765047';ctx.globalAlpha=.65;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(bx,by-68);ctx.lineTo(bx,by+68);ctx.stroke();ctx.globalAlpha=1;
      }else if(lane===2){ctx.fillStyle='#b99561';ctx.fillRect(bx,by-80,5,14);ctx.fillRect(bx,by+66,5,14);
      }else{ctx.strokeStyle='#556c6e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(bx,by+42,7,0,Math.PI*2);ctx.stroke();}
    }
  }
  // Physical-looking bridge crossbeams on the Charles River; only decoration.
  for(const x of [745,815]){ctx.save();ctx.globalAlpha=.45;ctx.fillStyle='#b5afb0';for(let lane=0;lane<3;lane++){
    const y=laneY(x,lane);ctx.fillRect(x,y-85,5,170);
  }ctx.restore();}
  // Streetlamp rows draw after roads; readable urban silhouette, no collisions.
  for(let x=1060;x<6310;x+=405)for(let l=0;l<3;l++){
    const y=laneY(x,l);
    for(const side of [-1,1]){
      ctx.fillStyle='#6b7f83';ctx.fillRect(x-3,y+side*101-4,6,7);
      ctx.fillStyle='#cfbd86';ctx.beginPath();ctx.arc(x,y+side*101,4,0,Math.PI*2);ctx.fill();
    }
  }
  // Every roof, planter and crate is derived from server-side collision.
  for(const [i,b] of BUILDINGS.entries())drawBuilding(b,i);
  for(const c of JUNGLE_COVER)drawCover(c);
  for(const car of STREET_COVER)drawStreetCover(car);
  for(const feature of JUNGLE_LANDMARKS)drawJungleLandmark(feature);
  // City plazas, shop markers and distinctive Boston transit stop T logos.
  for(const [x,y] of [[1440,1000],[4050,1000]]){
    ctx.fillStyle='#121e25';ctx.beginPath();ctx.arc(x,y-128,27,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff5e6';ctx.beginPath();ctx.arc(x,y-128,20,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#c7474c';ctx.font='bold 29px Arial';ctx.textAlign='center';ctx.fillText('T',x,y-118);ctx.textAlign='left';
  }
  // Atmospheric SoulSeekers signal anomalies never block players or enemy AI.
  for(const [x,y] of [[3550,1000],[5170,710],[2600,1330]]){
    ctx.save();ctx.strokeStyle='#775e97';ctx.globalAlpha=.42;ctx.lineWidth=3;
    for(let r=24;r<=78;r+=25){ctx.beginPath();ctx.arc(x,y,r,-.35,1.8*Math.PI);ctx.stroke();}ctx.restore();
  }
  for(const shop of SHOPS){
    ctx.fillStyle='#10271f';ctx.beginPath();ctx.arc(shop.x,shop.y,81,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#85d4ac';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#c4efda';ctx.fillRect(shop.x-26,shop.y-22,52,44);
    ctx.fillStyle='#214638';ctx.fillRect(shop.x-19,shop.y-14,38,28);
    ctx.textAlign='center';ctx.fillStyle='#ecffe9';ctx.font='bold 21px Segoe UI';ctx.fillText('$',shop.x,shop.y+7);
    ctx.font='bold 16px Consolas';ctx.fillText(shop.name,shop.x,shop.y-103);ctx.textAlign='left';
  }
  for(const info of BOSTON_DISTRICTS){
    labelAt(info.x,info.y,info.name,info.sub,'#bbcac4');
  }
  // Central Party arrival and red-tinted final approach / DM tower. The aura
  // overlays streets translucently so it doesn't disguise the road geometry.
  const px=WORLD.partyX,py=1000;
  ctx.fillStyle='#1e4d4a';ctx.beginPath();ctx.arc(px,py,95,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#83ead8';ctx.lineWidth=6;ctx.stroke();labelAt(px,py+5,'PARTY','SPAWN','#effff4');
  const glow=ctx.createRadialGradient(WORLD.dmX,1000,40,WORLD.dmX,1000,370);
  glow.addColorStop(0,'#9a2a4866');glow.addColorStop(1,'#9a2a4800');
  ctx.fillStyle=glow;ctx.fillRect(WORLD.dmX-380,620,760,760);
  ctx.fillStyle='#f0b6be';ctx.font='bold 19px Consolas';ctx.textAlign='center';
  ctx.fillText('DM TERRITORY / NO SIGNAL',WORLD.dmX,690);ctx.textAlign='left';
}
function hpBar(x,y,w,fraction,c='#e17f83'){ctx.fillStyle='#08151bbd';ctx.fillRect(x-w/2,y,w,6);ctx.fillStyle=c;ctx.fillRect(x-w/2,y,w*clamp(fraction,0,1),6);}
function shapeCircle(x,y,r,fill,stroke='#0d171b',line=3){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
function drawFort(f){if(cityTilesReady()){drawKenneyFort(ctx,f);ctx.fillStyle='#fff4f1';ctx.font='bold 12px Consolas';ctx.textAlign='center';ctx.fillText(`FORT ${f.lane+1}-${f.tier+1}`,f.x,f.y+4);ctx.textAlign='left';if(!f.broken)hpBar(f.x,f.y-64,105,f.hp/f.maxHp);return;}if(f.broken){ctx.fillStyle='#172325';ctx.fillRect(f.x-52,f.y-48,104,96);ctx.strokeStyle='#7b4b4e';ctx.lineWidth=5;ctx.strokeRect(f.x-52,f.y-48,104,96);ctx.strokeStyle='#d57f7c';ctx.beginPath();ctx.moveTo(f.x-40,f.y-30);ctx.lineTo(f.x+37,f.y+34);ctx.stroke();return;}
  ctx.fillStyle='#4c3439';ctx.fillRect(f.x-57,f.y-52,114,104);ctx.strokeStyle='#eb9ca0';ctx.lineWidth=5;ctx.strokeRect(f.x-57,f.y-52,114,104);
  ctx.fillStyle='#be8084';for(const xx of [-50,30])for(const yy of [-45,25])ctx.fillRect(f.x+xx,f.y+yy,20,20);
  ctx.fillStyle='#e8c5c6';ctx.font='bold 13px Consolas';ctx.textAlign='center';ctx.fillText(`FORT ${f.lane+1}-${f.tier+1}`,f.x,f.y+4);ctx.textAlign='left';hpBar(f.x,f.y-75,105,f.hp/f.maxHp);
  if(game.enemies?.some(e=>e.id===f.bossId)){
    ctx.strokeStyle='#eb8c9d';ctx.setLineDash([5,7]);ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,77,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  }
}
function drawTower(){const x=WORLD.dmX,y=1000,open=towerExposed(game);ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#380f22';ctx.beginPath();for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;ctx.lineTo(Math.cos(a)*88,Math.sin(a)*88);}ctx.closePath();ctx.fill();
  shapeCircle(0,0,65,open?'#742b49':'#53616c',open?'#ffc4cc':'#9fbcca',6);
  ctx.save();ctx.rotate(game.elapsed*.18);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillStyle=open?'#df6779':'#a7b1b9';ctx.fillRect(-11,-75,22,46);}ctx.restore();
  shapeCircle(0,0,24,open?'#f5a8b8':'#7f99ab');
  ctx.fillStyle='#fff3f4';ctx.font='bold 17px Segoe UI';ctx.textAlign='center';ctx.fillText('DM',0,5);ctx.fillText(open?'TOWER EXPOSED':'SEALED TOWER',0,-108);
  hpBar(0,-95,156,(game.towerHp??4200)/(game.towerMaxHp??4200),open?'#f69aaa':'#6c8d9e');ctx.restore();
}
function entityPosition(entity){
  if(mode!=='onlineParty'&&mode!=='onlineDM')return entity;
  if(entity.slot===activeSlot&&predictedPlayer)return predictedPlayer;
  return tweenPosition(remotePositions.get(entity.id),motionClock.time??renderClock,0)||entity;
}
function drawCharacter(p){if(p.hp<=0)return;const h=HEROES[p.hero]||HEROES[0],v=entityPosition(p);
  ctx.fillStyle='#070c10aa';ctx.beginPath();ctx.ellipse(v.x+6,v.y+11,p.r+5,p.r*.55,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(v.x,v.y);const angle=p.slot===activeSlot&&!isDM()?Math.atan2(chosenMouse.worldY-v.y,chosenMouse.worldX-v.x):0;
  ctx.rotate(angle);shapeCircle(0,0,p.r,h.color,'#13222d',4);ctx.fillStyle='#f3f7ff';ctx.fillRect(6,-5,27,10);
  shapeCircle(-5,-5,7,'#172731','#f8fffc',1);ctx.restore();
  if(p.slot===activeSlot&&!isDM()){ctx.strokeStyle='#f8dd9a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(v.x,v.y,p.r+9,0,Math.PI*2);ctx.stroke();}
  hpBar(v.x,v.y-40,64,p.hp/p.maxHp,'#82e2c6');ctx.fillStyle='#eefaf5';ctx.textAlign='center';ctx.font='700 12px Segoe UI';ctx.fillText(h.name.toUpperCase()+` [${p.level}]`,v.x,v.y-47);ctx.textAlign='left';
}
function drawEnemy(e){const v=entityPosition(e),boss=e.kind==='boss';
  ctx.fillStyle='#051017aa';ctx.beginPath();ctx.ellipse(v.x+5,v.y+9,e.r+8,e.r*.64,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(v.x,v.y);ctx.rotate(Math.PI/4);
  ctx.fillStyle=boss?'#a85678':e.kind==='brute'?'#ae6a59':e.kind==='sniper'?'#c69873':'#ae6371';ctx.fillRect(-e.r*.85,-e.r*.85,e.r*1.7,e.r*1.7);
  ctx.strokeStyle=possessed===e.id?'#fff4b7':'#eab0b5';ctx.lineWidth=possessed===e.id?5:2;ctx.strokeRect(-e.r*.85,-e.r*.85,e.r*1.7,e.r*1.7);ctx.restore();
  ctx.fillStyle='#ffdcdb';ctx.fillRect(v.x-4,v.y-4,8,8);
  if(boss){ctx.fillStyle='#ffd2da';ctx.textAlign='center';ctx.font='bold 13px Segoe UI';ctx.fillText('WARDEN',v.x,v.y-50);ctx.textAlign='left';}
  hpBar(v.x,v.y-e.r-20,boss?83:44,e.hp/e.maxHp);
}
function drawChest(c){if(c.opened)return;if(cityTilesReady()){drawKenneyChest(ctx,c);return;}ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle=c.grade==='relic'?'#3e225c':'#422c1b';ctx.fillRect(-20,-16,40,32);ctx.strokeStyle=c.grade==='relic'?'#d9abff':'#dbb77d';ctx.lineWidth=3;ctx.strokeRect(-20,-16,40,32);ctx.fillStyle=c.grade==='relic'?'#e3b9ff':'#edca8b';ctx.fillRect(-3,-15,6,30);ctx.fillRect(-18,-3,36,6);ctx.restore();}
function drawFX(fx){ctx.save();const v=1-fx.ttl/.38;ctx.globalAlpha=Math.max(0,1-v);
  ctx.strokeStyle=fx.type==='ability'?'#b7a4ff':fx.type==='nova'?'#ffd18d':fx.type==='loot'?'#ffd18d':'#f4bac2';
  ctx.lineWidth=fx.type==='ability'||fx.type==='nova'?6:3;
  ctx.beginPath();ctx.arc(fx.x,fx.y,(fx.type==='ability'?165:fx.type==='nova'?220:12)*Math.max(.2,v),0,Math.PI*2);ctx.stroke();ctx.restore();}
function drawMinimap(){if(!game)return;const w=210,h=125,x=width-w-18,y=height-h-18;
  ctx.save();ctx.fillStyle='#101a21e8';ctx.fillRect(x-5,y-5,w+10,h+10);ctx.strokeStyle='#88a3a0';ctx.lineWidth=1;ctx.strokeRect(x-5,y-5,w+10,h+10);
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='#2d4147';ctx.fillRect(x,y,w,h);
  // Minimap traces the same curved three-lane topology as the world.
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(let j=0;j<2;j++){
    ctx.strokeStyle=j===0?'#356a50':'#756155';ctx.lineWidth=10;ctx.beginPath();
    for(let wx=0;wx<=WORLD.width;wx+=60){const py=y+jungleY(wx,j)/WORLD.height*h,px=x+wx/WORLD.width*w;
      if(wx===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();
  }
  for(const cx of JUNGLE_LOOP_CROSSINGS)for(let j=0;j<2;j++){const px=x+cx/WORLD.width*w,cy=y+jungleY(cx,j)/WORLD.height*h;ctx.strokeStyle=j===0?'#a8c6a6':'#b7a38b';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(px,cy-8);ctx.lineTo(px,cy+8);ctx.stroke();}
  for(const cx of CONNECTORS){ctx.strokeStyle='#687b7c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+cx/WORLD.width*w,y+laneY(cx,0)/WORLD.height*h);ctx.lineTo(x+cx/WORLD.width*w,y+laneY(cx,2)/WORLD.height*h);ctx.stroke();}
  for(let lane=0;lane<3;lane++){
    ctx.strokeStyle='#a0b4b2';ctx.lineWidth=3.2;ctx.beginPath();
    for(let wx=0;wx<=WORLD.width;wx+=50){const py=y+laneY(wx,lane)/WORLD.height*h,px=x+wx/WORLD.width*w;
      if(wx===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();
  }
  ctx.restore();
  for(const f of game.forts||[]){ctx.fillStyle=f.broken?'#586869':'#f3a2a9';ctx.fillRect(x+f.x/WORLD.width*w-3,y+f.y/WORLD.height*h-3,6,6);}
  for(const p of game.players||[]){if(p.hp<=0)continue;ctx.fillStyle=HEROES[p.hero]?.color||'#6bd';ctx.beginPath();ctx.arc(x+p.x/WORLD.width*w,y+p.y/WORLD.height*h,2.8,0,Math.PI*2);ctx.fill();}
  for(const s of SHOPS){ctx.fillStyle='#a7e9b9';ctx.fillRect(x+s.x/WORLD.width*w-2,y+s.y/WORLD.height*h-2,4,4);}
  ctx.fillStyle='#f77a8a';ctx.beginPath();ctx.arc(x+WORLD.dmX/WORLD.width*w,y+h/2,6,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#d4f2eb';ctx.lineWidth=1.4;ctx.strokeRect(x+(camera.x-width/2/camera.zoom)/WORLD.width*w,y+(camera.y-height/2/camera.zoom)/WORLD.height*h,(width/camera.zoom)/WORLD.width*w,(height/camera.zoom)/WORLD.height*h);
  ctx.restore();}
function cachedWorld(){
  if(worldCache!==null)return worldCache;
  try{
    const cache=document.createElement('canvas');
    cache.width=WORLD.width;cache.height=WORLD.height;
    const worldCtx=cache.getContext('2d');
    if(!worldCtx)return null;
    ctx=worldCtx;
    ctx.imageSmoothingEnabled=false;
    try{drawWorld();}finally{ctx=screenCtx;}
    worldCache=cache;
  }catch(error){
    ctx=screenCtx;
    console.warn('World caching unavailable; drawing background directly:',error);
    return null;
  }
  return worldCache;
}




function drawCachedWorld(){
  const cache=cachedWorld();
  if(!cache){drawWorld();return;}
  const halfW=width/(2*camera.zoom),halfH=height/(2*camera.zoom);
  const x=Math.max(0,Math.floor(camera.x-halfW-5));
  const y=Math.max(0,Math.floor(camera.y-halfH-5));
  const w=Math.min(WORLD.width-x,Math.ceil(2*halfW+10));
  const h=Math.min(WORLD.height-y,Math.ceil(2*halfH+10));
  if(w>0&&h>0){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(cache,x,y,w,h,x,y,w,h);ctx.restore();}
}
function inView(e,pad=125){
  return Math.abs(e.x-camera.x)<width/(2*camera.zoom)+pad &&
         Math.abs(e.y-camera.y)<height/(2*camera.zoom)+pad;
}
function render(){if(!width||!height)return;const dpr=canvas.width/width;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#091219';ctx.fillRect(0,0,width,height);
  if(!game){ctx.textAlign='center';ctx.font='bold 33px Segoe UI';ctx.fillStyle='#537f80';ctx.fillText('SEEKING // STANDBY',width/2,height/2);ctx.textAlign='left';return;}
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
  drawCachedWorld();for(const c of game.chests||[])if(inView(c))drawChest(c);
  for(const f of game.forts||[])if(inView(f))drawFort(f);
  if(inView({x:WORLD.dmX,y:1000},200))drawTower();
  for(const e of game.enemies||[])if(inView(e))drawEnemy(e);
  for(const p of game.players||[])if(inView(p))drawCharacter(p);
  for(const b of game.bullets||[])if(inView(b)){ctx.fillStyle=b.color||'#fff';const v=entityPosition(b);shapeCircle(v.x,v.y,b.r,ctx.fillStyle,ctx.fillStyle,0);}
  for(const fx of game.effects||[])if(inView(fx))drawFX(fx);
  ctx.restore();drawMinimap();
  if(mode==='onlineParty' && game.players?.[activeSlot]?.respawn>0){ctx.fillStyle='#f1d9db';ctx.textAlign='center';ctx.font='bold 28px Segoe UI';ctx.fillText(`REDEPLOY ${Math.ceil(game.players[activeSlot].respawn)}s`,width/2,height/2);ctx.textAlign='left';}
}
function frame(now){
  renderClock=now;
  const rawDelta=Math.max(0,(now-lastRenderTime)/1000);
  const dt=Math.min(.05,rawDelta);
  if(!document.hidden&&mode!=='menu'&&rawDelta>0&&rawDelta<.5){
    frameSamples.push(rawDelta*1000);
    if(frameSamples.length>180)frameSamples.shift();
  }
  if(mode==='onlineParty'||mode==='onlineDM')motionClock.advance(dt*1000);
  // Animate local movement at display refresh rate, not at 30Hz setInterval.
  // This is visual-only; server still simulates actual movement and collision.
  if(mode==='onlineParty'&&game?.players?.[activeSlot]&&predictedPlayer)
    predictStep(predictedPlayer,game.players[activeSlot],currentInput(),dt);
  updateCamera(dt);
  render();lastRenderTime=now;lastTime=now;
  if(!document.hidden&&mode!=='menu'){
    frameCount++;
    if(now-frameWindowStarted>=1100){
      displayFps=Math.round(frameCount*1000/Math.max(1,now-frameWindowStarted));
      frameCount=0;frameWindowStarted=now;
      // Auto-quality steps down only after sustained low FPS, and restores slowly.
      if(displayFps<40){slowFrames++;fastFrames=0;}
      else if(displayFps>56){fastFrames++;slowFrames=0;}
      else {slowFrames=0;fastFrames=0;}
      if(slowFrames>=3&&qualityScale>0.7){qualityScale=.7;slowFrames=0;resize();notify('Low FPS: reduced canvas resolution to keep movement smooth.');}
      else if(fastFrames>=12&&qualityScale<1){qualityScale=1;fastFrames=0;resize();}
    }
  }else{frameCount=0;frameWindowStarted=now;if(document.hidden)frameSamples.length=0;}
  frameId=requestAnimationFrame(frame);
}
function events(){window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{
  const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='TEXTAREA')return;
  const k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(k==='escape'){possessed=null;selectedItem=null;placementType=null;}
  if(k==='i'&&!isDM()){$('toggleInventory').click();}
  if(k==='b'&&!isDM()){$('sidePanel').scrollTo({top:$('shopItems').offsetTop,behavior:'smooth'});}
  if(k==='f'&&!isDM())queueAction({type:'chest'});
  if(k==='r'&&selectedItem&&!isDM()){
    const p=game?.players?.[activeSlot],it=p?.inventory?.find(i=>i.id===selectedItem);if(it)queueAction({type:'moveItem',id:it.id,x:it.x,y:it.y,rotate:true});
  }
 });window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();chosenMouse.down=false;});
  canvas.addEventListener('mousemove',mouseWorld);
  canvas.addEventListener('mousedown',e=>{if(mode==='menu'||!game)return;mouseWorld(e);if(e.button!==0)return;
    if(isDM()&&placementType){const inferredLane=nearestLane(chosenMouse.worldX,chosenMouse.worldY);
      if(mode==='onlineDM'){net?.spawn(placementType,inferredLane,chosenMouse.worldX,chosenMouse.worldY);placementType=null;}
      else if(dmSpawn(game,inferredLane,placementType,chosenMouse.worldX,chosenMouse.worldY)){notify(`${placementType.toUpperCase()} deployed.`);placementType=null;}else notify('Invalid position or insufficient threat.');return;}
    if(isDM()&&!possessed){const target=(game.enemies||[]).filter(v=>v.hp>0).find(e=>dist(e,{x:chosenMouse.worldX,y:chosenMouse.worldY})<e.r+14);
      if(target){possessed=target.id;notify(`Possessed ${target.kind.toUpperCase()}. ESC to release.`);return;}}
    chosenMouse.down=true;
  });
  window.addEventListener('mouseup',()=>chosenMouse.down=false);
  canvas.addEventListener('mouseleave',()=>chosenMouse.down=false);
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(!isDM()||!game)return;
    mouseWorld(e);if(mode==='onlineDM')net?.order(chosenMouse.worldX,chosenMouse.worldY);
    else for(const enemy of game.enemies){if(enemy.kind==='boss'||enemy.id===possessed)continue;giveMarchOrder(enemy,chosenMouse.worldX,chosenMouse.worldY);}
    notify('March order issued to the field army.');
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=clamp(camera.zoom*(e.deltaY>0?.9:1.1),.52,1.52);},{passive:false});
  canvas.addEventListener('click',e=>{
    if(!isDM()||possessed||!game)return;const box=canvas.getBoundingClientRect(),px=e.clientX-box.left,py=e.clientY-box.top;
    const w=210,h=125,x=width-w-18,y=height-h-18;
    if(px>=x&&px<=x+w&&py>=y&&py<=y+h){camera.x=(px-x)/w*WORLD.width;camera.y=(py-y)/h*WORLD.height;}
  });
}
try{
  setupChoices();events();resize();
  window.__SEEKING_BOOTSTRAPPED__=true;
  requestAnimationFrame(frame);
  // Offline training remains playable even if no game server is configured.
  checkServerConfig();
}catch(error){
  console.error('SoulSeekers startup error:',error);
  $('firebaseStatus').textContent='STARTUP FAILED';
  menuMessage(`Game startup failed: ${error.message}. Take a screenshot of this message.`,true);
  window.__SEEKING_BOOTSTRAPPED__=false;
}

