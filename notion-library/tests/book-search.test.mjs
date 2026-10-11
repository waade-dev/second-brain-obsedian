import test from 'node:test';
import assert from 'node:assert/strict';
import {groupBooks,normalizeRows,searchBook} from '../public/library-model.js';
const book=groupBooks(normalizeRows([{Name:'Training models',Note:'Helpful reinforcement learning guide',URL:'https://example.com',Concept:'AI',Subconcept:'Training',Tags:['deep-learning']},{Name:'Foundation models',Note:'Research paper',Concept:'AI',Subconcept:'Research',Tags:['papers']}]))[0];
test('book search matches chapters plus article titles, notes and original tags',()=>{assert.deepEqual(searchBook(book,'training').chapters,['Training']);assert.equal(searchBook(book,'reinforcement').rows[0].Name,'Training models');assert.equal(searchBook(book,'deep-learning').rows.length,1);assert.equal(searchBook(book,'foundation').rows[0].Subconcept,'Research');});
test('all query words must match, regardless of their order or case',()=>{assert.equal(searchBook(book,'GUIDE reinforcement').rows.length,1);assert.equal(searchBook(book,'guide papers').rows.length,0);});
test('no matches return an empty result without changing the book',()=>{assert.deepEqual(searchBook(book,'no-such-concept'),{chapters:[],rows:[]});assert.equal(book.rows.length,2);});
