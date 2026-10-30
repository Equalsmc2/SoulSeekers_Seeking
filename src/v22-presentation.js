/** V22.4 presentation adapter. Melee geometry below is ported from the original V22.4 renderMeleeModel. */
import {weaponCatalog,meleeProfiles,meleeModelTips,clamp,potionPhases} from '../shared/dungeon/combat-data.mjs';
  function renderMeleeModel(g,type) {
    const metal = '#dce3dd', edge = '#fff0c6', shaft = '#866a4a', dark = '#4b515c';
    g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (x1, y1, x2, y2, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const poly = (pts, c, s) => {
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
      g.fillStyle = c; g.fill(); if (s) { g.strokeStyle = s; g.lineWidth = 1.5; g.stroke(); }
    };
    if (type === 'knife') {
      line(12, 0, 25, 0, 7, '#4d3634'); line(20, -5, 20, 5, 2, '#e8c788');
      poly([[24, -5], [43, -4], [49, 0], [43, 4], [24, 5]], metal, edge);
    } else if (type === 'shovel') {
      line(11, 0, 62, 0, 6, shaft); line(12, 0, 62, 0, 2, '#d4b88c');
      poly([[60, -13], [81, -15], [92, -6], [93, 5], [81, 15], [60, 12]], dark, metal);
    } else if (type === 'crowbar') {
      line(12, 0, 76, 0, 7, '#77818a');
      g.strokeStyle = '#b9c2c7'; g.lineWidth = 7; g.beginPath(); g.moveTo(75, 0); g.quadraticCurveTo(91, 0, 85, -16); g.stroke();
    } else if (type === 'mace') {
      line(12, 0, 52, 0, 7, shaft);
      poly([[49, -13], [72, -15], [78, -8], [78, 9], [72, 16], [49, 13]], dark, metal);
    }
  }
export function paintWeapon(g,slot,weapon,angle,scale=1,options={}){
 const w=weaponCatalog[slot]?.[weapon];if(!w)return;
 g.save();g.rotate(angle||0);g.scale(scale,scale);g.lineCap='round';g.lineJoin='round';
 if(meleeModelTips[w.type]){g.rotate(.28);const size=w.range*(meleeProfiles[w.type]?.reach||1)/meleeModelTips[w.type];g.scale(size,size);renderMeleeModel(g,w.type);g.restore();return;}
 const body=(x,y,width,height,fill,stroke='#ead5aa')=>{g.fillStyle=fill;g.strokeStyle=stroke;g.lineWidth=2;g.fillRect(x,y,width,height);g.strokeRect(x,y,width,height);};
 if(w.type==='camera'){body(14,-12,24,24,'#444e57');g.fillStyle='#1b2a35';g.beginPath();g.arc(27,0,9,0,Math.PI*2);g.fill();g.strokeStyle='#eee0b7';g.stroke();g.fillStyle='#d0b077';g.fillRect(18,-15,8,4);}
 else if(w.type==='carbine'){body(13,-5,33,10,'#454f55');body(44,-2,17,4,'#c8c3a8');body(22,5,7,13,'#56514c');body(4,-3,11,6,'#343c40');}
 else if(w.type==='extinguisher'){body(11,-9,25,18,'#c83c42');body(32,-3,20,6,'#aebac2');g.fillStyle='#f2e5c6';g.fillRect(18,-12,9,4);}
 else if(w.type==='crossbow'){body(15,-4,51,8,'#574a3c');g.strokeStyle='#d6c3a1';g.lineWidth=4;g.beginPath();g.moveTo(25,-24);g.quadraticCurveTo(67,0,25,24);g.stroke();g.strokeStyle='#f5dba2';g.lineWidth=1;g.beginPath();g.moveTo(25,-24);g.lineTo(25,24);g.moveTo(25,0);g.lineTo(76,0);g.stroke();}
 else if(w.type==='potion'){g.fillStyle=potionPhases[options.potionIdx||0]?.color||'#8dd5a5';g.beginPath();g.arc(24,0,9,0,Math.PI*2);g.fill();body(20,-15,8,7,'#bcb5a0');}
 else if(w.type==='drone'){body(13,-9,32,18,'#4b575f');g.strokeStyle='#9dd9db';g.beginPath();g.moveTo(30,-18);g.lineTo(30,18);g.moveTo(11,0);g.lineTo(51,0);g.stroke();for(const [x,y] of [[30,-19],[30,19],[9,0],[52,0]]){g.beginPath();g.arc(x,y,5,0,2*Math.PI);g.stroke();}}
 else if(w.type==='revolver'||w.type==='pistol'){body(12,-5,31,10,'#6b7173');body(40,-3,13,6,'#dbd8c7');body(23,5,8,17,'#4d4140');if(w.type==='revolver'){g.fillStyle='#d6be8b';g.beginPath();g.arc(27,0,8,0,Math.PI*2);g.fill();}}
 g.restore();
}
export function paintV22Actor(g,a,pos,screen,scale,color,local=false,attacking=false){
 const p=screen(pos),angle=a.aim??a.face??0,r=a.slot!==undefined?16:24;
 g.save();g.translate(p.x,p.y);g.scale(scale,scale);g.globalAlpha=a.hp<=0?.28:a.sneakT>0?.55:1;
 g.fillStyle='#101b21';g.strokeStyle=color;g.lineWidth=3;g.beginPath();g.arc(0,0,r+4,0,Math.PI*2);g.fill();g.stroke();
 g.save();g.rotate(angle);g.fillStyle=color;g.beginPath();g.moveTo(r+6,0);g.lineTo(-r*.65,-r*.83);g.lineTo(-r*.65,r*.83);g.closePath();g.fill();g.restore();
 g.fillStyle='#f1dfba';g.beginPath();g.arc(0,0,8,0,Math.PI*2);g.fill();
 if(a.slot!==undefined){if(!attacking)paintWeapon(g,a.slot,a.weapon??0,angle,1,{potionIdx:a.potionIdx});if(a.mode){g.globalAlpha=.4;g.strokeStyle=color;g.lineWidth=5;g.beginPath();g.arc(0,0,28+Math.sin(performance.now()*.012)*4,0,Math.PI*2);g.stroke();}}
 else{g.strokeStyle='#e5d1a0';g.lineWidth=4;g.beginPath();g.moveTo(Math.cos(angle)*9,Math.sin(angle)*9);g.lineTo(Math.cos(angle)*37,Math.sin(angle)*37);g.stroke();}
 g.restore();return p;
}
export function paintV22Effect(g,f,screen,scale){
 const p=screen(f),alpha=clamp(f.t/Math.max(.01,f.life||f.t||1),0,1),r=Math.max(2,(f.r||15)*scale);g.save();g.globalAlpha=alpha;
 if(f.kind==='particle'){g.fillStyle=f.c||'#ead5a0';g.beginPath();g.arc(p.x,p.y,Math.max(1.2,r),0,Math.PI*2);g.fill();}
 else if(f.kind==='trail'){g.fillStyle=f.c||'#e9ca83';g.globalAlpha=alpha*.2;g.beginPath();g.arc(p.x,p.y,r,0,2*Math.PI);g.fill();g.strokeStyle=f.c||'#e9ca83';g.globalAlpha=alpha*.5;g.lineWidth=2;g.stroke();}
 else if(f.kind==='popup'){g.font='bold 13px ui-monospace,monospace';g.fillStyle=f.c||'#d9b45f';g.textAlign='center';g.fillText(f.text||'',p.x,p.y-(1-alpha)*22);}
 else if(f.kind==='meleeImpact'){g.lineWidth=3;g.strokeStyle=f.c||'#ffebaa';g.beginPath();g.arc(p.x,p.y,r*(1-alpha)+3,0,Math.PI*2);g.stroke();}
 else if(f.kind==='melee'&&f.profile){const spec=f.profile,u=1-alpha,thrust=spec.motion==='thrust';let a=f.a,reach=f.r*spec.reach,tail=a;if(thrust){const shove=(v)=>{v=clamp(v,0,1);return v*v*(3-2*v);};const power=shove((u-.13)/.24)*(1-shove((u-.59)/.3));a+=f.side*.035;reach*=.54+power*.46;}else{const begin=spec.motion==='smash'?.29:spec.motion==='whip'?.22:.18,end=spec.motion==='smash'?.69:spec.motion==='whip'?.75:.71,strike=clamp((u-begin)/(end-begin),0,1);const smooth=strike*strike*(3-2*strike);a+=f.side*((smooth*2-1)*spec.arc);tail=a-f.side*.52;for(const [width,opacity,col] of [[19,.11,'#ffe588'],[11,.27,'#fff2b2'],[4,.8,'#ffffff']]){g.globalAlpha=opacity;g.strokeStyle=col;g.lineWidth=Math.max(2,width*scale);g.beginPath();g.arc(p.x,p.y,reach*scale,tail,a,f.side<0);g.stroke();}}
 g.globalAlpha=1;g.save();g.translate(p.x,p.y);g.rotate(a);g.scale(scale,scale);const size=reach/(meleeModelTips[f.type]||reach);g.scale(size,size);renderMeleeModel(g,f.type);g.restore();}
 else if(['cameraFlash','pressureBurst','foamSpray'].includes(f.kind)){g.fillStyle=f.c||'#f5dfb1';g.globalAlpha=alpha*.25;g.beginPath();g.moveTo(p.x,p.y);g.arc(p.x,p.y,r,f.a-f.arc,f.a+f.arc);g.closePath();g.fill();g.strokeStyle=f.c||'#faf0bf';g.globalAlpha=alpha*.8;g.lineWidth=3;g.stroke();}
 else if(f.kind==='bottle'&&Number.isFinite(f.tx)){const u=1-alpha,q=screen({x:f.x+(f.tx-f.x)*u,y:f.y+(f.ty-f.y)*u});g.fillStyle=f.c;g.fillRect(q.x-5,q.y-7-Math.sin(u*Math.PI)*35,10,14);}
 else{g.strokeStyle=f.c||'#c6b98e';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,r,0,Math.PI*2);g.stroke();}
 g.restore();
}
