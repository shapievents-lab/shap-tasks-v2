import { query, id as newId } from "./db";

export type Project = {
  id: string;
  name: string;
  client_contact: string | null;
  event_date: string | null;
  event_date_end: string | null;
  hours: string | null;
  headcount: string | null;
  location: string | null;
  team_present: string | null;
  proposal_owner: string | null;
  general_notes: string | null;
  archived: boolean;
  created_at: Date;
};

export type Contact = {
  id: string;
  project_id: string;
  name: string;
  phone: string | null;
  role: string | null;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  urgency: "high" | "low";
  status: "open" | "stuck" | "done";
  responsible_contact: string | null;
  owner_employee_id: string | null;
  notes: string | null;
  links: string | null;
  due_date: string | null;
  created_at: Date;
  updated_at: Date;
};

export type TaskWithProject = Task & {
  project_name: string;
  project_event_date?: string | null;
  owner_name: string | null;
};

export type TaskTag = {
  id: string;
  task_id: string;
  employee_id: string;
  employee_name?: string;
  tagged_by: string | null;
  note: string | null;
  resolved_at: Date | null;
  created_at: Date;
};

export type TagWithTask = TaskTag & {
  task_title: string;
  task_status: Task["status"];
  project_id: string;
  project_name: string;
  tagged_by_name: string | null;
};

// ---------- Projects ----------

/** Active (non-archived) projects, soonest upcoming date first; projects with no date go last. */
export async function listProjects(): Promise<Project[]> {
  const { rows } = await query<Project>(
    "SELECT * FROM projects WHERE archived = FALSE ORDER BY event_date ASC NULLS LAST, created_at DESC"
  );
  return rows;
}

/** Archived (finished/cancelled) projects, most recently archived date first. */
export async function listArchivedProjects(): Promise<Project[]> {
  const { rows } = await query<Project>(
    "SELECT * FROM projects WHERE archived = TRUE ORDER BY event_date DESC NULLS LAST, created_at DESC"
  );
  return rows;
}

/** Active projects in the manual/custom order sher (or an owner) has dragged them into.
 * Projects that were never manually placed fall back to soonest-date-first, appended after
 * the manually-ordered ones. */
export async function listProjectsCustomOrder(): Promise<Project[]> {
  const { rows } = await query<Project>(
    `SELECT * FROM projects WHERE archived = FALSE
     ORDER BY custom_sort_order ASC NULLS LAST, event_date ASC NULLS LAST, created_at DESC`
  );
  return rows;
}

/** Persists a manual drag-and-drop order for the active project list. */
export async function reorderProjects(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await query("UPDATE projects SET custom_sort_order = $1 WHERE id = $2", [i, orderedIds[i]]);
  }
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { rows } = await query<Project>("SELECT * FROM projects WHERE id = $1", [projectId]);
  return rows[0] ?? null;
}

export type ProjectTaskCounts = { high: number; low: number; openTotal: number; taskTotal: number };

/** Open (non-done) high/low task counts + totals for every active project, in one query —
 * avoids fetching each project's full task list just to count them. */
export async function listProjectTaskCounts(): Promise<Record<string, ProjectTaskCounts>> {
  const { rows } = await query<{
    project_id: string;
    high: number;
    low: number;
    open_total: number;
    task_total: number;
  }>(
    `SELECT project_id,
            COUNT(*) FILTER (WHERE status != 'done' AND urgency = 'high')::int as high,
            COUNT(*) FILTER (WHERE status != 'done' AND urgency = 'low')::int as low,
            COUNT(*) FILTER (WHERE status != 'done')::int as open_total,
            COUNT(*)::int as task_total
     FROM tasks
     GROUP BY project_id`
  );
  const byProject: Record<string, ProjectTaskCounts> = {};
  for (const r of rows) {
    byProject[r.project_id] = {
      high: r.high,
      low: r.low,
      openTotal: r.open_total,
      taskTotal: r.task_total,
    };
  }
  return byProject;
}

