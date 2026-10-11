import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLibrary, mapRow } from '../lib/notion.js';
const db='38aab648-4e24-80fb-9d96-c3c7f555d2f5';
const source='38aab648-4e24-80fb-9d96-c3c7f555d2f6';
const row={object:'page',id:'row-1',properties:{Name:{type:'title',title:[{plain_text:'A title'}]},URL:{type:'url',url:'https://example.com'},Tags:{type:'multi_select',multi_select:[{name:'big'},{name:'brains'}]},Note:{type:'rich_text',rich_text:[{plain_text:'Keep this'}]},Saved:{type:'date',date:{start:'2026-08-29'}}}};
test('preserves the extension’s existing names, tags, notes, and save date',()=>{assert.deepEqual(mapRow(row),{id:'row-1',Name:'A title',URL:'https://example.com',Tags:['big','brains'],Note:'Keep this',Saved:'2026-08-29'});});
test('reads all pages and never uses a mutation endpoint',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.includes('/databases/'))return Response.json({data_sources:[{id:source}]});if(!url.endsWith('/query'))return Response.json({properties:{...row.properties,Concept:{type:'select',select:{options:[{name:'Physics'}]}}}});return Response.json({results:[{...row,id:`row-${calls.length}`}],has_more:calls.length===3,next_cursor:calls.length===3?'next':null});};
  const data=await loadLibrary({token:'test-token',databaseId:db,fetchImpl});
  assert.equal(data.rows.length,2);assert.equal(calls.length,4);assert.equal(calls[0].options.method,'GET');assert.equal(calls[1].options.method,'GET');
  assert.ok(calls.slice(2).every(c=>c.url.endsWith('/query')&&c.options.method==='POST'));
  assert.equal(JSON.parse(calls[3].options.body).start_cursor,'next');assert.deepEqual(data.concepts,['Physics']);assert.ok(!JSON.stringify(data).includes('test-token'));
});
test('requires explicit selection when the database has multiple sources',async()=>{await assert.rejects(loadLibrary({token:'test-token',databaseId:db,fetchImpl:async()=>Response.json({data_sources:[{id:source},{id:db}]})}),/NOTION_DATA_SOURCE_ID/);});
test('rejects missing configuration and a mismatched schema instead of hiding them',async()=>{await assert.rejects(loadLibrary({}),/NOTION_TOKEN/);assert.throws(()=>mapRow({properties:{}}),/Name column/);});
test('reports inaccessible Notion data without exposing API credentials',async()=>{await assert.rejects(loadLibrary({token:'secret-test-token',databaseId:db,fetchImpl:async()=>new Response('',{status:404})}),error=>error.status===503&&!error.message.includes('secret-test-token')&&error.message.includes('Grant it access'));});
