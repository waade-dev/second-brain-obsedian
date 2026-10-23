const $ = id => document.getElementById(id);
const BASE_STATUSES = ['To do', 'In progress', 'Done'];
const state = {key: '', rows: [], statuses: BASE_STATUSES, loading: false, saving: false, editing: null, dragging: null, query: '', priority: ''};
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function safeLink(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function message(text) { $('task-message').textContent = text; }
function notionLink(url) { const link = $('notion-board-link'); const valid = /^https:\/\/www\.notion\.so\/[a-f0-9]{32}$/i.test(url || ''); link.hidden = !valid; if (valid) link.href = url; else link.removeAttribute('href'); }
async function request(method = 'GET', body, key = state.key) {
  const response = await fetch('/api/tasks', {method, cache: 'no-store', headers: {Authorization: `Bearer ${key}`, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(55000)});
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.key === key) lock();
    throw new Error(result.error || 'Could not sync tasks. Please refresh.');
  }
  return result;
}
function busy() {
  const locked = !state.key;
  for (const id of ['task-search', 'priority-filter', 'task-refresh', 'add-task']) $(id).disabled = locked || state.saving || state.loading;
  $('lock-board').disabled = state.saving || state.loading;
  $('task-board').setAttribute('aria-busy', String(state.loading || state.saving));
}
function render() {
  const unlocked = Boolean(state.key);
  $('unlock-panel').hidden = unlocked; $('lock-board').hidden = !unlocked; busy();
  const visible = state.rows.filter(task => (!state.priority || task.priority === state.priority) && `${task.name} ${task.notes} ${task.link}`.toLowerCase().includes(state.query.toLowerCase()));
  const complete = state.rows.filter(task => task.status === 'Done').length;
  $('task-count').textContent = unlocked ? `${state.rows.length} ${state.rows.length === 1 ? 'task' : 'tasks'} · ${complete} done${state.query || state.priority ? ` · ${visible.length} shown` : ''}` : 'Your next chapter starts here.';
  $('task-board').replaceChildren();
  const statuses = [...new Set([...BASE_STATUSES, ...state.statuses, ...state.rows.map(task => task.status)])];
  for (const [index, status] of statuses.entries()) {
    const rows = visible.filter(task => task.status === status);
    const column = el('section', `task-column stage-${index}`); column.dataset.status = status;
    const heading = el('div', 'column-heading'); const title = el('h2', '', status); title.id = `stage-${index}`; column.setAttribute('aria-labelledby', title.id);
    heading.append(el('span', 'column-dot'), title, el('span', 'column-count', unlocked ? String(rows.length) : '—'));
    const add = el('button', 'column-add', '+'); add.setAttribute('aria-label', `Add task to ${status}`); add.disabled = !unlocked || state.saving || state.loading; add.addEventListener('click', () => openTask(null, status)); heading.append(add); column.append(heading);
    const cards = el('div', 'task-cards'); cards.append(...rows.map(card));
    if (!rows.length) cards.append(el('p', 'column-empty', !unlocked ? 'Unlock to see your tasks.' : state.query || state.priority ? 'No matching tasks.' : status === 'Done' ? 'Small wins will land here.' : 'A little room for what’s next.'));
    column.append(cards);
    column.addEventListener('dragover', event => { if (state.dragging && !state.saving) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; column.classList.add('drop-target'); } });
    column.addEventListener('dragleave', event => { if (!column.contains(event.relatedTarget)) column.classList.remove('drop-target'); });
    column.addEventListener('drop', event => { event.preventDefault(); column.classList.remove('drop-target'); const task = state.rows.find(row => row.id === state.dragging); state.dragging = null; if (task && task.status !== status) move(task, status); });
    $('task-board').append(column);
  }
}
function card(task) {
  const node = el('article', 'task-card'); node.draggable = !state.saving && !state.loading;
  node.addEventListener('dragstart', event => { state.dragging = task.id; event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move'; });
  node.addEventListener('dragend', () => { state.dragging = null; document.querySelectorAll('.drop-target').forEach(column => column.classList.remove('drop-target')); });
  const heading = el('h3'); const edit = el('button', 'task-title', task.name); edit.disabled = state.saving || state.loading; edit.addEventListener('click', () => openTask(task)); heading.append(edit); node.append(heading);
  if (task.notes) node.append(el('p', 'task-note', task.notes));
  const meta = el('div', 'task-meta');
  if (task.priority) meta.append(el('span', `priority priority-${task.priority.toLowerCase()}`, task.priority));
  if (task.due) { const time = el('time', 'task-due'); time.dateTime = task.due; const date = new Date(`${task.due.slice(0, 10)}T12:00:00`); time.textContent = Number.isNaN(date.valueOf()) ? task.due : date.toLocaleDateString([], {day: 'numeric', month: 'short'}); if (task.status !== 'Done' && date < new Date(new Date().setHours(0, 0, 0, 0))) time.classList.add('overdue'); meta.append(time); }
  node.append(meta);
  const bottom = el('div', 'task-card-bottom');
  const label = el('label', 'move-label', 'Move'); const select = el('select', 'task-move'); select.setAttribute('aria-label', `Move ${task.name}`); select.disabled = state.saving || state.loading;
  for (const status of [...new Set([...state.statuses, task.status])]) select.append(new Option(status, status));
  select.value = task.status; select.addEventListener('change', () => move(task, select.value)); label.append(select); bottom.append(label);
  if (safeLink(task.link)) { const link = el('a', 'task-source', 'Link ↗'); link.href = safeLink(task.link); link.target = '_blank'; link.rel = 'noopener noreferrer'; bottom.append(link); }
  node.append(bottom); return node;
}
async function refresh() {
  if (!state.key || state.loading || state.saving) return;
  state.loading = true; render(); const key = state.key;
  try { const data = await request(); if (state.key !== key) return; state.rows = data.rows; state.statuses = data.statuses; notionLink(data.databaseUrl); message(`Connected to Notion · Checked ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`); }
  catch (error) { message(error.message); }
  finally { state.loading = false; render(); }
}
function lock() { state.key = ''; state.rows = []; state.editing = null; state.query = ''; state.priority = ''; notionLink(''); $('task-search').value = ''; $('priority-filter').value = ''; $('task-form').reset(); $('task-dialog').close(); $('task-edit-key').value = ''; message('Board locked.'); render(); }
function openTask(task, status = 'To do') {
  if (!state.key || state.saving || state.loading) return;
  state.editing = task?.id || null; $('task-form').reset(); $('task-error').textContent = '';
  $('task-dialog-title').textContent = task ? 'A little progress.' : 'A new task.';
  $('task-status').replaceChildren(...state.statuses.map(value => new Option(value, value)));
  for (const key of ['name', 'priority', 'due', 'notes', 'link']) $(`task-${key}`).value = task?.[key] || '';
  $('task-due').value = task?.due?.slice(0, 10) || '';
  $('task-status').value = task?.status || status;
  $('task-dialog').showModal();
}
async function move(task, status) {
  if (state.saving || state.loading || !state.key || status === task.status) return;
  state.saving = true; render();
  try { const data = await request('PATCH', {id: task.id, status}); state.rows = state.rows.map(row => row.id === task.id ? data.task : row); message(`Moved “${task.name}” to ${status}. Saved in Notion.`); }
  catch (error) { message(`${error.message} Your last loaded tasks are still shown; refresh to confirm their status.`); }
  finally { state.saving = false; render(); const select = [...document.querySelectorAll('.task-move')].find(node => node.getAttribute('aria-label') === `Move ${task.name}`); select?.focus({preventScroll: true}); }
}
$('unlock-board').addEventListener('click', () => { $('unlock-error').textContent = ''; $('unlock-dialog').showModal(); });
$('unlock-dialog').addEventListener('close', () => { $('task-edit-key').value = ''; });
$('unlock-form').addEventListener('submit', async event => {
  event.preventDefault(); const key = $('task-edit-key').value; const button = event.submitter; button.disabled = true; $('unlock-error').textContent = '';
  try { const data = await request('GET', undefined, key); state.key = key; state.rows = data.rows; state.statuses = data.statuses; notionLink(data.databaseUrl); $('unlock-dialog').close(); message('Connected to Notion. Your board is ready.'); render(); }
  catch (error) { $('unlock-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('task-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.saving) return;
  const body = Object.fromEntries(['name', 'status', 'priority', 'due', 'notes', 'link'].map(key => [key, $(`task-${key}`).value]));
  if (state.editing) {
    const original = state.rows.find(task => task.id === state.editing);
    for (const key of Object.keys(body)) if (body[key] === (key === 'due' ? original.due.slice(0, 10) : original[key])) delete body[key];
    if (!Object.keys(body).length) { $('task-dialog').close(); return; }
    body.id = state.editing;
  }
  state.saving = true; $('task-error').textContent = ''; $('save-task').textContent = 'Saving…';
  for (const control of $('task-form').elements) control.disabled = true;
  try { const data = await request(state.editing ? 'PATCH' : 'POST', body); state.rows = state.editing ? state.rows.map(row => row.id === state.editing ? data.task : row) : [...state.rows, data.task]; $('task-dialog').close(); message('Task saved in Notion.'); }
  catch (error) { const text = `${error.message} Refresh before retrying to avoid duplicate tasks.`; $('task-error').textContent = text; message(text); }
  finally { state.saving = false; for (const control of $('task-form').elements) control.disabled = false; $('save-task').textContent = 'Save task in Notion ↗'; render(); }
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', event => { if (state.saving || $('unlock-form').querySelector('button[type="submit"]').disabled) event.preventDefault(); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => { if (!state.saving && !$('unlock-form').querySelector('button[type="submit"]').disabled) $(button.dataset.close).close(); });
$('add-task').addEventListener('click', () => openTask(null));
$('task-refresh').addEventListener('click', refresh);
$('lock-board').addEventListener('click', lock);
$('task-search').addEventListener('input', event => { state.query = event.target.value; render(); });
$('priority-filter').addEventListener('change', event => { state.priority = event.target.value; render(); });
setInterval(() => { if (!document.hidden && !$('task-dialog').open) refresh(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('task-dialog').open) refresh(); });
render();
