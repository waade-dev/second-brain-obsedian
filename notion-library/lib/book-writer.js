import {LibraryError} from './notion.js';
const UUID=/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
export function validateBookName(value,label='Book name') {
  if(typeof value!=='string')throw new LibraryError(`${label} is required.`,400);
  const name=value.trim().replace(/\s+/g,' ');
  if(!name||name.length>80||/[\u0000-\u001f,]/.test(name))throw new LibraryError(`${label} must be 1–80 characters and cannot contain commas.`,400);
  return name;
}
const sameName=(a,b)=>a.trim().toLowerCase()===b.trim().toLowerCase();
export async function createNotionBook({name,chapter='',token,databaseId,dataSourceId,fetchImpl=fetch}) {
  name=validateBookName(name);chapter=chapter.trim()?validateBookName(chapter,'Chapter name'):'';
  if(!token)throw new LibraryError('Add NOTION_TOKEN to your server configuration to save books to Notion.',503);
  if(!dataSourceId&&!databaseId)throw new LibraryError('Set NOTION_DATABASE_ID to select your library.',503);
  if((databaseId&&!UUID.test(databaseId))||(dataSourceId&&!UUID.test(dataSourceId)))throw new LibraryError('Check your Notion database or data source ID.',503);
  const signal=AbortSignal.timeout(40000);
  async function request(path,body) {
    const response=await fetchImpl(`https://api.notion.com/v1${path}`,{method:body?'PATCH':'GET',headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2026-03-11','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal});
    if(!response.ok){if(response.status===403)throw new LibraryError('Give the Notion integration Update content permission to add books.',503);if(response.status===401||response.status===404)throw new LibraryError('The Notion connection cannot edit this library. Check its token and database access.',503);throw new LibraryError('Notion could not save the book. Please try again.',502);}
    return response.json();
  }
  let sourceId=dataSourceId;
  if(!sourceId){const db=await request(`/databases/${encodeURIComponent(databaseId)}`);if(db.data_sources?.length!==1)throw new LibraryError('Set NOTION_DATA_SOURCE_ID to select the library’s data source.',422);sourceId=db.data_sources[0].id;}
  if(!UUID.test(sourceId))throw new LibraryError('Notion returned an invalid data source ID.');
  const schema=await request(`/data_sources/${encodeURIComponent(sourceId)}`);
  const concept=schema.properties?.Concept,subconcept=schema.properties?.Subconcept;
  if(concept?.type!=='select'||(chapter&&subconcept?.type!=='select'))throw new LibraryError('Concept and Subconcept must keep their existing Select format.',422);
  const existing=concept.select?.options||[];
  if(existing.some(option=>sameName(option.name,name)))throw new LibraryError('A book with that name already exists. Open it from your shelf.',409);
  // Retain every option by ID so names, colours, descriptions and row values stay intact.
  const retain=options=>options.map(option=>option.id?{id:option.id}:{name:option.name});
  const properties={Concept:{select:{options:[...retain(existing),{name,color:'default'}]}}};
  const chapters=subconcept?.select?.options||[];
  if(chapter&&!chapters.some(option=>sameName(option.name,chapter)))properties.Subconcept={select:{options:[...retain(chapters),{name:chapter,color:'default'}]}};
  const updated=await request(`/data_sources/${encodeURIComponent(sourceId)}`,{properties});
  const concepts=(updated.properties?.Concept?.select?.options||[]).map(option=>option.name);
  const savedName=concepts.find(option=>sameName(option,name));
  if(!savedName)throw new LibraryError('Could not confirm the new book. Refresh Notion before trying again.',502);
  return {name:savedName,chapter,concepts};
}
