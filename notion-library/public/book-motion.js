// Motion decorates the live, readable DOM; no canvas snapshots or runtime dependencies.
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const piece=name=>Object.assign(document.createElement('div'),{className:name});
const ease='cubic-bezier(.22,.75,.18,1)';

export function animateBookOpening(dialog,trigger,fallbackCover){
  if(reduced()||typeof Element.prototype.animate!=='function')return()=>{};
  const source=trigger?.closest('.concept-book,.index-card')||trigger||fallbackCover;
  const cover=source?.querySelector('.book-cover')||fallbackCover?.querySelector('.book-cover');
  const spread=dialog.querySelector('.open-book-spread'),right=dialog.querySelector('.open-book-right');
  if(!source||!cover||!spread||!right)return()=>{};
  const origin=source.getBoundingClientRect(),destination=right.getBoundingClientRect();
  const mobile=window.matchMedia('(max-width: 700px)').matches;
  // A phone has room for one portrait cover, so keep its hinge inside that footprint.
  const width=mobile?Math.min(window.innerWidth-80,266,(window.innerHeight-140)*.66):destination.width;
  const height=mobile?width/.66:spread.getBoundingClientRect().height;
  if(width<=0||height<=0)return()=>{};
  const left=mobile?(window.innerWidth-width)/2:destination.left;
  const top=mobile?(window.innerHeight-height)/2:spread.getBoundingClientRect().top;
  const restingX=mobile?0:-width/2;
  const x=Math.max(-window.innerWidth,Math.min(window.innerWidth,origin.left+origin.width/2-(left+width/2)));
  const y=Math.max(-window.innerHeight,Math.min(window.innerHeight,origin.top+origin.height/2-(top+height/2)));
  const scale=Math.max(.22,Math.min(.8,origin.height/height));
  const stage=piece(`book-cinema${mobile?' book-cinema-mobile':''}`);stage.setAttribute('aria-hidden','true');
  const shadow=piece('cinema-shadow');Object.assign(shadow.style,{left:left+restingX+'px',top:top+height-15+'px',width:width+'px'});
  const book=piece('cinema-book');Object.assign(book.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  const board=piece('cinema-backboard'),block=piece('cinema-page-block'),spine=piece('cinema-spine');
  const leaves=Array.from({length:6},(_,i)=>{const leaf=piece('cinema-leaf');leaf.style.transform=`translateZ(${3+i*1.1}px)`;leaf.append(piece('cinema-paper-front'),piece('cinema-paper-back'));return leaf;});
  const hinge=piece('cinema-cover'),front=cover.cloneNode(true),lining=piece('cinema-cover-lining');front.classList.add('cinema-cover-front');
  const emblem=document.createElement('span');emblem.textContent='✦';lining.append(emblem);
  hinge.append(front,lining);book.append(board,block,spine,...leaves,hinge);stage.append(shadow,book);
  const skip=document.createElement('button');skip.type='button';skip.className='book-motion-skip';skip.textContent='Read now →';skip.setAttribute('aria-label','Skip book opening');
  dialog.append(stage,skip);source.classList.add('book-in-flight');dialog.classList.add('is-opening','cinema-opening');spread.inert=true;
  const animations=[];let finished=false;
  function cleanup(){if(finished)return;finished=true;window.removeEventListener('resize',cleanup);document.removeEventListener('visibilitychange',onVisibility);animations.forEach(a=>a.cancel());stage.remove();skip.remove();source.classList.remove('book-in-flight');dialog.classList.remove('is-opening','cinema-opening');spread.inert=false;}
  function onVisibility(){if(document.hidden)cleanup();}
  function play(node,frames,options){const animation=node.animate(frames,{fill:'forwards',...options});animations.push(animation);return animation;}
  skip.addEventListener('click',()=>{cleanup();if(dialog.open)dialog.querySelector('#book-page')?.focus({preventScroll:true});});
  window.addEventListener('resize',cleanup,{once:true});document.addEventListener('visibilitychange',onVisibility);
  const lift=play(book,mobile?[
    {opacity:0,transform:`translate3d(${Math.max(-18,Math.min(18,x))}px,${Math.max(-40,Math.min(40,y))}px,0) rotateY(-18deg) rotateZ(-2deg) scale(.82)`},
    {opacity:1,transform:'translate3d(0,-6px,0) rotateY(-5deg) rotateZ(0deg) scale(1)',offset:.8},
    {opacity:1,transform:'translate3d(0,0,0) rotateY(0deg) scale(1)'}
  ]:[
    {opacity:.55,transform:`translate3d(${x}px,${y}px,0) rotateY(-76deg) rotateZ(-5deg) scale(${scale})`},
    {opacity:1,transform:`translate3d(${restingX-12}px,-23px,80px) rotateY(-16deg) rotateZ(2deg) scale(.92)`,offset:.72},
    {opacity:1,transform:`translate3d(${restingX}px,0,0) rotateY(0deg) rotateZ(0deg) scale(1)`}
  ],{duration:mobile?330:460,easing:ease});
  play(shadow,[{opacity:0,transform:'scale(.35)'},{opacity:.45,transform:'scale(1.03)'},{opacity:.25,transform:'scale(1)'}],{duration:460,easing:ease});
  (async()=>{try{
    await lift.finished;if(finished)return;
    if(mobile){
      play(hinge,[{transform:'rotateY(0deg) translateZ(14px)'},{transform:'rotateY(-62deg) translateZ(14px)',offset:.7},{transform:'rotateY(-72deg) translateZ(14px)'}],{duration:460,easing:ease});
      for(const [i,leaf]of leaves.entries())play(leaf,[{transform:`translateZ(${3+i*1.1}px) rotateY(0deg)`},{transform:`translateZ(${3+i*1.1}px) rotateY(${-12-i*5}deg)`}],{duration:420,delay:i*12,easing:ease});
      play(book,[{transform:'translateY(0) scale(1)'},{transform:'translateY(-10px) scale(.96)'}],{duration:460,easing:ease});
      play(stage,[{opacity:1},{opacity:0}],{duration:180,delay:150,easing:'ease-in-out'});
      const reveal=play(spread,[{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:240,delay:290,easing:ease});
      await reveal.finished;if(finished)return;
      cleanup();if(dialog.open)dialog.querySelector('#book-page')?.focus({preventScroll:true});
      return;
    }
    play(book,[{transform:`translate3d(${restingX}px,0,0)`},{transform:'translate3d(0,0,0)'}],{duration:650,easing:'cubic-bezier(.3,.02,.2,1)'});
    const opening=play(hinge,[{transform:'rotateY(0deg) translateZ(14px)'},{transform:'rotateY(-88deg) translateZ(14px)',offset:.48},{transform:'rotateY(-179.5deg) translateZ(14px)'}],{duration:650,easing:'cubic-bezier(.32,.04,.2,1)'});
    for(const [i,leaf]of leaves.entries())play(leaf,[{transform:`translateZ(${3+i*1.1}px) rotateY(0deg)`,opacity:1},{transform:`translateZ(${3+i*1.1}px) rotateY(${-40-i*9}deg)`,opacity:1,offset:.45},{transform:`translateZ(${3+i*1.1}px) rotateY(-178deg)`,opacity:0}],{duration:520,delay:65+i*17,easing:ease});
    play(block,[{opacity:1},{opacity:0}],{duration:240,delay:260});
    play(spread,[{opacity:0,transform:'scale(.985)'},{opacity:1,transform:'scale(1)'}],{duration:330,delay:300,easing:ease});
    play(shadow,[{opacity:.25,transform:`translateX(${restingX}px) scale(1)`},{opacity:0,transform:'translateX(0) scale(1.8,.6)'}],{duration:650,easing:ease});
    await opening.finished;if(finished)return;
    await play(stage,[{opacity:1},{opacity:0}],{duration:110}).finished;
    cleanup();if(dialog.open)dialog.querySelector('#book-page')?.focus({preventScroll:true});
  }catch{cleanup();}})();
  return cleanup;
}

// Hinged strips bend the outgoing page while the next page remains selectable HTML.
export function animatePageTurn(page,update,direction=1){
  if(reduced()||typeof Element.prototype.animate!=='function'){update();return()=>{};}
  const pane=page.parentElement,bounds=page.getBoundingClientRect(),parent=pane.getBoundingClientRect();
  if(bounds.width<1||bounds.height<1){update();return()=>{};}
  const snapshot=page.cloneNode(true);snapshot.removeAttribute('id');snapshot.classList.add('fold-content');snapshot.style.padding=getComputedStyle(page).padding;snapshot.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  const count=page.querySelectorAll('*').length>350?1:9,stripWidth=bounds.width/count;
  const stage=piece('page-fold-stage');stage.setAttribute('aria-hidden','true');stage.inert=true;
  Object.assign(stage.style,{left:bounds.left-parent.left+'px',top:bounds.top-parent.top+'px',width:bounds.width+'px',height:bounds.height+'px'});
  let previous=stage;const strips=[];
  for(let i=0;i<count;i++){
    const strip=piece('page-fold-strip'),face=piece('page-fold-face'),offset=direction>0?i*stripWidth:bounds.width-(i+1)*stripWidth;
    Object.assign(strip.style,{width:stripWidth+1+'px',left:(i===0?(direction>0?0:bounds.width-stripWidth):(direction>0?stripWidth:-stripWidth))+'px',transformOrigin:direction>0?'left center':'right center'});
    const content=snapshot.cloneNode(true);Object.assign(content.style,{width:bounds.width+'px',height:bounds.height+'px',left:-offset+'px'});
    face.append(content);strip.append(face);previous.append(strip);previous=strip;strips.push(strip);
  }
  pane.append(stage);page.setAttribute('aria-busy','true');stage.querySelectorAll('.fold-content').forEach(node=>node.scrollTop=page.scrollTop);
  let done=false;const animations=[];
  function cleanup(){if(done)return;done=true;animations.forEach(a=>a.cancel());stage.remove();page.removeAttribute('aria-busy');window.removeEventListener('resize',cleanup);}
  window.addEventListener('resize',cleanup,{once:true});
  try{
    update();
    for(const [i,strip]of strips.entries()){
      const angle=direction>0?-1:1;
      animations.push(strip.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${angle*(i===0?35:10)}deg)`,offset:.45},{transform:`rotateY(${angle*(i===0?165:1.5)}deg)`}],{duration:470,delay:i*5,easing:'cubic-bezier(.25,.1,.18,1)',fill:'forwards'}));
    }
    animations.push(stage.animate([{opacity:1},{opacity:1,offset:.7},{opacity:0}],{duration:530,fill:'forwards'}));
    Promise.all(animations.map(a=>a.finished)).then(cleanup,cleanup);
  }catch{cleanup();}
  return cleanup;
}
