import {createOrbitChart} from './orbit-chart.mjs';
const palettes = ['mush','carbon','moss','paper','cmux'];
const tones = ['#e4c992','#b6c3a4','#dfa181','#beb4cc','#a8c8c6'];
const themeKey = 'waade-theme';
const read = key => {try{return localStorage.getItem(key);}catch{return null;}};
const save = (key,val) => {try{localStorage.setItem(key,val);}catch{}};
export function mountOrbitPicker({root=document.documentElement,groups,storageKey='waade-orbit-view',managePalette=true,onActivate,onLayout}) {
 const toggle=root.querySelector('[data-orbit-toggle]'),panel=root.querySelector('[data-orbit-picker]');
 const svg=panel?.querySelector('svg'),links=panel?.querySelector('[data-orbit-links]');
 if(!toggle||!panel||!svg||!links)return;
 let data=[], colors=new Map();
 const toData = groups => (groups||[]).map((group,index)=>({...group,category:group.id,number:index+1}));
 const palette=root.querySelector('[data-orbit-palette]'), heading=panel.querySelector('[data-orbit-heading]'), back=panel.querySelector('[data-orbit-back]');
 const chart=createOrbitChart(svg);
 const controller=new AbortController();
 const listen=(target,type,request)=>target?.addEventListener(type,request,{signal:controller.signal});
 if(heading)heading.tabIndex=-1;
 let selection, entries=[], opened=false;
 const paletteValue=theme=>{
  const next=palettes.includes(theme)?theme:'mush';
  root.dataset.orbitTheme=next;if(palette)palette.value=next;
 };
 function draw(){
  if(panel.hidden||!svg.parentElement.clientWidth)return;
  chart.render({title:selection?.name||'Explore',items:entries.slice(0,12),width:svg.parentElement.clientWidth,
   branch:!!selection,colors,viewFor:item=>item.id,hrefFor:item=>item.href||'#'+panel.id,
   center:{view:'@center',href:'#'+panel.id,label:selection?'All groups':'Choose a group',symbol:selection?'↶':'w.'}});
 }
 function render(){
  if(panel.hidden)return;
  entries=selection?selection.items.map((item,index)=>({...item,category:selection.id,number:index+1})):data;
  if(heading)heading.textContent=selection?.name||(entries.length?'Choose a book':'No books match');
  if(back)back.hidden=!selection;
  links.setAttribute('aria-label',selection?selection.name+' links':'Orbit groups');
  links.replaceChildren(...entries.map(item=>{
   const el=document.createElement(item.href?'a':'button');
   el.textContent=item.name;el.dataset.orbitView=item.id;
   if(item.href)el.href=item.href;else el.type='button';
   return el;
  }));
  draw();
 }
 function choose(group){
  const previous=selection;
  selection=group;render();
  if(group)heading?.focus({preventScroll:true});
  else if(previous)[...links.children].find(node=>node.dataset.orbitView===previous.id)?.focus({preventScroll:true});
  else links.firstElementChild?.focus({preventScroll:true});
 }
 function set(value,remember=false){
  opened=value==='orbit';
  root.dataset.orbitLayout=opened?'orbit':'original';
  toggle.setAttribute('aria-pressed',String(opened));
  if(panel.id)toggle.setAttribute('aria-controls',panel.id);
  if(!opened&&panel.contains(document.activeElement))toggle.focus({preventScroll:true});
  panel.hidden=!opened;
  if(remember)save(storageKey,root.dataset.orbitLayout);
  onLayout?.(opened);
  render();
 }
 listen(toggle,'click',()=>set(opened?'original':'orbit',true));
 listen(back,'click',()=>choose(undefined));
 listen(panel,'click',event=>{
  const id=event.target.closest('[data-orbit-view]')?.dataset.orbitView;
  if(!id||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(id==='@center'){event.preventDefault();choose(undefined);return;}
  if(!selection){const group=data.find(item=>item.id===id);if(group){event.preventDefault();choose(group);}return;}
  const item=selection.items.find(item=>item.id===id);
  if(item&&onActivate&&!item.href){event.preventDefault();onActivate({item,group:selection,trigger:event.target.closest('[data-orbit-view]')});}
 });
 listen(panel,'keydown',event=>{if(event.key==='Escape'&&selection){event.preventDefault();choose(undefined);}});
 for(const type of ['focusin','pointerover'])listen(panel,type,event=>chart.highlight(event.target.closest('[data-orbit-view]')?.dataset.orbitView));
 listen(panel,'pointerleave',()=>chart.highlight(document.activeElement?.dataset.orbitView));
 listen(palette,'change',()=>{paletteValue(palette.value);save(themeKey,palette.value);});
 listen(window,'storage',event=>{
  if(managePalette&&event.key===themeKey)paletteValue(event.newValue);
  if(event.key===storageKey)set(event.newValue);
 });
 const observer='ResizeObserver' in window?new ResizeObserver(draw):null;
 observer?.observe(svg.parentElement);
 function setGroups(groups){
  const selectedId=selection?.id;
  data=toData(groups);
  colors=new Map(data.map((item,index)=>[item.id,tones[index%tones.length]]));
  selection=data.find(item=>item.id===selectedId);
  render();
 }
 setGroups(groups);
 if(managePalette)paletteValue(read(themeKey));
 toggle.hidden=false;if(palette)palette.hidden=false;
 set(read(storageKey));
 return {set,setGroups,destroy(){controller.abort();observer?.disconnect();}};
}
