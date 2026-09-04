// JARVIS-style AI interface dashboard
// All "live" system numbers below are simulated placeholders — wire buildStatus()
// and sendToAssistant() up to a real backend/API to make this functional.

(function () {
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52; // matches r=52 in the SVG gauges

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
  });

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
        coreState.textContent = 'LISTENING';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
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
          speechSynthesis.cancel(); // stop JARVIS talking before we listen
          recognition.start();
        }
      });
    }
  }

  // ---------- Boot sequence ----------
  function init() {
    tickClock();
    tickUptime();
    refreshStatus();
    pushLog('System boot sequence complete.');

    setInterval(tickClock, 1000);
    setInterval(tickUptime, 1000);
    setInterval(refreshStatus, 2500);
    setInterval(() => {
      pushLog(logMessages[Math.floor(Math.random() * logMessages.length)]);
    }, 6000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
