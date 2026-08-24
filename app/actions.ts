"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  findEmployeeByCode,
  listEmployees,
  setCurrentEmployee,
  clearCurrentEmployee,
  getCurrentEmployee,
} from "@/lib/auth";
import {
  createProject,
  updateProject,
  addContact,
  createTask,
  updateTaskStatus,
  addTaskNote,
  tagEmployeeOnTask,
  getTask,
  getProject,
  setTaskOwner,
  bulkImportProjects,
  type ImportProject,
} from "@/lib/data";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/data";
import { notifyEmployee } from "@/lib/notify";

export async function loginAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const employee = await findEmployeeByCode(code);
  if (!employee) {
    redirect("/login?error=1");
  }
  await setCurrentEmployee(employee.id);
  redirect(employee.role === "owner" ? "/owner" : "/projects");
}

export async function logoutAction() {
  await clearCurrentEmployee();
  redirect("/login");
}

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const id = await createProject({
    name,
    client_contact: str(formData.get("client_contact")),
    event_date: str(formData.get("event_date")),
    event_date_end: str(formData.get("event_date_end")),
    hours: str(formData.get("hours")),
    headcount: str(formData.get("headcount")),
    location: str(formData.get("location")),
    team_present: str(formData.get("team_present")),
    proposal_owner: str(formData.get("proposal_owner")),
    general_notes: str(formData.get("general_notes")),
  });
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function updateProjectAction(projectId: string, formData: FormData) {
  await updateProject(projectId, {
    name: String(formData.get("name") ?? ""),
    client_contact: str(formData.get("client_contact")),
    event_date: str(formData.get("event_date")),
    event_date_end: str(formData.get("event_date_end")),
    hours: str(formData.get("hours")),
    headcount: str(formData.get("headcount")),
    location: str(formData.get("location")),
    team_present: str(formData.get("team_present")),
    proposal_owner: str(formData.get("proposal_owner")),
    general_notes: str(formData.get("general_notes")),
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function archiveProjectAction(projectId: string) {
  const me = await getCurrentEmployee();
  if (!me || me.role !== "owner") return;
  await updateProject(projectId, { archived: true });
  revalidatePath("/projects");
  revalidatePath("/projects/archived");
  redirect("/projects");
}

export async function archiveProjectQuickAction(projectId: string) {
  const me = await getCurrentEmployee();
  if (!me || me.role !== "owner") return;
  await updateProject(projectId, { archived: true });
  revalidatePath("/projects");
  revalidatePath("/projects/archived");
}

export async function unarchiveProjectAction(projectId: string) {
  const me = await getCurrentEmployee();
  if (!me || me.role !== "owner") return;
  await updateProject(projectId, { archived: false });
  revalidatePath("/projects");
  revalidatePath("/projects/archived");
}

export async function addContactAction(projectId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await addContact(projectId, name, str(formData.get("phone")), str(formData.get("role")));
  revalidatePath(`/projects/${projectId}`);
}

export async function createTaskAction(projectId: string, formData: FormData) {
  const me = await getCurrentEmployee();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const urgency = String(formData.get("urgency") ?? "high") as "high" | "low";
  const linkLabel = str(formData.get("link_label"));
  const linkUrl = str(formData.get("link_url"));
  await createTask({
    projectId,
    title,
    urgency,
    responsibleContact: str(formData.get("responsible_contact")),
    ownerEmployeeId: str(formData.get("owner_employee_id")),
    notes: str(formData.get("notes")),
    links: linkUrl ? [{ label: linkLabel || linkUrl, url: linkUrl }] : undefined,
    dueDate: str(formData.get("due_date")),
    actorEmployeeId: me?.id ?? null,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/team");
}

export async function updateTaskStatusAction(taskId: string, status: "open" | "stuck" | "done") {
  const me = await getCurrentEmployee();
  const task = await getTask(taskId);
  await updateTaskStatus(taskId, status, me?.id ?? null);
  if (task) {
    revalidatePath(`/projects/${task.project_id}`);
    revalidatePath("/team");
  }
}

export async function setTaskOwnerAction(taskId: string, formData: FormData) {
  const me = await getCurrentEmployee();
  const employeeId = str(formData.get("employee_id"));
  await setTaskOwner(taskId, employeeId, me?.id ?? null);

  const task = await getTask(taskId);
  if (task && employeeId) {
    const project = await getProject(task.project_id);
    await notifyEmployee({
      employeeId,
      taskId,
      message: `שויכת/ה למשימה "${task.title}"${project ? ` (${project.name})` : ""}`,
    });
  }
  if (task) {
    revalidatePath(`/projects/${task.project_id}`);
    revalidatePath("/team");
  }
}

export async function addTaskNoteAction(taskId: string, formData: FormData) {
  const me = await getCurrentEmployee();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  await addTaskNote(taskId, note, me?.id ?? null);
  const task = await getTask(taskId);
  if (task) revalidatePath(`/projects/${task.project_id}`);
}

export async function tagEmployeeAction(taskId: string, formData: FormData) {
  const me = await getCurrentEmployee();
  const employeeId = String(formData.get("employee_id") ?? "");
  const note = str(formData.get("note"));
  if (!employeeId) return;
  await tagEmployeeOnTask(taskId, employeeId, me?.id ?? null, note);

  const task = await getTask(taskId);
  const project = task ? await getProject(task.project_id) : null;
  const employees = await listEmployees();
  const target = employees.find((e) => e.id === employeeId);
  const taggerName = me?.name ?? "מישהו";
  if (task && target) {
    await notifyEmployee({
      employeeId: target.id,
      taskId,
      message: `${taggerName} תייג/ה אותך במשימה "${task.title}"${
        project ? ` (${project.name})` : ""
      }${note ? `: ${note}` : ""}`,
    });
  }
  if (task) {
    revalidatePath(`/projects/${task.project_id}`);
    revalidatePath("/team");
  }
}

export async function markNotificationReadAction(notificationId: string) {
  await markNotificationRead(notificationId);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const me = await getCurrentEmployee();
  if (me) await markAllNotificationsRead(me.id);
  revalidatePath("/notifications");
}

export async function bulkImportAction(formData: FormData) {
  const me = await getCurrentEmployee();
  if (!me || me.role !== "owner") {
    return { ok: false, error: "רק בעלים יכולים לייבא נתונים." };
  }
  const raw = String(formData.get("payload") ?? "");
  let parsed: { projects: ImportProject[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON לא תקין." };
  }
  if (!Array.isArray(parsed.projects)) {
    return { ok: false, error: "המבנה חייב לכלול מערך projects." };
  }
  const result = await bulkImportProjects(parsed.projects);
  revalidatePath("/projects");
  revalidatePath("/team");
  return { ok: true, ...result };
}

function str(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
