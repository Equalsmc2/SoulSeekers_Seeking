// DOM-free smoke test for the browser menu. Crucially, network.js is deliberately NOT
// copied to the temporary site; both offline modes must boot even without it.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const tmp=mkdtempSync(join(tmpdir(),'seeking-startup-'));
function copy(rel){const out=join(tmp,rel);mkdirSync(dirname(out),{recursive:true});copyFileSync(join(root,rel),out);}
try {
  for (const f of ['src/main.js','src/data.js','src/engine.js','src/sync.js','src/prediction.js','src/socket-network.js'])copy(f);
  // The new small socket networking module is offline-safe; no external SDK required.
  const elements=new Map();
  function el(){
    const names=new Set();
    return {
      textContent:'',innerHTML:'',value:'',disabled:false,children:[],style:{setProperty(){}},
      classList:{add(x){names.add(x)},remove(x){names.delete(x)},contains(x){return names.has(x)},toggle(x,force){if(force===undefined)force=!names.has(x); if(force)names.add(x);else names.delete(x);return force}},
      append(x){this.children.push(x)},querySelectorAll(){return[]},addEventListener(){},getBoundingClientRect(){return{width:900,height:600,left:0,top:0}},
      getContext(){return{setTransform(){}}},
    };
  }
  globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},createElement(){return el()},querySelectorAll(){return[]},activeElement:null};
  globalThis.location={hostname:'localhost',protocol:'http:',host:'localhost:8787',search:''};
  globalThis.localStorage={getItem(){return null},setItem(){}};
  globalThis.window={addEventListener(){},devicePixelRatio:1};
  globalThis.requestAnimationFrame=()=>1;
  const moduleUrl=pathToFileURL(join(tmp,'src/main.js')).href;
  await import(moduleUrl);
  assert.equal(window.__SEEKING_BOOTSTRAPPED__,true,'initial menu must finish bootstrapping');
  assert.equal(document.getElementById('heroChoices').children.length,6,'all six hero choices appear');
  document.getElementById('soloDM').onclick();
  assert.equal(document.getElementById('roleBadge').textContent,'DUNGEON MASTER');
  assert.ok(document.getElementById('menuLayer').classList.contains('hidden'),'DM training leaves menu');
  document.getElementById('soloParty').onclick();
  assert.equal(document.getElementById('roleBadge').textContent,'PARTY OPERATIVE');
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(document.getElementById('firebaseStatus').textContent,'SERVER ADDRESS SET');
  console.log('✓ All six character choices appear; offline Party and DM start even without network.js');
  console.log('✓ Local game server URL is detected without connecting to it');
} finally {rmSync(tmp,{recursive:true,force:true});}
