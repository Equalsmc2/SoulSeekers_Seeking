import {firebaseConfig} from '../firebase-config.js';
export const hasFirebase=Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
let sdk=null;
export async function connectFirebase(){
  if(!hasFirebase)throw Error('Firebase is not configured. See README.md. Local Training works without it.');
  if(sdk)return sdk;
  const V='12.19.0';
  const [app,auth,database]=await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`)
  ]);
  const instance=app.initializeApp(firebaseConfig);
  const a=auth.getAuth(instance),db=database.getDatabase(instance);
  if(!a.currentUser)await auth.signInAnonymously(a);
  sdk={...database,db,uid:a.currentUser.uid};return sdk;
}
function roomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
  return Array.from(bytes,v=>chars[v%chars.length]).join('');
}
export async function hostRoom(initialState,handleSlots,handleInputs){
  const s=await connectFirebase();const code=roomCode();
  const base=`rooms/${code}`;
  const room=s.ref(s.db,base);
  const result=await s.runTransaction(s.ref(s.db,`${base}/meta`), old=>old===null?{hostUid:s.uid,status:'running',createdAt:Date.now()}:undefined,{applyLocally:false});
  if(!result.committed)throw Error('Room ID collision. Retry.');
  await s.set(s.ref(s.db,`${base}/state`),initialState);
  const unsubSlots=s.onValue(s.ref(s.db,`${base}/slots`),snap=>handleSlots(snap.val()||{}));
  const unsubInputs=s.onValue(s.ref(s.db,`${base}/inputs`),snap=>handleInputs(snap.val()||{}));
  await s.onDisconnect(s.ref(s.db,`${base}/meta/status`)).set('disconnected');
  return {
    code,uid:s.uid,
    async publish(state){await s.set(s.ref(s.db,`${base}/state`),state);},
    close(){unsubSlots();unsubInputs();s.onDisconnect(s.ref(s.db,`${base}/meta/status`)).cancel();},
  };
}
export async function joinRoom(code,slot,name,onState,onSlots){
  const s=await connectFirebase();code=code.toUpperCase().trim();
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))throw Error('Enter a six-character room code.');
  const base=`rooms/${code}`;const metaSnap=await s.get(s.ref(s.db,`${base}/meta`));
  const meta=metaSnap.val();if(!meta)throw Error('No match found for that room code.');
  if(meta.status!=='running')throw Error('The host is not running this match.');
  const slotRef=s.ref(s.db,`${base}/slots/${slot}`);
  const claimed=await s.runTransaction(slotRef, current => (!current||current.uid===s.uid)?{uid:s.uid,name:String(name||'Seeker').slice(0,24)}:undefined,{applyLocally:false});
  if(!claimed.committed)throw Error('That character slot is already occupied. Choose another.');
  await s.onDisconnect(slotRef).remove();
  const inputRef=s.ref(s.db,`${base}/inputs/${s.uid}`);
  await s.onDisconnect(inputRef).remove();
  const stopState=s.onValue(s.ref(s.db,`${base}/state`),snap=>{const data=snap.val();if(data)onState(data);});
  const stopSlots=s.onValue(s.ref(s.db,`${base}/slots`),snap=>onSlots(snap.val()||{}));
  return {
    code,uid:s.uid,
    async send(input){await s.set(inputRef,input);},
    async leave(){stopState();stopSlots();await s.remove(slotRef);await s.remove(inputRef);},
  };
}
