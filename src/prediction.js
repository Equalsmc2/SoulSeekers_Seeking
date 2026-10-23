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

/**
 * A server-clocked presentation timeline. Do not use packet arrival time as
 * motion time: packets frequently arrive in bursts even when the simulation
 * steps at a steady 30 Hz. The playhead advances monotonically, stays behind
 * the latest server frame, and catches up gently instead of jumping ahead.
 */
export function createPlaybackClock({baseDelay=115,minDelay=100,maxDelay=205}={}) {
  let playhead=null,latest=null,lastArrival=null,lastServer=null;
  let networkJitter=0,delay=baseDelay,stalls=0;
  return {
    get time(){return playhead;},
    get delay(){return delay;},
    get jitter(){return networkJitter;},
    get stalls(){return stalls;},
    reset(){playhead=latest=lastArrival=lastServer=null;networkJitter=0;delay=baseDelay;stalls=0;},
    receive(serverMs,arrivalMs){
      if(!Number.isFinite(serverMs)||!Number.isFinite(arrivalMs))return;
      if(lastServer!==null && serverMs<=lastServer)return; // duplicate / stale sample
      if(lastServer!==null){
        const observed=(arrivalMs-lastArrival)-(serverMs-lastServer);
        // Packet burstiness, not normal 50 ms snapshot spacing, is jitter.
        networkJitter=.88*networkJitter+.12*Math.min(180,Math.abs(observed));
        const targetDelay=clamp(baseDelay+networkJitter*2.2,minDelay,maxDelay);
        delay+=clamp(targetDelay-delay,-2.5,2.5);
      }
      lastArrival=arrivalMs;lastServer=serverMs;latest=serverMs;
      if(playhead===null)playhead=serverMs-delay;
    },
    advance(deltaMs){
      if(playhead===null)return null;
      const dt=clamp(deltaMs,0,55);
      const target=latest-delay;
      // Keep the presentation clock stable across packets, with a small rate
      // adjustment to restore buffer occupancy after jitter or a skipped update.
      const gap=target-playhead;
      const rate=clamp(1+gap/380,.87,1.15);
      const ceiling=latest+35;
      if(playhead+dt*rate>ceiling && playhead<ceiling)stalls++;
      playhead=Math.min(ceiling,playhead+dt*rate);
      return playhead;
    },
  };
}

/** Interpolate on timestamped server-simulation positions. Legacy callers
 * can still supply arrival timestamps and the 110 ms default delay. */
export function tweenPosition(entry,time,delay=110){
  if(!entry?.samples?.length||!Number.isFinite(time))return null;
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
  const ahead=clamp(target-b.t,0,42);
  // Don't extrapolate through respawns, teleports or packet-starved intervals.
  if(!a || Math.hypot(b.x-a.x,b.y-a.y)>180 || target-b.t>85)return {x:b.x,y:b.y};
  const dt=Math.max(25,b.t-a.t);
  return {x:b.x+clamp((b.x-a.x)/dt,-1,1)*ahead,
          y:b.y+clamp((b.y-a.y)/dt,-1,1)*ahead};
}
export function receiveEntityMotion(entries,entities,time){
  if(!Number.isFinite(time))return;
  const present=new Set();
  for(const entity of entities){
    if(!entity?.id || !Number.isFinite(entity.x) || !Number.isFinite(entity.y))continue;
    present.add(entity.id);
    const old=entries.get(entity.id);
    const previous=old?.samples?.at(-1);
    // Reset when respawning, teleporting or reentering interest range after a pause.
    const jumped=previous&&(Math.hypot(entity.x-previous.x,entity.y-previous.y)>380 || time-previous.t>500);
    const samples=(!old||jumped)?[]:old.samples;
    if(previous && !jumped && time<=previous.t)continue;
    samples.push({t:time,x:entity.x,y:entity.y});
    while(samples.length>10 || (samples.length>2&&time-samples[0].t>800))samples.shift();
    entries.set(entity.id,{samples,lastReceived:time});
  }
  // An entity outside the Party's interest area should not cause unnecessary
  // sample loss if it briefly crosses a boundary. Expire it after a grace period.
  for(const [id,entry] of entries)if(!present.has(id)&&time-entry.lastReceived>360)entries.delete(id);
}

/** Compare a delayed server position with predicted-present movement without
 * dragging the local avatar backwards by the normal one-way network delay.
 * Hard corrections remain reserved for respawns and large divergences. */
export function reconcileWithLatency(pos,server,input,oneWaySeconds=0){
  if(!pos)return newPrediction(server);
  if(server.hp<=0||server.respawn>0){pos.x=server.x;pos.y=server.y;return pos;}
  const step=clamp(oneWaySeconds,0,.18);
  const base={x:server.x,y:server.y,dashCd:pos.dashCd};
  if(step>0){
    const count=Math.max(1,Math.ceil(step/.04));
    for(let i=0;i<count;i++)predictStep(base,server,{...input,dash:false},step/count);
  }
  const dx=base.x-pos.x,dy=base.y-pos.y,d=Math.hypot(dx,dy);
  if(d>390){pos.x=base.x;pos.y=base.y;return pos;}
  const moving=!!(input.mx||input.my);
  const deadZone=moving?22:3;
  if(d>deadZone){
    const factor=moving?(d<75?.08:.18):(d<75?.28:.36);
    const applied=(d-deadZone)*factor/d;
    pos.x+=dx*applied;pos.y+=dy*applied;
  }
  return pos;
}
