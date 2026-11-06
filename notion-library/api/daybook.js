import {createHash,timingSafeEqual} from 'node:crypto';
import {LibraryError} from '../lib/notion.js';
import {daybookClient} from '../lib/daybook.js';
import {devdeskClient} from '../lib/devdesk.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  try{
    const expected=process.env.DAYBOOK_BRIDGE_KEY,supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!expected||!supplied||!timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest()))return res.status(401).json({error:'Workspace authorization required.'});
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
    let body=req.body;if(body===undefined){const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>65536)throw new LibraryError('Details are too long.',413);chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks).toString();}if(typeof body==='string')body=JSON.parse(body);if(!body||Array.isArray(body)||typeof body!=='object'||Buffer.byteLength(JSON.stringify(body))>65536)throw new LibraryError('Send valid workspace details.',400);
    if(['devList','devSave','devRemove','devInbox'].includes(body.action)){const dev=devdeskClient({token:process.env.NOTION_TOKEN});const result=body.action==='devList'?await dev.list(body.kind):body.action==='devSave'?await dev.save(body.record):body.action==='devRemove'?await dev.remove(body.key,body.revision):{record:await dev.inbox(body.key)};return res.status(200).json(result);}
    const client=daybookClient({token:process.env.NOTION_TOKEN,dataSourceId:process.env.NOTION_TASKS_DATA_SOURCE_ID});
    if(body.action==='setupViews')return res.status(200).json(await client.setupViews());
    if(body.action==='setup')return res.status(200).json(await client.setup());
    if(body.action==='state')return res.status(200).json(await client.state(body.month));
    if(body.action==='saveLog')return res.status(200).json(await client.saveLog(body));
    if(body.action==='createTask')return res.status(201).json(await client.createTask(body.task));
    if(body.action==='updateTask')return res.status(200).json(await client.updateTask(body.task));
    throw new LibraryError('Unknown workspace action.',400);
  }catch(e){return res.status(e instanceof LibraryError?e.status:e instanceof SyntaxError?400:502).json({error:e instanceof LibraryError?e.message:e instanceof SyntaxError?'Send valid JSON.':'Could not sync Notion. Refresh before retrying.'});}
}
