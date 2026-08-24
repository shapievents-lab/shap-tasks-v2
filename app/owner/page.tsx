import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listActivitySince, type ActivityRow } from "@/lib/data";
import { startOfToday, startOfWeek } from "@/lib/time";

const actionLabel: Record<string, string> = {
  created: "יצר/ה משימה",
  status_changed: "עדכן/ה סטטוס ל",
  tagged: "תייג/ה מישהו",
  note: "הוסיף/ה הערה",
  assigned: "שייך/ה משימה",
  tag_resolved: "סימן/ה תיוג כטופל",
};

const statusLabel: Record<string, string> = {
  open: "פתוח",
  stuck: "בעבודה",
  done: "הושלם",
};

export default async function OwnerPage(props: PageProps<"/owner">) {
  const searchParams = await props.searchParams;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  const range = searchParams?.range === "week" ? "week" : "today";
  const since = range === "week" ? startOfWeek() : startOfToday();
  const activity = await listActivitySince(since);

  const byEmployee = new Map<string, ActivityRow[]>();
  for (const row of activity) {
    const key = row.employee_name ?? "לא ידוע";
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key)!.push(row);
  }

  const completed = activity.filter((r) => r.action === "status_changed" && r.detail === "done");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">דשבורד בעלים — מה הצוות עשה</h1>
        <div className="flex gap-2">
          <a
            href="/owner?range=today"
            className={`btn btn-sm ${range === "today" ? "btn-primary" : "btn-secondary"}`}
          >
            היום
          </a>
          <a
            href="/owner?range=week"
            className={`btn btn-sm ${range === "week" ? "btn-primary" : "btn-secondary"}`}
          >
            השבוע
          </a>
        </div>
      </div>

      {byEmployee.size === 0 && (
        <p className="text-slate-500">אין עדיין פעילות בטווח הזה.</p>
      )}

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <span className="badge badge-done">{completed.length}</span>
          משימות שהושלמו ({range === "week" ? "השבוע" : "היום"})
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-slate-500">אין עדיין משימות שהושלמו בטווח הזה.</p>
        ) : (
          <div className="card">
            <ul className="flex flex-col gap-1 text-sm">
              {completed.map((r) => (
                <li key={r.id} className="text-slate-600 border-b last:border-0 pb-1">
                  <span className="text-slate-400 text-xs">
                    {new Date(r.created_at).toLocaleString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "Asia/Jerusalem",
                    })}
                  </span>{" "}
                  <span className="font-medium">{r.employee_name ?? "לא ידוע"}</span> השלים/ה את{" "}
                  <span className="font-medium">{r.task_title}</span>
                  {r.project_name ? ` (${r.project_name})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {[...byEmployee.entries()].map(([name, rows]) => (
          <div key={name} className="card">
            <div className="font-semibold mb-2">{name}</div>
            <ul className="flex flex-col gap-1 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="text-slate-600 border-b last:border-0 pb-1">
                  <span className="text-slate-400 text-xs">
                    {new Date(r.created_at).toLocaleString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "Asia/Jerusalem",
                    })}
                  </span>{" "}
                  {actionLabel[r.action] ?? r.action}
                  {r.action === "status_changed"
                    ? ` "${statusLabel[r.detail ?? ""] ?? r.detail}"`
                    : ""}{" "}
                  —{" "}
                  <span className="font-medium">{r.task_title ?? r.project_name}</span>
                  {r.project_name && r.task_title ? ` (${r.project_name})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
