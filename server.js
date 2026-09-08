// Static file server + chat proxy for the JARVIS dashboard.
// Keeps the Anthropic API key server-side and forwards chat turns to Claude
// using the JARVIS_PERSONA system prompt, so the frontend never touches
// the key directly.

require('dotenv').config();
const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const persona = require('./assets/js/persona.js');
const db = require('./db.js');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[jarvis] ANTHROPIC_API_KEY is not set — /api/chat will return an error until it is. See .env.example.');
}
if (!process.env.DATABASE_URL) {
  console.warn('[jarvis] DATABASE_URL is not set — the to-do list will not be saved. See README.');
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tools JARVIS can call mid-conversation to manage the user's to-do list.
const tools = [
  {
    name: 'add_todo',
    description: "Add a new item to the user's to-do list.",
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The to-do item text' } },
      required: ['text'],
    },
  },
  {
    name: 'list_todos',
    description: "List everything currently on the user's to-do list, including completed items.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'complete_todo',
    description: 'Mark a to-do item as done, given its id (get the id from list_todos first if unknown).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'The id of the to-do item' } },
      required: ['id'],
    },
  },
  {
    name: 'remove_todo',
    description: 'Permanently delete a to-do item, given its id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'The id of the to-do item' } },
      required: ['id'],
    },
  },
  {
    name: 'add_milestone',
    description:
      "Add a milestone (a deadline-bound task) to a project. Creates the project automatically if it doesn't already exist. The milestone also appears on the general to-do list, tagged with its project and due date.",
    input_schema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project name, e.g. "Cabin build"' },
        text: { type: 'string', description: 'What needs to be done' },
        due_date: { type: 'string', description: 'Deadline in YYYY-MM-DD format' },
      },
      required: ['project', 'text', 'due_date'],
    },
  },
  {
    name: 'list_projects',
    description: "List every project along with its milestones, due dates, and completion status.",
    input_schema: { type: 'object', properties: {} },
  },
];

async function runTool(name, input) {
  switch (name) {
    case 'add_todo':
      return { ok: true, item: await db.addTodo(input.text) };
    case 'list_todos':
      return { ok: true, items: await db.listTodos() };
    case 'complete_todo': {
      const item = await db.completeTodo(input.id);
      return item ? { ok: true, item } : { ok: false, error: 'not found' };
    }
    case 'remove_todo':
      return { ok: await db.removeTodo(input.id) };
    case 'add_milestone': {
      const result = await db.addMilestone(input.project, input.text, input.due_date);
      return { ok: true, ...result };
    }
    case 'list_projects':
      return { ok: true, projects: await db.listProjects() };
    default:
      return { ok: false, error: `unknown tool ${name}` };
  }
}

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

  // Injected fresh per-request (rather than baked into persona.js) so
  // Claude can resolve relative dates like "by Friday" correctly.
  const todayStr = new Date().toISOString().slice(0, 10);
  const systemPrompt = `${persona.SYSTEM_PROMPT}\n\nToday's date is ${todayStr}.`;

  try {
    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      tools,
      messages,
    });

    // If Claude wants to add/check/list a to-do item, run the tool and hand
    // the result back so it can finish its reply. Looped in case it chains
    // more than one tool call before answering.
    let guard = 0;
    while (response.stop_reason === 'tool_use' && guard < 5) {
      guard++;
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await runTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt,
        tools,
        messages,
      });
    }

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

app.get('/api/todos', async (req, res) => {
  try {
    const items = await db.listTodos();
    res.json({ items });
  } catch (err) {
    console.error('[jarvis] /api/todos error:', err.message);
    res.status(500).json({ error: 'failed to load todos' });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await db.listProjects();
    res.json({ projects });
  } catch (err) {
    console.error('[jarvis] /api/projects error:', err.message);
    res.status(500).json({ error: 'failed to load projects' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const project = await db.getProject(id);
    if (!project) return res.status(404).json({ error: 'not found' });
    res.json({ project });
  } catch (err) {
    console.error('[jarvis] /api/projects/:id error:', err.message);
    res.status(500).json({ error: 'failed to load project' });
  }
});

app.post('/api/projects/:id/milestones', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { text, due_date } = req.body || {};
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  try {
    const milestone = await db.addMilestoneToProject(id, text.trim(), due_date || null);
    res.json({ milestone });
  } catch (err) {
    console.error('[jarvis] /api/projects/:id/milestones error:', err.message);
    res.status(500).json({ error: 'failed to add milestone' });
  }
});

app.patch('/api/todos/:id/done', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { done } = req.body || {};
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const item = await db.setTodoDone(id, !!done);
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json({ item });
  } catch (err) {
    console.error('[jarvis] /api/todos/:id/done error:', err.message);
    res.status(500).json({ error: 'failed to update' });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const removed = await db.removeTodo(id);
    res.json({ removed });
  } catch (err) {
    console.error('[jarvis] /api/todos/:id error:', err.message);
    res.status(500).json({ error: 'failed to delete' });
  }
});

db.init()
  .then(() => console.log('[jarvis] todos table ready'))
  .catch((err) => console.error('[jarvis] failed to set up the database:', err.message));

app.listen(PORT, () => {
  console.log(`[jarvis] serving on http://localhost:${PORT}`);
});
