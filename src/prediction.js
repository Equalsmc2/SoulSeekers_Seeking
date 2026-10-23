import {WORLD,BUILDINGS,clamp} from './data.js?v=R021';

function blocked(x,y,r){
  return BUILDINGS.some(b=>{
    const xx=clamp(x,b.x,b.x+b.w),yy=clamp(y,b.y,b.y+b.h);
    return (x-xx)**2+(y-yy)**2 < r*r;
  });
}

/** Purely visual prediction. The dedicated server remains authoritative. */
export function newPrediction(player){return {x:player.x,y:player.y,dashCd:player.dashCd||0};}
export function predictStep(pos,player,input,delta){
  if(!pos||!player)return pos;
  const dt=clamp(delta,0,.05);
  if(player.hp<=0||player.respawn>0){pos.x=player.x;pos.y=player.y;return pos;}
  pos.dashCd=Math.max(0,pos.dashCd-dt);
  const mx=clamp(input.mx||0,-1,1),my=clamp(input.my||0,-1,1),magnitude=Math.hypot(mx,my)||1;
  const dash=!!input.dash&&pos.dashCd<=0;
  const spd=235*(player.inventory?.some(i=>i.type==='boots')?1.18:1)*(dash?3.5:1);
  if(dash)pos.dashCd=5;
  const r=player.r||19,oldX=pos.x,oldY=pos.y;
  pos.x=clamp(pos.x+mx/magnitude*spd*dt,r+12,WORLD.width-r-12);
  if(blocked(pos.x,pos.y,r))pos.x=oldX;
  pos.y=clamp(pos.y+my/magnitude*spd*dt,r+12,WORLD.height-r-12);
  if(blocked(pos.x,pos.y,r))pos.y=oldY;
  return pos;
}
/** Network positions are in the past. Nudge, rather than yank, local prediction
 * back toward that delayed snapshot; teleport only on unmistakable divergence. */
export function reconcilePrediction(pos,server,isMoving){
  if(!pos)return newPrediction(server);
  if(server.hp<=0||server.respawn>0){pos.x=server.x;pos.y=server.y;return pos;}
  const d=Math.hypot(server.x-pos.x,server.y-pos.y);
  if(d>420){pos.x=server.x;pos.y=server.y;pos.dashCd=server.dashCd||0;return pos;}
  const correction=isMoving?(d<70?.015:.055):(d<70?.17:.24);
  pos.x+=(server.x-pos.x)*correction;
  pos.y+=(server.y-pos.y)*correction;
  return pos;
}

/** Buffered remote positions. Rendering 110ms behind the newest sample absorbs
 * uneven packet arrivals, while extrapolation is capped to 55ms after the last
 * sample. No unlimited runaway when the network pauses. */
export function tweenPosition(entry,time,delay=110){
  if(!entry?.samples?.length)return null;
  const samples=entry.samples,target=time-delay;
  if(samples.length===1 || target<=samples[0].t)return {x:samples[0].x,y:samples[0].y};
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    if(target<=b.t){
      const f=clamp((target-a.t)/Math.max(1,b.t-a.t),0,1);
      return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
    }
  }
  const b=samples.at(-1),a=samples.at(-2);
  const ahead=target-b.t>55?0:clamp(target-b.t,0,55);
  if(!a || Math.hypot(b.x-a.x,b.y-a.y)>180)return {x:b.x,y:b.y};
  const dt=Math.max(25,b.t-a.t);
  // Cap velocity to prevent pathological extrapolation on bursty connections.
  return {x:b.x+clamp((b.x-a.x)/dt,-.9,.9)*ahead,
          y:b.y+clamp((b.y-a.y)/dt,-.9,.9)*ahead};
}
export function receiveEntityMotion(entries,entities,time){
  const present=new Set();
  for(const entity of entities){
    if(!entity?.id)continue;
    present.add(entity.id);
    const old=entries.get(entity.id);
    const previous=old?.samples?.at(-1);
    const jumped=previous&&Math.hypot(entity.x-previous.x,entity.y-previous.y)>380;
    const samples=(!old||jumped)?[]:old.samples;
    // Fresh samples are bounded so a long-running match cannot leak memory.
    samples.push({t:time,x:entity.x,y:entity.y});
    while(samples.length>6 || (samples.length>2&&time-samples[0].t>700))samples.shift();
    entries.set(entity.id,{samples,lastReceived:time});
  }
  for(const id of entries.keys())if(!present.has(id))entries.delete(id);
}
