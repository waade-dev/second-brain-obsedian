import {createHash, timingSafeEqual} from 'node:crypto';
import {taskClient} from '../lib/tasks.js';
import {LibraryError} from '../lib/notion.js';

async function bodyOf(req) {
  if (req.body !== undefined) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (Buffer.byteLength(JSON.stringify(body) || '') > 16384) throw new LibraryError('Task details are too long.', 413);
    return body;
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 16384) throw new LibraryError('Task details are too long.', 413);
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({error: 'Use GET, POST or PATCH for tasks.'});
  }
  try {
    const expected = process.env.LIBRARY_EDIT_KEY || '';
    if (expected.length < 16) throw new LibraryError('Set LIBRARY_EDIT_KEY on the server (at least 16 characters) to unlock tasks.', 503);
    const supplied = (req.headers.authorization || '').replace(/^Bearer /, '');
    const hash = value => createHash('sha256').update(value).digest();
    if (!supplied || !timingSafeEqual(hash(supplied), hash(expected))) throw new LibraryError('The library edit key is incorrect.', 401);
    const client = taskClient({token: process.env.NOTION_TOKEN, dataSourceId: process.env.NOTION_TASKS_DATA_SOURCE_ID || undefined});
    if (req.method === 'GET') return res.status(200).json(await client.list());
    const body = await bodyOf(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LibraryError('Enter task details.', 400);
    if (req.method === 'POST') return res.status(201).json({task: await client.create(body)});
    return res.status(200).json({task: await client.update(body.id, body)});
  } catch (error) {
    return res.status(error instanceof LibraryError ? error.status : error instanceof SyntaxError ? 400 : 502).json({error: error instanceof LibraryError ? error.message : error instanceof SyntaxError ? 'Send valid JSON task details.' : 'Could not reach Notion. Refresh the board before retrying.'});
  }
}
