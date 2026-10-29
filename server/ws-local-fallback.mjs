/** Small no-dependency development WebSocket adapter used ONLY when npm's ws is absent.
 * Production Render installs the project's ws dependency. No compression or subprotocols.
 * Mask validation, payload limits, upgrade validation, fragmentation, ping/close supported.
 */
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(op,body){body=Buffer.isBuffer(body)?body:Buffer.from(body||'');let h;if(body.length<126){h=Buffer.from([0x80|op,body.length]);}else if(body.length<=65535){h=Buffer.alloc(4);h[0]=0x80|op;h[1]=126;h.writeUInt16BE(body.length,2);}else{h=Buffer.alloc(10);h[0]=0x80|op;h[1]=127;h.writeBigUInt64BE(BigInt(body.length),2);}return Buffer.concat([h,body]);}
class LocalSocket extends EventEmitter{
 constructor(socket,maxPayload=8192){super();this.socket=socket;this.readyState=1;this.bufferedAmount=0;this.maxPayload=maxPayload;this.buffer=Buffer.alloc(0);this.parts=[];this.opcode=0;this.closed=false;
  socket.on('data',b=>this.feed(b));socket.on('close',()=>this.finish());socket.on('end',()=>this.finish());socket.on('error',e=>{this.emit('error',e);this.finish();});}
 send(s){if(this.readyState!==1)return;const b=Buffer.from(String(s));this.socket.write(frame(1,b));}
 close(code=1000,reason=''){if(this.readyState!==1)return;const bytes=Buffer.from(String(reason));const b=Buffer.alloc(2+Math.min(bytes.length,123));b.writeUInt16BE(code,0);bytes.copy(b,2,0,b.length-2);this.readyState=2;try{this.socket.end(frame(8,b));}catch{this.socket.destroy();}this.finish();}
 finish(){if(this.closed)return;this.closed=true;this.readyState=3;this.emit('close');}
 fail(code=1002,reason='Protocol error'){try{this.close(code,reason);}catch{this.socket.destroy();}}
 feed(chunk){if(this.closed)return;this.buffer=Buffer.concat([this.buffer,chunk]);if(this.buffer.length>this.maxPayload*2+64)return this.fail(1009,'Message too large');while(this.buffer.length>=2){const b=this.buffer,fin=Boolean(b[0]&128),op=b[0]&15,masked=Boolean(b[1]&128);let size=b[1]&127,offset=2;if(!masked||Boolean(b[0]&0x70))return this.fail();if(size===126){if(b.length<4)return;size=b.readUInt16BE(2);offset=4;}else if(size===127){if(b.length<10)return;const len=b.readBigUInt64BE(2);if(len>BigInt(this.maxPayload))return this.fail(1009,'Message too large');size=Number(len);offset=10;}
  if(size>this.maxPayload)return this.fail(1009,'Message too large');if(b.length<offset+4+size)return;const mask=b.subarray(offset,offset+4),body=Buffer.from(b.subarray(offset+4,offset+4+size));for(let i=0;i<body.length;i++)body[i]^=mask[i%4];this.buffer=b.subarray(offset+4+size);
  if(op>=8){if(!fin||size>125)return this.fail();if(op===8){this.close(1000);return;}if(op===9){this.socket.write(frame(10,body));continue;}if(op===10)continue;return this.fail();}
  if(op===0){if(!this.opcode)return this.fail();}else if(op===1||op===2){if(this.opcode)return this.fail();this.opcode=op;}else return this.fail();this.parts.push(body);
  if(this.parts.reduce((n,x)=>n+x.length,0)>this.maxPayload)return this.fail(1009,'Message too large');if(fin){const msg=Buffer.concat(this.parts);this.parts=[];const packetOp=this.opcode;this.opcode=0;if(packetOp===1){const decoder=new TextDecoder('utf-8',{fatal:true});try{this.emit('message',decoder.decode(msg));}catch{return this.fail(1007,'Invalid UTF-8');}}}
 }}
}
export class WebSocketServer{
 constructor({maxPayload=8192}={}){this.maxPayload=maxPayload;}
 handleUpgrade(req,socket,head,callback){const key=req.headers['sec-websocket-key'];if(req.headers.upgrade?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13'||typeof key!=='string'||Buffer.from(key,'base64').length!==16){socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return socket.destroy();}
  const accept=createHash('sha1').update(key+GUID).digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');const ws=new LocalSocket(socket,this.maxPayload);callback(ws);if(head?.length)ws.feed(head);}
}
