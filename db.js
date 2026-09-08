// Postgres connection + persistence for JARVIS's to-do list.
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ideas (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      business_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Case-insensitive uniqueness so "Cabin build" and "cabin Build" (or
  // "yesss electrical" spoken lowercase) resolve to the same row.
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS projects_name_lower_idx ON projects (LOWER(name))`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS businesses_name_lower_idx ON businesses (LOWER(name))`);
  // A milestone IS a todo — just one with a project and a due date attached.
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE`);
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL`);

  // Seed the user's known businesses so they show up as tabs immediately,
  // without needing to be created via conversation first.
  const seedBusinesses = ['Yesss Electrical', 'VA Power', 'Saltwood & Co'];
  for (const name of seedBusinesses) {
    await pool.query(
      'INSERT INTO businesses (name) VALUES ($1) ON CONFLICT (LOWER(name)) DO NOTHING',
      [name]
    );
  }
}

async function listTodos() {
  if (!pool) return [];
  const { rows } = await pool.query(`
    SELECT t.id, t.text, t.done, t.project_id, t.due_date, t.business_id, b.name AS business_name
    FROM todos t
    LEFT JOIN businesses b ON b.id = t.business_id
    ORDER BY t.done ASC, (t.due_date IS NULL), t.due_date ASC, t.id ASC
  `);
  return rows;
}

async function addTodo(text, businessName) {
  let businessId = null;
  if (businessName) {
    const biz = await findOrCreateBusiness(businessName);
    businessId = biz.id;
  }
  const { rows } = await pool.query(
    'INSERT INTO todos (text, business_id) VALUES ($1, $2) RETURNING id, text, done, project_id, due_date, business_id',
    [text, businessId]
  );
  return rows[0];
}

async function completeTodo(id) {
  const { rows } = await pool.query(
    'UPDATE todos SET done = true WHERE id = $1 RETURNING id, text, done, project_id, due_date, business_id',
    [id]
  );
  return rows[0] || null;
}

async function removeTodo(id) {
  const { rowCount } = await pool.query('DELETE FROM todos WHERE id = $1', [id]);
  return rowCount > 0;
}

async function findOrCreateBusiness(name) {
  const trimmed = String(name).trim();
  const existing = await pool.query('SELECT id, name FROM businesses WHERE LOWER(name) = LOWER($1)', [trimmed]);
  if (existing.rows[0]) return existing.rows[0];
  const { rows } = await pool.query(
    'INSERT INTO businesses (name) VALUES ($1) RETURNING id, name',
    [trimmed]
  );
  return rows[0];
}

async function listBusinesses() {
  if (!pool) return [];
  const { rows } = await pool.query('SELECT id, name FROM businesses ORDER BY id ASC');
  return rows;
}

async function listIdeas() {
  if (!pool) return [];
  const { rows } = await pool.query(`
    SELECT i.id, i.text, i.business_id, b.name AS business_name
    FROM ideas i
    LEFT JOIN businesses b ON b.id = i.business_id
    ORDER BY i.id DESC
  `);
  return rows;
}

async function addIdea(text, businessName) {
  let businessId = null;
  if (businessName) {
    const biz = await findOrCreateBusiness(businessName);
    businessId = biz.id;
  }
  const { rows } = await pool.query(
    'INSERT INTO ideas (text, business_id) VALUES ($1, $2) RETURNING id, text, business_id',
    [text, businessId]
  );
  return rows[0];
}

async function removeIdea(id) {
  const { rowCount } = await pool.query('DELETE FROM ideas WHERE id = $1', [id]);
  return rowCount > 0;
}

async function findOrCreateProject(name) {
  const trimmed = String(name).trim();
  const existing = await pool.query('SELECT id, name FROM projects WHERE LOWER(name) = LOWER($1)', [trimmed]);
  if (existing.rows[0]) return existing.rows[0];
  const { rows } = await pool.query(
    'INSERT INTO projects (name) VALUES ($1) RETURNING id, name',
    [trimmed]
  );
  return rows[0];
}

async function addMilestone(projectName, text, dueDate) {
  const project = await findOrCreateProject(projectName);
  const { rows } = await pool.query(
    'INSERT INTO todos (text, project_id, due_date) VALUES ($1, $2, $3) RETURNING id, text, done, project_id, due_date',
    [text, project.id, dueDate || null]
  );
  return { project, milestone: rows[0] };
}

async function listProjects() {
  if (!pool) return [];
  const projects = await pool.query('SELECT id, name FROM projects ORDER BY id ASC');
  const milestones = await pool.query(`
    SELECT id, text, done, project_id, due_date
    FROM todos
    WHERE project_id IS NOT NULL
    ORDER BY (due_date IS NULL), due_date ASC, id ASC
  `);
  return projects.rows.map((p) => ({
    ...p,
    milestones: milestones.rows.filter((m) => m.project_id === p.id),
  }));
}

async function setTodoDone(id, done) {
  const { rows } = await pool.query(
    'UPDATE todos SET done = $2 WHERE id = $1 RETURNING id, text, done, project_id, due_date',
    [id, done]
  );
  return rows[0] || null;
}

async function addMilestoneToProject(projectId, text, dueDate) {
  const { rows } = await pool.query(
    'INSERT INTO todos (text, project_id, due_date) VALUES ($1, $2, $3) RETURNING id, text, done, project_id, due_date',
    [text, projectId, dueDate || null]
  );
  return rows[0];
}

async function getProject(id) {
  const proj = await pool.query('SELECT id, name FROM projects WHERE id = $1', [id]);
  if (!proj.rows[0]) return null;
  const milestones = await pool.query(
    `SELECT id, text, done, project_id, due_date FROM todos
     WHERE project_id = $1
     ORDER BY (due_date IS NULL), due_date ASC, id ASC`,
    [id]
  );
  return { ...proj.rows[0], milestones: milestones.rows };
}

module.exports = {
  init,
  listTodos,
  addTodo,
  completeTodo,
  removeTodo,
  findOrCreateProject,
  addMilestone,
  listProjects,
  setTodoDone,
  addMilestoneToProject,
  getProject,
  findOrCreateBusiness,
  listBusinesses,
  listIdeas,
  addIdea,
  removeIdea,
  isConfigured: !!pool,
};
