import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
if (!fs.existsSync(path.join(root, 'index.html'))) throw Error('请先运行 pnpm build');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req,res)=>{
  let filename;
  try {filename=path.resolve(root, '.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
  catch {res.writeHead(400).end();return;}
  if (filename===path.resolve(root)) filename=path.join(root,'index.html');
  if (!filename.startsWith(root)){res.writeHead(403).end();return;}
  fs.stat(filename,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(filename);
    stream.on('error',()=>res.destroy());
    res.on('close',()=>stream.destroy());
    stream.pipe(res);
  });
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(4175,'127.0.0.1',()=>console.log('器绘：http://127.0.0.1:4175/ （Ctrl+C 停止）'));
