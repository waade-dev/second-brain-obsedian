import {createHash,timingSafeEqual} from 'node:crypto';
import {createNotionBook} from '../lib/book-writer.js';
import {LibraryError} from '../lib/notion.js';
import {invalidateLibraryCache} from './library.js';
let pending=Promise.resolve();
function authorized(req) {
  const expected=process.env.LIBRARY_EDIT_KEY||'';
  if(expected.length<16)throw new LibraryError('Set LIBRARY_EDIT_KEY in your server configuration (at least 16 characters) to enable adding books.',503);
  const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
  const hash=value=>createHash('sha256').update(value).digest();
  if(!supplied||!timingSafeEqual(hash(supplied),hash(expected)))throw new LibraryError('The library edit key is incorrect.',401);
}
async function bodyOf(req) {
  if(req.body!==undefined){const value=typeof req.body==='string'?JSON.parse(req.body):req.body;if(Buffer.byteLength(JSON.stringify(value)||'')>8192)throw new LibraryError('The book details are too long.',413);return value;}
  const chunks=[];let size=0;
  for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>8192)throw new LibraryError('The book details are too long.',413);chunks.push(Buffer.from(chunk));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export default async function handler(req,res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST to add a book.'});}
  try {
    authorized(req);const body=await bodyOf(req);
    if(!body||typeof body!=='object'||typeof body.name!=='string'||(body.chapter!==undefined&&typeof body.chapter!=='string'))throw new LibraryError('Enter a book name and an optional chapter.',400);
    // Serialize read/append operations within a server instance.
    const operation=pending.catch(()=>{}).then(()=>createNotionBook({name:body.name,chapter:body.chapter,token:process.env.NOTION_TOKEN,databaseId:process.env.NOTION_DATABASE_ID,dataSourceId:process.env.NOTION_DATA_SOURCE_ID}));
    pending=operation;
    const result=await operation;invalidateLibraryCache();return res.status(201).json(result);
  }catch(error){return res.status(error instanceof LibraryError?error.status:error instanceof SyntaxError?400:502).json({error:error instanceof LibraryError?error.message:error instanceof SyntaxError?'Enter valid book details.':'Unable to save the book. Please try again.'});}
}
