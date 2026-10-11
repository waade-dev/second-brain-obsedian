import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotionBook,validateBookName} from '../lib/book-writer.js';
import handler from '../api/books.js';
const source='38aab648-4e24-80fb-9d96-c3c7f555d2f6';
const schema={properties:{Concept:{type:'select',select:{options:[{id:'old-1',name:'AI & Machine Learning',color:'purple',description:'Keep this'}]}},Subconcept:{type:'select',select:{options:[{id:'chapter-1',name:'Research',color:'green'}]}},Name:{type:'title',title:{}},Saved:{type:'date',date:{}}}};
test('creates only concept/chapter options and retains all existing IDs and row fields',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});if(options.method==='GET')return Response.json(schema);return Response.json({properties:{Concept:{select:{options:[...schema.properties.Concept.select.options,{name:'Design'}]}}}});};
  const result=await createNotionBook({name:' Design ',chapter:'Typography',token:'fixture',dataSourceId:source,fetchImpl});
  assert.deepEqual(result,{name:'Design',chapter:'Typography',concepts:['AI & Machine Learning','Design']});assert.equal(calls.length,2);
  const update=JSON.parse(calls[1].options.body);assert.deepEqual(Object.keys(update.properties),['Concept','Subconcept']);
  assert.deepEqual(update.properties.Concept.select.options,[{id:'old-1'},{name:'Design',color:'default'}]);assert.deepEqual(update.properties.Subconcept.select.options,[{id:'chapter-1'},{name:'Typography',color:'default'}]);assert.ok(!calls.some(call=>call.url.includes('/pages')));
});
test('a duplicate name is rejected before any write',async()=>{const calls=[];await assert.rejects(createNotionBook({name:' ai & machine learning ',token:'fixture',dataSourceId:source,fetchImpl:async(url,options)=>{calls.push(options.method);return Response.json(schema);}}),error=>error.status===409);assert.deepEqual(calls,['GET']);});
test('an existing chapter option is reused without replacing its settings',async()=>{let body;await createNotionBook({name:'Design',chapter:'research',token:'fixture',dataSourceId:source,fetchImpl:async(url,options)=>{if(options.method==='GET')return Response.json(schema);body=JSON.parse(options.body);return Response.json({properties:{Concept:{select:{options:[{name:'Design'}]}}}});}});assert.ok(!('Subconcept' in body.properties));});
test('invalid names and missing credentials fail before writing',async()=>{assert.throws(()=>validateBookName('a,b'),/commas/);assert.throws(()=>validateBookName(' '),/1–80/);await assert.rejects(createNotionBook({name:'Design'}),/NOTION_TOKEN/);});
test('creation refuses to convert an existing column format',async()=>{const calls=[];await assert.rejects(createNotionBook({name:'Design',token:'fixture',dataSourceId:source,fetchImpl:async(url,options)=>{calls.push(options.method);return Response.json({properties:{Concept:{type:'rich_text'}}});}}),/Select format/);assert.deepEqual(calls,['GET']);});
test('the public write endpoint rejects missing or incorrect edit keys',async()=>{
  const previous=process.env.LIBRARY_EDIT_KEY;process.env.LIBRARY_EDIT_KEY='test-edit-key-at-least-16';
  try{for(const authorization of ['', 'Bearer wrong-key']){let status,result;const res={setHeader(){},status(value){status=value;return this;},json(value){result=value;return this;}};await handler({method:'POST',headers:{authorization},body:{name:'Design'}},res);assert.equal(status,401);assert.equal(result.error,'The library edit key is incorrect.');}}finally{if(previous===undefined)delete process.env.LIBRARY_EDIT_KEY;else process.env.LIBRARY_EDIT_KEY=previous;}
});