export async function createProject(input: Partial<Project> & { name: string }): Promise<string> {
  const id = newId();
  await query(
    `INSERT INTO projects
      (id, name, client_contact, event_date, event_date_end, hours, headcount, location, team_present, proposal_owner, general_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      input.name,
      input.client_contact ?? null,
      input.event_date ?? null,
      input.event_date_end ?? null,
      input.hours ?? null,
      input.headcount ?? null,
      input.location ?? null,
      input.team_present ?? null,
      input.proposal_owner ?? null,
      input.general_notes ?? null,
    ]
  );
  return id;
}

export async function updateProject(projectId: string, input: Partial<Project>) {
  const fields = [
    "name",
    "client_contact",
    "event_date",
    "event_date_end",
    "hours",
    "headcount",
    "location",
    "team_present",
    "proposal_owner",
    "general_notes",
    "archived",
  ] as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const f of fields) {
    if (f in input) {
      sets.push(`${f} = $${i}`);
      values.push((input as Record<string, unknown>)[f]);
      i++;
    }
  }
  if (!sets.length) return;
  values.push(projectId);
  await query(`UPDATE projects SET ${sets.join(", ")} WHERE id = $${i}`, values);
}

// ---------- Contacts ----------

export async function listContacts(projectId: string): Promise<Contact[]> {
  const { rows } = await query<Contact>(
    "SELECT * FROM contacts WHERE project_id = $1 ORDER BY created_at",
    [projectId]
  );
  return rows;
}

export async function addContact(
  projectId: string,
  name: string,
  phone: string | null,
  role: string | null
) {
  await query(
    "INSERT INTO contacts (id, project_id, name, phone, role) VALUES ($1, $2, $3, $4, $5)",
    [newId(), projectId, name, phone, role]
  );
}

export async function updateContact(
  contactId: string,
  input: { name: string; phone: string | null; role: string | null }
) {
  await query("UPDATE contacts SET name = $1, phone = $2, role = $3 WHERE id = $4", [
    input.name,
    input.phone,
    input.role,
    contactId,
  ]);
}

export async function deleteContact(contactId: string) {
  await query("DELETE FROM contacts WHERE id = $1", [contactId]);
}

export async function getContact(contactId: string): Promise<Contact | null> {
  const { rows } = await query<Contact>("SELECT * FROM contacts WHERE id = $1", [contactId]);
  return rows[0] ?? null;
}

// ---------- Tasks ----------

export async function listTasksByProject(projectId: string): Promise<Task[]> {
  const { rows } = await query<Task>(
    "SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC",
    [projectId]
  );
  return rows;
}

export async function getTask(taskId: string): Promise<Task | null> {
  const { rows } = await query<Task>("SELECT * FROM tasks WHERE id = $1", [taskId]);
  return rows[0] ?? null;
}

export async function createTask(input: {
  projectId: string;
  title: string;
  urgency: "high" | "low";
  responsibleContact?: string | null;
  ownerEmployeeId?: string | null;
  notes?: string | null;
  links?: { label: string; url: string }[];
  dueDate?: string | null;
  actorEmployeeId?: string | null;
}): Promise<string> {
  const id = newId();
  await query(
    `INSERT INTO tasks
      (id, project_id, title, urgency, status, responsible_contact, owner_employee_id, notes, links, due_date)
     VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9)`,
    [
      id,
      input.projectId,
      input.title,
      input.urgency,
      input.responsibleContact ?? null,
      input.ownerEmployeeId ?? null,
      input.notes ?? null,
      input.links ? JSON.stringify(input.links) : null,
      input.dueDate ?? null,
    ]
  );
  await logActivity({
    taskId: id,
    projectId: input.projectId,
    employeeId: input.actorEmployeeId ?? null,
    action: "created",
    detail: input.title,
  });
  return id;
}

export async function updateTaskStatus(
  taskId: string,
  status: "open" | "stuck" | "done",
  actorEmployeeId: string | null
) {
  const task = await getTask(taskId);
  if (!task) return;
  await query("UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2", [
    status,
    taskId,
  ]);
  await logActivity({
    taskId,
    projectId: task.project_id,
    employeeId: actorEmployeeId,
    action: "status_changed",
    detail: status,
  });
}

export async function addTaskNote(taskId: string, note: string, actorEmployeeId: string | null) {
  const task = await getTask(taskId);
  if (!task) return;
  const combined = task.notes ? `${task.notes}\n${note}` : note;
  await query("UPDATE tasks SET notes = $1, updated_at = now() WHERE id = $2", [
    combined,
    taskId,
  ]);
  await logActivity({
    taskId,
    projectId: task.project_id,
    employeeId: actorEmployeeId,
    action: "note",
    detail: note,
  });
}

export async function listTaskTags(taskId: string): Promise<TaskTag[]> {
  const { rows } = await query<TaskTag>(
    `SELECT tt.*, e.name as employee_name
     FROM task_tags tt JOIN employees e ON e.id = tt.employee_id
     WHERE tt.task_id = $1 ORDER BY tt.created_at`,
    [taskId]
  );
  return rows;
}

/** Same as listTaskTags but for many tasks in one round trip — avoids an N+1 query when
 * rendering a page full of task cards (project detail, my-tasks). */
export async function listTaskTagsForTasks(taskIds: string[]): Promise<Record<string, TaskTag[]>> {
  if (taskIds.length === 0) return {};
  const { rows } = await query<TaskTag>(
    `SELECT tt.*, e.name as employee_name
     FROM task_tags tt JOIN employees e ON e.id = tt.employee_id
     WHERE tt.task_id = ANY($1) ORDER BY tt.created_at`,
    [taskIds]
  );
  const byTask: Record<string, TaskTag[]> = {};
  for (const id of taskIds) byTask[id] = [];
  for (const row of rows) {
    (byTask[row.task_id] ??= []).push(row);
  }
  return byTask;
}

export async function tagEmployeeOnTask(
  taskId: string,
  employeeId: string,
  taggedByEmployeeId: string | null,
  note: string | null
) {
  const task = await getTask(taskId);
  if (!task) return;
  await query(
    "INSERT INTO task_tags (id, task_id, employee_id, tagged_by, note) VALUES ($1, $2, $3, $4, $5)",
    [newId(), taskId, employeeId, taggedByEmployeeId, note]
  );
  await logActivity({
    taskId,
    projectId: task.project_id,
    employeeId: taggedByEmployeeId,
    action: "tagged",
    detail: employeeId,
  });
}

/** Marks a tag as handled (e.g. the tagged person approved / dealt with it), so it drops off
 * their personal "waiting for you" list. */
export async function resolveTaskTag(tagId: string, actorEmployeeId: string | null) {
  const { rows } = await query<TaskTag>("SELECT * FROM task_tags WHERE id = $1", [tagId]);
  const tag = rows[0];
  if (!tag) return;
  await query("UPDATE task_tags SET resolved_at = now() WHERE id = $1", [tagId]);
  await logActivity({
    taskId: tag.task_id,
    employeeId: actorEmployeeId,
    action: "tag_resolved",
    detail: null,
  });
}

/** All unresolved tags directed at an employee, with enough task/project context to show them
 * on that employee's personal task board (e.g. "סטפני תייגה אותך: אני צריכה שתאשרי"). */
export async function listOpenTagsForEmployee(employeeId: string): Promise<TagWithTask[]> {
  const { rows } = await query<TagWithTask>(
    `SELECT tt.*, t.title as task_title, t.status as task_status, t.project_id,
            p.name as project_name, tagger.name as tagged_by_name
     FROM task_tags tt
     JOIN tasks t ON t.id = tt.task_id
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN employees tagger ON tagger.id = tt.tagged_by
     WHERE tt.employee_id = $1 AND tt.resolved_at IS NULL
     ORDER BY tt.created_at DESC`,
    [employeeId]
  );
  return rows;
}

export async function setTaskOwner(
  taskId: string,
  employeeId: string | null,
  actorEmployeeId: string | null
) {
  const task = await getTask(taskId);
  if (!task) return;
  await query("UPDATE tasks SET owner_employee_id = $1, updated_at = now() WHERE id = $2", [
    employeeId,
    taskId,
  ]);
  await logActivity({
    taskId,
    projectId: task.project_id,
    employeeId: actorEmployeeId,
    action: "assigned",
    detail: employeeId,
  });
}

// ---------- Bulk import (one-time migration from the Google Sheet) ----------

export type ImportTask = { title: string; urgency: "high" | "low"; owner?: string | null };
export type ImportContact = { name: string; phone?: string | null; role?: string | null };
export type ImportProject = {
  name: string;
  client_contact?: string | null;
  event_date?: string | null;
  event_date_end?: string | null;
  hours?: string | null;
  headcount?: string | null;
  location?: string | null;
  team_present?: string | null;
  proposal_owner?: string | null;
  general_notes?: string | null;
  contacts?: ImportContact[];
  tasks?: ImportTask[];
};

/** Bulk-creates projects (with contacts + tasks) from a parsed import payload. Employee owner
 * names in tasks are matched by first-name against existing employees; unmatched names are left
 * unassigned. Returns how many of each entity were created. */
export async function bulkImportProjects(projects: ImportProject[]) {
  const { rows: employees } = await query<{ id: string; name: string }>(
    "SELECT id, name FROM employees"
  );
  const byName = new Map(employees.map((e) => [e.name, e.id]));

  let projectCount = 0;
  let contactCount = 0;
  let taskCount = 0;

  for (const p of projects) {
    const projectId = await createProject({
      name: p.name,
      client_contact: p.client_contact ?? null,
      event_date: p.event_date ?? null,
      event_date_end: p.event_date_end ?? null,
      hours: p.hours ?? null,
      headcount: p.headcount ?? null,
      location: p.location ?? null,
      team_present: p.team_present ?? null,
      proposal_owner: p.proposal_owner ?? null,
      general_notes: p.general_notes ?? null,
    });
    projectCount++;

    for (const c of p.contacts ?? []) {
      if (!c.name) continue;
      await addContact(projectId, c.name, c.phone ?? null, c.role ?? null);
      contactCount++;
    }

    for (const t of p.tasks ?? []) {
      if (!t.title) continue;
      const ownerEmployeeId = t.owner ? byName.get(t.owner) ?? null : null;
      await createTask({
        projectId,
        title: t.title,
        urgency: t.urgency,
        ownerEmployeeId,
        actorEmployeeId: null,
      });
      taskCount++;
    }
  }

  return { projectCount, contactCount, taskCount };
}

// ---------- Team-wide task view ----------

/** All non-archived tasks across every project, with project + owner names for the team view. */
export async function listAllOpenTasks(): Promise<TaskWithProject[]> {
  const { rows } = await query<TaskWithProject>(
    `SELECT t.*, p.name as project_name, e.name as owner_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN employees e ON e.id = t.owner_employee_id
     WHERE p.archived = FALSE
     ORDER BY t.due_date NULLS LAST, t.created_at DESC`
  );
  return rows;
}

/** All tasks (any status) owned by one employee across active projects, for their personal
 * "המשימות שלי" board, grouped by project in the UI — ordered soonest event date first so the
 * board reads in the same order as the projects list. */
export async function listTasksForEmployee(employeeId: string): Promise<TaskWithProject[]> {
  const { rows } = await query<TaskWithProject>(
    `SELECT t.*, p.name as project_name, p.event_date as project_event_date, e.name as owner_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN employees e ON e.id = t.owner_employee_id
     WHERE t.owner_employee_id = $1 AND p.archived = FALSE
     ORDER BY p.event_date ASC NULLS LAST, p.name, t.due_date NULLS LAST, t.created_at DESC`,
    [employeeId]
  );
  return rows;
}

// ---------- Activity / dashboard ----------

export async function logActivity(params: {
  taskId?: string | null;
  projectId?: string | null;
  employeeId?: string | null;
  action: string;
  detail?: string | null;
}) {
  await query(
    `INSERT INTO activity_log (id, task_id, project_id, employee_id, action, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      newId(),
      params.taskId ?? null,
      params.projectId ?? null,
      params.employeeId ?? null,
      params.action,
      params.detail ?? null,
    ]
  );
}

