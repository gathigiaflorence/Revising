/* app.js
   Replace the SID4 value below with the last 4 digits of your student ID.
   The storage key will be "focustasks_<SID4>" (exactly as required).
*/
const SID4 = '6092'; // <<< REPLACE '0000' with your last 4 student ID digits

/* ---------------------
   createStore (closure-based)
   ---------------------
   - encapsulates tasks state and storageKey
   - returns an API: add, toggle, remove, list
*/
function createStore(storageKey) {
  // No tasks variable at top-level; state is only inside this closure.
  let state = [];

  // hydrate from localStorage
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) state = parsed.map(item => ({ id: item.id, title: item.title, done: !!item.done }));
    }
  } catch (e) {
    console.warn('Failed to hydrate store:', e);
    state = [];
  }

  const persist = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist store:', e);
    }
  };

  // helpers using map/filter/reduce only for transforms
  const list = () => state.map(item => ({ id: item.id, title: item.title, done: item.done })); // deep-ish clone

  const add = (task) => {
    // task: { id, title, done }
    state = state.concat([{ id: task.id, title: task.title, done: !!task.done }]);
    persist();
    return list();
  };

  const toggle = (id) => {
    state = state.map(it => it.id === id ? { id: it.id, title: it.title, done: !it.done } : { id: it.id, title: it.title, done: it.done });
    persist();
    return list();
  };

  const remove = (id) => {
    state = state.filter(it => it.id !== id);
    persist();
    return list();
  };

  return { add, toggle, remove, list };
}

/* ---------------------
   Escaping user input before rendering
   ---------------------
   Use textContent or setAttribute for content; provide escapeHTML for any defensive cases.
*/
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, function (s) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[s];
  });
}

/* ---------- store instance ---------- */
const store = createStore(`focustasks_${SID4}`);

/* ---------- UI helpers ---------- */
const analyticsEl = document.getElementById('analytics');
const activeListEl = document.getElementById('active-list');
const doneListEl = document.getElementById('done-list');
const form = document.getElementById('add-form');
const input = document.getElementById('task-input');
const errorEl = document.getElementById('error');
const appTitle = document.getElementById('app-title');

appTitle.textContent = `FocusTasks ${SID4}`;

/* Analytics pure function as required */
function summarize(tasks) {
  const active = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;
  const total = active + done;
  const pct = total === 0 ? 0 : Math.round((done / total) * 1000) / 10; // 1dp
  return { active, done, pct };
}

/* Render analytics from store.list() (no DOM-count hacks) */
function renderAnalytics() {
  const s = summarize(store.list());
  analyticsEl.textContent = `Active: ${s.active} · Done: ${s.done} · Done %: ${s.pct.toFixed(1)}%`;
}

/* Build a task DOM node safely (no innerHTML with unescaped content) */
function buildTaskNode(task) {
  const wrapper = document.createElement('div');
  wrapper.className = 'task';
  wrapper.dataset.id = task.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-toggle';
  checkbox.setAttribute('aria-label', task.title);
  checkbox.checked = !!task.done;
  checkbox.tabIndex = 0;

  const title = document.createElement('div');
  title.className = 'title';
  // Use textContent to avoid injecting HTML. escapeHTML is available but textContent is sufficient.
  title.textContent = task.title;

  const delBtn = document.createElement('button');
  delBtn.className = 'small-btn delete-btn';
  delBtn.type = 'button';
  delBtn.textContent = 'Delete';
  delBtn.setAttribute('aria-label', `Delete ${task.title}`);

  wrapper.appendChild(checkbox);
  wrapper.appendChild(title);
  wrapper.appendChild(delBtn);

  return wrapper;
}

/* Render full lists from store (no per-row listeners) */
function renderAll() {
  const tasks = store.list();
  // clear
  activeListEl.innerHTML = '';
  doneListEl.innerHTML = '';

  // use map/filter/reduce for transforms (no loops)
  const activeTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  // append nodes (we can't use forEach — instead use reduce to accumulate DocumentFragment)
  const appendNodes = (arr, container) => {
    const frag = arr.reduce((fragAcc, t) => {
      fragAcc.appendChild(buildTaskNode(t));
      return fragAcc;
    }, document.createDocumentFragment());
    container.appendChild(frag);
  };

  appendNodes(activeTasks, activeListEl);
  appendNodes(doneTasks, doneListEl);
  renderAnalytics();
}

/* Validation helper */
function isBlank(s) {
  return s.trim().length === 0;
}

/* Generate unique id */
function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

/* ----------- Event handling (delegation) ----------- */

/* 1) Form submit - single listener for "add" */
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  errorEl.hidden = true;
  const title = input.value || '';
  if (isBlank(title)) {
    errorEl.textContent = 'Please enter a non-empty task title.';
    errorEl.hidden = false;
    input.focus();
    return;
  }
  // All user-supplied titles are stored as raw strings, but we avoid innerHTML and use textContent when rendering.
  const id = makeId();
  store.add({ id, title: title.trim(), done: false });
  input.value = '';
  renderAll();
  input.focus();
});

/* 2) Single delegated listener for both lists (toggle and delete) */
const listsWrapper = document.getElementById('main'); // parent containing both lists
listsWrapper.addEventListener('click', (ev) => {
  const target = ev.target;
  // handle delete
  if (target.matches('.delete-btn')) {
    const row = target.closest('.task');
    if (!row) return;
    const id = row.dataset.id;
    store.remove(id);
    renderAll();
    return;
  }

  // handle toggle when checkbox clicked
  if (target.matches('.task-toggle')) {
    const row = target.closest('.task');
    if (!row) return;
    const id = row.dataset.id;
    store.toggle(id);
    renderAll();
    return;
  }
});

/* keyboard behaviour: allow space/enter on task toggle via change event on wrapper (checkbox already handles keyboard) */
/* Initial render */
renderAll();

/* ---------------------
   Micro-comments for grading (Task 4)
   --------------------- */

/* 
Comment 1 (closure store): lines near createStore above.
Using a closure here keeps the task array private to the store and avoids a global 'tasks' variable.
This reduces accidental external mutation and makes the store easier to unit-test because all state is controlled through the returned API.
*/

/*
Comment 2 (escaping): the line in escapeHTML() (above) performs character-by-character replacement for & < > " '.
We also avoid innerHTML by using textContent when inserting titles into the DOM (see buildTaskNode).
This is sufficient for client-only rendering to prevent DOM injection, but in server-rendered or multi-user contexts you must also sanitize on the server and enforce a Content Security Policy (CSP) since client-side escaping alone cannot protect server logs, templates, or other consumers.
*/
