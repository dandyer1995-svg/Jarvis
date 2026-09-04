# JARVIS Dashboard

A JARVIS-style AI interface dashboard: an animated core visualization,
live system-status gauges, an activity log, and a chat console backed by
Claude.

## Running it with a real model

The dashboard is static HTML/CSS/JS, but the chat console needs a backend
to hold the API key and call Claude — `server.js` provides that.

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and add your Anthropic API key:
   ```
   cp .env.example .env
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open `http://localhost:3000`.

Chat messages now go to `/api/chat` (in `server.js`), which forwards them
to Claude using the persona defined in `assets/js/persona.js` as the
system prompt.

Without `ANTHROPIC_API_KEY` set, the dashboard still runs — the chat falls
back to a stock in-voice line telling you the model isn't connected.

## Project structure

- `index.html`, `assets/css/style.css`, `assets/js/app.js` — the dashboard UI
- `assets/js/persona.js` — JARVIS's voice (system prompt + stock lines),
  shared by the browser and `server.js`
- `server.js` — static file server + `/api/chat` proxy to the Anthropic API