export type ActivityRow = {
  id: string;
  task_id: string | null;
  project_id: string | null;
  employee_id: string | null;
  employee_name: string | null;
  project_name: string | null;
  task_title: string | null;
  action: string;
  detail: string | null;
  created_at: Date;
};

export async function listActivitySince(since: Date): Promise<ActivityRow[]> {
  const { rows } = await query<ActivityRow>(
    `SELECT al.*, e.name as employee_name, p.name as project_name, t.title as task_title
     FROM activity_log al
     LEFT JOIN employees e ON e.id = al.employee_id
     LEFT JOIN projects p ON p.id = al.project_id
     LEFT JOIN tasks t ON t.id = al.task_id
     WHERE al.created_at >= $1
     ORDER BY al.created_at DESC`,
    [since]
  );
  return rows;
}

// ---------- Notifications ----------

export type NotificationRow = {
  id: string;
  employee_id: string;
  task_id: string | null;
  message: string;
  read: boolean;
  whatsapp_sent: boolean;
  created_at: Date;
  project_id?: string | null;
};

export async function listNotifications(employeeId: string): Promise<NotificationRow[]> {
  const { rows } = await query<NotificationRow>(
    `SELECT n.*, t.project_id as project_id
     FROM notifications n LEFT JOIN tasks t ON t.id = n.task_id
     WHERE n.employee_id = $1 ORDER BY n.created_at DESC LIMIT 50`,
    [employeeId]
  );
  return rows;
}

export async function unreadNotificationCount(employeeId: string): Promise<number> {
  const { rows } = await query<{ c: number }>(
    "SELECT COUNT(*)::int as c FROM notifications WHERE employee_id = $1 AND read = FALSE",
    [employeeId]
  );
  return rows[0]?.c ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  await query("UPDATE notifications SET read = TRUE WHERE id = $1", [notificationId]);
}

export async function markAllNotificationsRead(employeeId: string) {
  await query("UPDATE notifications SET read = TRUE WHERE employee_id = $1", [employeeId]);
}
