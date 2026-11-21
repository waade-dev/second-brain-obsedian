const svgNS = 'http://www.w3.org/2000/svg';
function svg(name, attributes, parent) {
  const node = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent.append(node);
  return node;
}

// The home map and the private workspaces share geometry, labels and picking.
export function createOrbitChart(drawing) {
  const markers = new Map();
  let pickRadius = 0;
  let branchMode = false;
  let pickPoints = [];

  function clear() {
    pickPoints = [];
    markers.clear();
    drawing.replaceChildren();
  }

  function renderBranch({title, items, shown, width, colors, viewFor, hrefFor, center}) {
    const compact = width < 540;
    const viewWidth = compact ? 380 : 860;
    const display = items.filter(item => !shown || shown.has(item.id));
    const viewHeight = Math.max(compact ? 320 : 380, display.length * (compact ? 30 : 33) + 72);
    const hub = {x:compact ? 297 : 675, y:viewHeight / 2};
    const labelX = compact ? 13 : 38;
    const labelEnd = compact ? 120 : 242;
    const spacing = Math.min(compact ? 36 : 41, (viewHeight - 84) / Math.max(1, display.length - 1));
    drawing.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'branch-chart');
    svg('circle',{cx:hub.x,cy:hub.y,r:compact?48:71,class:'branch-orbit'},group);
    svg('circle',{cx:hub.x,cy:hub.y,r:compact?35:56,class:'branch-orbit branch-orbit-inner'},group);
    const half = Math.max(1, (display.length-1) / 2);
    const firstY = hub.y - spacing * (display.length-1) / 2;
    if (display.length) {
      const lastY = firstY + spacing*(display.length-1);
      svg('path',{d:`M${labelX+7} ${firstY-12} h-9 V${lastY+12} h9`,class:'branch-bracket'},group);
    }
    display.forEach((p,i)=>{
      const fraction = (i - (display.length-1)/2) / half;
      const rowY = firstY + i*spacing;
      const x = (compact ? 172 : 416) + (compact ? 24 : 68) * fraction ** 2;
      const y = hub.y + fraction * (viewHeight*.31);
      const path = viewFor(p);
      const anchor = svg('a',{href:hrefFor(p),'data-orbit-view':path,
        'aria-label':p.name+', '+p.category,class:'lens-point branch-point'},group);
      anchor.style.setProperty('--star',colors.get(p.category)||'#dfd4bc');
      const bendX = hub.x - (compact ? 49 : 108);
      const curve = `M${hub.x-15} ${hub.y} C${bendX} ${hub.y} ${x+22} ${y} ${x} ${y}`;
      svg('path',{d:curve,class:'lens-branch'},anchor);
      const flow=svg('path',{d:curve,class:'lens-flow',pathLength:100},anchor);
      flow.style.animationDelay=(-.24*i)+'s';
      svg('path',{d:`M${x} ${y} Q${labelEnd+18} ${rowY} ${labelEnd} ${rowY}`,class:'lens-leader'},anchor);
      svg('rect',{x:labelX,y:rowY-12,width:labelEnd-labelX,height:24,rx:2,class:'branch-hit'},anchor);
      const label = svg('text',{x:labelX+5,y:rowY+4,class:'lens-label'},anchor);
      const max = compact ? 14 : 27;
      label.textContent = p.name.length > max ? p.name.slice(0,max-1)+'…' : p.name;
      svg('circle',{cx:x,cy:y,r:compact?7:9,class:'lens-halo'},anchor);
      svg('circle',{cx:x,cy:y,r:3.5,class:'lens-core'},anchor);
      svg('circle',{cx:x,cy:y,r:compact?15:13,fill:'transparent'},anchor);
      const number = svg('text',{x:x+10,y:y-8,class:'lens-number'},anchor);
      number.textContent=p.number;
      pickPoints.push({x,y,path});
      markers.set(p.id,anchor);
    });
    const back=svg('a',{href:center.href,'data-orbit-view':center.view,'aria-label':center.label,class:'lens-center branch-center',
      transform:`translate(${hub.x} ${hub.y})`},group);
    svg('circle',{r:compact?24:29},back);
    svg('text',{y:5,'text-anchor':'middle'},back).textContent=center.symbol;
    const heading=svg('text',{x:hub.x,y:hub.y+(compact?58:86),'text-anchor':'middle',class:'lens-title branch-title'},group);
    heading.textContent=compact && title.length > 23 ? title.slice(0,22)+'…' : title;
    drawing.replaceChildren(group);
  }

  function render(options) {
    const active = drawing.contains(document.activeElement) ? document.activeElement : null;
    const focus = active?.getAttribute('data-orbit-view');
    renderChart(options);
    if (focus) {
      const replacement = [...drawing.querySelectorAll('[data-orbit-view]')]
        .find(marker => marker.getAttribute('data-orbit-view') === focus);
      replacement?.focus({preventScroll:true});
    }
  }

  function renderChart({title, items, shown, width, colors, viewFor, hrefFor, center, branch=false}) {
    clear();
    branchMode = branch;
    drawing.style.width = width + 'px';
    drawing.setAttribute('aria-label', title + ' map');
    if (branch) return renderBranch({title, items, shown, width, colors, viewFor, hrefFor, center});
    const compact = width < 540;
    const halfWidth = compact ? 175 : 340;
    const r = compact ? 137 : 163;
    pickRadius = r * 1.07;
    const halfHeight = compact ? 166 : 218;
    drawing.style.width = width + 'px';
    drawing.setAttribute('viewBox', [-halfWidth,-halfHeight,halfWidth*2,halfHeight*2].join(' '));
    drawing.setAttribute('aria-label', title + ' map');
    const group = document.createElementNS(svgNS, 'g');
    for (let i = 0; i < 144; i++) {
      const angle = i * Math.PI / 72;
      const long = i % 12 === 0;
      const inner = r * (long ? 1.04 : 1.05);
      const outer = r * (long ? 1.075 : 1.06);
      svg('line', {x1:Math.cos(angle)*inner, y1:Math.sin(angle)*inner,
        x2:Math.cos(angle)*outer, y2:Math.sin(angle)*outer, class:'lens-tick'}, group);
    }
    for (const size of [.34,.64,.88,1.05]) {
      svg('circle', {r:r*size, class:'lens-guide'}, group);
    }
    const heading = svg('text', {x:0, y:-r*1.14, 'text-anchor':'middle', class:'lens-title'}, group);
    heading.textContent = title;
    const positions = items.map((p,i) => {
      const angle = (i + .27) * 2 * Math.PI / items.length - Math.PI / 2;
      const distance = r * (.49 + .19 * (i % 2));
      return {p, i, angle, x:Math.cos(angle)*distance, y:Math.sin(angle)*distance};
    });
    for (const sign of [-1,1]) {
      const side = positions.filter(item => Math.sign(item.x) === sign).sort((a,b) => a.y-b.y);
      side.forEach((item,i) => { item.labelY = (i-(side.length-1)/2) * Math.min(42, (2*halfHeight-60)/Math.max(1,side.length)); });
    }
    for (const {p,i,angle,x,y,labelY} of positions) {
      if (shown && !shown.has(p.id)) continue;
      const path = viewFor(p);
      const sign = Math.sign(x);
      const color = colors.get(p.category) || '#dfd4bc';
      const anchor = svg('a', {href:hrefFor(p),'data-orbit-view':path,'aria-label':p.name + ', ' + p.category, class:'lens-point'}, group);
      anchor.style.setProperty('--star',color);
      // Each etched fan belongs to the project at the end of its branch.
      const fan = [];
      const span = Math.min(.55, Math.PI * 1.65 / positions.length);
      const threads = [];
      for (let j = -15; j <= 15; j++) {
        const theta = angle + span * j / 30;
        const dx = Math.cos(theta), dy = Math.sin(theta);
        const inner = r * .77;
        const outer = r * (.92 + .08 * Math.cos(j / 15 * Math.PI));
        fan.push(`M${dx*inner} ${dy*inner} L${dx*outer} ${dy*outer}`);
        if (j % 3 === 0) threads.push(`M${x} ${y} Q${dx*r*.71} ${dy*r*.71} ${dx*inner} ${dy*inner}`);
      }
      svg('path', {d:threads.join(' '), class:'lens-threads'}, anchor);
      svg('path', {d:fan.join(' '), class:'lens-fan'}, anchor);
      const bend = angle + .48;
      const curve = `M0 0 Q${Math.cos(bend)*r*.46} ${Math.sin(bend)*r*.46} ${x} ${y}`;
      svg('path', {d:curve,class:'lens-branch'}, anchor);
      const flow = svg('path', {d:curve,class:'lens-flow',pathLength:100}, anchor);
      flow.style.animationDelay = (-.32*i)+'s';
      if (!compact) {
        const elbow = sign*(r+7);
        svg('path', {d:`M${x} ${y} L${elbow} ${labelY} h${sign*10}`,class:'lens-leader'}, anchor);
        const label = svg('text', {x:elbow+sign*15,y:labelY+4,'text-anchor':sign<0?'end':'start',class:'lens-label'}, anchor);
        label.textContent = p.name.length > 22 ? p.name.slice(0,21)+'…' : p.name;
      }
      svg('circle', {cx:x,cy:y,r:9,class:'lens-halo'}, anchor);
      svg('circle', {cx:x,cy:y,r:3.5,class:'lens-core'}, anchor);
      svg('circle', {cx:x,cy:y,r:compact?17:12,fill:'transparent'}, anchor);
      const number = svg('text', {x:x+8,y:y-8,class:'lens-number'}, anchor);
      number.textContent = p.number;
      pickPoints.push({x,y,path});
      markers.set(p.id,anchor);
    }
    const back = svg('a', {href: center.href, 'data-orbit-view':center.view, 'aria-label':center.label,class:'lens-center'}, group);
    svg('circle',{r:22},back);
    svg('text', {y:5,'text-anchor':'middle'},back).textContent=center.symbol;
    drawing.replaceChildren(group);
  }

  return {
    render, clear,
    highlight(id, selected) {
      for (const [key, marker] of markers) {
        marker.classList.toggle('is-lit', key === id || key === selected);
        marker.classList.toggle('is-selected', key === selected);
      }
      if (branchMode) drawing.classList.toggle('branch-has-selection', Boolean(id || selected));
    },
    pick(clientX, clientY) {
      const matrix = drawing.getScreenCTM();
      if (!matrix || !pickPoints.length) return;
      const local = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
      if (!branchMode && Math.hypot(local.x, local.y) > pickRadius) return;
      let nearest, distance = Infinity;
      for (const point of pickPoints) {
        const d = Math.hypot(point.x - local.x, point.y - local.y);
        if (d < distance) { nearest = point.path; distance = d; }
      }
      return !branchMode || distance < 25 ? nearest : undefined;
    },
  };
}
