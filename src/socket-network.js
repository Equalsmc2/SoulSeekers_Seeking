/** WebSocket networking only: never stores or writes combat states to Firebase. */
export function normalizeEndpoint(raw,loc=globalThis.location){
  let value=String(raw||'').trim();
  if(!value)throw new Error('Paste the WebSocket server URL from Render, or use localhost:8787 for local testing.');
  if(!/^\w+:\/\//.test(value))value=`https://${value}`;
  let url;
  try{url=new URL(value);}catch{throw new Error('That server address is invalid. Use https://YOUR-SERVICE.onrender.com.');}
  if(url.protocol==='https:')url.protocol='wss:';
  else if(url.protocol==='http:')url.protocol='ws:';
  if(!['ws:','wss:'].includes(url.protocol))throw new Error('Use an HTTPS/WSS game server URL.');
  if(loc?.protocol==='https:' && url.protocol==='ws:' && !['localhost','127.0.0.1'].includes(url.hostname))throw new Error('GitHub Pages requires a secure HTTPS/WSS server URL.');
  url.pathname='/ws';url.search='';url.hash='';
  return url.toString();
}
export function describeSocketError(error){
  const message=String(error?.message||error||'Connection problem');
  return message.includes('timed out')?'Game server did not answer. Check the Render service is live (first wake-up can take about a minute).':message;
}

/** One socket per game tab. Automatic reconnect uses server-issued unguessable
 * room tokens, so the player's seat survives brief network interruptions.
 */
export function connectMatch({endpoint,role,code='',slot=0,name='Seeker',onState=()=>{},onRoster=()=>{},onEvent=()=>{},onConnection=()=>{},WebSocketImpl=globalThis.WebSocket}){
  if(!WebSocketImpl)return Promise.reject(new Error('WebSockets are not supported in this browser.'));
  const url=normalizeEndpoint(endpoint);
  let ws=null,closed=false,resolved=false,retries=0,roomCode='',authToken='',selectedSlot=slot;
  // A refresh in the same tab may reclaim a previously reserved Party seat.
  if(role==='party'&&code){try{authToken=sessionStorage.getItem(`seeking-seat-${code}-${slot}`)||'';}catch{}}
  let rejectFirst,resolveFirst,connectTimer=null,reconnectTimer=null,lastPing=0,lastPong=0;
  const connection={
    get code(){return roomCode;},get token(){return authToken;},get slot(){return selectedSlot;},get ready(){return ws?.readyState===1&&resolved;},
    get latency(){return lastPong||0;},get endpoint(){return url;},
    sendInput(input){send({type:'input',input});},
    sendDMInput(input){send({type:'dmInput',input});},
    spawn(kind,lane,x,y){send({type:'dmSpawn',kind,lane,x,y});},
    order(x,y){send({type:'dmOrder',x,y});},
    close(){closed=true;clearTimeout(connectTimer);clearTimeout(reconnectTimer);if(ws){ws.close(1000,'Leaving match');ws=null;}},
  };
  function send(msg){if(ws?.readyState===1)ws.send(JSON.stringify(msg));}
  const first=new Promise((resolve,reject)=>{resolveFirst=resolve;rejectFirst=reject;});
  function open(){
    if(closed)return;
    onConnection(retries?'Reconnecting to the game server…':'Connecting to game server…');
    let socket;
    try{socket=new WebSocketImpl(url);}catch(e){if(!resolved)rejectFirst(e);return;}
    ws=socket;
    connectTimer=setTimeout(()=>{if(ws===socket&&socket.readyState!==1)socket.close();},12000);
    socket.addEventListener('open',()=>{
      clearTimeout(connectTimer);
      if(roomCode){
        if(role==='dm')send({type:'rejoinDM',code:roomCode,token:authToken});
        else send({type:'join',code:roomCode,slot:selectedSlot,name,token:authToken});
      }else if(role==='dm')send({type:'host'});
      else send({type:'join',code,slot,name,token:authToken||undefined});
    });
    socket.addEventListener('message',event=>{
      let msg;try{msg=JSON.parse(event.data);}catch{return;}
      if(msg.type==='welcome'){
        roomCode=msg.code;authToken=msg.token;selectedSlot=msg.slot??selectedSlot;
        if(role==='party')try{sessionStorage.setItem(`seeking-seat-${roomCode}-${selectedSlot}`,authToken);}catch{}
        retries=0;onState(msg.state);onRoster(msg.slots||[]);
        onConnection('CONNECTED / DEDICATED SERVER');
        if(!resolved){resolved=true;resolveFirst(connection);}
      }else if(msg.type==='snapshot'){onState(msg.state);}
      else if(msg.type==='roster'){onRoster(msg.slots||[]);}
      else if(msg.type==='event'){onEvent(msg.message);}
      else if(msg.type==='pong'){lastPong=Math.max(0,Date.now()-lastPing);}
      else if(msg.type==='error'){
        onEvent(msg.message);
        if(!resolved){closed=true;rejectFirst(new Error(msg.message));socket.close();}
        else if(/invalid|expired|already been reserved|already in a match/i.test(msg.message)){closed=true;onConnection('SESSION EXPIRED / RETURN TO MENU');socket.close();}
      }
    });
    socket.addEventListener('error',()=>{onConnection('NETWORK ERROR / RECONNECTING');});
    socket.addEventListener('close',()=>{
      clearTimeout(connectTimer);
      if(closed)return;
      onConnection('DISCONNECTED / RECONNECTING');
      const delay=Math.min(9000,500*Math.pow(1.6,Math.min(8,retries++)));
      reconnectTimer=setTimeout(open,delay);
    });
  }
  open();
  // Keep a live channel active on hosts that may spin down during long quiet periods.
  const timer=setInterval(()=>{if(closed){clearInterval(timer);return;}if(ws?.readyState===1){lastPing=Date.now();send({type:'ping',at:lastPing});}},8000);
  const originalClose=connection.close;connection.close=()=>{clearInterval(timer);originalClose();};
  return first;
}
