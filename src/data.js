export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const WORLD = { width: 6800, height: 2000, lanes: [350, 1000, 1650], partyX: 180, dmX: 6490 };
/** Three routes leave the same downtown start, fan out through Boston, then
 * converge at the final DM approach. The curve is shared by AI, objectives,
 * buildings, wave spawns, HUD and world rendering. */
export const MAP_X = [0, 180, 470, 970, 1440, 2520, 3700, 4760, 5500, 5900, 6220, 6490, 6800];
export const MAP_FAN = [0, 0, .12, .78, 1, 1, 1, 1, .94, .72, .30, 0, 0];
export const MAP_TITLE = 'BOSTON // THE BLACKOUT';
export const BOSTON_DISTRICTS = [
  {x:700,y:180,name:'BEACON HILL',sub:'GASLIT ROW'},
  {x:1970,y:155,name:'NORTH END',sub:'BRICK & BELLS'},
  {x:3400,y:155,name:'GOVERNMENT CENTER',sub:'SILENT PLAZA'},
  {x:5240,y:155,name:'SEAPORT',sub:'DARK DOCKS'},
  {x:1020,y:1840,name:'BACK BAY',sub:'THE BLACKOUT'},
  {x:3240,y:1840,name:'SOUTH END',sub:'THE SERVICE ROUTE'},
  {x:4850,y:1830,name:'SOUTH BOSTON',sub:'RAIL YARDS'},
];
const smooth=t=>t*t*(3-2*t);
export function laneY(x,lane){
  const lx=clamp(x,0,WORLD.width);
  let i=0;while(i<MAP_X.length-2 && lx>MAP_X[i+1])i++;
  const t=smooth((lx-MAP_X[i])/(MAP_X[i+1]-MAP_X[i]));
  const fan=MAP_FAN[i]+(MAP_FAN[i+1]-MAP_FAN[i])*t;
  return 1000+(lane-1)*650*fan;
}
export function jungleY(x,index){return (laneY(x,index)+laneY(x,index+1))/2;}
export const LANE_NAMES=['BEACON / NORTH','COMMON / CENTER','SOUTH END / SOUTH'];
export const CONNECTORS=[1080,1940,3100,4160,5350,5930];
// Shared navigable route network includes cross-town connectors and jungle paths.
export function lanePoint(x,lane){return {x,y:laneY(x,lane)};}
export function nearestLane(x,y){let result=0,d=Infinity;for(let l=0;l<3;l++){
  const gap=Math.abs(y-laneY(x,l));if(gap<d){d=gap;result=l;}
}return result;}
export const MATCH_SECONDS = 20 * 60;
export const HEROES = [
  {name:'Asya', title:'THE DEAD FREQUENCY', color:'#c99cff', role:'Denpa sorcerer', spell:'Signal Burst'},
  {name:'Jeanette', title:'THE LUNAR ECLIPSE', color:'#dce7f9', role:'Anti-magic specialist', spell:'Moonfall'},
  {name:'Alex', title:'THE RED THORN', color:'#ff7b83', role:'Area controller', spell:'Thornlash'},
  {name:'SoulSeeker 04', title:'UNASSIGNED', color:'#ffc979', role:'Placeholder roster slot', spell:'Arc Shot'},
  {name:'SoulSeeker 05', title:'UNASSIGNED', color:'#77e1c0', role:'Placeholder roster slot', spell:'Arc Shot'},
  {name:'SoulSeeker 06', title:'UNASSIGNED', color:'#8cc0ff', role:'Placeholder roster slot', spell:'Arc Shot'},
];
export const ITEMS = {
  bandage: {name:'Field Dressing', icon:'✚', w:2, h:1, price:50, desc:'Restore 50 HP. Use from inventory.'},
  vest: {name:'Ceramic Vest', icon:'⬡', w:2, h:2, price:150, desc:'+45 maximum HP while carried.'},
  lens: {name:'Focus Lens', icon:'◎', w:1, h:2, price:115, desc:'+25% shot damage while carried.'},
  boots: {name:'Runner Boots', icon:'»', w:2, h:1, price:100, desc:'+18% movement speed while carried.'},
  battery: {name:'Denpa Battery', icon:'⚡', w:1, h:1, price:80, desc:'Restore 60 HP on use (prototype spell reagent).'},
  spell: {name:'Extra Spell Slot', icon:'✦', w:2, h:2, price:220, desc:'Unlock another castable spell: Echo Nova (E).'},
};
export const SHOP_IDS = ['bandage','vest','lens','boots','battery','spell'];
// Collision and visuals derive from the same footprints. Fixed deterministic
// geometry means client and authoritative server never disagree on walls.
const proximity=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1,dx*dx+dy*dy)));
  return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));
};
export function onTravelCorridor(x,y,padding=0){
  for(let l=0;l<3;l++)if(Math.abs(y-laneY(x,l))<112+padding)return true;
  for(let j=0;j<2;j++)if(Math.abs(y-jungleY(x,j))<75+padding && x>710 && x<6230)return true;
  for(const cx of CONNECTORS)if(Math.abs(x-cx)<72+padding && y>200 && y<1800)return true;
  for(const [cx,cy,r] of [[WORLD.partyX,1000,190],[WORLD.dmX,1000,215],[2190,690,164],[4590,1310,164]])
    if(Math.hypot(x-cx,y-cy)<r+padding)return true;
  return false;
}
export const BUILDINGS=(()=>{
  const out=[];
  for(let ix=0,x=530;x<6250;ix++,x+=158){
    for(let iy=0,y=95;y<1900;iy++,y+=116){
      const w=91+(ix*13+iy*31)%28,h=58+(ix*19+iy*11)%22;
      const ox=((ix*29+iy*7)%35)-17,oy=((iy*19+ix*5)%23)-11;
      const b={x:x+ox,y:y+oy,w,h,kind:(ix+iy)%6};
      const pts=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x,y:b.y+b.h},{x:b.x+b.w,y:b.y+b.h},
        {x:b.x+b.w/2,y:b.y+b.h/2},{x:b.x+b.w/2,y:b.y},{x:b.x+b.w/2,y:b.y+b.h}];
      if(pts.some(p=>onTravelCorridor(p.x,p.y,9)))continue;
      out.push(b);
    }
  }
  return out;
})();
export const SHOPS=[{x:2190,y:690,name:'COMMON MARKET'},{x:4590,y:1310,name:'SEAPORT EXCHANGE'}];
export const CHEST_SPOTS=[
  {x:850,y:760},{x:1540,y:660},{x:2850,y:650},{x:4020,y:680},{x:5520,y:680},
  {x:920,y:1230},{x:1780,y:1350},{x:3340,y:1340},{x:4910,y:1340},{x:5790,y:1230},
];
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const makeId=(prefix='e')=> `${prefix}_${Math.random().toString(36).slice(2,9)}`;
