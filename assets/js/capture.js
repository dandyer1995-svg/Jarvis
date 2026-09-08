// JARVIS Quick Capture — a stripped-down mobile page for firing a to-do or
// business idea at JARVIS on the go. No dashboard chrome, no gauges — just
// a mic, a text box, and a spoken confirmation. Talks to the same
// /api/chat endpoint as the full dashboard, so JARVIS categorizes and
// tags things (to-do vs idea, which business) exactly the same way.

(function () {
  const captureLog = document.getElementById('captureLog');
  const captureForm = document.getElementById('captureForm');
  const captureInput = document.getElementById('captureInput');
  const micBtn = document.getElementById('captureMicBtn');
  const micHint = document.getElementById('captureMicHint');

  const history = [];

  function appendMessage(who, text) {
    const wrap = document.createElement('div');
    wrap.className = `capture-msg capture-msg-${who}`;
    wrap.textContent = text;
    captureLog.appendChild(wrap);
    captureLog.scrollTop = captureLog.scrollHeight;
  }

  const persona = window.JARVIS_PERSONA;

  async function sendToAssistant(message) {
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
      const line = persona && persona.ERROR
        ? persona.ERROR[Math.floor(Math.random() * persona.ERROR.length)]
        : "That didn't go through.";
      return line;
    }
  }

  captureForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = captureInput.value.trim();
    if (!text) return;
    appendMessage('user', text);
    captureInput.value = '';
    const reply = await sendToAssistant(text);
    appendMessage('ai', reply);
    speak(reply);
  });

  // ---------- Speak the confirmation back (hands-free capture) ----------
  let jarvisVoice = null;
  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    jarvisVoice =
      voices.find((v) => /Daniel|Google UK English Male/i.test(v.name)) ||
      voices.find((v) => v.lang === 'en-GB') ||
      voices.find((v) => v.lang.startsWith('en')) ||
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

  // ---------- Mic: same extended-listening behaviour as the dashboard ----------
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let listening = false;
  let manualStop = false;
  let finalTranscript = '';
  let micTimeoutId = null;
  const MIC_MAX_SESSION_MS = 60000;

  if (!SpeechRecognitionCtor) {
    micBtn.disabled = true;
    micHint.textContent = 'Voice input not supported — try Chrome';
  } else {
    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      listening = true;
      micBtn.classList.add('listening');
      micHint.textContent = 'Listening… tap to send';
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
      captureInput.value = (finalTranscript + interim).trim();
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // keep listening, don't give up
    };

    recognition.onend = () => {
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
      micHint.textContent = 'Tap to speak';
      clearTimeout(micTimeoutId);
      const heard = finalTranscript.trim();
      finalTranscript = '';
      if (heard) {
        captureInput.value = heard;
        captureForm.requestSubmit();
      }
    };

    micBtn.addEventListener('click', () => {
      if (listening) {
        manualStop = true;
        recognition.stop();
      } else {
        manualStop = false;
        finalTranscript = '';
        speechSynthesis.cancel();
        recognition.start();
        clearTimeout(micTimeoutId);
        micTimeoutId = setTimeout(() => {
          manualStop = true;
          recognition.stop();
        }, MIC_MAX_SESSION_MS);
      }
    });
  }
})();
