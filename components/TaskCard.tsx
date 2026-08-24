import type { Task, TaskTag } from "@/lib/data";
import type { Employee } from "@/lib/auth";
import {
  updateTaskStatusAction,
  addTaskNoteAction,
  tagEmployeeAction,
  resolveTaskTagAction,
} from "@/app/actions";

const statusLabel: Record<Task["status"], string> = {
  open: "פתוח",
  stuck: "בעבודה",
  done: "הושלם",
};

export default function TaskCard({
  task,
  employees,
  tags,
}: {
  task: Task;
  employees: Employee[];
  tags: TaskTag[];
}) {
  const setOpen = updateTaskStatusAction.bind(null, task.id, "open");
  const setStuck = updateTaskStatusAction.bind(null, task.id, "stuck");
  const setDone = updateTaskStatusAction.bind(null, task.id, "done");
  const addNoteHere = addTaskNoteAction.bind(null, task.id);
  const tagHere = tagEmployeeAction.bind(null, task.id);

  const links: { label: string; url: string }[] = task.links ? JSON.parse(task.links) : [];
  const owner = employees.find((e) => e.id === task.owner_employee_id);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{task.title}</div>
          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {task.responsible_contact && <span>איש קשר: {task.responsible_contact}</span>}
            {owner && <span>אחראי/ת: {owner.name}</span>}
            {task.due_date && <span>יעד: {task.due_date}</span>}
            {links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" className="text-indigo-600 underline">
                {l.label}
              </a>
            ))}
          </div>
          {task.notes && (
            <div className="text-xs text-slate-600 mt-2 whitespace-pre-line border-t pt-2">
              {task.notes}
            </div>
          )}
          {tags.length > 0 && (
            <div className="text-xs mt-2 flex flex-wrap gap-2">
              {tags.map((t) => {
                const resolveThis = resolveTaskTagAction.bind(null, t.id, task.project_id);
                return (
                  <span
                    key={t.id}
                    className={`flex items-center gap-1 border rounded px-2 py-0.5 ${
                      t.resolved_at
                        ? "bg-slate-50 border-slate-200 text-slate-400 line-through"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    🏷 {t.employee_name}
                    {t.note ? `: ${t.note}` : ""}
                    {!t.resolved_at && (
                      <form action={resolveThis}>
                        <button
                          type="submit"
                          className="text-emerald-700 font-bold ms-1"
                          title="סמן כטופל"
                        >
                          ✓
                        </button>
                      </form>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <span className={`badge badge-${task.status}`}>{statusLabel[task.status]}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 border-t pt-3">
        <form action={setOpen}>
          <button className="btn btn-secondary btn-sm" type="submit">
            פתוח
          </button>
        </form>
        <form action={setStuck}>
          <button className="btn btn-secondary btn-sm" type="submit">
            בעבודה
          </button>
        </form>
        <form action={setDone}>
          <button className="btn btn-secondary btn-sm" type="submit">
            הושלם ✓
          </button>
        </form>

        <details className="ms-auto">
          <summary className="text-xs text-indigo-600 cursor-pointer">תייג / הוסף הערה</summary>
          <div className="flex flex-col gap-2 mt-2 w-64">
            <form action={tagHere} className="flex flex-col gap-2">
              <select name="employee_id" className="input" required defaultValue="">
                <option value="" disabled>
                  תייג עובד/ת...
                </option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <input name="note" placeholder="הערה (למשל: אני צריכה שתאשרי)" className="input" />
              <button className="btn btn-secondary btn-sm" type="submit">
                תייג
              </button>
            </form>
            <form action={addNoteHere} className="flex gap-2">
              <input name="note" placeholder="הערה חדשה" className="input" />
              <button className="btn btn-secondary btn-sm" type="submit">
                הוסף
              </button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}
