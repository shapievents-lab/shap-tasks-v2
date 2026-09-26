"use client";

import { useState } from "react";
import type { Task, TaskTag } from "@/lib/data";
import type { Employee } from "@/lib/auth";
import {
  updateTaskStatusAction,
  addTaskNoteAction,
  tagEmployeeAction,
  resolveTaskTagAction,
  updateTaskAction,
  deleteTaskAction,
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
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const setOpen = updateTaskStatusAction.bind(null, task.id, "open");
  const setStuck = updateTaskStatusAction.bind(null, task.id, "stuck");
  const setDone = updateTaskStatusAction.bind(null, task.id, "done");
  const addNoteHere = addTaskNoteAction.bind(null, task.id);
  const tagHere = tagEmployeeAction.bind(null, task.id);
  const saveEditHere = updateTaskAction.bind(null, task.id);
  const deleteThis = deleteTaskAction.bind(null, task.id);

  const links: { label: string; url: string }[] = task.links ? JSON.parse(task.links) : [];
  const owner = employees.find((e) => e.id === task.owner_employee_id);
  const accent =
    task.status === "done"
      ? "card-accent-done"
      : task.urgency === "high"
        ? "card-accent-high"
        : "card-accent-low";

  if (editing) {
    return (
      <div className={`card ${accent}`}>
        <form
          action={async (formData) => {
            await saveEditHere(formData);
            setEditing(false);
          }}
          className="grid sm:grid-cols-2 gap-3"
        >
          <label className="text-sm sm:col-span-2">
            תיאור המשימה *
            <input name="title" defaultValue={task.title} required className="input mt-1" />
          </label>
          <label className="text-sm">
            דחיפות
            <select name="urgency" className="input mt-1" defaultValue={task.urgency}>
              <option value="high">גבוהה</option>
              <option value="low">נמוכה</option>
            </select>
          </label>
          <label className="text-sm">
            איש קשר אחראי (מהלקוח/ספק)
            <input
              name="responsible_contact"
              defaultValue={task.responsible_contact ?? ""}
              className="input mt-1"
            />
          </label>
          <label className="text-sm">
            תאריך יעד למשימה (אופציונלי)
            <input name="due_date" type="date" defaultValue={task.due_date ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            הערה
            <textarea name="notes" defaultValue={task.notes ?? ""} className="input mt-1" rows={2} />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn btn-primary btn-sm" type="submit">
              שמור
            </button>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setEditing(false)}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`card ${accent}`}>
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

        <button
          className="text-xs text-indigo-600"
          type="button"
          onClick={() => setEditing(true)}
        >
          ערוך
        </button>

        {confirmingDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-red-600">למחוק את המשימה?</span>
            <form action={deleteThis}>
              <button className="text-red-600 font-semibold" type="submit">
                כן, מחק
              </button>
            </form>
            <button
              className="text-slate-500"
              type="button"
              onClick={() => setConfirmingDelete(false)}
            >
              ביטול
            </button>
          </span>
        ) : (
          <button
            className="text-xs text-red-600"
            type="button"
            onClick={() => setConfirmingDelete(true)}
          >
            מחק
          </button>
        )}

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
