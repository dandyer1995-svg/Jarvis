// Barney dashboard front-end.
// Chat talks to /api/chat (Claude + to-do tools). To-do and activity
// panels reflect real state — nothing here is simulated.

(function () {
  // ---------- Header: date + connection status ----------
  const dateLabel = document.getElementById('dateLabel');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  function tickDate() {
    const now = new Date();
    dateLabel.textContent = now.toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Online';
      document.getElementById('envModel').textContent = data.model || '—';
      document.getElementById('envData').textContent = data.dbConnected ? 'Connected' : 'Not connected';
    } catch (err) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Offline';
    }
  }

  // ---------- Activity feed (real events only) ----------
  const logList = document.getElementById('logList');
  function pushLog(text) {
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span class="log-time">${time}</span>${text}`;
    logList.prepend(li);
    while (logList.children.length > 8) {
      logList.removeChild(logList.lastChild);
    }
  }

  // ---------- Chat ----------
  const chatLog = document.getElementById('chatLog');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  function appendMessage(who, text) {
    const wrap = document.createElement('div');
    wrap.className = `msg msg-${who}`;
    const tag = document.createElement('span');
    tag.className = 'msg-tag';
    tag.textContent = who === 'ai' ? 'Barney' : 'You';
    const body = document.createElement('p');
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

  async function sendToAssistant(message) {
    const persona = window.BARNEY_PERSONA;
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
    pushLog('Message sent');

    const reply = await sendToAssistant(text);
    appendMessage('ai', reply);
    speak(reply);
    pushLog('Reply received');
    refreshTodos();
  });

  // ---------- To-do list ----------
  const todoList = document.getElementById('todoList');
  const todoCount = document.getElementById('todoCount');

  function renderTodos(items) {
    if (!todoList) return;
    todoList.innerHTML = '';
    const open = items.filter((i) => !i.done).length;
    todoCount.textContent = open ? `${open} open` : '';

    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'todo-empty';
      li.textContent = 'Nothing on the list yet.';
      todoList.appendChild(li);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (item.done ? ' done' : '');

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo-check' + (item.done ? ' checked' : '');
      check.setAttribute('aria-label', item.done ? 'Completed' : 'Mark as done');
      check.textContent = item.done ? '✓' : '';
      check.disabled = item.done;
      check.addEventListener('click', () => completeTodo(item));

      const label = document.createElement('span');
      label.className = 'todo-label';
      label.textContent = item.text;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'todo-delete';
      del.setAttribute('aria-label', 'Delete');
      del.textContent = '×';
      del.addEventListener('click', () => deleteTodo(item));

      li.appendChild(check);
      li.appendChild(label);
      li.appendChild(del);
      todoList.appendChild(li);
    });
  }

  async function refreshTodos() {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) return;
      const data = await res.json();
      renderTodos(data.items || []);
    } catch (err) {
      // silent — panel just keeps showing its last known state
    }
  }

  async function completeTodo(item) {
    try {
      await fetch(`/api/todos/${item.id}/complete`, { method: 'POST' });
      pushLog(`Completed "${item.text}"`);
      refreshTodos();
    } catch (err) {}
  }

  async function deleteTodo(item) {
    try {
      await fetch(`/api/todos/${item.id}`, { method: 'DELETE' });
      pushLog(`Removed "${item.text}"`);
      refreshTodos();
    } catch (err) {}
  }

  // ---------- Voice: Barney speaks (text-to-speech) ----------
  let barneyVoice = null;
  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    barneyVoice =
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
    if (barneyVoice) utter.voice = barneyVoice;
    utter.rate = 1;
    utter.pitch = 0.95;
    speechSynthesis.speak(utter);
  }

  // ---------- Voice: you speak (speech-to-text via mic button) ----------
  const micBtn = document.getElementById('micBtn');
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const envVoice = document.getElementById('envVoice');
  let recognition = null;
  let listening = false;

  if (envVoice) envVoice.textContent = SpeechRecognitionCtor ? 'Ready' : 'Unavailable';

  if (micBtn) {
    if (!SpeechRecognitionCtor) {
      micBtn.disabled = true;
      micBtn.title = 'Speech recognition not supported in this browser (try Chrome or Edge)';
    } else {
      recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-GB';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        listening = true;
        micBtn.classList.add('listening');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        pushLog('Voice input used');
        chatForm.requestSubmit();
      };

      recognition.onerror = (event) => {
        pushLog(`Voice input error: ${event.error}`);
      };

      recognition.onend = () => {
        listening = false;
        micBtn.classList.remove('listening');
      };

      micBtn.addEventListener('click', () => {
        if (listening) {
          recognition.stop();
        } else {
          speechSynthesis.cancel(); // stop Barney talking before we listen
          recognition.start();
        }
      });
    }
  }

  // ---------- Boot ----------
  function init() {
    tickDate();
    setInterval(tickDate, 30000);
    checkHealth();
    refreshTodos();
    setInterval(refreshTodos, 15000);
    pushLog('Dashboard loaded');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
