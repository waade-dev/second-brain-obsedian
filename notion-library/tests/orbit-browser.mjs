// Start npm run dev separately; browser tests use the snapshot and no credentials.
import assert from 'node:assert/strict';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const {chromium}=pw.default||pw;
const origin=process.env.LIBRARY_ORIGIN||'http://127.0.0.1:4173';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
try {
 for(const width of [320,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin);
  const orbit=page.getByRole('button',{name:'Orbit',exact:true});
  const palette=page.getByRole('combobox',{name:'Color palette'});
  const scope=page.locator('#library-orbit [data-orbit-links]');
  const shelf=page.getByRole('button',{name:'Shelf',exact:true});
  const search=page.getByRole('searchbox',{name:'Search your library'});
  const bookDialog=page.getByRole('dialog',{name:/AI & Machine Learning/});
  await page.locator('.concept-spine-track').waitFor();
  assert.equal(await shelf.getAttribute('aria-pressed'),'true');
  assert.equal(await orbit.getAttribute('aria-pressed'),'false');
  assert.equal(await palette.inputValue(),'carbon');
  await orbit.click();
  assert.equal(await shelf.getAttribute('aria-pressed'),'false');
  assert.equal(await orbit.getAttribute('aria-pressed'),'true');
  await scope.getByRole('button',{name:'AI & Machine Learning'}).waitFor();
  assert.ok(await page.locator('[data-orbit-field] svg .lens-point').count()>=3);
  const backgrounds=new Set();
  for(const choice of ['mush','carbon','moss','paper','cmux']){
    await palette.selectOption(choice);
    assert.equal(await page.locator('html').getAttribute('data-orbit-theme'),choice);
    assert.equal(await orbit.getAttribute('aria-pressed'),'true');
    backgrounds.add(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor));
  }
  assert.equal(backgrounds.size,5);
  const group=scope.getByRole('button',{name:'AI & Machine Learning'});
  await group.focus();
  await page.keyboard.press('Enter');
  const openBook=scope.getByRole('button',{name:'Open book',exact:true});
  await openBook.focus();
  await page.keyboard.press('Enter');
  await bookDialog.waitFor();
  await page.getByRole('button',{name:'Close book'}).click();
  assert.ok(await openBook.evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Escape');
  assert.ok(await group.evaluate(e=>e===document.activeElement));
  await search.fill('unlikelyqzxzz');
  await page.getByRole('heading',{name:'No books match'}).waitFor();
  await search.clear();
  await group.waitFor();
  await page.reload();
  assert.equal(await orbit.getAttribute('aria-pressed'),'true');
  assert.equal(await palette.inputValue(),'cmux');
  await page.getByRole('button',{name:'Topics',exact:true}).click();
  await page.locator('.concept-index').waitFor();
  assert.equal(await orbit.getAttribute('aria-pressed'),'false');
  await shelf.click();
  await page.locator('.concept-spine-track').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  if(process.env.ORBIT_SCREENSHOTS){
    await orbit.click();
    await group.waitFor();
    await page.screenshot({path:process.env.ORBIT_SCREENSHOTS+'/second-brain-orbit-'+width+'.png',fullPage:true});
  }
  await page.getByRole('link',{name:'Kanban'}).click();
  await page.getByRole('button',{name:'Unlock board'}).waitFor();
  assert.equal(await palette.inputValue(),'cmux');
  assert.equal(await page.locator('#task-board').locator('.task-card').count(),0);
  const unauthorized=await page.request.get(origin+'/api/tasks');
  assert.equal(unauthorized.status(),401);
  await page.close();
 }
 const fallback=await browser.newPage();
 await fallback.route('**/waade-orbit.mjs',r=>r.abort());
 await fallback.goto(origin);
 await fallback.locator('.concept-spine-track').waitFor();
 assert.equal(await fallback.getByRole('button',{name:'Orbit',exact:true}).isVisible(),false);
 await fallback.close();
 console.log('Four widths: ring and original views, keyboard/focus, update/empty results, five distinct palettes and persistence, locked Kanban, graceful missing asset fallback.');
} finally { await browser.close(); }
