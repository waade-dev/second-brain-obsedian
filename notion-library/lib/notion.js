const API = 'https://api.notion.com/v1';
const VERSION = '2026-03-11';
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
export class LibraryError extends Error { constructor(message, status = 502) { super(message); this.status = status; } }
const richText = (items) => (items || []).map(item => item.plain_text ?? item.text?.content ?? '').join('');
function propertyText(prop) { if (!prop) return ''; if (prop.type === 'title') return richText(prop.title); if (prop.type === 'rich_text') return richText(prop.rich_text); if (prop.type === 'url') return prop.url || ''; return ''; }
export function mapRow(page) {
  const p = page.properties || {};
  for (const key of ['Name','URL','Tags','Note','Saved']) if (!(key in p)) throw new LibraryError(`The data source is missing the existing ${key} column. Check NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID; do not rename your table columns.`, 422);
  return {
    id: page.id,
    Name: propertyText(p.Name) || 'Untitled',
    URL: propertyText(p.URL),
    Tags: p.Tags.type === 'multi_select' ? (p.Tags.multi_select || []).map(tag => tag.name) : p.Tags.type === 'select' ? (p.Tags.select ? [p.Tags.select.name] : []) : [],
    Note: propertyText(p.Note),
    ...(p.Concept ? {Concept: p.Concept.type === 'select' ? p.Concept.select?.name || '' : propertyText(p.Concept)} : {}),
    ...(p.Subconcept ? {Subconcept: p.Subconcept.type === 'select' ? p.Subconcept.select?.name || '' : propertyText(p.Subconcept)} : {}),
    Saved: p.Saved.type === 'date' ? p.Saved.date?.start || null : p.Saved.type === 'created_time' ? p.Saved.created_time : p.Saved.type === 'last_edited_time' ? p.Saved.last_edited_time : null
  };
}
export async function loadLibrary({ token, databaseId, dataSourceId, fetchImpl = fetch }) {
  if (!token) throw new LibraryError('Set NOTION_TOKEN in Vercel to connect your library.', 503);
  if (!dataSourceId && !databaseId) throw new LibraryError('Set NOTION_DATABASE_ID in Vercel to select my-brain.', 503);
  if ((databaseId && !UUID.test(databaseId)) || (dataSourceId && !UUID.test(dataSourceId))) throw new LibraryError('The Notion database or data source ID must be a UUID.', 503);
  const deadline = AbortSignal.timeout(45000);
  async function request(path, body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetchImpl(`${API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
        ...(body ? {body:JSON.stringify(body)} : {}), signal: deadline
      });
      if (response.status === 429 && attempt < 2) { const seconds = Math.min(5, Math.max(1, Number(response.headers.get('retry-after')) || 1)); await new Promise(resolve => setTimeout(resolve, seconds * 1000)); continue; }
      if (!response.ok) {
        if (response.status === 401) throw new LibraryError('The Notion token is invalid. Update NOTION_TOKEN in Vercel.', 503);
        if (response.status === 403 || response.status === 404) throw new LibraryError('The Notion connection cannot read my-brain. Grant it access to this database and check the database ID.', 503);
        throw new LibraryError('Notion is temporarily unavailable. Try refreshing in a minute.', 502);
      }
      return response.json();
    }
  }
  let sourceId = dataSourceId;
  if (!sourceId) {
    const database = await request(`/databases/${encodeURIComponent(databaseId)}`);
    if (database.data_sources?.length !== 1) throw new LibraryError('Select the correct data source with NOTION_DATA_SOURCE_ID. The database must contain exactly one source for automatic selection.', 422);
    sourceId = database.data_sources[0].id;
    if (!UUID.test(sourceId)) throw new LibraryError('Notion returned an invalid data source ID.');
  }
  const schema = await request(`/data_sources/${encodeURIComponent(sourceId)}`);
  if (!schema.properties || typeof schema.properties !== 'object') throw new LibraryError('Notion returned an unexpected data source schema.');
  for (const key of ['Name','URL','Tags','Note','Saved']) if (!(key in schema.properties)) throw new LibraryError(`The data source is missing the existing ${key} column. Check your database connection.`, 422);
  const concepts = schema.properties.Concept?.type === 'select'
    ? (schema.properties.Concept.select?.options || []).map(option => option.name).filter(name => typeof name === 'string' && name.trim())
    : [];
  const rows = []; let cursor; let pages = 0;
  do {
    if (++pages > 50) throw new LibraryError('This collection is too large to load in one request. Add incremental sync before displaying more than 5,000 rows.', 422);
    if (pages > 1) await new Promise(resolve => setTimeout(resolve, 350));
    const result = await request(`/data_sources/${encodeURIComponent(sourceId)}/query`, {page_size:100,...(cursor ? {start_cursor:cursor} : {})});
    if (!Array.isArray(result.results)) throw new LibraryError('Notion returned an unexpected query response.');
    for (const page of result.results) if (page.object === 'page' && !page.in_trash && !page.archived && !page.is_archived) rows.push(mapRow(page));
    if (result.has_more && !result.next_cursor) throw new LibraryError('Notion returned incomplete pagination. Please try again.');
    if (result.request_status?.incomplete_reason) throw new LibraryError('Notion returned a partial collection. Please try again or add incremental sync.', 422);
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);
  return { rows, concepts, source: 'notion', syncedAt: new Date().toISOString() };
}
