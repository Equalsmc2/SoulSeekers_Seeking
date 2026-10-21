export const WORLD = { width: 6800, height: 2000, lanes: [350, 1000, 1650], partyX: 180, dmX: 6490 };
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
export const BUILDINGS = (()=>{
  const out=[];
  // Even footprints, repeatable geometry, kept clear of the lane routes and shop nodes.
  for(const x of [480,850,1230,1630,2000,2380,2730,3200,3600,3980,4380,4780,5180,5580,5980]){
    for(const y of [540,770,1190,1440]){
      if ((x===1230 && y===540) || (x===2000 && y===1440)) continue;
      out.push({x:x+(y%3)*7,y,w:145,h:95});
    }
  }
  return out;
})();
export const SHOPS=[{x:2050,y:675,name:'PUBLIC GARDEN MARKET'},{x:4660,y:1335,name:'BACK ALLEY EXCHANGE'}];
export const CHEST_SPOTS=[{x:650,y:690},{x:1570,y:680},{x:2630,y:650},{x:3870,y:680},{x:5480,y:665},{x:860,y:1330},{x:1720,y:1330},{x:3350,y:1330},{x:4970,y:1335},{x:6120,y:1335}];
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const makeId=(prefix='e')=> `${prefix}_${Math.random().toString(36).slice(2,9)}`;
