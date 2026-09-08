// JARVIS-style AI interface dashboard
// All "live" system numbers below are simulated placeholders — wire buildStatus()
// and sendToAssistant() up to a real backend/API to make this functional.

(function () {
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52; // matches r=52 in the SVG gauges

  // ---------- Reactor core: spinning particle field ----------
  // Replaces the old clean HUD rings with layered bands of small dots that
  // orbit the core at different speeds/directions, like a swirling star
  // field around a central glow.
  // ---------- Reactor core: precision HUD aperture ----------
  // Thin etched rings (solid/dashed/dotted), a couple of small geometric
  // accent nodes, and a sparse dot bezel — mostly static, with only a
  // handful of rings on a slow rotation. Deliberately restrained: crisp
  // vector linework rather than a dense glowing particle field.
  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function generateCoreRings() {
    const tickGroup = document.querySelector('.tick-group');
    if (!tickGroup) return;
    const svgNS = 'http://www.w3.org/2000/svg';

    function addRing({ r, dash, w, faint, rot }) {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '200');
      circle.setAttribute('cy', '200');
      circle.setAttribute('r', String(r));
      circle.setAttribute('class', `core-ring${faint ? ' faint' : ''}`);
      circle.setAttribute('stroke-width', String(w));
      if (dash) circle.setAttribute('stroke-dasharray', dash);

      if (rot) {
        const g = document.createElementNS(svgNS, 'g');
        g.style.transformOrigin = '200px 200px';
        g.style.animation = `${rot.dir === 1 ? 'spin' : 'spin-rev'} ${rot.dur}s linear infinite`;
        g.appendChild(circle);
        tickGroup.appendChild(g);
      } else {
        tickGroup.appendChild(circle);
      }
    }

    // Etched concentric rings — mostly static, mixed line styles.
    addRing({ r: 58, dash: null, w: 1, faint: false });
    addRing({ r: 74, dash: '1 5', w: 1, faint: true });
    addRing({ r: 92, dash: null, w: 0.75, faint: true });
    addRing({ r: 110, dash: '3 4', w: 1, faint: false, rot: { dir: 1, dur: 95 } });
    addRing({ r: 130, dash: null, w: 0.75, faint: true });
    addRing({ r: 152, dash: '16 7', w: 1.5, faint: false, rot: { dir: -1, dur: 75 } });
    addRing({ r: 174, dash: '1 6', w: 1, faint: true });
    addRing({ r: 198, dash: '2 4', w: 0.75, faint: true, rot: { dir: 1, dur: 140 } });

    // Sparse dot bezels at two radii — the "instrument rim" detail from
    // the reference image, not a dense particle cloud.
    function addDotRing(r, count, size, faint) {
      const g = document.createElementNS(svgNS, 'g');
      for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i;
        const p = polarToCartesian(200, 200, r, angle);
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
        dot.setAttribute('r', String(size));
        dot.setAttribute('class', `core-dot${faint ? ' faint' : ''}`);
        g.appendChild(dot);
      }
      tickGroup.appendChild(g);
    }
    addDotRing(66, 28, 0.9, true);
    addDotRing(206, 40, 1.1, false);

    // A few small unfilled diamond nodes at asymmetric points — reads as
    // a sensor/connector detail without adding visual weight.
    function addDiamondNode(angleDeg, r, size) {
      const p = polarToCartesian(200, 200, r, angleDeg);
      const pts = [
        [p.x, p.y - size], [p.x + size, p.y], [p.x, p.y + size], [p.x - size, p.y],
      ];
      const poly = document.createElementNS(svgNS, 'polygon');
      poly.setAttribute('points', pts.map((pt) => pt.map((n) => n.toFixed(1)).join(',')).join(' '));
      poly.setAttribute('class', 'core-node');
      tickGroup.appendChild(poly);
    }
    addDiamondNode(-35, 100, 4);
    addDiamondNode(150, 133, 3.5);
    addDiamondNode(62, 179, 4.5);

    // A light scatter of small dim particles for subtle texture/depth —
    // far sparser than before, secondary to the rings rather than the
    // main event.
    const bands = [
      { count: 10, rMin: 60, rMax: 95, dotMin: 0.6, dotMax: 1.1, op: [0.3, 0.55] },
      { count: 14, rMin: 100, rMax: 150, dotMin: 0.5, dotMax: 1.0, op: [0.2, 0.45] },
      { count: 12, rMin: 155, rMax: 195, dotMin: 0.4, dotMax: 0.9, op: [0.15, 0.35] },
    ];
    bands.forEach((band) => {
      for (let i = 0; i < band.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = band.rMin + Math.random() * (band.rMax - band.rMin);
        const x = 200 + radius * Math.cos(angle);
        const y = 200 + radius * Math.sin(angle);
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
        dot.setAttribute('r', (band.dotMin + Math.random() * (band.dotMax - band.dotMin)).toFixed(2));
        dot.setAttribute('class', 'core-particle');
        const baseOp = (band.op[0] + Math.random() * (band.op[1] - band.op[0])).toFixed(2);
        dot.style.setProperty('--base-op', baseOp);
        dot.style.animationDuration = `${(3 + Math.random() * 3).toFixed(1)}s`;
        dot.style.animationDelay = `-${(Math.random() * 4).toFixed(1)}s`;
        tickGroup.appendChild(dot);
      }
    });
  }

  // ---------- Clock ----------
  function tickClock() {
    const now = new Date();
    document.getElementById('clockTime').textContent =
      now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('clockDate').textContent =
      now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ---------- Uptime ----------
  const bootTime = Date.now();
  function tickUptime() {
    const secs = Math.floor((Date.now() - bootTime) / 1000);
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    document.getElementById('uptimeVal').textContent = `${h}:${m}:${s}`;
  }

  // ---------- Gauges (CPU / MEM) ----------
  function setGauge(metric, percent) {
    const gauge = document.querySelector(`.gauge[data-metric="${metric}"]`);
    if (!gauge) return;
    const fill = gauge.querySelector('.gauge-fill');
    const value = gauge.querySelector('.gauge-value');
    const offset = GAUGE_CIRCUMFERENCE * (1 - percent / 100);
    fill.style.strokeDashoffset = offset;
    value.textContent = Math.round(percent);
  }

  // ---------- Bar metrics ----------
  function setBar(barId, valueId, percent, label) {
    document.getElementById(barId).style.width = `${percent}%`;
    document.getElementById(valueId).textContent = label;
  }

  function randomWalk(prev, min, max, maxStep) {
    const next = prev + (Math.random() - 0.5) * maxStep;
    return Math.min(max, Math.max(min, next));
  }

  let cpu = 32, mem = 54, disk = 61, net = 120, lat = 40;

  function refreshStatus() {
    cpu = randomWalk(cpu, 8, 92, 14);
    mem = randomWalk(mem, 20, 85, 6);
    disk = randomWalk(disk, 40, 80, 3);
    net = randomWalk(net, 10, 900, 120);
    lat = randomWalk(lat, 12, 120, 20);

    setGauge('cpu', cpu);
    setGauge('mem', mem);
    setBar('diskBar', 'diskVal', disk, `${Math.round(disk)} %`);
    setBar('netBar', 'netVal', Math.min(100, net / 9), `${Math.round(net)} KB/s`);
    setBar('latBar', 'latVal', Math.min(100, lat), `${Math.round(lat)} ms`);
  }

  // ---------- Activity log ----------
  const logMessages = [
    'Voice input calibrated.',
    'Background sync completed.',
    'Memory index optimized.',
    'No anomalies detected.',
    'Session context saved.',
    'Network handshake stable.',
    'Idle scan complete.'
  ];
  const logList = document.getElementById('logList');
  function pushLog(text) {
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    li.innerHTML = `<span class="log-time">${time}</span>${text}`;
    logList.prepend(li);
    while (logList.children.length > 12) {
      logList.removeChild(logList.lastChild);
    }
  }

  // ---------- Chat ----------
  const chatLog = document.getElementById('chatLog');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const coreState = document.getElementById('coreState');

  function appendMessage(who, text) {
    const wrap = document.createElement('div');
    wrap.className = `msg msg-${who}`;
    const tag = document.createElement('span');
    tag.className = 'msg-tag';
    tag.textContent = who === 'ai' ? 'JARVIS' : 'YOU';
    const body = document.createElement('span');
    body.className = 'msg-text';
    body.textContent = text;
    wrap.appendChild(tag);
    wrap.appendChild(body);
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function pickLine(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  // Conversation history sent to the server on each turn, so the model has
  // context. Kept client-side; server.js is stateless between requests.
  const history = [];

  // Calls the /api/chat endpoint in server.js, which forwards to Claude
  // using JARVIS_PERSONA.SYSTEM_PROMPT. Falls back to a stock persona line
  // if the server isn't running or ANTHROPIC_API_KEY isn't configured.
  async function sendToAssistant(message) {
    const persona = window.JARVIS_PERSONA;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const data = await res.json();
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: data.reply });
      return data.reply;
    } catch (err) {
      return `${pickLine(persona.ERROR)} ${persona.FALLBACK_SUFFIX}`;
    }
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage('user', text);
    chatInput.value = '';
    coreState.textContent = 'PROCESSING';
    pushLog(`Command received: "${text}"`);

    const reply = await sendToAssistant(text);
    appendMessage('ai', reply);
    speak(reply);
    coreState.textContent = 'LISTENING';
    refreshTodos();
    refreshProjects();
    refreshBusinesses();
    refreshIdeas();
  });

  // ---------- To-Do list ----------
  const todoList = document.getElementById('todoList');
  const todoTabs = document.getElementById('todoTabs');
  let allTodos = [];
  let businessList = [];
  let activeBusinessTab = 'all'; // 'all' | 'none' | a business id

  function renderTodos(items) {
    if (!todoList) return;
    todoList.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'todo-empty';
      li.textContent = 'Nothing on the list yet.';
      todoList.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      if (item.done) li.classList.add('done');
      const check = document.createElement('span');
      check.className = 'todo-check' + (item.done ? ' checked' : '');
      const label = document.createElement('span');
      label.textContent = item.text;
      li.appendChild(check);
      li.appendChild(label);
      todoList.appendChild(li);
    });
  }

  function applyTodoFilter() {
    let filtered = allTodos;
    if (activeBusinessTab === 'none') {
      filtered = allTodos.filter((i) => !i.business_id);
    } else if (activeBusinessTab !== 'all') {
      filtered = allTodos.filter((i) => i.business_id === activeBusinessTab);
    }
    renderTodos(filtered);
  }

  function renderTodoTabs() {
    if (!todoTabs) return;
    todoTabs.innerHTML = '';
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'none', label: 'General' },
      ...businessList.map((b) => ({ id: b.id, label: b.name })),
    ];
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'todo-tab' + (activeBusinessTab === t.id ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        activeBusinessTab = t.id;
        renderTodoTabs();
        applyTodoFilter();
      });
      todoTabs.appendChild(btn);
    });
  }

  async function refreshTodos() {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) return;
      const data = await res.json();
      allTodos = data.items || [];
      applyTodoFilter();
    } catch (err) {
      // silent — panel just keeps showing its last known state
    }
  }

  async function refreshBusinesses() {
    try {
      const res = await fetch('/api/businesses');
      if (!res.ok) return;
      const data = await res.json();
      businessList = data.businesses || [];
      renderTodoTabs();
      renderIdeaTabs();
    } catch (err) {
      // silent
    }
  }

  // ---------- Ideas (future projects / business ideas) ----------
  const ideaList = document.getElementById('ideaList');
  const ideaTabs = document.getElementById('ideaTabs');
  const ideaAddForm = document.getElementById('ideaAddForm');
  const ideaAddText = document.getElementById('ideaAddText');
  let allIdeas = [];
  let activeIdeaTab = 'all'; // 'all' | 'none' | a business id

  function renderIdeas(items) {
    if (!ideaList) return;
    ideaList.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'todo-empty';
      li.textContent = 'No ideas on file yet.';
      ideaList.appendChild(li);
      return;
    }
    items.forEach((idea) => {
      const li = document.createElement('li');
      const bullet = document.createElement('span');
      bullet.className = 'idea-bullet';
      bullet.textContent = '✦';
      const text = document.createElement('span');
      text.className = 'idea-text';
      text.textContent = idea.text;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'idea-delete';
      del.textContent = '✕';
      del.title = 'Delete';
      del.addEventListener('click', () => deleteIdea(idea.id));
      li.appendChild(bullet);
      li.appendChild(text);
      li.appendChild(del);
      ideaList.appendChild(li);
    });
  }

  function applyIdeaFilter() {
    let filtered = allIdeas;
    if (activeIdeaTab === 'none') {
      filtered = allIdeas.filter((i) => !i.business_id);
    } else if (activeIdeaTab !== 'all') {
      filtered = allIdeas.filter((i) => i.business_id === activeIdeaTab);
    }
    renderIdeas(filtered);
  }

  function renderIdeaTabs() {
    if (!ideaTabs) return;
    ideaTabs.innerHTML = '';
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'none', label: 'General' },
      ...businessList.map((b) => ({ id: b.id, label: b.name })),
    ];
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'todo-tab' + (activeIdeaTab === t.id ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        activeIdeaTab = t.id;
        renderIdeaTabs();
        applyIdeaFilter();
      });
      ideaTabs.appendChild(btn);
    });
  }

  async function refreshIdeas() {
    try {
      const res = await fetch('/api/ideas');
      if (!res.ok) return;
      const data = await res.json();
      allIdeas = data.ideas || [];
      applyIdeaFilter();
    } catch (err) {
      // silent
    }
  }

  async function deleteIdea(id) {
    try {
      await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
    } catch (err) {
      // silent
    }
    refreshIdeas();
  }

  if (ideaAddForm) {
    ideaAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ideaAddText.value.trim();
      if (!text) return;
      // Quick-add from the dashboard always goes in as general; use chat
      // ("save an idea for VA Power...") to tag one to a business.
      try {
        await fetch('/api/ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        ideaAddText.value = '';
        refreshIdeas();
      } catch (err) {
        // silent
      }
    });
  }

  // ---------- Projects & milestones ----------
  const projectList = document.getElementById('projectList');

  // Urgency drives both the dot colour on the dashboard and whether an
  // item counts toward the spoken deadline summary on load.
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

  function formatDueDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function renderProjects(projects) {
    if (!projectList) return;
    projectList.innerHTML = '';
    if (!projects.length) {
      const div = document.createElement('div');
      div.className = 'project-empty';
      div.textContent = 'No projects yet.';
      projectList.appendChild(div);
      return;
    }
    projects.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'project-card';

      const head = document.createElement('div');
      head.className = 'project-head';
      const name = document.createElement('span');
      name.className = 'project-name';
      name.textContent = p.name;
      const doneCount = p.milestones.filter((m) => m.done).length;
      const progress = document.createElement('span');
      progress.className = 'project-progress';
      progress.textContent = `${doneCount}/${p.milestones.length}`;
      head.appendChild(name);
      head.appendChild(progress);
      card.appendChild(head);

      const ul = document.createElement('ul');
      ul.className = 'milestone-list';
      p.milestones.forEach((m) => {
        const li = document.createElement('li');
        li.className = `milestone ${urgencyOf(m)}`;
        const dot = document.createElement('span');
        dot.className = 'milestone-dot';
        const text = document.createElement('span');
        text.className = 'milestone-text';
        text.textContent = m.text;
        li.appendChild(dot);
        li.appendChild(text);
        if (m.due_date) {
          const due = document.createElement('span');
          due.className = 'milestone-due';
          due.textContent = formatDueDate(m.due_date);
          li.appendChild(due);
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
      card.addEventListener('click', () => openProjectModal(p.id));
      projectList.appendChild(card);
    });
  }

  async function refreshProjects() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      renderProjects(data.projects || []);
    } catch (err) {
      // silent — panel just keeps showing its last known state
    }
  }

  // ---------- Project detail modal ----------
  const projectModalOverlay = document.getElementById('projectModalOverlay');
  const projectModalTitle = document.getElementById('projectModalTitle');
  const projectModalProgress = document.getElementById('projectModalProgress');
  const projectModalMilestones = document.getElementById('projectModalMilestones');
  const projectModalClose = document.getElementById('projectModalClose');
  const projectModalAddForm = document.getElementById('projectModalAddForm');
  const projectModalAddText = document.getElementById('projectModalAddText');
  const projectModalAddDate = document.getElementById('projectModalAddDate');
  let currentProjectId = null;

  async function openProjectModal(id) {
    currentProjectId = id;
    projectModalOverlay.hidden = false;
    await loadProjectIntoModal(id);
  }

  function closeProjectModal() {
    projectModalOverlay.hidden = true;
    currentProjectId = null;
  }

  async function loadProjectIntoModal(id) {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      renderProjectModal(data.project);
    } catch (err) {
      // silent
    }
  }

  function renderProjectModal(project) {
    projectModalTitle.textContent = project.name;
    const doneCount = project.milestones.filter((m) => m.done).length;
    projectModalProgress.textContent = `${doneCount}/${project.milestones.length} complete`;

    projectModalMilestones.innerHTML = '';
    if (!project.milestones.length) {
      const li = document.createElement('li');
      li.className = 'modal-empty';
      li.textContent = 'No milestones yet — add one below.';
      projectModalMilestones.appendChild(li);
      return;
    }

    project.milestones.forEach((m) => {
      const li = document.createElement('li');
      li.className = urgencyOf(m);

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'modal-check' + (m.done ? ' checked' : '');
      check.textContent = m.done ? '✓' : '';
      check.addEventListener('click', () => toggleMilestone(m.id, !m.done));

      const text = document.createElement('span');
      text.className = 'modal-milestone-text';
      text.textContent = m.text;

      li.appendChild(check);
      li.appendChild(text);

      if (m.due_date) {
        const due = document.createElement('span');
        due.className = 'modal-milestone-due';
        due.textContent = formatDueDate(m.due_date);
        li.appendChild(due);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'modal-delete';
      del.textContent = '✕';
      del.title = 'Delete';
      del.addEventListener('click', () => deleteMilestone(m.id));
      li.appendChild(del);

      projectModalMilestones.appendChild(li);
    });
  }

  async function toggleMilestone(id, done) {
    try {
      await fetch(`/api/todos/${id}/done`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done }),
      });
    } catch (err) {
      // silent
    }
    if (currentProjectId != null) await loadProjectIntoModal(currentProjectId);
    refreshProjects();
    refreshTodos();
  }

  async function deleteMilestone(id) {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    } catch (err) {
      // silent
    }
    if (currentProjectId != null) await loadProjectIntoModal(currentProjectId);
    refreshProjects();
    refreshTodos();
  }

  if (projectModalClose) projectModalClose.addEventListener('click', closeProjectModal);
  if (projectModalOverlay) {
    projectModalOverlay.addEventListener('click', (e) => {
      if (e.target === projectModalOverlay) closeProjectModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !projectModalOverlay.hidden) closeProjectModal();
  });

  if (projectModalAddForm) {
    projectModalAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = projectModalAddText.value.trim();
      if (!text || currentProjectId == null) return;
      const dueDate = projectModalAddDate.value || null;
      try {
        await fetch(`/api/projects/${currentProjectId}/milestones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, due_date: dueDate }),
        });
        projectModalAddText.value = '';
        projectModalAddDate.value = '';
        await loadProjectIntoModal(currentProjectId);
        refreshProjects();
        refreshTodos();
      } catch (err) {
        // silent
      }
    });
  }

  // Spoken once, when the dashboard is opened — not repeated on every
  // refresh, so it doesn't nag.
  async function speakDeadlineSummary() {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) return;
      const items = (await res.json()).items || [];
      const pending = items.filter((i) => !i.done && i.due_date);
      const overdue = pending.filter((i) => urgencyOf(i) === 'overdue').length;
      const dueSoon = pending.filter((i) => urgencyOf(i) === 'warn').length;
      if (!overdue && !dueSoon) return;
      const parts = [];
      if (overdue) parts.push(`${overdue} item${overdue === 1 ? '' : 's'} overdue`);
      if (dueSoon) parts.push(`${dueSoon} due within the next three days`);
      speak(`Sir, you have ${parts.join(' and ')}.`);
    } catch (err) {
      // silent
    }
  }

  // ---------- Voice: JARVIS speaks (text-to-speech) ----------
  let jarvisVoice = null;
  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    jarvisVoice =
      voices.find(v => /Daniel|Google UK English Male/i.test(v.name)) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] || null;
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = pickVoice;
    pickVoice();
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (jarvisVoice) utter.voice = jarvisVoice;
    utter.rate = 1;
    utter.pitch = 0.85;
    speechSynthesis.speak(utter);
  }

  // ---------- Voice: you speak (speech-to-text via mic button) ----------
  const micBtn = document.getElementById('micBtn');
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let manualStop = false;
  let finalTranscript = '';
  let micTimeoutId = null;
  const MIC_MAX_SESSION_MS = 60000; // hard safety cap so the mic never stays open forever

  if (micBtn) {
    if (!SpeechRecognitionCtor) {
      micBtn.disabled = true;
      micBtn.title = 'Speech recognition not supported in this browser (try Chrome or Edge)';
    } else {
      recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-GB';
      recognition.continuous = true; // don't stop the instant there's a pause
      recognition.interimResults = true; // show live text so you know it's still listening

      recognition.onstart = () => {
        listening = true;
        micBtn.classList.add('listening');
        coreState.textContent = 'LISTENING';
      };

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += `${transcript} `;
          } else {
            interim += transcript;
          }
        }
        chatInput.value = (finalTranscript + interim).trim();
      };

      recognition.onerror = (event) => {
        // "no-speech" fires ~5s in if it hasn't heard anything yet — that's
        // not a real error, it's Chrome giving up too early. Swallow it and
        // keep the mic open rather than dropping the session.
        if (event.error === 'no-speech') return;
        pushLog(`Voice input error: ${event.error}`);
      };

      recognition.onend = () => {
        // Chrome sometimes ends the session on its own even in continuous
        // mode. If the user didn't ask to stop, just pick it back up.
        if (listening && !manualStop) {
          try {
            recognition.start();
            return;
          } catch (err) {
            // fall through to full stop below
          }
        }
        listening = false;
        manualStop = false;
        micBtn.classList.remove('listening');
        clearTimeout(micTimeoutId);
        const heard = finalTranscript.trim();
        finalTranscript = '';
        if (heard) {
          chatInput.value = heard;
          chatForm.requestSubmit();
        }
      };

      micBtn.addEventListener('click', () => {
        if (listening) {
          manualStop = true;
          recognition.stop();
        } else {
          manualStop = false;
          finalTranscript = '';
          speechSynthesis.cancel(); // stop JARVIS talking before we listen
          recognition.start();
          clearTimeout(micTimeoutId);
          micTimeoutId = setTimeout(() => {
            manualStop = true;
            recognition.stop();
          }, MIC_MAX_SESSION_MS);
        }
      });
    }
  }

  // ---------- External connections status ----------
  async function refreshConnections() {
    const outlookStatus = document.getElementById('outlookStatus');
    const saltwoodGmailStatus = document.getElementById('saltwoodGmailStatus');
    if (!outlookStatus && !saltwoodGmailStatus) return;

    function renderStatus(el, info, connectUrl) {
      if (!el) return;
      if (!info || !info.configured) {
        el.textContent = 'Not set up';
        el.classList.remove('connected');
      } else if (info.connected) {
        el.textContent = 'Connected';
        el.classList.add('connected');
      } else {
        el.classList.remove('connected');
        el.innerHTML = `<a href="${connectUrl}">Connect</a>`;
      }
    }

    try {
      const res = await fetch('/api/connections');
      if (!res.ok) return;
      const data = await res.json();
      renderStatus(outlookStatus, data.microsoft, '/auth/microsoft/login');
      renderStatus(saltwoodGmailStatus, data.googleSaltwood, '/auth/google/login');
    } catch (err) {
      // silent
    }
  }

  // ---------- Boot sequence ----------
  function init() {
    generateCoreRings();
    tickClock();
    tickUptime();
    refreshStatus();
    refreshBusinesses();
    refreshTodos();
    refreshProjects();
    refreshIdeas();
    refreshConnections();
    pushLog('System boot sequence complete.');

    setInterval(tickClock, 1000);
    setInterval(tickUptime, 1000);
    setInterval(refreshStatus, 2500);
    setInterval(refreshTodos, 15000);
    setInterval(refreshProjects, 15000);
    setInterval(refreshIdeas, 15000);
    setInterval(() => {
      pushLog(logMessages[Math.floor(Math.random() * logMessages.length)]);
    }, 6000);

    // Give voices a moment to load and the boot sequence to settle before
    // JARVIS speaks the deadline summary, so it doesn't talk over itself.
    setTimeout(speakDeadlineSummary, 1800);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
