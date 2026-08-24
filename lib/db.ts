import { Pool } from "pg";
import { randomUUID } from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var __shapPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __shapMigrated: Promise<void> | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add a Render Postgres connection string as an environment variable."
    );
  }
  return new Pool({
    connectionString,
    // Render's internal DB URL doesn't need SSL, but the external one does.
    // rejectUnauthorized: false keeps this working either way without needing
    // to ship Render's CA bundle.
    ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  if (!global.__shapPool) {
    global.__shapPool = createPool();
  }
  return global.__shapPool;
}

/** Runs the (idempotent) schema migration + seed exactly once per server instance. */
export function ensureMigrated(): Promise<void> {
  if (!global.__shapMigrated) {
    global.__shapMigrated = migrate();
  }
  return global.__shapMigrated;
}

async function migrate() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_contact TEXT,
      event_date TEXT,
      hours TEXT,
      headcount TEXT,
      location TEXT,
      team_present TEXT,
      proposal_owner TEXT,
      general_notes TEXT,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'high',
      status TEXT NOT NULL DEFAULT 'open',
      responsible_contact TEXT,
      owner_employee_id TEXT REFERENCES employees(id),
      notes TEXT,
      links TEXT,
      due_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      tagged_by TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      employee_id TEXT REFERENCES employees(id),
      action TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES employees(id),
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tags_task ON task_tags(task_id);
    CREATE INDEX IF NOT EXISTS idx_notif_employee ON notifications(employee_id, read);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_employee_id);

    ALTER TABLE projects ADD COLUMN IF NOT EXISTS event_date_end TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TEXT;
    ALTER TABLE task_tags ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_sort_order INTEGER;

    CREATE INDEX IF NOT EXISTS idx_tags_employee_open ON task_tags(employee_id) WHERE resolved_at IS NULL;
  `);

  const { rows } = await pool.query<{ c: number }>("SELECT COUNT(*)::int as c FROM employees");
  if (rows[0].c > 0) return;

  const insert = `INSERT INTO employees (id, name, code, role) VALUES ($1, $2, $3, $4)`;
  await pool.query(insert, [randomUUID(), "סטפני", "1111", "employee"]);
  await pool.query(insert, [randomUUID(), "בר", "2222", "employee"]);
  await pool.query(insert, [randomUUID(), "נועם", "3333", "employee"]);
  await pool.query(insert, [randomUUID(), "שר", "0001", "owner"]);
  await pool.query(insert, [randomUUID(), "טל", "0002", "owner"]);
}

/** Run a query, making sure the schema exists first. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
) {
  await ensureMigrated();
  return getPool().query<T>(text, params as unknown[]);
}

export function id() {
  return randomUUID();
}
