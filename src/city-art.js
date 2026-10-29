// R03.3 polished pixel-art Boston — Kenney Roguelike Modern City 2.0 (CC0).
// World geometry is read-only: collision, pathing and match simulation remain
// in data.js / engine.js on both clients and the authoritative server.
import {WORLD,BUILDINGS,JUNGLE_COVER,STREET_COVER,JUNGLE_LANDMARKS,SHOPS,
  BOSTON_DISTRICTS,CONNECTORS,JUNGLE_LOOP_CROSSINGS,laneY,jungleY,
  jungleHalfWidth,jungleTrailY} from './data.js?v=R033';
const img = typeof Image==='function' ? new Image() : {complete:false,naturalWidth:0};
let redraw = null;
img.decoding = 'async';
img.onload=()=>{if(redraw)redraw();};
if(typeof Image==='function')img.src=new URL('../assets/kenney/city_tiles.png',import.meta.url).href;
export const cityTilesReady=()=>img.complete && img.naturalWidth>0;
export function onCityTilesLoaded(callback){redraw=callback;if(cityTilesReady())callback();}
const TILE=32; // Two world units per source pixel. Pixel-art edges stay crisp.
function seed(n){let x=(n|0)^0x45d9f3b;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967295;}
function tile(ctx,id,x,y,w=TILE,h=TILE){
  if(!cityTilesReady())return;
  ctx.drawImage(img,(id%37)*16,Math.floor(id/37)*16,16,16,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function banner(ctx,x,y,title,subtitle,color='#d9e2ce'){
  ctx.save();ctx.textAlign='center';ctx.font='bold 19px ui-monospace, Consolas, monospace';
  const w=Math.max(ctx.measureText(title).width+30,154);
  ctx.fillStyle='#0c151ad9';ctx.fillRect(x-w/2,y-26,w,46);
  ctx.fillStyle=color;ctx.fillText(title,x,y-8);
  ctx.fillStyle='#b0bebb';ctx.font='10px ui-monospace, Consolas, monospace';ctx.fillText(subtitle,x,y+9);
  ctx.restore();
}
function nearConnector(x,y){
  for(const cx of CONNECTORS)if(Math.abs(cx-x)<55&&y>laneY(x,0)-84&&y<laneY(x,2)+84)return true;
  return false;
}
function parkPath(x,y,j){
  const half=jungleHalfWidth(x),cy=jungleY(x,j);
  if(x<1100||x>5780||Math.abs(y-cy)>half)return false;
  if(JUNGLE_LOOP_CROSSINGS.some(cx=>Math.abs(cx-x)<26)&&Math.abs(y-cy)<half-8)return true;
  for(let branch=-1;branch<=1;branch++)if(Math.abs(y-jungleTrailY(x,j,branch))<31)return true;
  return false;
}
function floorAt(x,y,ix,iy){
  const n=seed(ix*4901+iy*1987);
  // Street width is shared with the simulation: curbs and center markings are
  // refined in paintStreetNetwork below. One subdued palette ties tiles together.
  for(let l=0;l<3;l++){
    const gap=Math.abs(y-laneY(x,l));
    if(gap<103)return gap>88?(l===0?780:l===2?781:703):
      gap<10&&ix%8<3?(l===1?788:712):(n<.08?750:713);
  }
  if(nearConnector(x,y))return n<.11?740:703;
  // The Charles: bridge roads take priority over water, not vice versa.
  const wave=730+Math.sin(y/290)*22+(y/2000)*55;
  if(Math.abs(x-wave)<87)return n<.14?211:n<.24?212:174;
  for(let j=0;j<2;j++){
    if(x>1050&&x<5800 && Math.abs(y-jungleY(x,j))<jungleHalfWidth(x)){
      if(j===0){
        if(parkPath(x,y,j))return n<.10?706:n<.15?743:894;
        return n<.12?925:n<.22?926:888;
      }
      if(parkPath(x,y,j))return n<.20?703:n<.35?891:890;
      return n<.08?892:n<.13?896:891;
    }
  }
  // Real neighborhoods have larger consistent paving fields, not random noise.
  if(y<255)return n<.08?743:n<.20?814:706;
  if(y>1745)return n<.08?891:n<.14?896:890;
  return n<.08?740:n<.16?703:890;
}
function route(ctx,fn,width,color,x0=750,x1=6160){
  ctx.beginPath();
  for(let x=x0;x<=x1;x+=18){const y=fn(x);if(x===x0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
}
function paintStreetNetwork(ctx){
  // Curbs, asphalt and purposeful road markings. No random paint stripes.
  for(let l=0;l<3;l++){
    const y=x=>laneY(x,l);
    const laneCol=['#343b42','#30383c','#394047'][l];
    route(ctx,y,198,'#777e7c',0,WORLD.width);
    route(ctx,y,190,'#a6a49a',0,WORLD.width);
    route(ctx,y,181,'#252e33',0,WORLD.width);
    route(ctx,y,169,laneCol,0,WORLD.width);
    // One legible centerline instead of randomly placed full-tile stripes.
    ctx.save();ctx.setLineDash(l===1?[37,28]:[29,39]);
    route(ctx,y,l===1?3.5:2.5,l===1?'#cfab58':'#b4babc',0,WORLD.width);
    ctx.restore();
    route(ctx,x=>y(x)-74,1.5,'#7b8387',0,WORLD.width);
    route(ctx,x=>y(x)+74,1.5,'#7b8387',0,WORLD.width);
    // Repeated paving seams and storm drains, placed on actual lane edges.
    for(let x=1190;x<5840;x+=370){
      const cy=y(x);ctx.fillStyle='#151f26';ctx.fillRect(x-10,cy-90,19,5);
      ctx.fillRect(x+27,cy+85,18,5);
      if(l===0){ctx.fillStyle='#93776b';ctx.fillRect(x,cy-104,32,5);}
      if(l===2){ctx.fillStyle='#ae9360';ctx.fillRect(x+30,cy+95,25,6);}
    }
  }
  // Cross-street transfers: road-priority over jungles, clearly marked entry.
  for(const cx of CONNECTORS){
    const ya=laneY(cx,0),yb=laneY(cx,2);
    ctx.fillStyle='#4b5559';ctx.fillRect(cx-45,ya-70,90,yb-ya+140);
    ctx.fillStyle='#303c42';ctx.fillRect(cx-39,ya-65,78,yb-ya+130);
    ctx.strokeStyle='#b7bcb6';ctx.lineWidth=3;ctx.setLineDash([20,24]);
    ctx.beginPath();ctx.moveTo(cx,ya-65);ctx.lineTo(cx,yb+65);ctx.stroke();ctx.setLineDash([]);
    // Zebra crossings at the intersections, four clean evenly spaced strips.
    for(let l=0;l<3;l++){
      const cy=laneY(cx,l);ctx.fillStyle='#b9c2bf';
      for(let i=-2;i<=2;i++)ctx.fillRect(cx+i*16-5,cy-72,10,18);
      for(let i=-2;i<=2;i++)ctx.fillRect(cx+i*16-5,cy+55,10,18);
    }
  }
  // Four bridge parapets give the Charles a structural connection to Boston.
  for(const yy of [laneY(735,0),laneY(735,1),laneY(735,2)]){
    ctx.strokeStyle='#d0c3aa';ctx.lineWidth=5;
    for(const v of [-93,93]){ctx.beginPath();ctx.moveTo(640,yy+v);ctx.lineTo(866,yy+v);ctx.stroke();}
    for(let i=0;i<8;i++){
      ctx.fillStyle='#647481';ctx.fillRect(656+i*29,yy-96,5,9);ctx.fillRect(656+i*29,yy+88,5,9);
    }
  }
}
function paintJungleIdentity(ctx){
  // Non-solid visual gardens and rail tracks. Routes/collision unchanged.
  for(let j=0;j<2;j++){
    if(j===0){
      // Three meandering park promenades share the walkable jungle geometry.
      for(const side of [-1,0,1]){
        const line=x=>jungleTrailY(x,0,side)+6*Math.sin(x/210+side*2.4);
        route(ctx,line,57,'#71886b',1170,5650);
        route(ctx,line,48,'#b7ac8f',1170,5650);
        route(ctx,line,41,'#bfb79d',1170,5650);
      }
      for(const x of JUNGLE_LOOP_CROSSINGS){
        const cy=jungleY(x,0);
        ctx.fillStyle='#c3b79d';ctx.fillRect(x-22,cy-174,44,347);
        ctx.strokeStyle='#829478';ctx.lineWidth=2;ctx.strokeRect(x-24,cy-175,48,350);
      }
      // Tree courts and flower islands distinguish this from a grass highway.
      for(let x=1350;x<5550;x+=455){
        const cy=jungleY(x,0),off=x%2===0?75:-75;
        const y=cy+off;
        ctx.fillStyle='#497a56';ctx.fillRect(x-61,y-21,122,42);
        ctx.fillStyle='#3d6348';ctx.fillRect(x-54,y-15,108,30);
        for(let i=0;i<6;i++){
          const px=x-43+i*17;
          tile(ctx,i%3===0?401:i%3===1?403:405,px-8,y-11,17,21);
        }
        // benches are visual accents, not phantom collision blockers.
        tile(ctx,578,x-57,y+30,35,17);
      }
      // Formal pavers around two gathering points.
      for(const [x,y] of [[2350,jungleY(2350,0)],[3970,jungleY(3970,0)]]){
        ctx.fillStyle='#b9b29e';ctx.beginPath();ctx.ellipse(x,y,70,54,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#8c9a7f';ctx.lineWidth=5;ctx.stroke();
        ctx.fillStyle='#9e997f';ctx.fillRect(x-8,y-7,16,14);
      }
    }else{
      // The freight jungle is an integrated industrial yard, with branching
      // rail sidings, safety hatching and distinct paved maintenance aisles.
      for(const side of [-1,0,1]){
        const y=x=>jungleTrailY(x,1,side);
        route(ctx,y,57,'#656e70',1170,5600);
        route(ctx,y,49,'#808b8a',1170,5600);
        route(ctx,y,38,'#8a9694',1170,5600);
      }
      for(const x of JUNGLE_LOOP_CROSSINGS){
        const cy=jungleY(x,1);ctx.fillStyle='#778384';
        ctx.fillRect(x-29,cy-173,58,346);
        ctx.strokeStyle='#a4a8a1';ctx.lineWidth=3;ctx.strokeRect(x-30,cy-173,60,346);
      }
      for(const side of [-1,1]){
        const rail=x=>jungleY(x,1)+side*(100+8*Math.sin(x/330));
        route(ctx,x=>rail(x)-10,3,'#b5c3c4',1320,5580);
        route(ctx,x=>rail(x)+10,3,'#b5c3c4',1320,5580);
        for(let x=1330;x<5570;x+=22){const y=rail(x);
          ctx.fillStyle='#585750';ctx.fillRect(x-3,y-17,6,34);
        }
      }
      for(let x=1250;x<5400;x+=360){
        const cy=jungleY(x,1);const y=cy+((Math.floor(x/360)%2)?77:-77);
        ctx.fillStyle='#c8a35c';
        for(let k=0;k<4;k++)ctx.fillRect(x-57+k*20,y+38,12,4);
        for(let k=0;k<3;k++)tile(ctx,603,x-46+k*27,y-13,27,28);
      }
    }
  }
}
function building(ctx,b,order){
  const {x,y,w,h,district}=b;
  const historic=district==='historic',industrial=district==='industrial',civic=district==='civic';
  const seed0=seed(x*3+y*7);const roof=historic?[3,4,5,6,7]:industrial?[11,12,14,15]:civic?[19,20,21,22]:[26,27,28,29];
  const palette=historic?['#543a38','#b88472','#efbca4']:
    industrial?['#37434d','#71808d','#9daab8']:
    civic?['#606a6b','#aab4b6','#cdd0c9']:['#595757','#a7a69e','#d6caba'];
  // A complete footprint, with a controlled silhouette instead of random roof
  // tiles. Only data.js authoritative building rectangles are rendered solid.
  ctx.fillStyle='#17242acc';ctx.fillRect(x+8,y+10,w+1,h+1);
  ctx.fillStyle=palette[0];ctx.fillRect(x-5,y-5,w+10,h+10);
  ctx.fillStyle=palette[1];ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const roofTile=roof[Math.floor(seed0*roof.length)];
  for(let yy=y;yy<y+h;yy+=TILE)for(let xx=x;xx<x+w;xx+=TILE)
    tile(ctx,roofTile,xx,yy);
  // Architectural rhythm: parapets, HVAC and recessed rooftop court.
  ctx.strokeStyle=palette[2];ctx.lineWidth=3;ctx.strokeRect(x+4,y+4,w-8,h-8);
  if(w>77&&h>54){
    const skylight=order%4===0;
    if(skylight){
      ctx.fillStyle='#435867';ctx.fillRect(x+w*.30,y+h*.27,w*.41,h*.33);
      ctx.strokeStyle='#ced6d2';ctx.lineWidth=3;ctx.strokeRect(x+w*.30,y+h*.27,w*.41,h*.33);
      ctx.strokeStyle='#7895a5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+w*.505,y+h*.27);ctx.lineTo(x+w*.505,y+h*.60);ctx.stroke();
    }else{
      const vent=industrial?544:historic?143:579;
      tile(ctx,vent,x+w*.40,y+h*.3,28,28);
      if(w>100&&order%2===0)tile(ctx,543,x+12,y+12,21,20);
    }
    if(industrial&&order%3===0){
      tile(ctx,550,x+w-38,y+10,27,24);
      ctx.fillStyle='#d5a66e';ctx.fillRect(x+12,y+h-13,29,5);
    }
    if(historic&&order%5===0){
      ctx.fillStyle='#486c54';ctx.fillRect(x+w-30,y+h-23,17,11);
    }
  }
  ctx.restore();
  ctx.strokeStyle=palette[2];ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);
  // North/south-facing shop awnings on street-adjacent buildings. Top-down,
  // shallow depth, no fake doors or items standing in a road.
  if(historic&&order%3===0){
    ctx.fillStyle='#6f4f50';ctx.fillRect(x+12,y+h-2,Math.min(36,w-24),7);
    for(let a=0;a<4;a++){ctx.fillStyle=a%2?'#ddc4a9':'#a35d5b';ctx.fillRect(x+12+a*9,y+h-2,9,7);}
  }
}
function cover(ctx,c){
  const {x,y,w,h,kind}=c;ctx.fillStyle='#17242c';ctx.fillRect(x+5,y+6,w,h);
  if(kind==='planter'){
    ctx.fillStyle='#9a8b6d';ctx.fillRect(x,y,w,h);
    for(const off of [0,1])tile(ctx,off?438:440,x+off*w/2,y-4,w/2+2,h+7);
  }else{
    tile(ctx,570,x,y,w*.5,h*.65);tile(ctx,571,x+w*.5,y,w*.5,h*.65);
    tile(ctx,573,x,y+h*.65,w,h*.35);
  }
}
function vehicle(ctx,v){
  const {x,y,w,h,color}=v;const strips=[
    [697,698,699,700],[882,883,884,885],[992,993,994,995],[660,661,662,663]
  ];
  const arr=strips[color%strips.length];
  ctx.fillStyle='#11191f';ctx.fillRect(x+5,y+6,w,h);
  for(let i=0;i<4;i++)tile(ctx,arr[i],x+i*w/4,y,w/4,h);
}
function tree(ctx,x,y,id=438,size=48){
  tile(ctx,id,x-size/2,y-size/2,size,size);
}
function decorateJungle(ctx,j){
  const park=j===0;
  // All trees/containers remain outside the primary three trail centerlines.
  // Tree clusters are non-solid scenery along district borders; cover is solid.
  for(let x=1230;x<5670;x+=108){
    const cy=jungleY(x,j),half=jungleHalfWidth(x);
    for(const side of [-1,1]){
      const jitter=seed(x*17+side*j*31);
      const y=cy+side*(half-28)+((jitter-.5)*20);
      if(park){tree(ctx,x+9*(jitter-.5),y,[438,440,441,443,475,477,478][Math.floor(jitter*7)],33+Math.floor(jitter*11));}
      else{
        if(jitter<.55){tile(ctx,570,x-17,y-14,30,28);tile(ctx,575,x+13,y-15,22,29);}
        else {tile(ctx,497,x-14,y-10,22,26);tile(ctx,495,x+9,y-7,16,19);}
      }
    }
  }
  // Ground details in the open between the three safe paths.
  for(let x=1310;x<5560;x+=239){
    const cy=jungleY(x,j),n=seed(x+j*919);const side=x%3===0?1:-1;
    const y=cy+side*(87+(n-.5)*19);
    if(JUNGLE_LOOP_CROSSINGS.some(cx=>Math.abs(cx-x)<85))continue;
    if(park){
      tile(ctx,401+Math.floor(n*6),x-19,y-22,35,44);
      if(n<.24)tile(ctx,533,x+12,y+24,22,26);
    }else{
      tile(ctx,n<.5?498:493,x,y,26,29);
      if(n<.3)tile(ctx,500,x+32,y+9,23,26);
    }
  }
}
function landmark(ctx,l){
  const {x,y,kind,name,sub}=l;
  if(kind==='pond'){
    // Tiles, not antialiased ellipses: one little urban lagoon with a footbridge.
    for(let yy=-3;yy<=3;yy++)for(let xx=-5;xx<=5;xx++){
      const normalized=(xx/5)**2+(yy/3)**2;
      if(normalized>1)continue;
      const n=seed(xx*61+yy*199+174);
      tile(ctx,normalized>.72?211:n<.2?212:174,x+xx*23-11,y+yy*23-11,23,23);
    }
    for(let xx=-5;xx<=5;xx++)tile(ctx,706,x+xx*23-11,y-13,23,27);
    tile(ctx,533,x+45,y+50,22,22);
  }else if(kind==='memorial'){
    for(let yy=-2;yy<=2;yy++)for(let xx=-3;xx<=3;xx++)tile(ctx,703,x+xx*32-16,y+yy*32-16);
    for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)tile(ctx,19,x+xx*32-16,y+yy*32-16);
    tile(ctx,109,x-18,y-19,38,38);tile(ctx,368,x+44,y-20,24,25);
  }else if(kind==='bandstand'){
    for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++)if(xx*xx+yy*yy<7)tile(ctx,706,x+xx*32-16,y+yy*32-16);
    for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)tile(ctx,26,x+xx*32-16,y+yy*32-16);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])tile(ctx,500,x+Math.cos(a)*64-10,y+Math.sin(a)*64-10,20,20);
  }else if(kind==='depot'){
    for(let yy=-2;yy<=2;yy++)for(let xx=-4;xx<=4;xx++)tile(ctx,713,x+xx*32-16,y+yy*32-16);
    for(let yy=-2;yy<=2;yy+=2)for(let xx=-4;xx<=4;xx++)tile(ctx,788,x+xx*32-16,y+yy*32-16);
    // Parked public transit-like vehicle with distinctive red-orange stripe.
    for(let xx=-3;xx<=3;xx++)tile(ctx,xx%2===0?589:590,x+xx*32-16,y-15,32,32);
    tile(ctx,550,x-110,y-25,28,31);
  }else if(kind==='substation'){
    for(let yy=-2;yy<=2;yy++)for(let xx=-4;xx<=4;xx++)tile(ctx,891,x+xx*32-16,y+yy*32-16);
    for(let xx=-3;xx<=3;xx+=2){tile(ctx,543,x+xx*32-16,y-32,34,32);tile(ctx,501,x+xx*32-16,y+17,25,28);}
    tile(ctx,550,x+65,y-52,40,42);
  }else if(kind==='freight'){
    for(let yy=-2;yy<=2;yy++)for(let xx=-5;xx<=5;xx++)tile(ctx,892,x+xx*29-14,y+yy*29-14,29,29);
    for(let xx=-4;xx<=4;xx+=2)for(let yy=-1;yy<=1;yy++)tile(ctx,xx%4===0?570:573,x+xx*28-13,y+yy*29-13,30,30);
  }
  banner(ctx,x,y-114,name,sub,l.jungle===0?'#e7e3c1':'#f1c4a4');
}
export function drawKenneyFort(ctx,f){
  const x=f.x,y=f.y;
  ctx.save();ctx.imageSmoothingEnabled=false;
  const base=f.broken?12:3;
  for(let r=0;r<3;r++)for(let c=0;c<4;c++)tile(ctx,base+((r+c)%3),x-56+c*28,y-42+r*28,28,28);
  ctx.strokeStyle=f.broken?'#5e646c':'#ec8f92';ctx.lineWidth=4;ctx.strokeRect(x-57,y-43,114,86);
  tile(ctx,f.broken?733:550,x-26,y-24,52,48);
  tile(ctx,550,x-47,y-36,22,24);tile(ctx,550,x+26,y+14,20,22);
  if(f.broken){ctx.strokeStyle='#e2b3ac';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-45,y-31);ctx.lineTo(x+46,y+37);ctx.stroke();}
  ctx.restore();
}
export function drawKenneyChest(ctx,c){
  ctx.save();ctx.imageSmoothingEnabled=false;
  tile(ctx,c.grade==='relic'?567:570,c.x-21,c.y-17,21,34);
  tile(ctx,c.grade==='relic'?567:571,c.x,c.y-17,21,34);
  ctx.lineWidth=2;ctx.strokeStyle=c.grade==='relic'?'#d8aaff':'#ecd2a5';ctx.strokeRect(c.x-22,c.y-18,44,36);
  ctx.restore();
}
export function drawKenneyWorld(ctx){
  ctx.save();ctx.imageSmoothingEnabled=false;
  // Low-variance seeded tilemap, all 6,800 x 2,000 world units. Created only
  // when the static world cache first initializes (not once per video frame).
  for(let iy=0,y=0;y<WORLD.height;iy++,y+=TILE)
    for(let ix=0,x=0;x<WORLD.width;ix++,x+=TILE)
      tile(ctx,floorAt(x+TILE/2,y+TILE/2,ix,iy),x,y);
  // Urban fabric painted in intentional passes. All painter details are
  // non-solid; the authoritative physics and 30Hz network remain unchanged.
  paintJungleIdentity(ctx);
  for(let j=0;j<2;j++)decorateJungle(ctx,j);
  paintStreetNetwork(ctx);
  // Visual sidewalk rhythm around each collision-solid city block.
  for(const b of BUILDINGS){
    ctx.fillStyle=b.district==='historic'?'#8f8980':b.district==='industrial'?'#68777b':'#818d8c';
    ctx.globalAlpha=.34;ctx.fillRect(b.x-12,b.y-11,b.w+24,b.h+24);ctx.globalAlpha=1;
  }
  // Rooftops share server collision footprints exactly.
  for(const [i,b] of BUILDINGS.entries())building(ctx,b,i);
  for(const c of JUNGLE_COVER)cover(ctx,c);
  for(const v of STREET_COVER)vehicle(ctx,v);
  for(const l of JUNGLE_LANDMARKS)landmark(ctx,l);
  for(const [i,s] of SHOPS.entries()){
    ctx.fillStyle='#122a26';ctx.fillRect(s.x-49,s.y-39,98,78);
    ctx.strokeStyle='#69d1ac';ctx.lineWidth=3;ctx.strokeRect(s.x-49,s.y-39,98,78);
    for(let k=-1;k<=1;k++)tile(ctx,k===0?393:430,s.x+k*32-15,s.y-37,32,32);
    tile(ctx,288,s.x-17,s.y-4,33,40);
    banner(ctx,s.x,s.y-73,i===0?'GARDEN NIGHT MARKET':'UNDERWORKS EXCHANGE','ITEMS / UPGRADE','#9de2cb');
  }
  for(const d of BOSTON_DISTRICTS)banner(ctx,d.x,d.y,d.name,d.sub,'#f0e6d4');
  // Training base / final tower approach, subtle background under dynamic art.
  ctx.strokeStyle='#64d0bf';ctx.lineWidth=4;ctx.strokeRect(WORLD.partyX-67,934,134,132);
  banner(ctx,WORLD.partyX,925,'PARTY SPAWN','SAFE TERRITORY','#a1ffdc');
  ctx.strokeStyle='#df7c8b';ctx.lineWidth=5;ctx.strokeRect(WORLD.dmX-87,913,174,174);
  banner(ctx,WORLD.dmX,840,'DM TOWER','NO SIGNAL','#ffd0ce');
  // Blackout twilight: one composited wash, not a full-screen blur or glow.
  ctx.globalAlpha=.12;ctx.fillStyle='#172d41';ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.globalAlpha=1;
  for(let x=1140;x<6060;x+=365){
    for(let l=0;l<3;l++){
      const y=laneY(x,l);
      for(const side of [-1,1]){
        // Amber safety lamps and a compact light footprint; do not hide shots.
        ctx.fillStyle='#edbf79';ctx.fillRect(x-3,y+side*100-3,6,6);
        ctx.strokeStyle='#cfa96c';ctx.lineWidth=1;
        ctx.strokeRect(x-6,y+side*100-6,12,12);
      }
    }
  }
  ctx.restore();
}
