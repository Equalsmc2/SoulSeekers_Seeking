import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const tmp=mkdtempSync(join(tmpdir(),'seeking-render-'));
let raf=null,drawCalls=0,backgroundDraws=0;
const ctx=()=>new Proxy({
 setTransform(){},
 drawImage(){drawCalls++},
 createRadialGradient(){return {addColorStop(){}}},
}, {get(target,key){
 if(key in target)return target[key];
 if(['fillStyle','strokeStyle','lineWidth','globalAlpha','font','textAlign','textBaseline'].includes(key))return '';
 return ()=>{};
},set(target,key,value){target[key]=value;return true;}});
function el(tag='div'){
 const names=new Set();
 const obj={tagName:tag.toUpperCase(),textContent:'',innerHTML:'',disabled:false,value:'',children:[],
 style:{setProperty(){},width:''},
 classList:{add(x){names.add(x)},remove(x){names.delete(x)},contains(x){return names.has(x)},toggle(x,f){f=f??!names.has(x);if(f)names.add(x);else names.delete(x)}},
 append(x){this.children.push(x)},replaceChildren(){this.children=[]},querySelectorAll(){return[]},addEventListener(){},scrollTo(){},
 getBoundingClientRect(){return{width:960,height:640,left:0,top:0}},getContext(){return ctx()},
 };
 return obj;
}
try{
 for(const f of ['src/main.js','src/data.js','src/engine.js','src/sync.js','src/prediction.js','src/socket-network.js']){
  const dest=join(tmp,f);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(root,f),dest);
 }
 const elements=new Map();
 const originalSetTimeout=globalThis.setTimeout;
 globalThis.document={hidden:false,activeElement:null,getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},querySelectorAll(){return[]},createElement(t){return el(t)}};
 globalThis.location={hostname:'localhost',protocol:'http:',host:'localhost:8787',search:''};
 globalThis.localStorage={getItem(){return null},setItem(){}};
 globalThis.window={devicePixelRatio:1,addEventListener(){},setInterval(){return 1}};
 globalThis.requestAnimationFrame=fn=>(raf=fn,1);
 await import(pathToFileURL(join(tmp,'src/main.js')).href);
 assert.equal(window.__SEEKING_BOOTSTRAPPED__,true);
 elements.get('soloParty').onclick();
 assert.ok(typeof raf==='function');
 raf(performance.now());
 assert.ok(drawCalls>=1,'world must be prerendered and composited');
 const prior=drawCalls;
 raf(performance.now()+17);
 assert.ok(drawCalls>prior,'cached world must render on subsequent frames');
 console.log('✓ Actual game render draws cached map without JS exceptions');
}finally{rmSync(tmp,{recursive:true,force:true})}
