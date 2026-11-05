import { timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool, query, id as newId, ensureMigrated } from "./db";
import type { Employee } from "./auth";
import { notifyEmployee } from "./notify";

/**
 * The task distributor ("מחלק המשימות") — an external automation that reads meeting summaries,
 * proposes task updates as "cards", and waits for the reviewer (Sher) to approve each card here.
 * It never writes tasks itself: the only machine-facing endpoints read a snapshot and submit a
 * card. Everything that changes projects/tasks happens in applyCard(), after a human approved.
 */

// Only Sher reviews cards — Tal is also an owner, but cards can show filtered items from
// conversations with Tal (e.g. salary talk) that must stay with Sher.
const REVIEWER_NAME = process.env.AGENT_REVIEWER_NAME ?? "שר";

export const SOURCE_LABEL: Record<string, string> = {
  zoom: "זום",
  pocket: "Pocket",
  self_email: "מייל",
  sher_note: "סיכום שלך",
};

export function isReviewer(me: Employee | null): boolean {
  return !!me && me.role === "owner" && me.name === REVIEWER_NAME;
}

export async function getReviewer(): Promise<{ id: string } | null> {
  const { rows } = await query<{ id: string }>(
    "SELECT id FROM employees WHERE role = 'owner' AND name = $1 LIMIT 1",
    [REVIEWER_NAME]
  );
  return rows[0] ?? null;
}

