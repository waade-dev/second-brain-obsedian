import {LibraryError} from './notion.js';

export const STATUSES = ['To do', 'In progress', 'Done'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const text = values => (values || []).map(value => value.plain_text ?? value.text?.content ?? '').join('');
const sameID = (a, b) => typeof a === 'string' && typeof b === 'string' && a.replaceAll('-', '').toLowerCase() === b.replaceAll('-', '').toLowerCase();

export function validateTask(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new LibraryError('Enter task details.', 400);
  const task = {};
  if (!partial || Object.hasOwn(input, 'name')) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 200) throw new LibraryError('Task name must be 1–200 characters.', 400);
    task.name = input.name.trim();
  }
  for (const [key, options] of [['status', STATUSES], ['priority', PRIORITIES]]) {
    if (Object.hasOwn(input, key)) {
      if (!options.includes(input[key]) && !(key === 'priority' && input[key] === '')) throw new LibraryError(`Choose a valid ${key}.`, 400);
      task[key] = input[key];
    }
  }
  for (const [key, limit] of [['notes', 2000], ['link', 2000], ['due', 10]]) {
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== 'string' || input[key].length > limit) throw new LibraryError(`Check the task ${key}.`, 400);
      task[key] = input[key].trim();
    }
  }
  if (task.due && (!/^\d{4}-\d{2}-\d{2}$/.test(task.due) || !Number.isFinite(Date.parse(task.due)) || new Date(task.due).toISOString().slice(0, 10) !== task.due)) throw new LibraryError('Choose a valid due date.', 400);
  if (task.link) {
    try { if (!['http:', 'https:'].includes(new URL(task.link).protocol)) throw new Error(); }
    catch { throw new LibraryError('Use an http or https link.', 400); }
  }
  if (!partial) task.status ??= 'To do';
  if (!Object.keys(task).length) throw new LibraryError('No task changes were provided.', 400);
  return task;
}

export function mapTask(page) {
  const p = page.properties || {};
  return {id: page.id, name: text(p.Name?.title) || 'Untitled', status: p.Status?.status?.name || 'To do', priority: p.Priority?.select?.name || '', due: p.Due?.date?.start || '', notes: text(p.Notes?.rich_text), link: p.Link?.url || '', url: page.url || ''};
}

export function taskClient({token, dataSourceId, fetchImpl = fetch}) {
  if (!token) throw new LibraryError('Set NOTION_TOKEN on the server to connect the task board.', 503);
  if (typeof dataSourceId !== 'string' || !UUID.test(dataSourceId)) throw new LibraryError('Set NOTION_TASKS_DATA_SOURCE_ID on the server to select the task database.', 503);
  const signal = AbortSignal.timeout(45000);
  async function request(path, method = 'GET', body) {
    // Writes are not automatically retried: a timed-out create may already have succeeded.
    const response = await fetchImpl(`https://api.notion.com/v1${path}`, {method, signal, headers: {Authorization: `Bearer ${token}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) throw new LibraryError('The app’s Notion integration needs access to Second Brain Tasks, with Read, Insert and Update content permissions. Add it under the database’s Connections menu.', 503);
      if (response.status === 429) throw new LibraryError('Notion is busy. Wait a moment, then refresh before retrying.', 429);
      throw new LibraryError('Notion could not complete this request. Refresh the board before retrying.', 502);
    }
    return response.json();
  }
  async function schema() {
    const source = await request(`/data_sources/${dataSourceId}`);
    for (const [name, type] of Object.entries({Name: 'title', Status: 'status', Priority: 'select', Due: 'date', Notes: 'rich_text', Link: 'url'})) {
      if (source.properties?.[name]?.type !== type) throw new LibraryError(`The task database needs its ${name} ${type} property. Check the configured task data source.`, 422);
    }
    const statuses = source.properties.Status.status?.options?.map(option => option.name) || [];
    if (STATUSES.some(status => !statuses.includes(status))) throw new LibraryError('The task database needs To do, In progress and Done status options.', 422);
    return source;
  }
  function properties(task) {
    const result = {};
    if ('name' in task) result.Name = {title: [{text: {content: task.name}}]};
    if ('status' in task) result.Status = {status: {name: task.status}};
    if ('priority' in task) result.Priority = {select: task.priority ? {name: task.priority} : null};
    if ('due' in task) result.Due = {date: task.due ? {start: task.due} : null};
    if ('notes' in task) result.Notes = {rich_text: task.notes ? [{text: {content: task.notes}}] : []};
    if ('link' in task) result.Link = {url: task.link || null};
    return result;
  }
  return {
    async list() {
      const source = await schema();
      const rows = []; let cursor; let pages = 0;
      do {
        if (++pages > 50) throw new LibraryError('The board exceeds 5,000 tasks. Add incremental loading before showing this collection.', 422);
        if (pages > 1) await new Promise(resolve => setTimeout(resolve, 350));
        const result = await request(`/data_sources/${dataSourceId}/query`, 'POST', {page_size: 100, sorts: [{property: 'Due', direction: 'ascending'}], ...(cursor ? {start_cursor: cursor} : {})});
        if (!Array.isArray(result.results) || (result.has_more && !result.next_cursor) || result.request_status?.incomplete_reason) throw new LibraryError('Notion returned an incomplete task list. Please refresh.', 502);
        rows.push(...result.results.filter(page => page.object === 'page' && !page.archived && !page.in_trash && !page.is_archived).map(mapTask));
        cursor = result.has_more ? result.next_cursor : null;
      } while (cursor);
      const databaseId = source.parent?.database_id;
      const databaseUrl = typeof databaseId === 'string' && UUID.test(databaseId) ? `https://www.notion.so/${databaseId.replaceAll('-', '')}` : '';
      return {rows, statuses: source.properties.Status.status.options.map(option => option.name), databaseUrl, syncedAt: new Date().toISOString()};
    },
    async create(input) {
      const task = validateTask(input);
      await schema();
      return mapTask(await request('/pages', 'POST', {parent: {type: 'data_source_id', data_source_id: dataSourceId}, properties: properties(task)}));
    },
    async update(id, input) {
      if (typeof id !== 'string' || !UUID.test(id)) throw new LibraryError('Choose a valid task.', 400);
      const task = validateTask(input, true);
      await schema();
      const page = await request(`/pages/${id}`);
      if (!sameID(page.parent?.data_source_id, dataSourceId) || page.in_trash || page.archived || page.is_archived) throw new LibraryError('This task is not an active task in this board.', 404);
      return mapTask(await request(`/pages/${id}`, 'PATCH', {properties: properties(task)}));
    }
  };
}
