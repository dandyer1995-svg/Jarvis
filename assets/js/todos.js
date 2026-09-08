// JARVIS To-Do dashboard — a fuller, dedicated view of the same to-do
// list that appears compactly on the main dashboard. Talks to the same
// /api/todos endpoints, so anything done here or on the main dashboard
// or via chat/voice stays in sync.

(function () {
  const statsEl = document.getElementById('todosStats');
  const tabsEl = document.getElementById('todosPageTabs');
  const listEl = document.getElementById('todosPageList');
  const addForm = document.getElementById('todosAddForm');
  const addText = document.getElementById('todosAddText');
  const addBusiness = document.getElementById('todosAddBusiness');

  let allTodos = [];
  let businessList = [];
  let activeTab = 'all'; // 'all' | 'none' | a business id

  function formatDueDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function urgencyOf(item) {
    if (item.done) return 'done';
    if (!item.due_date) return 'none';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${item.due_date}T00:00:00`);
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'warn';
    return 'ok';
  }

  function filteredTodos() {
    if (activeTab === 'none') return allTodos.filter((i) => !i.business_id);
    if (activeTab === 'all') return allTodos;
    return allTodos.filter((i) => i.business_id === activeTab);
  }

  function renderStats() {
    const items = filteredTodos();
    const done = items.filter((i) => i.done).length;
    const open = items.length - done;
    statsEl.textContent = `${open} open · ${done} done · ${items.length} total`;
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'none', label: 'General' },
      ...businessList.map((b) => ({ id: b.id, label: b.name })),
    ];
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'todo-tab' + (activeTab === t.id ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        activeTab = t.id;
        renderTabs();
        renderList();
        renderStats();
      });
      tabsEl.appendChild(btn);
    });
  }

  function renderBusinessSelect() {
    addBusiness.innerHTML = '<option value="">General</option>';
    businessList.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      addBusiness.appendChild(opt);
    });
  }

  function renderList() {
    const items = filteredTodos();
    listEl.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'todo-empty';
      li.textContent = 'Nothing here yet.';
      listEl.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = `todos-page-row ${urgencyOf(item)}`;

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'modal-check' + (item.done ? ' checked' : '');
      check.textContent = item.done ? '✓' : '';
      check.addEventListener('click', () => toggleDone(item.id, !item.done));

      const main = document.createElement('div');
      main.className = 'todos-page-main';

      const text = document.createElement('span');
      text.className = 'todos-page-text';
      text.textContent = item.text;
      main.appendChild(text);

      const meta = document.createElement('div');
      meta.className = 'todos-page-meta';
      if (item.business_name) {
        const tag = document.createElement('span');
        tag.className = 'todos-page-tag';
        tag.textContent = item.business_name;
        meta.appendChild(tag);
      }
      if (item.project_name) {
        const tag = document.createElement('span');
        tag.className = 'todos-page-tag project';
        tag.textContent = item.project_name;
        meta.appendChild(tag);
      }
      if (item.due_date) {
        const due = document.createElement('span');
        due.className = 'todos-page-due';
        due.textContent = formatDueDate(item.due_date);
        meta.appendChild(due);
      }
      if (meta.childNodes.length) main.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'idea-delete';
      del.textContent = '✕';
      del.title = 'Delete';
      del.addEventListener('click', () => deleteTodo(item.id));

      li.appendChild(check);
      li.appendChild(main);
      li.appendChild(del);
      listEl.appendChild(li);
    });
  }

  async function refreshTodos() {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) return;
      const data = await res.json();
      allTodos = data.items || [];
      renderList();
      renderStats();
    } catch (err) {
      // silent
    }
  }

  async function refreshBusinesses() {
    try {
      const res = await fetch('/api/businesses');
      if (!res.ok) return;
      const data = await res.json();
      businessList = data.businesses || [];
      renderTabs();
      renderBusinessSelect();
    } catch (err) {
      // silent
    }
  }

  async function toggleDone(id, done) {
    try {
      await fetch(`/api/todos/${id}/done`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
    } catch (err) {
      // silent
    }
    refreshTodos();
  }

  async function deleteTodo(id) {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    } catch (err) {
      // silent
    }
    refreshTodos();
  }

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = addText.value.trim();
    if (!text) return;
    const business = addBusiness.value || undefined;
    try {
      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, business }),
      });
      addText.value = '';
      refreshTodos();
    } catch (err) {
      // silent
    }
  });

  refreshBusinesses();
  refreshTodos();
  setInterval(refreshTodos, 15000);
})();
