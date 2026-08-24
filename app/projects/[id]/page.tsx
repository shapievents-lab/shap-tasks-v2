import { notFound, redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listEmployees, type Employee } from "@/lib/auth";
import {
  getProject,
  listContacts,
  listTasksByProject,
  listTaskTags,
  type Task,
  type TaskTag,
} from "@/lib/data";
import {
  updateProjectAction,
  addContactAction,
  createTaskAction,
  archiveProjectAction,
} from "@/app/actions";
import TaskCard from "@/components/TaskCard";

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const project = await getProject(id);
  if (!project) notFound();

  const [contacts, tasks, allEmployees] = await Promise.all([
    listContacts(id),
    listTasksByProject(id),
    listEmployees(),
  ]);
  const employees = allEmployees.filter((e) => e.role === "employee");

  const high = tasks.filter((t) => t.urgency === "high" && t.status !== "done");
  const low = tasks.filter((t) => t.urgency === "low" && t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  const updateThisProject = updateProjectAction.bind(null, id);
  const addContactHere = addContactAction.bind(null, id);
  const createTaskHere = createTaskAction.bind(null, id);
  const archiveThis = archiveProjectAction.bind(null, id);

  const tagLists = await Promise.all(tasks.map((t) => listTaskTags(t.id)));
  const tagsByTask: Record<string, TaskTag[]> = Object.fromEntries(
    tasks.map((t, idx) => [t.id, tagLists[idx]])
  );

  return (
    <div className="flex flex-col gap-6">
      <details className="card" open={!project.event_date}>
        <summary className="cursor-pointer font-bold text-lg">{project.name} — פרטי אירוע</summary>
        <form action={updateThisProject} className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-sm sm:col-span-2">
            שם הפרויקט / האירוע
            <input name="name" defaultValue={project.name} required className="input mt-1" />
          </label>
          <label className="text-sm">
            איש קשר מהלקוח
            <input name="client_contact" defaultValue={project.client_contact ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm">
            תאריך התחלה
            <input name="event_date" type="date" defaultValue={project.event_date ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm">
            תאריך סיום (אם מדובר ביותר מיום אחד)
            <input
              name="event_date_end"
              type="date"
              defaultValue={project.event_date_end ?? ""}
              className="input mt-1"
            />
          </label>
          <label className="text-sm">
            שעות
            <input name="hours" defaultValue={project.hours ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm">
            כמות אנשים
            <input name="headcount" defaultValue={project.headcount ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm">
            מיקום
            <input name="location" defaultValue={project.location ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm">
            צוות נוכח
            <input name="team_present" defaultValue={project.team_present ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm">
            אחראי/ת הצעת מחיר
            <input name="proposal_owner" defaultValue={project.proposal_owner ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            הערות כלליות
            <textarea name="general_notes" defaultValue={project.general_notes ?? ""} className="input mt-1" rows={2} />
          </label>
          <div className="sm:col-span-2 flex justify-between items-center">
            <button className="btn btn-primary" type="submit">
              שמור פרטים
            </button>
            {me.role === "owner" && (
              <form action={archiveThis}>
                <button className="btn btn-secondary btn-sm" type="submit">
                  העבר לארכיון
                </button>
              </form>
            )}
          </div>
        </form>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-semibold">
          אנשי קשר וספקים ({contacts.length})
        </summary>
        <div className="mt-4 flex flex-col gap-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b last:border-0 py-1 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-slate-500">{c.role}</span>
              <span dir="ltr" className="text-slate-500">
                {c.phone}
              </span>
            </div>
          ))}
          <form action={addContactHere} className="grid sm:grid-cols-4 gap-2 mt-2">
            <input name="name" placeholder="שם" className="input" required />
            <input name="phone" placeholder="טלפון" className="input" dir="ltr" />
            <input name="role" placeholder="תפקיד (ספק/לקוח/אחר)" className="input" />
            <button className="btn btn-secondary" type="submit">
              הוסף
            </button>
          </form>
        </div>
      </details>

      <details className="card" open>
        <summary className="cursor-pointer font-semibold">משימה חדשה</summary>
        <form action={createTaskHere} className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-sm sm:col-span-2">
            תיאור המשימה *
            <input name="title" required className="input mt-1" />
          </label>
          <label className="text-sm">
            דחיפות
            <select name="urgency" className="input mt-1" defaultValue="high">
              <option value="high">גבוהה</option>
              <option value="low">נמוכה</option>
            </select>
          </label>
          <label className="text-sm">
            איש קשר אחראי (מהלקוח/ספק)
            <input name="responsible_contact" className="input mt-1" placeholder="למשל: דנה מהקייטרינג" />
          </label>
          <label className="text-sm">
            עובד/ת אחראי/ת אצלנו
            <select name="owner_employee_id" className="input mt-1" defaultValue="">
              <option value="">— לא שויך —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            תאריך יעד למשימה (אופציונלי)
            <input name="due_date" type="date" className="input mt-1" />
          </label>
          <label className="text-sm">
            קישור (אופציונלי)
            <input name="link_url" className="input mt-1" placeholder="https://..." dir="ltr" />
          </label>
          <label className="text-sm">
            כותרת לקישור
            <input name="link_label" className="input mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            הערה
            <textarea name="notes" className="input mt-1" rows={2} />
          </label>
          <div className="sm:col-span-2">
            <button className="btn btn-primary" type="submit">
              הוסף משימה
            </button>
          </div>
        </form>
      </details>

      <TaskSection title="דחיפות גבוהה" tasks={high} employees={employees} tagsByTask={tagsByTask} accent="high" />
      <TaskSection title="דחיפות נמוכה" tasks={low} employees={employees} tagsByTask={tagsByTask} accent="low" />
      <TaskSection title="הושלמו" tasks={done} employees={employees} tagsByTask={tagsByTask} accent="done" />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  employees,
  tagsByTask,
  accent,
}: {
  title: string;
  tasks: Task[];
  employees: Employee[];
  tagsByTask: Record<string, TaskTag[]>;
  accent: "high" | "low" | "done";
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h2 className="font-semibold mb-2 flex items-center gap-2">
        <span className={`badge badge-${accent}`}>{tasks.length}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} employees={employees} tags={tagsByTask[t.id] ?? []} />
        ))}
      </div>
    </div>
  );
}
