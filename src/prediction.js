import {WORLD,BUILDINGS,clamp} from './data.js?v=R017';

function blocked(x,y,r){
  return BUILDINGS.some(b=>{
    const xx=clamp(x,b.x,b.x+b.w),yy=clamp(y,b.y,b.y+b.h);
    return (x-xx)**2+(y-yy)**2 < r*r;
  });
}

/** Visual-only prediction: never writes to the host's authoritative state. */
export function newPrediction(player){
  return {x:player.x,y:player.y,dashCd:player.dashCd||0};
}
export function predictStep(pos,player,input,delta){
  if(!pos||!player)return pos;
  const dt=clamp(delta,0,.08);
  if(player.hp<=0||player.respawn>0){pos.x=player.x;pos.y=player.y;return pos;}
  pos.dashCd=Math.max(0,pos.dashCd-dt);
  const mx=clamp(input.mx||0,-1,1), my=clamp(input.my||0,-1,1);
  const magnitude=Math.hypot(mx,my)||1;
  const dash=!!input.dash&&pos.dashCd<=0;
  const spd=235*(player.inventory?.some(i=>i.type==='boots')?1.18:1)*(dash?3.5:1);
  if(dash)pos.dashCd=5;
  const r=player.r||19;
  const oldX=pos.x,oldY=pos.y;
  pos.x=clamp(pos.x+mx/magnitude*spd*dt,r+12,WORLD.width-r-12);
  if(blocked(pos.x,pos.y,r))pos.x=oldX;
  pos.y=clamp(pos.y+my/magnitude*spd*dt,r+12,WORLD.height-r-12);
  if(blocked(pos.x,pos.y,r))pos.y=oldY;
  return pos;
}
/** Smooth out harmless timing differences; snap only for major corrections. */
export function reconcilePrediction(pos,server,isMoving){
  if(!pos)return newPrediction(server);
  if(server.hp<=0||server.respawn>0){pos.x=server.x;pos.y=server.y;return pos;}
  const d=Math.hypot(server.x-pos.x,server.y-pos.y);
  if(d>460){pos.x=server.x;pos.y=server.y;pos.dashCd=server.dashCd||0;return pos;}
  const correction=isMoving?.045:.27;
  pos.x+=(server.x-pos.x)*correction;
  pos.y+=(server.y-pos.y)*correction;
  return pos;
}

export function tweenPosition(entry,time){
  if(!entry)return null;
  const t=clamp((time-entry.started)/entry.duration,0,1);
  return {x:entry.fromX+(entry.toX-entry.fromX)*t,y:entry.fromY+(entry.toY-entry.fromY)*t};
}
export function receiveEntityMotion(entries,entities,time){
  const present=new Set();
  for(const entity of entities){
    if(!entity?.id)continue;
    present.add(entity.id);
    const old=entries.get(entity.id);
    const from=tweenPosition(old,time)||entity;
    const jump=Math.hypot(entity.x-from.x,entity.y-from.y)>380;
    const elapsed=old ? time-old.lastReceived : 160;
    const duration=clamp(elapsed,90,260);
    entries.set(entity.id,{
      fromX:jump?entity.x:from.x,fromY:jump?entity.y:from.y,
      toX:entity.x,toY:entity.y,started:time,duration,lastReceived:time,
    });
  }
  for(const id of entries.keys())if(!present.has(id))entries.delete(id);
}
