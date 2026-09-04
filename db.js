// Postgres connection + persistence for Barney's to-do list.
// Requires a DATABASE_URL environment variable pointing at a Postgres
// database (e.g. a free Render PostgreSQL instance). Without it, the
// to-do endpoints will fail — everything else in the app still works.

const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Render's managed Postgres uses a self-signed cert internally.
      ssl: { rejectUnauthorized: false },
    })
  : null;

async function init() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function listTodos() {
  if (!pool) return [];
  const { rows } = await pool.query(
    'SELECT id, text, done FROM todos ORDER BY done ASC, id ASC'
  );
  return rows;
}

async function addTodo(text) {
  const { rows } = await pool.query(
    'INSERT INTO todos (text) VALUES ($1) RETURNING id, text, done',
    [text]
  );
  return rows[0];
}

async function completeTodo(id) {
  const { rows } = await pool.query(
    'UPDATE todos SET done = true WHERE id = $1 RETURNING id, text, done',
    [id]
  );
  return rows[0] || null;
}

async function removeTodo(id) {
  const { rowCount } = await pool.query('DELETE FROM todos WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { init, listTodos, addTodo, completeTodo, removeTodo, isConfigured: !!pool };
