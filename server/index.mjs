import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {createMatchService} from './matches.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT)||8787;
const host=process.env.HOST||'0.0.0.0';
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/health'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({status:'ok',game:'seeking',version:'R03'}));
  }
  let decoded;
  try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);return res.end('Bad URL');}
  const full=path.resolve(root,'.'+(decoded.endsWith('/')?decoded+'index.html':decoded));
  // Static server is only for game assets, never server code/config/scripts.
  const rel=path.relative(root,full).replaceAll('\\','/');
  if(rel.startsWith('..')||path.isAbsolute(rel)||rel.startsWith('server/')||rel.startsWith('tests/')||rel.startsWith('.')||!['.html','.js','.css','.png','.svg','.ico'].includes(path.extname(full))){res.writeHead(404);return res.end('Not found');}
  fs.stat(full,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(full).pipe(res);
  });
});
const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:{threshold:8192,serverNoContextTakeover:true,clientNoContextTakeover:true,concurrencyLimit:2,zlibDeflateOptions:{level:1}}});
const service=createMatchService();
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/ws'){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>service.attach(ws));
});
server.listen(port,host,()=>console.log(`SoulSeekers R03 game server running at http://localhost:${port} (WebSocket /ws)`));
function shutdown(){service.stop();for(const c of service.clients)try{c.close(1001,'Server restarting');}catch{}server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
