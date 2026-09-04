// Static file server + chat proxy for the JARVIS dashboard.
// Keeps the Anthropic API key server-side and forwards chat turns to Claude
// using the JARVIS_PERSONA system prompt, so the frontend never touches
// the key directly.

require('dotenv').config();
const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const persona = require('./assets/js/persona.js');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[jarvis] ANTHROPIC_API_KEY is not set — /api/chat will return an error until it is. See .env.example.');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
  }

  // history is the prior turns as [{ role: 'user' | 'assistant', content: string }, ...]
  const messages = Array.isArray(history) ? history.slice(-20) : [];
  messages.push({ role: 'user', content: message });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: persona.SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ reply });
  } catch (err) {
    console.error('[jarvis] /api/chat error:', err.message);
    res.status(502).json({ error: 'model request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[jarvis] serving on http://localhost:${PORT}`);
});
