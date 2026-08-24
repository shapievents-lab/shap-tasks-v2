"use client";

import Link from "next/link";
import type { TaskWithProject } from "@/lib/data";
import type { Employee } from "@/lib/auth";
import { setTaskOwnerAction } from "@/app/actions";

const statusLabel: Record<TaskWithProject["status"], string> = {
  open: "פתוח",
  stuck: "בעבודה",
  done: "הושלם",
};

export default function TeamTaskRow({
  task,
  employees,
}: {
  task: TaskWithProject;
  employees: Employee[];
}) {
  const assignHere = setTaskOwnerAction.bind(null, task.id);

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="font-medium">{task.title}</div>
        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <Link href={`/projects/${task.project_id}`} className="text-indigo-600 underline">
            {task.project_name}
          </Link>
          {task.due_date && <span>יעד: {task.due_date}</span>}
          {task.responsible_contact && <span>איש קשר: {task.responsible_contact}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`badge badge-${task.status}`}>{statusLabel[task.status]}</span>
        <form action={assignHere} className="flex items-center gap-1">
          <select
            name="employee_id"
            defaultValue={task.owner_employee_id ?? ""}
            className="input input-sm"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="">— לא שויך —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </form>
      </div>
    </div>
  );
}
