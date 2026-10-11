export const CONCEPTS = [
  { name:'AI & Machine Learning', subtitle:'Models, ideas & experiments', symbol:'✳', colour:'#78659f', dark:'#a38bbf', description:'From the first experiment to the next foundation model.', chapters:['Training','Foundation Models','Research','Roadmaps'] },
  { name:'Systems & Backend', subtitle:'The architecture of things', symbol:'⌘', colour:'#627d68', dark:'#92aa8e', description:'The patterns and decisions behind well-built systems.', chapters:['Databases','Low-Level Design','System Design'] },
  { name:'Algorithms', subtitle:'Patterns worth understanding', symbol:'◇', colour:'#b08455', dark:'#d2b17d', description:'A collection of small ideas that solve big problems.', chapters:['Dynamic Programming','Data Structures','Problem Solving'] },
  { name:'People & Learning', subtitle:'Good minds. New directions.', symbol:'✦', colour:'#6b8194', dark:'#96adc3', description:'People to follow, paths to explore, and things to learn.', chapters:['Profiles','Learning Logs'] }
];
export function hash(text) { return [...String(text)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0); }
export function safeURL(value) { try { const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null; } catch{return null;} }
export function hostname(value) { try {return new URL(value).hostname.replace(/^www\./,'');}catch{return 'Saved article';} }
export function legacyClassification(row) {
  const tags=(row.Tags||[]).join(' ').toLowerCase(), title=String(row.Name||'').toLowerCase();
  if(/letsgo-dp|dynamic programming|best dp/.test(tags+' '+title))return ['Algorithms','Dynamic Programming'];
  if(/bknd-research|hermitage|database/.test(tags+' '+title))return ['Systems & Backend','Databases'];
  if(/go-lld|elevator|low-level/.test(tags+' '+title))return ['Systems & Backend','Low-Level Design'];
  if(/kill-lld|hello interview|system.design/.test(tags+' '+title))return ['Systems & Backend','System Design'];
  if(/papers/.test(tags+' '+title))return ['AI & Machine Learning','Research'];
  if(/roadmap/.test(title))return ['AI & Machine Learning','Roadmaps'];
  if(/train-ai|marin/.test(tags+' '+title))return ['AI & Machine Learning','Foundation Models'];
  if(/ai-training|weights.*biases/.test(tags+' '+title))return ['AI & Machine Learning','Training'];
  if(/what-im-learning/.test(title))return ['People & Learning','Learning Logs'];
  if(/big.brains|github/.test(tags+' '+title))return ['People & Learning','Profiles'];
  return ['Unsorted','General'];
}
export function normalizeRows(rows) {
  if(!Array.isArray(rows))throw new Error('The library response must contain rows.');
  return rows.map((r,i)=>{const legacy=legacyClassification(r);return {id:String(r.id||`row-${i}`),Name:String(r.Name||'Untitled'),URL:String(r.URL||''),Tags:Array.isArray(r.Tags)?r.Tags.map(String):[],Note:String(r.Note||''),Saved:r.Saved||null,Concept:Object.hasOwn(r,'Concept')?String(r.Concept||'Unsorted'):legacy[0],Subconcept:Object.hasOwn(r,'Subconcept')?String(r.Subconcept||'General'):legacy[1]};});
}
export function matchesSearch(row,query) {return [row.Name,row.URL,row.Note,row.Concept,row.Subconcept,...row.Tags].join(' ').toLowerCase().includes(query.toLowerCase().trim());}
export function normalizeConcepts(concepts) {return Array.isArray(concepts)?[...new Set(concepts.filter(name=>typeof name==='string'&&name.trim()))]:[];}
export function searchBook(book,query) {
  const terms=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match=text=>terms.every(term=>text.toLowerCase().includes(term));
  return {chapters:book.chapters.filter(chapter=>match(chapter)),rows:book.rows.filter(row=>match([row.Name,row.URL,row.Note,row.Subconcept,...row.Tags].join(' ')))};
}
function bookMetadata(name) {
  const known=CONCEPTS.find(c=>c.name===name);if(known)return known;
  const palettes=[['#8b7f8f','#b3a5b8'],['#587b85','#93b6bf'],['#8a7059','#c5a888'],['#7b805d','#b2bb91'],['#986965','#cf9f98']];
  const [colour,dark]=palettes[hash(name)%palettes.length];
  return {name,subtitle:'A collection of your own',symbol:'❋',colour,dark,description:'A home for your saved ideas.',chapters:[]};
}
export function groupBooks(rows, {query='',concept='All',tag='All',sort='topic',concepts=[]}={}) {
  const groups=new Map();
  if(tag==='All')for(const name of normalizeConcepts(concepts)){if(concept!=='All'&&name!==concept)continue;if(query&&!name.toLowerCase().includes(query.toLowerCase().trim()))continue;groups.set(name,{...bookMetadata(name),rows:[],chapters:[]});}
  for(const row of rows){if(concept!=='All'&&row.Concept!==concept)continue;if(tag!=='All'&&!row.Tags.includes(tag))continue;if(!matchesSearch(row,query))continue;let group=groups.get(row.Concept);if(!group){group={...bookMetadata(row.Concept),rows:[],chapters:[]};groups.set(row.Concept,group);}group.rows.push(row);}
  const books=[...groups.values()];
  for(const book of books){const configured=CONCEPTS.find(c=>c.name===book.name)?.chapters||[];book.chapters=[...new Set(book.rows.map(r=>r.Subconcept))].sort((a,b)=>{const ia=configured.indexOf(a),ib=configured.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b);});book.rows.sort((a,b)=>sort==='title'?a.Name.localeCompare(b.Name):(Date.parse(b.Saved)||0)-(Date.parse(a.Saved)||0));}
  books.sort((a,b)=>sort==='recent'?Math.max(0,...b.rows.map(r=>Date.parse(r.Saved)||0))-Math.max(0,...a.rows.map(r=>Date.parse(r.Saved)||0))||a.name.localeCompare(b.name):sort==='title'?a.name.localeCompare(b.name):sort==='colour'?a.colour.localeCompare(b.colour):(CONCEPTS.findIndex(c=>c.name===a.name)<0?999:CONCEPTS.findIndex(c=>c.name===a.name))-(CONCEPTS.findIndex(c=>c.name===b.name)<0?999:CONCEPTS.findIndex(c=>c.name===b.name))||a.name.localeCompare(b.name));
  return books;
}
