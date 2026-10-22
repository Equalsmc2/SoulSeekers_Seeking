import {firebaseConfig} from '../firebase-config.js?v=R016';
import {makeLatestOnlySender} from './sync.js?v=R016';

export const hasFirebase=Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
let sdkPromise=null;
function withDeadline(promise,step,ms=18000){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${step} timed out. Check Firebase connectivity or browser extensions, then try again.`)),ms);}),
  ]).finally(()=>clearTimeout(timer));
}

/** Connections are shared per browser tab; a rejected login must be retryable. */
export async function connectFirebase(){
  if(!hasFirebase)throw new Error('Firebase configuration is missing from firebase-config.js.');
  if(!sdkPromise){
    sdkPromise=(async()=>{
      const V='12.19.0';
      const [app,auth,database]=await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
      ]);
      const instance=app.getApps().length?app.getApp():app.initializeApp(firebaseConfig);
      const a=auth.getAuth(instance), db=database.getDatabase(instance);
      const user=a.currentUser || (await auth.signInAnonymously(a)).user;
      if(!user?.uid)throw new Error('Firebase authentication did not return a user.');
      return {...database,db,uid:user.uid};
    })().catch(e=>{sdkPromise=null;throw e;});
  }
  return withDeadline(sdkPromise,'Firebase sign-in');
}

/** O, I, 0 and 1 are intentionally excluded to avoid copy/typing mistakes. */
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeRoomCode(code){
  return String(code??'').trim().toUpperCase().replace(/[\s-]/g,'');
}
export function isValidRoomCode(code){
  return new RegExp(`^[${CODE_ALPHABET}]{6}$`).test(normalizeRoomCode(code));
}
function makeRoomCode(){
  const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
  return Array.from(bytes,v=>CODE_ALPHABET[v%CODE_ALPHABET.length]).join('');
}

/** Translate Firebase errors into actionable messages for the in-game lobby. */
export function describeNetworkError(error){
  const code=String(error?.code||'').toLowerCase();
  const msg=String(error?.message||'');
  if(code.includes('permission-denied')||code.includes('permission_denied')||/permission.denied/i.test(msg))
    return 'Firebase permission denied. Publish the bundled database.rules.json in Realtime Database → Rules (NOT Firestore → Rules).';
  if(code.includes('auth/operation-not-allowed')||code.includes('auth/admin-restricted-operation'))
    return 'Firebase Anonymous Authentication is disabled. Enable it in Authentication → Sign-in method.';
  if(code.includes('auth/unauthorized-domain'))
    return 'This website domain is not authorized for Firebase Authentication. Check Authentication → Settings → Authorized domains.';
  if(code.includes('auth/network-request-failed')||code.includes('network-error')||code.includes('unavailable'))
    return 'Could not reach Firebase. Check your connection, browser blockers, and Firebase service status.';
  return msg||'Could not connect to Firebase. Check the browser console for details.';
}

const report=fn=>typeof fn==='function'?fn:()=>{};

/** Kept injectable so host/join behavior can be tested without a live Firebase project. */
export async function hostRoomWithClient(s,initialState,handleSlots,handleInputs,onError=()=>{}){
  const code=makeRoomCode();
  const base=`rooms/${code}`;
  const metaRef=s.ref(s.db,`${base}/meta`);
  const claimed=await s.runTransaction(metaRef,old=>old===null?{
    hostUid:s.uid,status:'running',createdAt:Date.now()
  }:undefined,{applyLocally:false});
  if(!claimed.committed)throw new Error('Room code collision. Select HOST AS DM again.');
  try{
    await s.set(s.ref(s.db,`${base}/state`),initialState);
  }catch(e){
    try{await s.remove(metaRef);}catch{ /* report original error */ }
    throw e;
  }
  const unsubSlots=s.onValue(s.ref(s.db,`${base}/slots`),snap=>handleSlots(snap.val()||{}),onError);
  const unsubInputs=s.onValue(s.ref(s.db,`${base}/inputs`),snap=>handleInputs(snap.val()||{}),onError);
  // At most one large state upload at a time, even if network latency spikes.
  const stateSender=makeLatestOnlySender(state=>s.set(s.ref(s.db,`${base}/state`),state),onError);
  const disconnect=s.onDisconnect(s.ref(s.db,`${base}/meta/status`));
  try{await disconnect.set('disconnected');}catch(e){onError(e);}
  return {
    code,uid:s.uid,
    publish(state){stateSender.queue(state);},
    getSyncStats(){return stateSender.stats();},
    close(){stateSender.close();unsubSlots();unsubInputs();disconnect.cancel().catch(()=>{});},
  };
}

export async function joinRoomWithClient(s,enteredCode,slot,name,onState,onSlots,onProgress=()=>{},onError=()=>{}){
  const code=normalizeRoomCode(enteredCode);
  if(!isValidRoomCode(code))throw new Error('Use the DM’s six-character ROOM CODE (not a custom password). Letters O/I and numbers 0/1 are not used.');
  if(!Number.isInteger(slot)||slot<0||slot>=6)throw new Error('Choose a valid SoulSeeker character.');
  const base=`rooms/${code}`;
  report(onProgress)('Finding the DM’s room...');
  const metaSnap=await withDeadline(s.get(s.ref(s.db,`${base}/meta`)),'Room lookup');
  const meta=metaSnap.val();
  if(!meta)throw new Error(`Room ${code} does not exist. Copy the code shown in the DM browser and try again.`);
  if(meta.status!=='running')throw new Error('The DM has left this match. Ask them to host a NEW room and share its new code.');

  // Wait for the initial state BEFORE closing the join menu. This distinguishes
  // a real successful join from a subscription which later fails silently.
  report(onProgress)('Checking live match data...');
  const stateSnapshot=await withDeadline(s.get(s.ref(s.db,`${base}/state`)),'Match data download');
  const initial=stateSnapshot.val();
  if(!initial||!Array.isArray(initial.players)||initial.players.length!==6)
    throw new Error('The DM room has no valid game state yet. Ask the DM to host a fresh room.');

  const slotRef=s.ref(s.db,`${base}/slots/${slot}`);
  report(onProgress)('Reserving your character...');
  const claim=await withDeadline(s.runTransaction(slotRef,current=>{
    if(current&&current.uid!==s.uid)return undefined;
    return {uid:s.uid,name:String(name||'Seeker').trim().slice(0,24)||'Seeker'};
  },{applyLocally:false}),'Character reservation');
  if(!claim.committed)throw new Error('That character is already selected by another player. Choose a different character.');

  const inputRef=s.ref(s.db,`${base}/inputs/${s.uid}`);
  const stopFns=[];
  const slotDisconnect=s.onDisconnect(slotRef),inputDisconnect=s.onDisconnect(inputRef);
  try{
    // onDisconnect may be rejected if a user's Firebase rules don't allow cleanup.
    // A cleanup issue alone should not prevent someone who has claimed a slot.
    try{await slotDisconnect.remove();await inputDisconnect.remove();}
    catch(e){console.warn('Could not register automatic disconnect cleanup:',e);}
    report(onProgress)('Syncing with the battlefield...');
    onState(initial);
    stopFns.push(s.onValue(s.ref(s.db,`${base}/state`),snap=>{
      const state=snap.val();if(state)onState(state);
    },onError));
    stopFns.push(s.onValue(s.ref(s.db,`${base}/slots`),snap=>onSlots(snap.val()||{}),onError));
    const inputSender=makeLatestOnlySender(input=>s.set(inputRef,input),onError);
    return {
      code,uid:s.uid,
      send(input){inputSender.queue(input);},
      getSyncStats(){return inputSender.stats();},
      async leave(){
        inputSender.close();
        for(const fn of stopFns)fn();
        await Promise.allSettled([s.remove(slotRef),s.remove(inputRef),slotDisconnect.cancel(),inputDisconnect.cancel()]);
      },
    };
  }catch(e){
    for(const fn of stopFns)fn();
    await Promise.allSettled([s.remove(slotRef),slotDisconnect.cancel(),inputDisconnect.cancel()]);
    throw e;
  }
}

export async function hostRoom(initialState,handleSlots,handleInputs,onError){
  return hostRoomWithClient(await connectFirebase(),initialState,handleSlots,handleInputs,onError);
}
export async function joinRoom(code,slot,name,onState,onSlots,onProgress,onError){
  return joinRoomWithClient(await connectFirebase(),code,slot,name,onState,onSlots,onProgress,onError);
}