/** Bearer-token check for the automation's endpoints. Fails closed when no secret is configured. */
export function agentAuthorized(authHeader: string | null): boolean {
  const secret = process.env.AGENT_SECRET;
  if (!secret || !authHeader?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authHeader.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------- Card shape (produced by the agent's last stage) ----------

export type CardItem = { text: string; due_date?: string | null; replaces?: string | null; source_quote?: string };
export type TaskChange = {
  action: "new_task" | "add_items" | "update_item" | "close_item";
  existing_task_id?: string | null;
  title: string;
  due_date?: string | null;
  urgency?: "high" | "low";
  responsible_contact?: string | null;
  owner_employee?: string | null;
  items: CardItem[];
};
export type EventDetail = {
  field: string;
  label?: string;
  value: string;
  status?: string;
  previous?: string | null;
  source_quote?: string;
};
export type CardContact = { name: string; phone?: string | null; role?: string | null };
export type CardSegment = {
  project_id: string | null;
  project_name?: string | null;
  needs_you_reason?: string | null;
  new_project?: boolean;
  new_project_name?: string | null;
  task_changes?: TaskChange[];
  already_exists?: { existing_task_title: string; item: string }[];
  event_details?: EventDetail[];
  contacts?: CardContact[];
};
export type Card = {
  card_title: string;
  conversation_type?: string;
  needs_you?: string[];
  segments: CardSegment[];
  filtered?: { category: string; content: string }[];
  not_items?: { line: string; reason: string }[];
};

export type AgentCardRow = {
  id: string;
  source: string;
  source_id: string;
  title: string | null;
  conversation_at: string | null;
  status: "pending" | "approved" | "rejected" | "irrelevant" | "failed";
  reason: string | null;
  proposed_card: Card | null;
  final_card: Card | null;
  apply_log: string[] | null;
  decided_at: Date | null;
  created_at: Date;
};

// ---------- Snapshot for the automation ----------

const SUMMARY_TASK_TITLE = "סיכום שיחה";

export async function getAgentSnapshot() {
  const [employees, projects, contacts, tasks, processed, notes, waGroups] = await Promise.all([
    query<{ id: string; name: string }>("SELECT id, name FROM employees ORDER BY name"),
    // Recently archived projects stay in, so a wrap-up meeting after an event still matches.
    query(
      `SELECT id, name, client_contact, event_date, event_date_end, hours, headcount, location,
              team_present, proposal_owner, general_notes, archived
       FROM projects
       WHERE archived = FALSE OR created_at > now() - interval '6 months'
       ORDER BY archived, event_date NULLS LAST`
    ),
    // No phone numbers — the agent doesn't need them to match projects.
    query<{ project_id: string; name: string; role: string | null }>(
      "SELECT project_id, name, role FROM contacts ORDER BY created_at"
    ),
    query<{
      id: string; project_id: string; title: string; notes: string | null; urgency: string;
      due_date: string | null; responsible_contact: string | null; owner_name: string | null;
    }>(
      `SELECT t.id, t.project_id, t.title, t.notes, t.urgency, t.due_date, t.responsible_contact,
              e.name as owner_name
       FROM tasks t LEFT JOIN employees e ON e.id = t.owner_employee_id
       WHERE t.status != 'done' ORDER BY t.created_at`
    ),
    query<{ source_id: string }>(
      "SELECT source_id FROM agent_cards WHERE created_at > now() - interval '45 days'"
    ),
    // Sher's own "סיכום שיחה" notes become an input once she has stopped editing for 15 minutes.
    query<{ id: string; project_id: string; project_name: string; notes: string | null; updated_at: Date }>(
      `SELECT t.id, t.project_id, p.name as project_name, t.notes, t.updated_at
       FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE btrim(t.title) = $1 AND t.status != 'done' AND COALESCE(t.notes, '') != ''
         AND t.updated_at < now() - interval '15 minutes'
         AND NOT EXISTS (SELECT 1 FROM agent_cards c WHERE c.source_id = 'note:' || t.id)`,
      [SUMMARY_TASK_TITLE]
    ),
    // Romi (WhatsApp groups bot): a group is read only after Sher approved its "which project?" card.
    query<{ source_id: string; project_id: string | null }>(
      `SELECT source_id, final_card->'segments'->0->>'project_id' AS project_id
       FROM agent_cards WHERE source = 'whatsapp_join' AND status = 'approved'`
    ),
  ]);

  const byProject = <T extends { project_id: string }>(rows: T[]) => {
    const map = new Map<string, Omit<T, "project_id">[]>();
    for (const { project_id, ...rest } of rows) {
      if (!map.has(project_id)) map.set(project_id, []);
      map.get(project_id)!.push(rest);
    }
    return map;
  };
  const contactsBy = byProject(contacts.rows);
  const tasksBy = byProject(tasks.rows);

  return {
    employees: employees.rows,
    projects: projects.rows.map((p) => ({
      ...p,
      contacts: contactsBy.get(p.id as string) ?? [],
      open_tasks: tasksBy.get(p.id as string) ?? [],
    })),
    processed_source_ids: processed.rows.map((r) => r.source_id),
    summary_notes: notes.rows.map((n) => ({
      source_id: `note:${n.id}`,
      task_id: n.id,
      project_id: n.project_id,
      project_name: n.project_name,
      notes: n.notes,
      updated_at: n.updated_at,
    })),
    whatsapp_groups: waGroups.rows
      .filter((g) => g.project_id)
      .map((g) => ({ group_id: g.source_id.replace(/^wa-join:/, ""), project_id: g.project_id })),
  };
}

// ---------- Recording what the automation produced ----------

export async function recordAgentCard(input: {
  source: string;
  source_id: string;
  title: string | null;
  conversation_at: string | null;
  status: "pending" | "irrelevant" | "failed";
  reason: string | null;
  card: Card | null;
}): Promise<{ id: string; created: boolean }> {
  const cardId = newId();
  const { rowCount } = await query(
    `INSERT INTO agent_cards (id, source, source_id, title, conversation_at, status, reason, proposed_card)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (source_id) DO NOTHING`,
    [
      cardId, input.source, input.source_id, input.title, input.conversation_at,
      input.status, input.reason, input.card ? JSON.stringify(input.card) : null,
    ]
  );
  if (!rowCount) return { id: "", created: false };

  if (input.status === "pending" && input.card?.needs_you?.length) {
    const reviewer = await getReviewer();
    if (reviewer) {
      await notifyEmployee({
        employeeId: reviewer.id,
        message: `מחלק המשימות צריך אותך (${input.card.needs_you.length}): ${input.card.card_title}`,
        link: `/agent-cards/${cardId}`,
      });
    }
  }
  return { id: cardId, created: true };
}

export async function listAgentCards(status: AgentCardRow["status"]): Promise<AgentCardRow[]> {
  const { rows } = await query<AgentCardRow>(
    "SELECT * FROM agent_cards WHERE status = $1 ORDER BY conversation_at DESC NULLS LAST, created_at DESC LIMIT 100",
    [status]
  );
  return rows;
}

export async function countPendingAgentCards(): Promise<number> {
  const { rows } = await query<{ c: number }>(
    "SELECT COUNT(*)::int as c FROM agent_cards WHERE status = 'pending'"
  );
  return rows[0]?.c ?? 0;
}

export async function getAgentCard(cardId: string): Promise<AgentCardRow | null> {
  const { rows } = await query<AgentCardRow>("SELECT * FROM agent_cards WHERE id = $1", [cardId]);
  return rows[0] ?? null;
}

export async function rejectAgentCard(cardId: string, reviewerId: string) {
  await query(
    "UPDATE agent_cards SET status = 'rejected', decided_by = $1, decided_at = now() WHERE id = $2 AND status = 'pending'",
    [reviewerId, cardId]
  );
}

// ---------- Applying an approved card ----------

export const PROJECT_FIELDS = [
  "client_contact", "event_date", "event_date_end", "hours", "headcount",
  "location", "team_present", "proposal_owner", "general_notes",
] as const;

const NUMBERED = /^\s*(\d+)\.\s*/;

function stripNumber(line: string) {
  return line.replace(NUMBERED, "").trim();
}

/** Appends lines to a task's notes, continuing its numbering when Sher numbered it. */
export function appendItems(notes: string | null, texts: string[]): string {
  const lines = (notes ?? "").split("\n").filter((l) => l.trim() !== "");
  const numbers = lines.map((l) => l.match(NUMBERED)?.[1]).filter(Boolean).map(Number);
  const numbered = numbers.length > 0 || lines.length === 0;
  let next = numbers.length ? Math.max(...numbers) + 1 : 1;
  for (const t of texts) lines.push(numbered ? `${next++}. ${stripNumber(t)}` : stripNumber(t));
  return lines.join("\n");
}

/** Finds the line in the notes that the agent referred to (it quotes it, with or without its number). */
function findLine(lines: string[], ref: string): number {
  const target = stripNumber(ref);
  if (!target) return -1;
  const exact = lines.findIndex((l) => stripNumber(l) === target);
  return exact >= 0 ? exact : lines.findIndex((l) => stripNumber(l).includes(target) || target.includes(stripNumber(l)) && stripNumber(l).length > 10);
}

export function replaceItem(notes: string | null, ref: string, text: string): { notes: string; found: boolean } {
  const lines = (notes ?? "").split("\n");
  const i = findLine(lines, ref);
  if (i < 0) return { notes: appendItems(notes, [`${stripNumber(text)} (עדכון)`]), found: false };
  const num = lines[i].match(NUMBERED)?.[1];
  lines[i] = num ? `${num}. ${stripNumber(text)}` : stripNumber(text);
  return { notes: lines.join("\n"), found: true };
}

export function closeItem(notes: string | null, ref: string, note: string): { notes: string; found: boolean } {
  const lines = (notes ?? "").split("\n");
  const i = findLine(lines, ref);
  if (i < 0) return { notes: notes ?? "", found: false };
  lines[i] = `${lines[i].trimEnd()} - בוצע${note ? ` (${stripNumber(note)})` : ""}`;
  return { notes: lines.join("\n"), found: true };
}

export type SegmentTarget = { projectId: string | null; newProjectName: string | null };

/**
 * Writes an approved card into projects/tasks in one transaction. `targets` is the project the
 * reviewer chose for each segment (by index); a segment with neither is skipped.
 * Returns a human-readable log of what was written.
 */
export async function applyCard(
  cardId: string,
  card: Card,
  targets: SegmentTarget[],
  reviewerId: string
): Promise<string[]> {
  await ensureMigrated();
  const client = await getPool().connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT status FROM agent_cards WHERE id = $1 FOR UPDATE", [cardId]);
    if (locked.rows[0]?.status !== "pending") throw new Error("הכרטיס כבר טופל.");

    const { rows: emps } = await client.query<{ id: string; name: string }>("SELECT id, name FROM employees");
    const employeeId = (name?: string | null) => (name ? emps.find((e) => e.name === name)?.id ?? null : null);

    for (const [i, seg] of card.segments.entries()) {
      const target = targets[i];
      let projectId = target?.projectId ?? null;
      if (!projectId && target?.newProjectName) {
        projectId = newId();
        await client.query("INSERT INTO projects (id, name) VALUES ($1, $2)", [projectId, target.newProjectName]);
        log.push(`פרויקט חדש: ${target.newProjectName}`);
      }
      if (!projectId) continue;
      const proj = await client.query<{ name: string; general_notes: string | null }>(
        "SELECT name, general_notes FROM projects WHERE id = $1",
        [projectId]
      );
      if (!proj.rows[0]) continue;
      const projectName = proj.rows[0].name;
      // Keep the project the reviewer chose on the saved card — Romi reads it back to know
      // which project a WhatsApp group belongs to.
      card.segments[i] = { ...seg, project_id: projectId };

      for (const tc of seg.task_changes ?? []) {
        await applyTaskChange(client, projectId, projectName, tc, employeeId, reviewerId, log);
      }

      let generalNotes = proj.rows[0].general_notes;
      for (const d of seg.event_details ?? []) {
        if (!d.value?.trim()) continue;
        if ((PROJECT_FIELDS as readonly string[]).includes(d.field) && d.field !== "general_notes") {
          await client.query(`UPDATE projects SET ${d.field} = $1 WHERE id = $2`, [d.value.trim(), projectId]);
        } else {
          const line = d.field === "general_notes" ? d.value.trim() : `${d.label || d.field}: ${d.value.trim()}`;
          generalNotes = generalNotes ? `${generalNotes}\n${line}` : line;
          await client.query("UPDATE projects SET general_notes = $1 WHERE id = $2", [generalNotes, projectId]);
        }
        log.push(`${projectName} - פרט אירוע: ${d.label || d.field}`);
      }

      for (const c of seg.contacts ?? []) {
        if (!c.name?.trim()) continue;
        await client.query(
          "INSERT INTO contacts (id, project_id, name, phone, role) VALUES ($1, $2, $3, $4, $5)",
          [newId(), projectId, c.name.trim(), c.phone ?? null, c.role ?? null]
        );
        log.push(`${projectName} - איש קשר: ${c.name.trim()}`);
      }
    }

    await client.query(
      `UPDATE agent_cards SET status = 'approved', final_card = $1, apply_log = $2,
              decided_by = $3, decided_at = now() WHERE id = $4`,
      [JSON.stringify(card), JSON.stringify(log), reviewerId, cardId]
    );
    await client.query("COMMIT");
    return log;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function applyTaskChange(
  client: PoolClient,
  projectId: string,
  projectName: string,
  tc: TaskChange,
  employeeId: (name?: string | null) => string | null,
  actorId: string,
  log: string[]
) {
  const texts = tc.items.map((it) => it.text).filter((t) => t?.trim());
  if (!texts.length && tc.action !== "close_item") return;

  const logActivity = (taskId: string, action: string, detail: string) =>
    client.query(
      `INSERT INTO activity_log (id, task_id, project_id, employee_id, action, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId(), taskId, projectId, actorId, action, detail]
    );

  if (tc.action === "new_task") {
    // Same topic already open in this project (common when the reviewer picked the project for
    // a segment the agent couldn't place) — add to it instead of opening a duplicate.
    const sameTopic = await client.query<{ id: string }>(
      "SELECT id FROM tasks WHERE project_id = $1 AND status != 'done' AND btrim(title) = btrim($2) LIMIT 1",
      [projectId, tc.title]
    );
    if (sameTopic.rows[0]) {
      await applyTaskChange(
        client, projectId, projectName,
        { ...tc, action: "add_items", existing_task_id: sameTopic.rows[0].id },
        employeeId, actorId, log
      );
      return;
    }
    const taskId = newId();
    await client.query(
      `INSERT INTO tasks (id, project_id, title, urgency, status, responsible_contact, owner_employee_id, notes, due_date)
       VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8)`,
      [
        taskId, projectId, tc.title.trim(), tc.urgency === "low" ? "low" : "high",
        tc.responsible_contact || null, employeeId(tc.owner_employee),
        appendItems(null, texts), tc.due_date || null,
      ]
    );
    await logActivity(taskId, "created", tc.title.trim());
    log.push(`${projectName} - משימה חדשה: ${tc.title.trim()} (${texts.length} סעיפים)`);
    return;
  }

  const existing = await client.query<{ id: string; notes: string | null; project_id: string }>(
    "SELECT id, notes, project_id FROM tasks WHERE id = $1 FOR UPDATE",
    [tc.existing_task_id ?? ""]
  );
  const task = existing.rows[0];
  if (!task || task.project_id !== projectId) {
    // The task disappeared or belongs elsewhere — don't guess; open the items as a new task.
    await applyTaskChange(client, projectId, projectName, { ...tc, action: "new_task" }, employeeId, actorId, log);
    return;
  }

  let notes = task.notes;
  let missing = 0;
  for (const it of tc.items) {
    if (tc.action === "add_items") {
      if (it.text?.trim()) notes = appendItems(notes, [it.text]);
    } else if (tc.action === "update_item") {
      if (!it.text?.trim()) continue;
      const r = replaceItem(notes, it.replaces ?? "", it.text);
      notes = r.notes;
      if (!r.found) missing++;
    } else {
      const r = closeItem(notes, it.replaces ?? it.text ?? "", it.replaces ? it.text : "");
      notes = r.notes;
      if (!r.found) missing++;
    }
  }
  await client.query("UPDATE tasks SET notes = $1, updated_at = now() WHERE id = $2", [notes, task.id]);
  await logActivity(task.id, "note", `מחלק המשימות: ${tc.action}`);
  const verb = { add_items: "נוספו סעיפים", update_item: "עודכנו סעיפים", close_item: "סומנו כבוצע" }[tc.action];
  log.push(`${projectName} - ${tc.title}: ${verb}${missing ? ` (${missing} לא נמצאו בהערה ונוספו בסוף)` : ""}`);
}
