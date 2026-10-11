import { loadLibrary, LibraryError } from '../lib/notion.js';
let cached; let pending;
export function invalidateLibraryCache(){cached=undefined;}
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'This library is read-only. Use GET.'}); }
  try {
    const fresh = new URL(req.url || '/api/library', 'http://localhost').searchParams.get('fresh') === '1';
    if (!cached || Date.now() - cached.time > (fresh ? 1000 : 20000)) {
      if (!pending) pending = loadLibrary({ token:process.env.NOTION_TOKEN, databaseId:process.env.NOTION_DATABASE_ID, dataSourceId:process.env.NOTION_DATA_SOURCE_ID }).then(data => {cached={data,time:Date.now()};return data;}).finally(()=>{pending=null;});
      await pending;
    }
    return res.status(200).json(cached.data);
  } catch (error) {
    return res.status(error instanceof LibraryError ? error.status : 502).json({error:error instanceof LibraryError ? error.message : 'Unable to load Notion right now. Try refreshing in a minute.'});
  }
}
