export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const WORLD = { width: 6800, height: 2000, lanes: [350, 1000, 1650], partyX: 180, dmX: 6490 };
/** Three routes leave the same downtown start, fan out through Boston, then
 * converge at the final DM approach. The curve is shared by AI, objectives,
 * buildings, wave spawns, HUD and world rendering. */
export const MAP_X = [0, 180, 470, 970, 1440, 2520, 3700, 4760, 5500, 5900, 6220, 6490, 6800];
export const MAP_FAN = [0, 0, .12, .78, 1, 1, 1, 1, .94, .72, .30, 0, 0];
export const MAP_TITLE = 'BOSTON // THE BLACKOUT';
export const BOSTON_DISTRICTS = [
  {x:1150,y:170,name:'BEACON HILL',sub:'LANTERN ROW'},
  {x:3010,y:145,name:'NORTH END',sub:'THE BELLS WENT QUIET'},
  {x:4860,y:155,name:'WATERFRONT',sub:'NORTH WHARF'},
  {x:1630,y:1025,name:'DOWNTOWN CROSSING',sub:'THE SIGNAL IS DEAD'},
  {x:3370,y:990,name:'GOVERNMENT CENTER',sub:'CIVIC BLACKOUT'},
  {x:5410,y:980,name:'FINANCIAL DISTRICT',sub:'NO SIGNAL'},
  {x:1280,y:1860,name:'BACK BAY',sub:'THE LONG NIGHT'},
  {x:3150,y:1860,name:'SOUTH END',sub:'BRICK & SHADOW'},
  {x:5170,y:1850,name:'SOUTH BOSTON',sub:'HARBOR FREIGHT'},
];
export const JUNGLES = [
  {id:'common',name:'THE HOLLOW COMMON',sub:'PUBLIC GARDEN / LOST SIGNAL',theme:'park',from:1100,to:5750,center:0},
  {id:'underworks',name:'THE UNDERWORKS',sub:'RED LINE / FORT POINT',theme:'rail',from:1100,to:5750,center:1},
];
// The previous jungle strip was 207 units wide. Each new district is up to
// 480 units across, with broad encounter courtyards and multiple looping trails.
// Width narrows as the three main lanes converge near the bases.
const smooth=t=>t*t*(3-2*t);
export function laneY(x,lane){
  const lx=clamp(x,0,WORLD.width);
  let i=0;while(i<MAP_X.length-2 && lx>MAP_X[i+1])i++;
  const t=smooth((lx-MAP_X[i])/(MAP_X[i+1]-MAP_X[i]));
  const fan=MAP_FAN[i]+(MAP_FAN[i+1]-MAP_FAN[i])*t;
  return 1000+(lane-1)*650*fan;
}
export function jungleY(x,index){return (laneY(x,index)+laneY(x,index+1))/2;}
export function jungleHalfWidth(x){
  const fan=clamp((laneY(x,2)-laneY(x,0))/1300,0,1);
  return 36+204*fan;
}
// Two flanking loops per jungle allow real rotations and fights away from roads.
export function jungleTrailY(x,index,side=0){
  if(side===0)return jungleY(x,index);
  const fan=clamp((laneY(x,2)-laneY(x,0))/1300,0,1);
  return jungleY(x,index)+side*(139+13*Math.sin((x+index*510)/390))*fan;
}
export const JUNGLE_LOOP_CROSSINGS=[1500,2350,3150,3970,4830,5480];
export const JUNGLE_LANDMARKS=[
  {id:'garden',x:1740,jungle:0,name:'PUBLIC GARDEN',sub:'THE SWAN POND',kind:'pond'},
  {id:'memorial',x:3330,jungle:0,name:'THE SILENT MEMORIAL',sub:'ECHO RELAY 04',kind:'memorial'},
  {id:'bandstand',x:4810,jungle:0,name:'COMMON BANDSTAND',sub:'DEAD AIR',kind:'bandstand'},
  {id:'redline',x:1740,jungle:1,name:'RED LINE DEPOT',sub:'LAST TRAIN OUT',kind:'depot'},
  {id:'substation',x:3320,jungle:1,name:'BLACKOUT SUBSTATION',sub:'HIGH VOLTAGE',kind:'substation'},
  {id:'freight',x:5030,jungle:1,name:'FORT POINT FREIGHT',sub:'YARD 09',kind:'freight'},
].map(v=>({...v,y:jungleY(v.x,v.jungle)}));
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
  for(let j=0;j<2;j++)if(x>960 && x<6100 && Math.abs(y-jungleY(x,j))<jungleHalfWidth(x)+padding)return true;
  for(let j=0;j<2;j++)for(const cx of JUNGLE_LOOP_CROSSINGS){
    if(Math.abs(x-cx)<62+padding&&Math.abs(y-jungleY(x,j))<255+padding)return true;
  }
  for(const cx of CONNECTORS)if(Math.abs(x-cx)<72+padding && y>200 && y<1800)return true;
  for(const [cx,cy,r] of [[WORLD.partyX,1000,190],[WORLD.dmX,1000,215],[2190,690,190],[4590,1310,190]])
    if(Math.hypot(x-cx,y-cy)<r+padding)return true;
  return false;
}
export const BUILDINGS=(()=>{
  const out=[];
  for(let ix=0,x=530;x<6250;ix++,x+=158){
    for(let iy=0,y=95;y<1900;iy++,y+=116){
      const wide=(iy===0||iy===15) && ix%6===0;
      if((iy===0||iy===15)&&ix%6===1)continue;
      const w=wide?239:91+(ix*13+iy*31)%28,h=wide?92:58+(ix*19+iy*11)%22;
      const ox=((ix*29+iy*7)%35)-17,oy=((iy*19+ix*5)%23)-11;
      const bx=x+ox,by=y+oy;
      const district=by<510?'historic':by>1490?'industrial':(by>915&&by<1090?'civic':'mixed');
      const b={x:bx,y:by,w,h,kind:(ix+iy)%6,district};
      const pts=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x,y:b.y+b.h},{x:b.x+b.w,y:b.y+b.h},
        {x:b.x+b.w/2,y:b.y+b.h/2},{x:b.x+b.w/2,y:b.y},{x:b.x+b.w/2,y:b.y+b.h}];
      if(pts.some(p=>onTravelCorridor(p.x,p.y,9)))continue;
      out.push(b);
    }
  }
  return out;
})();
export const SHOPS=[{x:2190,y:690,name:'GARDEN NIGHT MARKET'},{x:4590,y:1310,name:'UNDERWORKS EXCHANGE'}];
export const CHEST_SPOTS=[
  {x:1060,y:725},{x:1540,y:660},{x:2850,y:650},{x:4020,y:680},{x:5520,y:680},{x:3470,y:530},{x:5210,y:810},
  {x:1060,y:1260},{x:1780,y:1350},{x:3340,y:1340},{x:4910,y:1340},{x:5790,y:1230},{x:2700,y:1470},{x:4180,y:1190},
  {x:3330,y:735,grade:'relic',name:'MEMORIAL FREQUENCY CACHE'},
  {x:3320,y:1405,grade:'relic',name:'SUBSTATION LOCKBOX'},
];
// Tactical cover is separate from permanent city blocks. Park planters and
// maintenance crates are collision-solid on both the server and client.
// They sit between the three open jungle trails, not on the trails themselves.
export const JUNGLE_COVER=(()=>{
  const covers=[];
  const xs=[1260,1470,1850,2070,2580,2780,3070,3570,3790,4200,4440,4750,5110,5350,5670];
  for(let j=0;j<2;j++)for(let i=0;i<xs.length;i++){
    const x=xs[i]+(j?70:0);
    if(CONNECTORS.some(cx=>Math.abs(cx-x)<135)||JUNGLE_LOOP_CROSSINGS.some(cx=>Math.abs(cx-x)<95))continue;
    const y=jungleY(x,j)+(i%2===0?76:-76);
    if(Math.hypot(x-2190,y-690)<210||Math.hypot(x-4590,y-1310)<210)continue;
    if(CHEST_SPOTS.some(c=>Math.hypot(x-c.x,y-c.y)<106))continue;
    covers.push({x:x-24,y:y-23,w:48,h:46,jungle:j,kind:j===0?'planter':'cargo'});
  }
  return covers;
})();
// Abandoned vehicles and lane barricades create real street-level cover,
// always offset from the AI's centerline and never placed on a fort or bridge.
export const STREET_COVER=(()=>{
  const result=[];
  for(let lane=0;lane<3;lane++)for(let i=0;i<5;i++){
    const x=[1680,2520,3530,4300,5160][i]+lane*34;
    const side=(i+lane)%2?1:-1;
    const y=laneY(x,lane)+side*61;
    result.push({x:x-32,y:y-16,w:64,h:32,kind:'vehicle',lane,color:(i+lane)%4});
  }
  return result;
})();
export const OBSTACLES=[...BUILDINGS,...JUNGLE_COVER,...STREET_COVER];
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const makeId=(prefix='e')=> `${prefix}_${Math.random().toString(36).slice(2,9)}`;
