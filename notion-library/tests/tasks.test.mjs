import test from 'node:test';
import assert from 'node:assert/strict';
import {taskClient as makeTaskClient, validateTask} from '../lib/tasks.js';
import handler from '../api/tasks.js';
const source = '22222222-2222-4222-8222-222222222222';
const taskClient = options => makeTaskClient({dataSourceId: source, ...options});
const id = '11111111-1111-4111-8111-111111111111';
const schema = {properties: Object.fromEntries(Object.entries({Name:'title', Status:'status', Priority:'select', Due:'date', Notes:'rich_text', Link:'url'}).map(([name,type])=>[name,{type,...(name==='Status'?{status:{options:['To do','In progress','Done'].map(name=>({name}))}}:{})}]))};
const page = (status='To do', parent=source) => ({object:'page',id,parent:{type:'data_source_id',data_source_id:parent},properties:{Name:{title:[{plain_text:'Build something'}]},Status:{status:{name:status}},Priority:{select:null},Due:{date:null},Notes:{rich_text:[]},Link:{url:null}}});
test('the task source must be configured on the server',()=>{
  assert.throws(()=>makeTaskClient({token:'fixture'}),error=>error.status===503&&error.message.includes('NOTION_TASKS_DATA_SOURCE_ID'));
});
test('invalid dates, links and empty names fail before network access',async()=>{
  for(const input of [{name:' '},{name:'A',due:'2026-02-30'},{name:'A',link:'javascript:alert(1)'},{name:'A',status:'Missing'},{name:'A',notes:'x'.repeat(2001)}]) assert.throws(()=>validateTask(input),error=>error.status===400);
  let calls=0; const client=taskClient({token:'fixture',fetchImpl:async()=>{calls++;}});
  await assert.rejects(client.create({name:'',status:'To do'})); assert.equal(calls,0);
});
test('creating tasks writes only into the configured task source',async()=>{
  const calls=[];
  const client=taskClient({token:'fixture',fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(options.method==='GET'?schema:page());}});
  const task=await client.create({name:' Build something ',priority:'High',due:'2026-12-01',notes:'Context',link:'https://example.com'});
  assert.equal(task.name,'Build something'); assert.equal(calls.length,2);
  const body=JSON.parse(calls[1].options.body);assert.deepEqual(body.parent,{type:'data_source_id',data_source_id:source});assert.deepEqual(body.properties.Status,{status:{name:'To do'}});assert.equal(body.properties.Notes.rich_text[0].text.content,'Context');assert.ok(!('children' in body));
});
test('moving a task patches only status and preserves all other properties',async()=>{
  const calls=[];
  const client=taskClient({token:'fixture',fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(url.includes('/data_sources/')?schema:page(options.method==='PATCH'?'Done':'To do'));}});
  const task=await client.update(id,{status:'Done'});assert.equal(task.status,'Done');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body),{properties:{Status:{status:{name:'Done'}}}});
});
test('a task from another database cannot be changed through this endpoint',async()=>{
  const methods=[];
  const client=taskClient({token:'fixture',fetchImpl:async(url,options)=>{methods.push(options.method);return Response.json(url.includes('/data_sources/')?schema:page('To do',id));}});
  await assert.rejects(client.update(id,{status:'Done'}),error=>error.status===404);assert.deepEqual(methods,['GET','GET']);
});
test('updates support clearing optional values without replacing task content',async()=>{
  let body;
  const client=taskClient({token:'fixture',fetchImpl:async(url,options)=>{if(options.method==='PATCH')body=JSON.parse(options.body);return Response.json(url.includes('/data_sources/')?schema:page());}});
  await client.update(id,{due:'',priority:'',notes:'',link:''});assert.deepEqual(body.properties,{Priority:{select:null},Due:{date:null},Notes:{rich_text:[]},Link:{url:null}});
});
test('loading follows pagination and omits archived tasks',async()=>{
  let queries=0;
  const client=taskClient({token:'fixture',fetchImpl:async(url,options)=>{if(options.method==='GET')return Response.json(schema);queries++;const body=JSON.parse(options.body);if(queries===2)assert.equal(body.start_cursor,'next');return Response.json({results:queries===1?[page(),{...page(),archived:true}]:[page('Done')],has_more:queries===1,next_cursor:queries===1?'next':null});}});
  const data=await client.list();assert.equal(data.rows.length,2);assert.equal(queries,2);assert.deepEqual(data.statuses,['To do','In progress','Done']);
});
test('partial pagination and changed schemas are explicit errors',async()=>{
  await assert.rejects(taskClient({token:'fixture',fetchImpl:async(url,options)=>Response.json(options.method==='GET'?schema:{results:[],has_more:true})}).list(),/incomplete/);
  await assert.rejects(taskClient({token:'fixture',fetchImpl:async()=>Response.json({properties:{}})}).list(),error=>error.status===422);
});
test('permission failures never leak the token or retry a write',async()=>{
  const methods=[];
  const client=taskClient({token:'secret-fixture',fetchImpl:async(url,options)=>{methods.push(options.method);return options.method==='GET'?Response.json(schema):Response.json({secret:'secret-fixture'},{status:403});}});
  await assert.rejects(client.create({name:'A'}),error=>error.status===503&&!error.message.includes('secret-fixture'));assert.deepEqual(methods,['GET','POST']);
});
test('all task methods require the edit key, including reads',async()=>{
  const old=process.env.LIBRARY_EDIT_KEY;process.env.LIBRARY_EDIT_KEY='fixture-key-at-least-16';
  try{for(const method of ['GET','POST','PATCH']){let status,result;const headers={};const res={setHeader(k,v){headers[k]=v;},status(v){status=v;return this;},json(v){result=v;}};await handler({method,headers:{authorization:'Bearer wrong'},body:{name:'A'}},res);assert.equal(status,401);assert.equal(result.error,'The library edit key is incorrect.');assert.equal(headers['Cache-Control'],'private, no-store');}}
  finally{if(old===undefined)delete process.env.LIBRARY_EDIT_KEY;else process.env.LIBRARY_EDIT_KEY=old;}
});
