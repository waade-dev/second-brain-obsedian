import {CONCEPTS,safeURL,hostname,normalizeRows,normalizeConcepts,groupBooks,searchBook} from './library-model.js';
import {animateBookOpening} from './book-motion.js';
import {fetchCollection} from './library-data.js';
const $=id=>document.getElementById(id);
const state={rows:[],concepts:[],concept:'All',tag:'All',query:'',sort:'topic',view:'shelf',live:false,fetching:false,lastSync:null,capturedAt:null,connectionError:'',error:'',openBook:null,chapter:null,bookQuery:''};
function el(type,className,text){const node=document.createElement(type);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function plural(number,word){return `${number} ${word}${number===1?'':'s'}`;}
function allBooks(){return groupBooks(state.rows,{concepts:state.concepts});}
function visibleBooks(){return groupBooks(state.rows,{query:state.query,concept:state.concept,tag:state.tag,sort:state.sort,concepts:state.concepts});}
function addStyles(node,book){node.style.setProperty('--cover',book.colour);node.style.setProperty('--cover-light',book.dark);}
function makeCover(book,index){
  const button=el('button',`concept-book cover-style-${index%4}`);addStyles(button,book);button.setAttribute('aria-label',`Open ${book.name}, ${plural(book.chapters.length,'chapter')}, ${plural(book.rows.length,'article')}`);
  const face=el('span','book-cover');face.append(el('span','cover-volume',`THE SECOND BRAIN COLLECTION / ${String(index+1).padStart(2,'0')}`));
  const ornament=el('span','cover-ornament',book.symbol);ornament.setAttribute('aria-hidden','true');face.append(ornament,el('span','cover-title',book.name),el('span','cover-subtitle',book.subtitle));
  const foot=el('span','cover-footer');foot.append(el('span','',plural(book.chapters.length,'chapter')),el('span','',`${book.rows.length} SAVED ${book.rows.length === 1 ? "FIND" : "FINDS"}`));face.append(foot);
  const spine=el('span','cover-spine');spine.setAttribute('aria-hidden','true');const pages=el('span','cover-pages');pages.setAttribute('aria-hidden','true');
  button.append(pages,spine,face);button.addEventListener('click',()=>openBook(book.name,button));return button;
}
function renderFilters(){
  $('filters').replaceChildren();
  for(const [name,count] of [['All',state.rows.length],...allBooks().map(book=>[book.name,book.rows.length])]){const button=el('button',`tag-pill${state.concept===name?' active':''}`);button.setAttribute('aria-pressed',String(state.concept===name));if(name!=='All'){const meta=CONCEPTS.find(c=>c.name===name);button.append(el('span','tag-symbol',meta?.symbol||'❋'));}button.append(el('span','',name==='All'?'All books':name),el('span','tag-count',count));button.addEventListener('click',()=>{state.concept=name;render();});$('filters').append(button);}
}
function makeSpine(book,index){
  const button=el('button',`book concept-book shelf-spine ${['banded','label','italic','banded'][index%4]}`);addStyles(button,book);
  const description=`Open ${book.name}, ${plural(book.chapters.length,'chapter')}, ${plural(book.rows.length,'article')}`;
  button.setAttribute('aria-label',description);button.title=description;
  button.style.setProperty('--book-colour',book.colour);
  button.style.setProperty('--book-width',`${[76,90,70,82][index%4]}px`);
  button.style.setProperty('--book-height',`${[286,312,272,300][index%4]}px`);
  const symbol=el('span','book-symbol',book.symbol);symbol.setAttribute('aria-hidden','true');
  button.append(symbol,el('span','book-title',book.name),el('span','imprint',`${book.rows.length} ${book.rows.length===1?'find':'finds'}`));
  button.addEventListener('click',()=>openBook(book.name,button));return button;
}
function renderBooks(){
  const books=visibleBooks(),count=books.reduce((n,book)=>n+book.rows.length,0);
  $('collection').replaceChildren();$('result-count').textContent=`${plural(books.length,'book')} · ${plural(count,'article')}`;
  $('collection-title').textContent=state.query?'Your discoveries':state.concept==='All'?'A shelf for every curiosity':state.concept;
  $('collection-hint').textContent='PICK A SPINE. OPEN A BOOK.';
  if(!books.length){const empty=el('div','empty-state');empty.append(el('span','empty-icon','⌕'),el('h3','','A little room for curiosity.'),el('p','',state.rows.length?'No matches. Try another concept, tag, or search.':'Save your first link with the extension to start a chapter.'));if(state.rows.length){const clear=el('button','','Show all books');clear.addEventListener('click',()=>{state.query='';state.concept='All';state.tag='All';$('search').value='';$('tag-select').value='All';render();});empty.append(clear);}$('collection').append(empty);return;}
  if(state.view==='shelf'){const shelf=el('div','concept-shelf');const track=el('div','book-track concept-spine-track');track.setAttribute('aria-label','Concept books on the shelf');track.append(...books.map(makeSpine));const bookend=el('span','bookend');bookend.setAttribute('aria-hidden','true');track.append(bookend);shelf.append(track,el('div','shelf-wood'));const caption=el('div','shelf-caption');caption.append(el('span','shelf-name','✦  Pick a spine. There’s something good inside.'),el('span','shelf-number','VOLUME ONE · ALWAYS GROWING'));shelf.append(caption);$('collection').append(shelf);}
  else {const grid=el('div','concept-index');for(const [i,book]of books.entries()){const card=el('article','index-card');addStyles(card,book);const top=el('div','index-top');top.append(el('span','index-symbol',book.symbol),el('span','index-volume',`VOL. ${String(i+1).padStart(2,'0')}`));card.append(top,el('h3','',book.name),el('p','',book.description));const chapters=el('div','index-chapters');if(!book.chapters.length){const open=el('button','index-chapter','Open this book ↗');open.addEventListener('click',()=>openBook(book.name,open));chapters.append(open);}for(const [j,chapter]of book.chapters.entries()){const button=el('button','index-chapter');button.append(el('span','',`${String(j+1).padStart(2,'0')}  ${chapter}`),el('span','',String(book.rows.filter(row=>row.Subconcept===chapter).length)));button.addEventListener('click',()=>openBook(book.name,button,chapter));chapters.append(button);}card.append(chapters);grid.append(card);}$('collection').append(grid);}
}
function render(){
  const books=allBooks();$('stats').replaceChildren();for(const [i,[value,label]]of [[books.length,'concept books'],[state.rows.length,'saved finds'],[books.reduce((n,b)=>n+b.chapters.length,0),'chapters']].entries()){if(i)$('stats').append(el('span','stat-divider'));const stat=el('span');stat.append(el('strong','',value),document.createTextNode(` ${label}`));$('stats').append(stat);}
  renderFilters();const selected=state.tag;$('tag-select').replaceChildren(new Option('All original tags','All'));for(const tag of [...new Set(state.rows.flatMap(r=>r.Tags))].sort())$('tag-select').append(new Option(tag,tag));$('tag-select').value=selected;
  for(const [id,value]of [['shelf-view','shelf'],['topics-view','topics']]){$(id).classList.toggle('active',state.view===value);$(id).setAttribute('aria-pressed',String(state.view===value));}
  renderBooks();renderStatus();if($('book-dialog').open)renderOpenBook();
}
function renderStatus(){$('connection-button').classList.toggle('live',state.live&&!state.error);$('connection-label').textContent=state.error&&state.live?'Sync paused':state.live?'Connected to Notion':'Live sync off';$('sync-message').textContent=state.error||(state.live?`Last checked ${new Date(state.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}. New saves arrive automatically while this page is open.`:`Snapshot mode · ${plural(state.rows.length,'saved article')}${state.capturedAt?` · captured ${new Date(state.capturedAt).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'})}`:''}. New Notion changes need a live connection.`);}
function currentBook(){return allBooks().find(book=>book.name===state.openBook);}
let returnFocus, cancelBookMotion;
function openBook(name,trigger,chapter=null){cancelBookMotion?.();state.openBook=name;state.chapter=chapter;state.bookQuery='';$('book-search').value='';returnFocus=trigger;const dialog=$('book-dialog');renderOpenBook();if(!dialog.open)dialog.showModal();const book=currentBook();const fallback=makeCover(book,allBooks().findIndex(item=>item.name===name));if(!trigger.matches('.concept-book')){fallback.classList.add('motion-source');document.body.append(fallback);}cancelBookMotion=animateBookOpening(dialog,trigger,fallback);fallback.remove();}
function renderOpenBook(){
  const book=currentBook(),dialog=$('book-dialog');if(!book){dialog.close();return;}addStyles(dialog,book);$('open-book-title').textContent=book.name;$('open-book-description').textContent=book.description;$('open-book-volume').textContent=`${plural(book.chapters.length,'chapter')} · ${plural(book.rows.length,'saved article')}`;$('open-book-symbol').textContent=book.symbol;
  if(state.chapter&&!book.chapters.includes(state.chapter))state.chapter=null;
  const chapterList=$('chapter-list');chapterList.replaceChildren();const all=el('button',`chapter-button${!state.chapter?' active':''}`);all.append(el('span','','Contents'),el('span','chapter-count',String(book.rows.length)));all.setAttribute('aria-pressed',String(!state.chapter));all.addEventListener('click',()=>chooseChapter(null));chapterList.append(all);
  for(const [i,chapter]of book.chapters.entries()){const button=el('button',`chapter-button${state.chapter===chapter?' active':''}`);button.append(el('span','chapter-number',String(i+1).padStart(2,'0')),el('span','chapter-name',chapter),el('span','chapter-count',String(book.rows.filter(r=>r.Subconcept===chapter).length)));button.setAttribute('aria-pressed',String(state.chapter===chapter));button.addEventListener('click',()=>chooseChapter(chapter));chapterList.append(button);}
  const page=$('book-page');page.replaceChildren();$('clear-book-search').hidden=!state.bookQuery;
  if(state.bookQuery.trim()){renderBookSearch(book,page);$('page-number').textContent='⌕';return;}
  if(!state.chapter){const title=el('div','page-heading');title.append(el('p','eyebrow','A MAP OF YOUR CURIOSITY'),el('h3','','The contents.'),el('p','page-intro',book.chapters.length?'Pick a chapter. There’s something good inside.':'Save a link to this concept in Notion to begin its first chapter.'));page.append(title);const contents=el('div','contents-list');for(const [i,chapter]of book.chapters.entries()){const button=el('button','contents-chapter');button.append(el('span','contents-number',String(i+1).padStart(2,'0')),el('span','contents-title',chapter),el('span','contents-dots'),el('span','contents-count',plural(book.rows.filter(r=>r.Subconcept===chapter).length,'find')),el('span','contents-arrow','↗'));button.addEventListener('click',()=>chooseChapter(chapter));contents.append(button);}page.append(contents,el('p','book-colophon','GOOD IDEAS DESERVE A PLACE TO LIVE.'));}
  else {const rows=book.rows.filter(row=>row.Subconcept===state.chapter);const heading=el('div','page-heading');heading.append(el('p','eyebrow',`CHAPTER ${String(book.chapters.indexOf(state.chapter)+1).padStart(2,'0')}`),el('h3','',state.chapter),el('p','page-intro',plural(rows.length,'saved find')));page.append(heading);const articles=el('div','chapter-articles');articles.append(...rows.map(row=>articleCard(row)));page.append(articles);}
  $('page-number').textContent=state.chapter?String(book.chapters.indexOf(state.chapter)+1).padStart(2,'0'):'00';
}
function highlighted(node,text,query=''){
  const terms=[...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a,b)=>b.length-a.length);
  if(!terms.length){node.textContent=text;return;}
  const pattern=new RegExp(terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi');
  let cursor=0;for(const match of text.matchAll(pattern)){node.append(document.createTextNode(text.slice(cursor,match.index)),el('mark','',match[0]));cursor=match.index+match[0].length;}node.append(document.createTextNode(text.slice(cursor)));
}
function articleCard(row,query='',showChapter=false){
  const article=el('article','saved-article');
  if(showChapter){const chapter=el('button','search-result-chapter',`Chapter ${row.Subconcept} →`);chapter.addEventListener('click',()=>chooseChapter(row.Subconcept));article.append(chapter);}
  const link=safeURL(row.URL),title=el(link?'a':'span','article-title');highlighted(title,row.Name,query);
  if(link){title.href=link;title.target='_blank';title.rel='noopener noreferrer';title.append(el('span','article-arrow','↗'));}
  const meta=el('div','article-meta');meta.append(el('span','',hostname(row.URL)));
  if(row.Saved){const date=new Date(row.Saved);if(!Number.isNaN(date.valueOf()))meta.append(el('span','',date.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'})));}
  article.append(title,meta);
  if(row.Note){const note=el('p','article-note');highlighted(note,row.Note,query);article.append(note);}
  if(row.Tags.length){const tags=el('div','article-tags');for(const tag of row.Tags){const chip=el('span');highlighted(chip,tag,query);tags.append(chip);}article.append(tags);}
  return article;
}
function renderBookSearch(book,page){
  const results=searchBook(book,state.bookQuery),heading=el('div','page-heading');
  heading.append(el('p','eyebrow','SEARCH THIS BOOK'),el('h3','','Found inside.'),el('p','page-intro',`${plural(results.chapters.length,'chapter')} · ${plural(results.rows.length,'saved find')}`));page.append(heading);
  if(results.chapters.length){const contents=el('div','contents-list search-chapters');for(const chapter of results.chapters){const button=el('button','contents-chapter');const title=el('span','contents-title');highlighted(title,chapter,state.bookQuery);button.append(title,el('span','contents-count',plural(book.rows.filter(row=>row.Subconcept===chapter).length,'find')),el('span','contents-arrow','→'));button.addEventListener('click',()=>chooseChapter(chapter));contents.append(button);}page.append(contents);}
  if(results.rows.length){const articles=el('div','chapter-articles');articles.append(...results.rows.map(row=>articleCard(row,state.bookQuery,true)));page.append(articles);}
  if(!results.chapters.length&&!results.rows.length){const empty=el('div','book-search-empty');empty.append(el('p','','No matches in this book. Try a chapter, title, note, or tag.'),el('p','field-hint','Words can appear in any order.'));page.append(empty);}
}
function chooseChapter(chapter){state.bookQuery='';$('book-search').value='';state.chapter=chapter;renderOpenBook();const page=$('book-page');page.classList.remove('turning');void page.offsetWidth;page.classList.add('turning');page.scrollTop=0;page.focus({preventScroll:true});}
async function refresh(fresh=false){
  if(state.fetching)return;
  const before=JSON.stringify([state.rows,state.concepts,state.live,state.error]);
  state.fetching=true;$('refresh').disabled=true;
  try{
    const data=await fetchCollection({live:state.live,fresh});
    state.rows=normalizeRows(data.rows);state.concepts=normalizeConcepts(data.concepts);
    state.live=data.live;state.lastSync=Date.now();state.capturedAt=data.capturedAt||null;
    state.connectionError=data.connectionError;state.error='';
  }catch(error){state.error=state.rows.length?'Sync paused. Your last loaded collection is still here; we’ll try again shortly.':'Could not load the collection. Please refresh to try again.';state.connectionError=error.message;}
  finally{
    state.fetching=false;$('refresh').disabled=false;
    if(before!==JSON.stringify([state.rows,state.concepts,state.live,state.error])){
      if(state.concept!=='All'&&!allBooks().some(book=>book.name===state.concept))state.concept='All';
      if(state.tag!=='All'&&!state.rows.some(r=>r.Tags.includes(state.tag)))state.tag='All';render();
    }else renderStatus();
  }
}
$('search').addEventListener('input',event=>{state.query=event.target.value;renderBooks();});$('sort').addEventListener('change',event=>{state.sort=event.target.value;renderBooks();});$('tag-select').addEventListener('change',event=>{state.tag=event.target.value;renderBooks();});
for(const [id,view]of [['shelf-view','shelf'],['topics-view','topics']])$(id).addEventListener('click',()=>{state.view=view;render();});
$('refresh').addEventListener('click',()=>refresh(true));$('close-book').addEventListener('click',()=>$('book-dialog').close());$('book-dialog').addEventListener('close',()=>{cancelBookMotion?.();cancelBookMotion=null;state.openBook=null;state.chapter=null;if(returnFocus?.isConnected)returnFocus.focus();else $('shelf-view').focus();});
let creatingBook=false;
$('add-book').addEventListener('click',()=>{$('add-book-error').textContent='';$('add-book-dialog').showModal();$('new-book-name').focus();});
$('close-add-book').addEventListener('click',()=>{if(!creatingBook)$('add-book-dialog').close();});
$('add-book-dialog').addEventListener('cancel',event=>{if(creatingBook)event.preventDefault();});
$('add-book-dialog').addEventListener('close',()=>{$('library-edit-key').value='';$('add-book').focus();});
$('add-book-form').addEventListener('submit',async event=>{
  event.preventDefault();if(creatingBook)return;
  creatingBook=true;$('create-book').disabled=true;$('close-add-book').disabled=true;$('create-book').textContent='Creating your book…';$('add-book-error').textContent='';
  try{
    const response=await fetch('/api/books',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${$('library-edit-key').value}`},body:JSON.stringify({name:$('new-book-name').value,chapter:$('new-book-chapter').value}),signal:AbortSignal.timeout(55000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save the book.');
    state.concept='All';state.tag='All';state.query='';$('search').value='';await refresh(true);
    state.concepts=normalizeConcepts([...state.concepts,...data.concepts,data.name]);render();
    $('library-notice').textContent=`“${data.name}” is saved in Notion. ${data.chapter?`Choose “${data.chapter}” when saving your first link.`:'Reload the extension popup to start saving to it.'}`;$('library-notice').hidden=false;
    $('add-book-form').reset();$('add-book-dialog').close();
  }catch(error){$('add-book-error').textContent=error.name==='TimeoutError'?'Saving took too long. Refresh Notion to check whether the book was created before retrying.':error.message;}
  finally{creatingBook=false;$('create-book').disabled=false;$('close-add-book').disabled=false;$('create-book').textContent='Create book in Notion ↗';}
});
$('book-search').addEventListener('input',event=>{state.bookQuery=event.target.value;renderOpenBook();$('book-page').scrollTop=0;});
$('clear-book-search').addEventListener('click',()=>{state.bookQuery='';$('book-search').value='';renderOpenBook();$('book-search').focus();});
for(const id of ['book-dialog','connection-dialog','add-book-dialog'])$(id).addEventListener('click',event=>{if(event.target===$(id)){if(id==='add-book-dialog'&&creatingBook)return;const box=event.target.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)$(id).close();}});
$('connection-button').addEventListener('click',()=>{$('connection-detail').textContent=state.live&&!state.error?'my-brain powers your concept books and chapters. New links and concept options are checked every minute while the library is open.':`${state.connectionError||'The live connection is not configured.'} ${state.live?'Your last connected collection is retained.':'You’re viewing a saved snapshot.'} For local preview, set NOTION_TOKEN and NOTION_DATABASE_ID in .env.local and refresh. For hosting, set them in Vercel and redeploy.`;$('connection-dialog').showModal();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('book-dialog').open&&!$('connection-dialog').open){event.preventDefault();$('search').focus();}});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);refresh();
