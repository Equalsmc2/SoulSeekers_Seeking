import {WORLD,HEROES,ITEMS,BUILDINGS,SHOPS,clamp,dist} from './data.js';
import {createGame,tick,dmSpawn,serialize,teamHasShop,towerExposed} from './engine.js';
import {hasFirebase,hostRoom,joinRoom,describeNetworkError,normalizeRoomCode} from './network.js';
const $=id=>document.getElementById(id);
const canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let game=null,mode='menu',net=null,activeSlot=0,selectedHero=0,lane=1,possessed=null,placementType=null;
let netInputs={},netSlots={},selectedItem=null,inventoryVisible=true,renderedWinner=null;
let actionSeq=0,pendingAction=null,lastTime=performance.now(),lastPublish=0,lastInputSend=0,lastUI=0;
let toastTimeout=null,chosenMouse={x:0,y:0,down:false,worldX:0,worldY:0},keys=new Set();
const camera={x:WORLD.partyX+280,y:1000,zoom:.95},smoothPositions=new Map();
let width=1000,height=700,frameId=null;
const INPUT_RATE=95,PUBLISH_RATE=150;
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
  $('copyRoomCode').classList.remove('hidden');
}

function setupChoices(){
  HEROES.forEach((h,i)=>{const b=document.createElement('button');b.type='button';b.className='hero-choice'+(i===selectedHero?' chosen':'');b.style.setProperty('--hero',h.color);
    b.innerHTML=`<div class="hero-icon">${['Ø','☾','Ⅲ','◇','✛','✦'][i]}</div><b>${h.name.toUpperCase()}</b><small>${h.role}</small>`;
    b.onclick=()=>{selectedHero=i;document.querySelectorAll('.hero-choice').forEach((el,j)=>el.classList.toggle('chosen',i===j));};$('heroChoices').append(b);});
  $('firebaseStatus').textContent=hasFirebase?'CONFIGURED / NOT YET CONNECTED':'SETUP REQUIRED';
  $('roomCodeInput').addEventListener('input',e=>{e.target.value=normalizeRoomCode(e.target.value);});
  $('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinOnline').click();});
  $('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinOnline').click();});
  $('copyRoomCode').onclick=async()=>{if(!net?.code)return;try{await navigator.clipboard.writeText(net.code);notify(`Copied room ${net.code}`);}catch{window.prompt('Copy the room code:',net.code);}};
  $('dmUnits').innerHTML=[['grunt','GRUNT',12],['brute','BRUTE',30],['sniper','SNIPER',24]].map(([id,n,c])=>`<button class="dm-unit" data-unit="${id}"><span>${n}</span><b>${c} THREAT +</b></button>`).join('');
  $('dmUnits').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(!game)return;placementType=b.dataset.unit;possessed=null;notify(`Click the battlefield to deploy a ${placementType.toUpperCase()}. ESC cancels.`);});
  $('shopItems').innerHTML=Object.entries(ITEMS).map(([id,d])=>`<button class="shop-card" data-buy="${id}"><b>${d.icon} ${d.name}</b><span>${d.price} GOLD</span></button>`).join('');
  $('shopItems').querySelectorAll('button').forEach(b=>b.onclick=()=>queueAction({type:'buy',item:b.dataset.buy}));
  document.querySelectorAll('.lane').forEach(b=>b.onclick=()=>{lane=Number(b.dataset.lane);if(isDM()&&!possessed)camera.y=WORLD.lanes[lane];document.querySelectorAll('.lane').forEach(el=>el.classList.toggle('active',el===b));});
  $('toggleInventory').onclick=()=>{inventoryVisible=!inventoryVisible;$('inventoryWrap').classList.toggle('hidden',!inventoryVisible);};
  $('useItemButton').onclick=()=>{if(selectedItem)queueAction({type:'item',id:selectedItem});};
  $('soloParty').onclick=()=>startLocal('party');$('soloDM').onclick=()=>startLocal('dm');
  $('menuButton').onclick=()=>location.reload();$('endRestart').onclick=()=>location.reload();
  $('hostOnline').onclick=async()=>{
    if(!hasFirebase){menuMessage('Set up Firebase first using README.md, then reload the page.',true);return;}
    $('hostOnline').disabled=true;
    try{
      menuMessage('Signing in and creating a Firebase room...');
      const g=createGame();
      net=await hostRoom(serialize(g),slots=>{netSlots=slots;},inputs=>{netInputs=inputs;},liveNetworkError);
      mode='onlineDM';game=g;camera.x=5790;camera.y=1000;
      $('connection').textContent='FIREBASE CONNECTED';$('roomLabel').textContent=`ROOM ${net.code} · SHARE THIS CODE`;
      setRoomCode(net.code);
      leaveMenu();notify(`Room ${net.code} created. Copy and share it with your Party.`);
    }catch(e){menuMessage(describeNetworkError(e),true);console.error('Host failed:',e);}
    finally{$('hostOnline').disabled=false;}
  };
  $('joinOnline').onclick=async()=>{
    if(!hasFirebase){menuMessage('First configure Firebase in firebase-config.js.',true);return;}
    const code=normalizeRoomCode($('roomCodeInput').value);
    $('joinOnline').disabled=true;
    try{
      menuMessage('Signing in to Firebase...');
      let latestState=null;
      net=await joinRoom(code,selectedHero,$('playerName').value||HEROES[selectedHero].name,
        next=>{latestState=next;game=next;},slots=>{netSlots=slots;},
        step=>menuMessage(step),liveNetworkError);
      if(!latestState)throw new Error('Firebase did not provide a game state.');
      activeSlot=selectedHero;mode='onlineParty';camera.x=WORLD.partyX+250;camera.y=WORLD.lanes[selectedHero%3];
      $('connection').textContent='FIREBASE CONNECTED';$('roomLabel').textContent=`ROOM ${net.code}`;
      leaveMenu();notify('Connected to DM host. Advance with your party!');
    }catch(e){menuMessage(describeNetworkError(e),true);console.error('Join failed:',e);}
    finally{$('joinOnline').disabled=false;}
  };
}
function leaveMenu(){ $('menuLayer').classList.add('hidden');$('roleBadge').textContent=isDM()?'DUNGEON MASTER':'PARTY OPERATIVE';
  $('dmPanel').classList.toggle('hidden',!isDM());$('playerPanel').classList.toggle('hidden',isDM());
  $('controls').innerHTML=isDM()?'WASD POSSESSED ENEMY <b>·</b> CLICK ENEMY TO POSSESS <b>·</b> MOUSE FIRE <b>·</b> RIGHT CLICK TO COMMAND <b>·</b> ARROWS PAN <b>·</b> ESC RELEASE':'WASD MOVE <b>·</b> MOUSE FIRE <b>·</b> Q SPELL <b>·</b> E ECHO <b>·</b> SPACE DASH <b>·</b> F CHEST <b>·</b> B SHOP <b>·</b> I INVENTORY';
}
function isDM(){return mode==='dm'||mode==='onlineDM';}
function isHost(){return mode==='party'||mode==='dm'||mode==='onlineDM';}
function startLocal(role){mode=role;game=createGame();activeSlot=0;
  if(role==='party' && selectedHero!==0){game.players[0].hero=selectedHero;game.players[selectedHero].hero=0;}
  camera.x=role==='dm'?5790:WORLD.partyX+250;camera.y=role==='dm'?1000:game.players[0].y;
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
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);width=Math.max(1,r.width);height=Math.max(1,r.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
function scrToWorld(sx,sy){return {x:(sx-width/2)/camera.zoom+camera.x,y:(sy-height/2)/camera.zoom+camera.y};}
function mouseWorld(e){const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;const w=scrToWorld(x,y);chosenMouse.x=x;chosenMouse.y=y;chosenMouse.worldX=w.x;chosenMouse.worldY=w.y;}
function updateCamera(dt){if(!game)return;let tx=camera.x,ty=camera.y;
  if(!isDM()){const p=game.players?.[activeSlot];if(p){tx=p.x;ty=p.y;}}
  else if(possessed){const e=game.enemies?.find(v=>v.id===possessed&&v.hp>0);if(e){tx=e.x;ty=e.y;}else {possessed=null;notify('Possessed unit eliminated.');}}
  else{const v=530*dt/camera.zoom;camera.x+=(Number(keys.has('arrowright'))-Number(keys.has('arrowleft')))*v;camera.y+=(Number(keys.has('arrowdown'))-Number(keys.has('arrowup')))*v;}
  if(!isDM()||possessed){const f=Math.min(1,dt*7);camera.x+=(tx-camera.x)*f;camera.y+=(ty-camera.y)*f;}
  camera.x=clamp(camera.x,0,WORLD.width);camera.y=clamp(camera.y,0,WORLD.height);
}
function update(dt,now){if(!game)return;
  if(isHost()){
    const inputs={};
    if(mode==='party')inputs[0]=currentInput();
    if(mode==='onlineDM'){
      for(const [slot,s] of Object.entries(netSlots)){const i=Number(slot);if(Number.isInteger(i)&&i>=0&&i<6 && s?.uid && netInputs[s.uid])inputs[i]=netInputs[s.uid];}
    }
    tick(game,dt,inputs,isDM()?dmInput():null);
    if(mode==='onlineDM'&&now-lastPublish>=PUBLISH_RATE){lastPublish=now;net.publish(serialize(game)).catch(e=>notify(`Sync error: ${e.message}`));}
  } else if(mode==='onlineParty'&&net&&now-lastInputSend>=INPUT_RATE){
    lastInputSend=now;net.send(currentInput()).catch(e=>notify(`Input sync error: ${e.message}`));
  }
  updateCamera(dt);
  if(now-lastUI>=140){lastUI=now;refreshUI();}
  if(game.status==='finished'&&renderedWinner!==game.winner){renderedWinner=game.winner;
    $('endOverlay').classList.remove('hidden');$('endTitle').textContent=game.winner==='party'?'PARTY VICTORY':'DM VICTORY';$('endTitle').style.color=game.winner==='party'?'#79e5d4':'#e88f9c';}
}
function refreshUI(){if(!game)return;
  const t=Math.max(0,Math.ceil(game.time||0));$('clock').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  $('towerHp').textContent=towerExposed(game)?`${Math.ceil(game.towerHp??4200)} / ${game.towerMaxHp??4200}`:'SHIELDED';
  $('towerBar').style.width=`${100*(game.towerHp??4200)/(game.towerMaxHp??4200)}%`;
  $('victoryRule').textContent=towerExposed(game)?'The DM Tower can now take damage':'Destroy 4 of 6 forts to expose the Tower';
  const alive=(game.forts||[]).filter(f=>!f.broken).length;
  $('threat').textContent=Math.floor(game.threat||0);$('armySize').textContent=game.enemies?.length||0;$('fortCount').textContent=alive;
  $('possession').textContent=possessed?`POSSESSED: ${possessed.toUpperCase()}`:'NO UNIT POSSESSED';
  for(const b of $('dmUnits').querySelectorAll('button')){const cost={grunt:12,brute:30,sniper:24}[b.dataset.unit];b.disabled=!isHost()||!isDM()||game.threat<cost;}
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
  const present=Object.entries(netSlots).length;
  $('onlineRoster').textContent=mode==='onlineDM'?`ROOM ${net?.code||''} / ${present} OF 6 PLAYERS JOINED`:mode==='onlineParty'?`ROOM ${net?.code||''} / ${present} PLAYERS`:'LOCAL TRAINING / AI TEAMMATES';
}
function escapeHTML(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function refreshInventory(p){const grid=$('invGrid');grid.replaceChildren();
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
function drawWorld(){ctx.fillStyle='#1c3137';ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.save();ctx.strokeStyle='#345158';ctx.lineWidth=1;ctx.globalAlpha=.35;
  for(let x=0;x<WORLD.width;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.height);ctx.stroke();}
  for(let y=0;y<WORLD.height;y+=90){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.width,y);ctx.stroke();}ctx.restore();
  // Two dangerous jungle corridors through the city.
  for(const [j,y] of [650,1320].entries()){
    ctx.fillStyle='#20463b';ctx.fillRect(0,y-140,WORLD.width,280);
    ctx.fillStyle='#2a5848';for(let x=90;x<WORLD.width;x+=118){const jitter=((x*3+j*53)%62)-31;ctx.beginPath();ctx.arc(x,y+jitter+(Math.sin(x*.012)*56),23,0,Math.PI*2);ctx.fill();}
  }
  // Charles River inspired crossing; road bridges traverse it.
  ctx.fillStyle='#214858';ctx.fillRect(300,0,105,WORLD.height);ctx.fillStyle='#3c7280';
  for(let y=35;y<WORLD.height;y+=75){ctx.fillRect(309,y,13,40);ctx.fillRect(385,y+18,7,28);}
  for(const [i,y] of WORLD.lanes.entries()){
    ctx.fillStyle='#39454a';ctx.fillRect(0,y-111,WORLD.width,222);
    ctx.fillStyle='#647479';ctx.fillRect(0,y-111,WORLD.width,6);ctx.fillRect(0,y+105,WORLD.width,6);
    ctx.strokeStyle='#88908b';ctx.lineWidth=3;ctx.setLineDash([28,22]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.width,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#9baeb7';ctx.font='700 24px Segoe UI';ctx.fillText(['BEACON HILL // NORTH','DOWNTOWN CROSSING // CENTER','SOUTH END // SOUTH'][i],520,y-145);
    for(let x=520;x<WORLD.width;x+=340){ctx.fillStyle='#6e8c8d';ctx.fillRect(x,y-108,3,26);ctx.fillRect(x,y+82,3,26);}
  }
  // Buildings are drawn from exact collision rectangles.
  for(const [i,b] of BUILDINGS.entries()){
    ctx.fillStyle='#0d1b22';ctx.fillRect(b.x+8,b.y+10,b.w,b.h);
    ctx.fillStyle=['#647276','#616468','#576e71'][i%3];ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle='#9aa5a5';ctx.lineWidth=3;ctx.strokeRect(b.x+3,b.y+3,b.w-6,b.h-6);
    ctx.fillStyle='#36484d';ctx.fillRect(b.x+16,b.y+17,b.w-32,b.h-34);
    ctx.fillStyle='#889b9d';for(let w=0;w<3;w++)ctx.fillRect(b.x+23+w*34,b.y+26,19,18);
  }
  for(const shop of SHOPS){
    ctx.fillStyle='#13281c';ctx.beginPath();ctx.arc(shop.x,shop.y,88,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#91dfad';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#bcead1';ctx.fillRect(shop.x-27,shop.y-22,54,44);ctx.fillStyle='#153d34';ctx.fillRect(shop.x-20,shop.y-14,40,28);
    ctx.fillStyle='#dffbe5';ctx.font='bold 19px Segoe UI';ctx.textAlign='center';ctx.fillText('$',shop.x,shop.y+7);
    ctx.font='700 13px Consolas';ctx.fillText(shop.name,shop.x,shop.y-103);ctx.textAlign='left';
  }
  ctx.fillStyle='#82dbc6';ctx.beginPath();ctx.arc(WORLD.partyX,1000,90,0,Math.PI*2);ctx.fillStyle='#244846';ctx.fill();ctx.strokeStyle='#75dec7';ctx.lineWidth=6;ctx.stroke();
  ctx.fillStyle='#e2f9f3';ctx.font='bold 18px Segoe UI';ctx.textAlign='center';ctx.fillText('PARTY SPAWN',WORLD.partyX,1005);ctx.textAlign='left';
  ctx.fillStyle='#6c2939';ctx.fillRect(WORLD.dmX-190,0,480,WORLD.height);ctx.fillStyle='#e0b1b7';ctx.font='bold 19px Segoe UI';ctx.fillText('DUNGEON MASTER TERRITORY',WORLD.dmX-165,110);
}
function hpBar(x,y,w,fraction,c='#e17f83'){ctx.fillStyle='#08151bbd';ctx.fillRect(x-w/2,y,w,6);ctx.fillStyle=c;ctx.fillRect(x-w/2,y,w*clamp(fraction,0,1),6);}
function shapeCircle(x,y,r,fill,stroke='#0d171b',line=3){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
function drawFort(f){if(f.broken){ctx.fillStyle='#172325';ctx.fillRect(f.x-52,f.y-48,104,96);ctx.strokeStyle='#7b4b4e';ctx.lineWidth=5;ctx.strokeRect(f.x-52,f.y-48,104,96);ctx.strokeStyle='#d57f7c';ctx.beginPath();ctx.moveTo(f.x-40,f.y-30);ctx.lineTo(f.x+37,f.y+34);ctx.stroke();return;}
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
function entityPosition(entity){if(mode!=='onlineParty')return entity;
  let sm=smoothPositions.get(entity.id);if(!sm){sm={x:entity.x,y:entity.y};smoothPositions.set(entity.id,sm);}
  if(Math.hypot(entity.x-sm.x,entity.y-sm.y)>340){sm.x=entity.x;sm.y=entity.y;}
  else{sm.x+=(entity.x-sm.x)*.18;sm.y+=(entity.y-sm.y)*.18;}
  return sm;
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
function drawChest(c){if(c.opened)return;ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle='#422c1b';ctx.fillRect(-20,-16,40,32);ctx.strokeStyle='#dbb77d';ctx.lineWidth=3;ctx.strokeRect(-20,-16,40,32);ctx.fillStyle='#edca8b';ctx.fillRect(-3,-15,6,30);ctx.fillRect(-18,-3,36,6);ctx.restore();}
function drawFX(fx){ctx.save();const v=1-fx.ttl/.38;ctx.globalAlpha=Math.max(0,1-v);
  ctx.strokeStyle=fx.type==='ability'?'#b7a4ff':fx.type==='nova'?'#ffd18d':fx.type==='loot'?'#ffd18d':'#f4bac2';
  ctx.lineWidth=fx.type==='ability'||fx.type==='nova'?6:3;
  ctx.beginPath();ctx.arc(fx.x,fx.y,(fx.type==='ability'?165:fx.type==='nova'?220:12)*Math.max(.2,v),0,Math.PI*2);ctx.stroke();ctx.restore();}
function drawMinimap(){if(!game)return;const w=210,h=125,x=width-w-18,y=height-h-18;
  ctx.save();ctx.fillStyle='#101a21e8';ctx.fillRect(x-5,y-5,w+10,h+10);ctx.strokeStyle='#88a3a0';ctx.lineWidth=1;ctx.strokeRect(x-5,y-5,w+10,h+10);
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='#2d4147';ctx.fillRect(x,y,w,h);
  for(const ly of WORLD.lanes){ctx.strokeStyle='#879597';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y+ly/WORLD.height*h);ctx.lineTo(x+w,y+ly/WORLD.height*h);ctx.stroke();}
  ctx.fillStyle='#3b6d56';ctx.fillRect(x,y+560/WORLD.height*h,w,240/WORLD.height*h);ctx.fillRect(x,y+1210/WORLD.height*h,w,240/WORLD.height*h);
  for(const f of game.forts||[]){ctx.fillStyle=f.broken?'#586869':'#f3a2a9';ctx.fillRect(x+f.x/WORLD.width*w-3,y+f.y/WORLD.height*h-3,6,6);}
  for(const p of game.players||[]){if(p.hp<=0)continue;ctx.fillStyle=HEROES[p.hero]?.color||'#6bd';ctx.beginPath();ctx.arc(x+p.x/WORLD.width*w,y+p.y/WORLD.height*h,2.8,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#f77a8a';ctx.beginPath();ctx.arc(x+WORLD.dmX/WORLD.width*w,y+h/2,6,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#d4f2eb';ctx.lineWidth=1.4;ctx.strokeRect(x+(camera.x-width/2/camera.zoom)/WORLD.width*w,y+(camera.y-height/2/camera.zoom)/WORLD.height*h,(width/camera.zoom)/WORLD.width*w,(height/camera.zoom)/WORLD.height*h);
  ctx.restore();}
function render(){if(!width||!height)return;const dpr=canvas.width/width;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#091219';ctx.fillRect(0,0,width,height);
  if(!game){ctx.textAlign='center';ctx.font='bold 33px Segoe UI';ctx.fillStyle='#537f80';ctx.fillText('SEEKING // STANDBY',width/2,height/2);ctx.textAlign='left';return;}
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
  drawWorld();for(const c of game.chests||[])drawChest(c);for(const f of game.forts||[])drawFort(f);drawTower();
  for(const e of game.enemies||[])drawEnemy(e);for(const p of game.players||[])drawCharacter(p);
  for(const b of game.bullets||[]){ctx.fillStyle=b.color||'#fff';shapeCircle(b.x,b.y,b.r,ctx.fillStyle,ctx.fillStyle,0);}
  for(const fx of game.effects||[])drawFX(fx);ctx.restore();drawMinimap();
  if(mode==='onlineParty' && game.players?.[activeSlot]?.respawn>0){ctx.fillStyle='#f1d9db';ctx.textAlign='center';ctx.font='bold 28px Segoe UI';ctx.fillText(`REDEPLOY ${Math.ceil(game.players[activeSlot].respawn)}s`,width/2,height/2);ctx.textAlign='left';}
}
function frame(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;update(dt,now);render();frameId=requestAnimationFrame(frame);}
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
    if(isDM()&&placementType){const inferredLane=WORLD.lanes.reduce((best,ly,j)=>Math.abs(ly-chosenMouse.worldY)<Math.abs(WORLD.lanes[best]-chosenMouse.worldY)?j:best,0);
      if(dmSpawn(game,inferredLane,placementType,chosenMouse.worldX,chosenMouse.worldY)){notify(`${placementType.toUpperCase()} deployed.`);placementType=null;}else notify('Invalid position or insufficient threat.');return;}
    if(isDM()&&!possessed){const target=(game.enemies||[]).filter(v=>v.hp>0).find(e=>dist(e,{x:chosenMouse.worldX,y:chosenMouse.worldY})<e.r+14);
      if(target){possessed=target.id;notify(`Possessed ${target.kind.toUpperCase()}. ESC to release.`);return;}}
    chosenMouse.down=true;
  });
  window.addEventListener('mouseup',()=>chosenMouse.down=false);
  canvas.addEventListener('mouseleave',()=>chosenMouse.down=false);
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(!isDM()||!game||!isHost())return;
    mouseWorld(e);for(const enemy of game.enemies){if(enemy.kind==='boss'||enemy.id===possessed)continue;enemy.orderX=chosenMouse.worldX;enemy.orderY=chosenMouse.worldY;}
    notify('March order issued to the field army.');
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=clamp(camera.zoom*(e.deltaY>0?.9:1.1),.52,1.52);},{passive:false});
  canvas.addEventListener('click',e=>{
    if(!isDM()||possessed||!game)return;const box=canvas.getBoundingClientRect(),px=e.clientX-box.left,py=e.clientY-box.top;
    const w=210,h=125,x=width-w-18,y=height-h-18;
    if(px>=x&&px<=x+w&&py>=y&&py<=y+h){camera.x=(px-x)/w*WORLD.width;camera.y=(py-y)/h*WORLD.height;}
  });
}
setupChoices();events();resize();requestAnimationFrame(frame);
