import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseEnv } from 'node:util';
import handler from './api/library.js';
import booksHandler from './api/books.js';
import tasksHandler from './api/tasks.js';
const publicDir = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(['/api/library','/api/books','/api/tasks'].includes(url.pathname)) {
    // Local configuration edits take effect without stopping the preview.
    try {
      const local = parseEnv(await readFile(new URL('./.env.local', import.meta.url), 'utf8'));
      for(const key of ['NOTION_TOKEN','NOTION_DATABASE_ID','NOTION_DATA_SOURCE_ID','NOTION_TASKS_DATA_SOURCE_ID','LIBRARY_EDIT_KEY']) if(Object.hasOwn(local,key)) process.env[key]=local[key];
    } catch(error) {
      if(error.code!=='ENOENT'){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Could not read .env.local. Check the local configuration file.'}));}
    }
    res.status=code=>{res.statusCode=code;return res;};res.json=data=>res.end(JSON.stringify(data));return ({'/api/books':booksHandler,'/api/tasks':tasksHandler}[url.pathname]||handler)(req,res);
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  try {
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file=path.resolve(publicDir, `.${requested}`);
    if(!file.startsWith(publicDir+path.sep) || requested.split('/').some(part=>part.startsWith('.'))) {res.writeHead(403);return res.end();}
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log(`Library preview: http://127.0.0.1:${server.address().port}`));
