/** Seeking M2+ first playable runtime. All authoritative state is computed on Node.
 * Do not accept client-submitted positions, HP, ammo, souls, monster ownership, or elapsed time. */
import {ROOM_SIZE,ROOM_LOOKUP,doors,xy,coords,pokerInfo,TAROT} from './rules.mjs';
import {HEROES,MONSTERS} from '../combat/loadouts.mjs';
const HALF=ROOM_SIZE/2, DOOR_HALF=125, RADIUS=20, tarotIndex=Object.fromEntries(TAROT.map(t=>[t.id,t]));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hypot=(a,b)=>Math.hypot(a,b);
const dist=(a,b)=>hypot(a.x-b.x,a.y-b.y);
const roomKey=(x,y)=>xy(Math.floor((x+HALF)/ROOM_SIZE),Math.floor((y+HALF)/ROOM_SIZE));
const near=(a,b,r)=>dist(a,b)<=r;
const norm=(x,y)=>{const d=hypot(x,y)||1;return {x:x/d,y:y/d};};
const at=(key,dx=0,dy=0)=>{const [x,y]=coords(key);return {x:x*ROOM_SIZE+dx,y:y*ROOM_SIZE+dy};};
const rotRect=(ob,r)=>{const [x,y,w,h]=ob;let pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];for(let i=0;i<r;i++)pts=pts.map(([px,py])=>[-py,px]);return {left:Math.min(...pts.map(p=>p[0])),right:Math.max(...pts.map(p=>p[0])),top:Math.min(...pts.map(p=>p[1])),bottom:Math.max(...pts.map(p=>p[1]))};};
export class DungeonRuntime{
 constructor(board,{now=()=>Date.now()}={}){
  this.now=now;this.board=structuredClone(board);this.players=Array(6).fill(null);this.inputs=Array(6).fill(null);this.seen=new Set();this.souls=new Set();this.monsters=[];this.nextMonster=1;this.dmInput={x:0,y:0};this.possessed=null;this.threat=30;this.time=0;this.startedAt=now();this.deadline=this.startedAt+40*60*1000;this.result=null;this.version=1;this.events=[];
  this.camps={};for(const [k,room] of Object.entries(this.board))if(room.camp)this.camps[k]={key:k,owner:'dm',progress:0,progressSide:null,timer:3,card:room.camp.id};
  for(const [key,camp] of Object.entries(this.camps))Object.assign(camp,this.campPos(key));
  const entry=Object.keys(this.board).find(k=>this.board[k].id==='entry');this.entrance=entry;this.seen.add(entry);this.lastTick=this.startedAt;
 }
 log(text){this.events.unshift({text,at:Math.round(this.time*10)/10});this.events.length=Math.min(12,this.events.length);this.version++;}
 addPlayer(slot){if(!Number.isInteger(slot)||slot<0||slot>=6)throw Error('Invalid player slot');if(this.players[slot]){if(this.inputs[slot])this.inputs[slot]={...this.inputs[slot],x:0,y:0,interact:false,attack:false,rest:false,guard:false,seq:-1};return this.players[slot];}const def=HEROES[slot],sp=at(this.entrance,[-100,-60,-20,20,60,100][slot],slot%2?-50:50);const p={slot,name:def.name,x:sp.x,y:sp.y,hp:def.hp,maxHp:def.hp,weapon:0,dodge:0,ammo:def.weapons.map(w=>w.mag),reloading:[0,0],weaponReady:0,castReady:0,dodgeReady:0,spellSlots:{1:def.slots[0],2:def.slots[1]},sorcery:def.sp||0,restUses:2,downFor:0,invuln:1,buff:0,wards:0,potion:0,history:[],lastAction:0,restProgress:0,restCooldown:0,guardStart:-100};this.players[slot]=p;this.inputs[slot]={x:0,y:0,interact:false,attack:false,rest:false,guard:false,aimX:sp.x+10,aimY:sp.y,seq:-1};return p;}
 removePlayer(slot){if(this.inputs[slot])this.inputs[slot]={...this.inputs[slot],x:0,y:0,interact:false,attack:false,rest:false,guard:false,seq:-1};}
 roomAt(x,y){const key=roomKey(x,y);return this.board[key]?key:null;}
 tileEffect(k){return tarotIndex[this.board[k]?.tarot?.id]||null;}
 modifier(k,kind){const t=this.tileEffect(k);if(!t)return 1;if(t.effect===kind)return t.power;if(t.effect==='devil'&&['hp','damage','speed'].includes(kind))return t.power;return 1;}
 /** Collision uses real 960-unit rooms, rotated obstacles and 250-unit doorway apertures. */
 walkable(x,y,r=RADIUS){if(!finite(x)||!finite(y)||Math.abs(x)>26000||Math.abs(y)>26000)return false;
  const k=this.roomAt(x,y);if(!k)return false;const room=this.board[k], [gx,gy]=coords(k),lx=x-gx*ROOM_SIZE,ly=y-gy*ROOM_SIZE,mask=doors(room);
  if(lx < -HALF+r && (!(mask&8)||Math.abs(ly)>DOOR_HALF-r))return false;
  if(lx > HALF-r && (!(mask&2)||Math.abs(ly)>DOOR_HALF-r))return false;
  if(ly < -HALF+r && (!(mask&1)||Math.abs(lx)>DOOR_HALF-r))return false;
  if(ly > HALF-r && (!(mask&4)||Math.abs(lx)>DOOR_HALF-r))return false;
  for(const ob of ROOM_LOOKUP[room.id].ob){const q=rotRect(ob,room.rot);if(lx>q.left-r&&lx<q.right+r&&ly>q.top-r&&ly<q.bottom+r)return false;}
  return true;
 }
 campPos(key){for(const [dx,dy] of [[-170,-125],[160,-140],[-190,160],[170,140],[0,-205],[0,210],[-285,0],[280,0],[0,0]]){const p=at(key,dx,dy);if(this.walkable(p.x,p.y,40)&&Math.hypot(dx,dy-200)>90)return p;}return at(key);}
 move(actor,dx,dy,step,r=RADIUS){const n=norm(dx,dy);let left=Math.min(700,Math.max(0,step));while(left>0){const s=Math.min(left,16);const nx=actor.x+n.x*s,ny=actor.y+n.y*s;if(this.walkable(nx,actor.y,r))actor.x=nx;if(this.walkable(actor.x,ny,r))actor.y=ny;left-=s;}}
 canSee(a,b){if(!finite(b?.x)||!finite(b?.y)||dist(a,b)>1500)return false;const distance=dist(a,b);for(let t=30;t<distance;t+=24){const s=t/distance;if(!this.walkable(a.x+(b.x-a.x)*s,a.y+(b.y-a.y)*s,4))return false;}return true;}
 // Prevent shooting through walls or from undiscovered areas. Damage happens here, never on the client.
 nearestMonster(p,target,range,cone=.65){let best=null,score=Infinity;const aim=norm(target.x-p.x,target.y-p.y);for(const m of this.monsters){if(m.hp<=0)continue;const d=dist(p,m);if(d>range+28)continue;const dir=norm(m.x-p.x,m.y-p.y);if(dir.x*aim.x+dir.y*aim.y<cone)continue;if(!this.canSee(p,m))continue;const metric=d+(1-(dir.x*aim.x+dir.y*aim.y))*160;if(metric<score){score=metric;best=m;}}return best;}
 input(slot,packet){const p=this.players[slot],old=this.inputs[slot];if(!p||!old)return;const n=packet.inputSeq;if(!Number.isSafeInteger(n)||n<=old.seq)return;const x=Number(packet.x),y=Number(packet.y);if(!finite(x)||!finite(y)||Math.abs(x)>2||Math.abs(y)>2)return;const aimX=Number(packet.aimX),aimY=Number(packet.aimY);if(packet.guard===true&&!old.guard)p.guardStart=this.time;this.inputs[slot]={seq:n,x:clamp(x,-1,1),y:clamp(y,-1,1),interact:packet.interact===true,attack:packet.attack===true,rest:packet.rest===true,guard:packet.guard===true,aimX:finite(aimX)&&Math.abs(aimX)<26000?aimX:p.x,aimY:finite(aimY)&&Math.abs(aimY)<26000?aimY:p.y};}
 partyAction(slot,type,args={}){const p=this.players[slot];if(!p||this.result)throw Error('No active hero');if(p.hp<=0)throw Error('Hero is down');const def=HEROES[slot];const target={x:Number(args.aimX),y:Number(args.aimY)};if(!['partyWeapon','partyDodgeSelect','partyReload','partyPotion'].includes(type)&&(!finite(target.x)||!finite(target.y)||Math.abs(target.x)>26000||Math.abs(target.y)>26000))throw Error('Invalid aim');
  if(type==='partyWeapon'){if(![0,1].includes(args.index))throw Error('Choose weapon 0 or 1');p.weapon=args.index;return;}
  if(type==='partyDodgeSelect'){if(![0,1].includes(args.index))throw Error('Choose dodge 0 or 1');p.dodge=args.index;return;}
  if(type==='partyReload'){this.reload(p);return;}
  if(type==='partyPotion'){p.potion=(p.potion+1)%3;return;}
  if(type==='partyAttack'){
   const weapon=def.weapons[p.weapon],index=p.weapon;if(this.time<p.weaponReady||this.time<p.castReady)return;
   if(p.reloading[index]>0)return;if(weapon.mag&&p.ammo[index]<=0){this.reload(p);return;}
   p.weaponReady=this.time+weapon.cool;p.castReady=this.time+.16;if(weapon.mag){p.ammo[index]--;if(p.ammo[index]===0)p.reloading[index]=weapon.reload;}
   if(weapon.type==='potion'&&p.potion===0){p.hp=clamp(p.hp+34,0,p.maxHp);return;}
   if(weapon.type==='potion'&&p.potion===1){p.buff=this.time+4;return;}
   const melee=!weapon.mag,enemy=this.nearestMonster(p,target,weapon.range,melee?.35:.94);
   if(enemy){if(weapon.type==='camera'){enemy.dazzled=this.time+4;return;}let damage=weapon.damage;
    if(weapon.type==='pistol'&&enemy.dazzled>this.time)damage*=1.3;
    if(weapon.type==='crossbow')enemy.slowUntil=this.time+1.1;
    enemy.hp=Math.max(0,enemy.hp-damage);if(enemy.hp<=0)this.log(`${p.name} defeated ${enemy.type}`);}
   return;
  }
  if(type==='partyDodge'){
   if(this.time<p.dodgeReady)return;const idx=p.dodge,name=def.dodges[idx][0],cd=def.dodges[idx][1],aim=norm(target.x-p.x,target.y-p.y),before={x:p.x,y:p.y};
   const distance=name==="Knight's Move"?160:name==='Signal Loss'?245:name==='Double Exposure'?210:name==='Foreclosure'?145:165;
   // Knight's Move can phase through intervening walls, but the destination must be legal.
   if(name==="Knight's Move"){const cand={x:p.x+aim.x*distance,y:p.y+aim.y*distance};if(this.walkable(cand.x,cand.y))Object.assign(p,cand);}
   else if(name==='Rewind Echo'&&p.history.length){const back=p.history[0];if(this.walkable(back.x,back.y))Object.assign(p,back);}
   else if(name==='Castling'){const other=this.monsters.filter(m=>m.hp>0&&near(p,m,300)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(other&&this.walkable(other.x,other.y)){const tmp={x:p.x,y:p.y};p.x=other.x;p.y=other.y;other.x=tmp.x;other.y=tmp.y;other.stun=this.time+.6;}}
   else this.move(p,aim.x,aim.y,distance);
   p.dodgeReady=this.time+cd;p.invuln=this.time+(name==='Deadweight'?.75:.32);
   if(name==='Foreclosure')for(const m of this.monsters)if(m.hp>0&&near(p,m,65))m.hp=Math.max(0,m.hp-32);
   if(name==='Counterweight')p.buff=this.time+3;
   this.log(`${p.name} used ${name}`);return;
  }
  if(type==='partyCast'){
   const index=Number(args.index);if(!Number.isInteger(index)||index<0||index>=def.spells.length)throw Error('Unknown spell');const spell=def.spells[index];if(this.time<p.castReady||this.time<p.weaponReady)return;
   if(spell.level&&p.spellSlots[spell.level]<=0)throw Error('No spell slots');if(spell.range&&spell.effect!=='blink'&&spell.effect!=='aoe'&&dist(p,target)>spell.range+10)throw Error('Out of range');if(spell.level)p.spellSlots[spell.level]--;
   p.castReady=this.time+.65;p.weaponReady=this.time+.23;
   if(spell.effect==='heal'){const ally=this.players.filter(Boolean).filter(q=>q.hp>0&&near(p,q,210)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]||p;ally.hp=Math.min(ally.maxHp,ally.hp+(spell.name==='Aid'?35:spell.name==='Mending'?12:45));}
   else if(spell.effect==='ward'){p.wards=this.time+4;}
   else if(spell.effect==='blink'){const dir=norm(target.x-p.x,target.y-p.y);const d=clamp(dist(p,target),0,spell.range);this.move(p,dir.x,dir.y,d);}
   else if(spell.effect==='aoe'){for(const m of this.monsters)if(m.hp>0&&near(m,p,220)&&this.canSee(p,m))m.hp=Math.max(0,m.hp-34);}
   else if(spell.effect==='hold'||spell.effect==='hex'||spell.effect==='damage'){
    const m=this.nearestMonster(p,target,spell.range||500,.83);
    if(m){if(spell.effect==='hold')m.stun=this.time+2.4;else if(spell.effect==='hex')m.slowUntil=this.time+4;else m.hp=Math.max(0,m.hp-(spell.level?38:19));}
   }
   this.log(`${p.name} cast ${spell.name}`);return;
  }
  throw Error('Unknown Party action');
 }
 reload(p){const w=HEROES[p.slot].weapons[p.weapon],i=p.weapon;if(!w.mag||p.reloading[i]>0||p.ammo[i]>=w.mag)return;p.reloading[i]=w.reload;}
 summon(type,x,y,campKey=null){const stats=MONSTERS[type];if(!stats)throw Error('Unknown monster');if(this.monsters.filter(m=>m.hp>0).length>=110)throw Error('Monster cap reached');if(!this.walkable(x,y,28))throw Error('Monster must spawn inside a room');if(!campKey){if(this.threat<stats.cost)throw Error('Not enough threat');this.threat-=stats.cost;}
 const room=this.roomAt(x,y),hp=stats.hp*this.modifier(room,'hp');const m={id:this.nextMonster++,type,x,y,hp,maxHp:hp,campKey,order:'hunt',dest:null,reach:stats.reach,cool:0,stun:0,slowUntil:0,dazzled:0};this.monsters.push(m);return m;}
 dmAction(type,args={}){if(this.result)throw Error('Match ended');
  if(type==='dmSummon'){const x=Number(args.x),y=Number(args.y);if(!finite(x)||!finite(y))throw Error('Invalid spawn');return this.summon(args.unit,x,y);}
  if(type==='dmOrder'){const m=this.monsters.find(m=>m.id===args.monsterId&&m.hp>0);if(!m)throw Error('Monster not found');if(!['hunt','hold','move','capture'].includes(args.order))throw Error('Unknown order');m.order=args.order;if(args.order==='capture'){if(!this.camps[args.key])throw Error('Camp not found');m.campKeyTarget=args.key;m.dest={x:this.camps[args.key].x,y:this.camps[args.key].y};}else if(args.order==='move'){const x=Number(args.x),y=Number(args.y);if(!this.walkable(x,y))throw Error('Invalid order destination');m.dest={x,y};}else m.dest=null;return;}
  if(type==='dmPossess'){const m=this.monsters.find(m=>m.id===args.monsterId&&m.hp>0);if(!m)throw Error('Monster not found');this.possessed=m.id;return;}
  if(type==='dmRelease'){this.possessed=null;return;}
  if(type==='dmInput'){const x=Number(args.x),y=Number(args.y);if(!finite(x)||!finite(y)||Math.abs(x)>1||Math.abs(y)>1)throw Error('Invalid DM movement');this.dmInput={x,y};return;}
  throw Error('Unknown DM action');
 }
 /** Route hostiles through paired doors between graph cells, not straight through dungeon walls. */
 pathTarget(m,target){const start=this.roomAt(m.x,m.y),finish=this.roomAt(target.x,target.y);if(!start||!finish||start===finish)return target;
  const queue=[start],seen=new Set([start]),parent=new Map();const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
  while(queue.length){const k=queue.shift();if(k===finish)break;const [x,y]=coords(k);for(let d=0;d<4;d++){const [dx,dy]=dirs[d],nk=xy(x+dx,y+dy);if(seen.has(nk)||!this.board[nk]||!(doors(this.board[k])&(1<<d))||!(doors(this.board[nk])&(1<<((d+2)%4))))continue;parent.set(nk,{from:k,d});seen.add(nk);queue.push(nk);}}
  if(!seen.has(finish))return {x:m.x,y:m.y};let next=finish;while(parent.get(next)?.from!==start){next=parent.get(next)?.from;if(!next)return target;}const d=parent.get(next)?.d;
  const [gx,gy]=coords(start),[dx,dy]=dirs[d],exit={x:gx*ROOM_SIZE+dx*420,y:gy*ROOM_SIZE+dy*420};
  // First align to the central opening, then advance through the wall.
  if((dx!==0&&Math.abs(m.y-gy*ROOM_SIZE)>55)||(dy!==0&&Math.abs(m.x-gx*ROOM_SIZE)>55))return {x:gx*ROOM_SIZE,y:gy*ROOM_SIZE};
  return {x:gx*ROOM_SIZE+dx*570,y:gy*ROOM_SIZE+dy*570};
 }
 update(dt){if(this.result)return;dt=clamp(dt,0,.06);this.time+=dt;this.threat=clamp(this.threat+dt*.66,0,30);
  if(this.now()>=this.deadline){this.result='DM WIN · TIME EXPIRED';this.log(this.result);return;}
  for(const p of this.players){if(!p)continue;for(let i=0;i<2;i++){const before=p.reloading[i];p.reloading[i]=Math.max(0,before-dt);if(before>0&&p.reloading[i]===0)p.ammo[i]=HEROES[p.slot].weapons[i].mag;}
   if(p.hp<=0){p.restProgress=0;p.downFor-=dt;if(p.downFor<=0){const sp=at(this.entrance);p.x=sp.x;p.y=sp.y;p.hp=p.maxHp;p.invuln=this.time+2;}continue;}
   p.history.push({x:p.x,y:p.y,t:this.time});p.history=p.history.filter(v=>this.time-v.t<1.02);
   const inp=this.inputs[p.slot];if(inp){const def=HEROES[p.slot],rk=this.roomAt(p.x,p.y),t=this.tileEffect(rk);let multiplier=t?.effect==='fleet'?t.power:t?.effect==='slow'?t.power:1;if(p.buff>this.time)multiplier*=1.22;const speed=def.speed*multiplier;this.move(p,inp.x,inp.y,hypot(inp.x,inp.y)>0?speed*dt:0);const current=this.roomAt(p.x,p.y);if(current)this.seen.add(current);
    if(inp.attack){p.restProgress=0;}if(inp.attack&&!this.result&&this.time>=p.weaponReady)this.partyAction(p.slot,'partyAttack',{aimX:inp.aimX,aimY:inp.aimY});
    if(inp.rest&&!inp.attack&&hypot(inp.x,inp.y)<.1&&p.hp>0&&this.time>=p.restCooldown&&!this.monsters.some(m=>m.hp>0&&near(m,p,290))){p.restProgress+=dt;if(p.restProgress>=4.3){p.spellSlots={1:def.slots[0],2:def.slots[1]};p.sorcery=def.sp||0;p.restUses=2;p.hp=Math.min(p.maxHp,p.hp+40);p.restProgress=0;p.restCooldown=this.time+10;this.log(`${p.name} completed a long rest`);}}else if(p.restProgress>0){if(p.restProgress>=1.6&&p.restUses>0){p.restUses--;p.spellSlots[1]=Math.min(def.slots[0],p.spellSlots[1]+2);p.spellSlots[2]=Math.min(def.slots[1],p.spellSlots[2]+1);p.hp=Math.min(p.maxHp,p.hp+20);p.restCooldown=this.time+4;this.log(`${p.name} completed a short rest`);}p.restProgress=0;}
    const soul=this.board[current]?.soul&&!this.souls.has(current);if(inp.interact&&soul&&near(p,at(current,0,200),100)){this.souls.add(current);this.log(`${def.name} collected soul ${this.souls.size}/7`);}
    if(inp.interact&&this.souls.size===7&&current===this.entrance&&near(p,at(this.entrance),155)){this.result='PARTY WIN · SEVEN SOULS EXTRACTED';this.log(this.result);}
   }
   const effect=this.tileEffect(this.roomAt(p.x,p.y));if(effect?.effect==='hurt'&&this.time>=p.invuln){p.hp=Math.max(0,p.hp-dt*effect.power*2);}
   if(effect?.effect==='heal')p.hp=Math.min(p.maxHp,p.hp+dt*effect.power);
   if(p.hp<=0){p.downFor=4;this.log(`${p.name} was downed`);}
  }
  for(const [key,c] of Object.entries(this.camps)){
   const center={x:c.x,y:c.y},info=pokerInfo(c.card),present=this.players.filter(p=>p&&p.hp>0&&near(p,center,125)&&this.inputs[p.slot]?.interact);
   const guarding=this.monsters.filter(m=>m.hp>0&&near(m,center,132));const capturing=guarding.filter(m=>m.order==='capture'||m.id===this.possessed);
   let side=null;if(c.owner==='dm'&&present.length&&!guarding.length)side='party';else if(c.owner==='party'&&capturing.length&&!this.players.some(p=>p&&p.hp>0&&near(p,center,125)))side='dm';
   if(side){if(c.progressSide!==side){c.progress=0;c.progressSide=side;}const mod=side==='party'?this.modifier(key,'partyCapture')/this.modifier(key,'dmCapture'):this.modifier(key,'dmCapture')/this.modifier(key,'partyCapture');c.progress=Math.min(1,c.progress+dt/(side==='party'?2.8:3.2)*mod);if(c.progress===1){c.owner=side;c.progress=0;c.progressSide=null;c.timer=2.2;this.log(`Camp ${key} ${side==='party'?'sealed by Party':'reclaimed by DM'}`);}}
   else c.progress=Math.max(0,c.progress-dt*.3);
   if(c.owner==='dm'){c.timer-=dt;if(c.timer<=0){let alive=this.monsters.filter(m=>m.hp>0&&m.campKey===key).length;for(let i=0;i<info.units&&alive<info.cap;i++,alive++){const point={x:c.x+i*36,y:c.y};if(this.walkable(point.x,point.y,28))this.summon(info.monster,point.x,point.y,key);}c.timer=info.interval*this.modifier(key,'spawn');}}
  }
  for(const m of this.monsters){if(m.hp<=0)continue;const stats=MONSTERS[m.type];if(this.time<m.stun)continue;let destination=null;
   if(m.id===this.possessed){this.move(m,this.dmInput.x,this.dmInput.y,stats.speed*dt);}
   else if(m.order==='move'||m.order==='capture')destination=m.dest;
   else if(m.order==='hunt')destination=this.players.filter(p=>p&&p.hp>0).sort((a,b)=>dist(m,a)-dist(m,b))[0]||null;
   if(destination){destination=this.pathTarget(m,destination);const d=dist(m,destination);if(d>15){const direction=norm(destination.x-m.x,destination.y-m.y);const speed=stats.speed*this.modifier(this.roomAt(m.x,m.y),'speed')*(m.slowUntil>this.time?.6:1);this.move(m,direction.x,direction.y,Math.min(speed*dt,d));}}
   const target=this.players.filter(p=>p&&p.hp>0&&this.time>=p.invuln&&dist(m,p)<=stats.reach&&this.canSee(m,p)).sort((a,b)=>dist(m,a)-dist(m,b))[0];
   if(target&&this.time>=m.cool){m.cool=this.time+stats.cooldown;if(target.wards<=this.time){const defending=this.inputs[target.slot]?.guard;const parry=defending&&this.time-target.guardStart<=.18;const mitigated=parry?0:defending?.38:1;if(parry)m.stun=this.time+.45;target.hp=Math.max(0,target.hp-stats.damage*this.modifier(this.roomAt(m.x,m.y),'damage')*mitigated);target.restProgress=0;if(target.hp<=0){target.downFor=4;this.log(`${target.name} was downed`);}}}
  }
  this.monsters=this.monsters.filter(m=>m.hp>0);
 }
 snapshot(role='party',slot=null){const all=role==='dm',seen=all?new Set(Object.keys(this.board)):this.seen;const board=Object.fromEntries([...seen].filter(k=>this.board[k]).map(k=>[k,structuredClone(this.board[k])]));for(const [key,room] of Object.entries(board)){room.soul=room.soul&&!this.souls.has(key);if(room.camp){room.camp={id:room.camp.id,...this.camps[key]};}}
  return {phase:this.result?'ENDED':'ACTIVE',result:this.result,remainingMs:Math.max(0,this.deadline-this.now()),time:this.time,souls:this.souls.size,roomCount:Object.keys(this.board).length,board,players:this.players.filter(Boolean).filter(p=>all||seen.has(this.roomAt(p.x,p.y))||p.slot===slot).map(p=>({slot:p.slot,name:p.name,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,weapon:p.weapon,dodge:p.dodge,...(all||p.slot===slot?{ammo:p.ammo,reloading:p.reloading,weaponReady:p.weaponReady,castReady:p.castReady,dodgeReady:p.dodgeReady,spellSlots:p.spellSlots,sorcery:p.sorcery,restUses:p.restUses,restProgress:p.restProgress,potion:p.potion}: {})})),monsters:this.monsters.filter(m=>all||seen.has(this.roomAt(m.x,m.y))).map(m=>({id:m.id,x:m.x,y:m.y,type:m.type,hp:m.hp,maxHp:m.maxHp,order:all?m.order:undefined})),camps:Object.fromEntries(Object.entries(this.camps).filter(([k])=>seen.has(k))),threat:all?this.threat:undefined,possessed:all?this.possessed:undefined,events:all?this.events:this.events.filter(e=>e.text.includes('soul')||e.text.includes('WIN')||e.text.includes('downed')).slice(0,5)};
 }
}
