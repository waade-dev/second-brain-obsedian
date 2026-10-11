import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCollection} from '../public/library-data.js';

test('snapshot refresh reloads newly captured concepts and rows instead of keeping the first snapshot',async()=>{
  const calls=[];let version=0;
  const fetchImpl=async(url,options)=>{calls.push({url,options});return url.startsWith('/api/')?Response.json({error:'Set NOTION_TOKEN'},{status:503}):Response.json({rows:[{Name:`Save ${++version}`}],concepts:[`Concept ${version}`]});};
  const first=await fetchCollection({fetchImpl});const second=await fetchCollection({fetchImpl,fresh:true});
  assert.equal(first.rows[0].Name,'Save 1');assert.equal(second.rows[0].Name,'Save 2');assert.deepEqual(second.concepts,['Concept 2']);assert.equal(second.live,false);assert.equal(second.connectionError,'Set NOTION_TOKEN');assert.equal(calls[2].url,'/api/library?fresh=1');assert.ok(calls.every(c=>c.options.cache==='no-store'));
});
test('a connected collection is retained during outages instead of being replaced by an old snapshot',async()=>{
  const calls=[];const fetchImpl=async url=>{calls.push(url);return Response.json({error:'Notion unavailable'},{status:503});};
  await assert.rejects(fetchCollection({fetchImpl,live:true}),/Notion unavailable/);assert.deepEqual(calls,['/api/library']);
});
test('a configured connection returns live rows and new schema options',async()=>{
  const data=await fetchCollection({fetchImpl:async()=>Response.json({rows:[{Name:'New live save'}],concepts:['Physics']})});
  assert.equal(data.live,true);assert.equal(data.connectionError,'');assert.deepEqual(data.concepts,['Physics']);
});
