import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listProjects, listTasksByProject } from "@/lib/data";
import { createProjectAction } from "@/app/actions";

export default async function ProjectsPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const projects = await listProjects();
  const taskLists = await Promise.all(projects.map((p) => listTasksByProject(p.id)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">פרויקטים</h1>
      </div>

      <div className="grid gap-3">
        {projects.length === 0 && (
          <p className="text-slate-500">אין עדיין פרויקטים. אפשר להוסיף אחד למטה.</p>
        )}
        {projects.map((p, idx) => {
          const tasks = taskLists[idx];
          const open = tasks.filter((t) => t.status !== "done");
          const high = open.filter((t) => t.urgency === "high").length;
          const low = open.filter((t) => t.urgency === "low").length;
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card flex items-center justify-between hover:border-indigo-400 transition"
            >
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-slate-500">
                  {[p.event_date, p.location, p.client_contact].filter(Boolean).join(" · ") ||
                    "אין עדיין פרטים"}
                </div>
              </div>
              <div className="flex gap-2">
                {high > 0 && <span className="badge badge-high">{high} דחוף</span>}
                {low > 0 && <span className="badge badge-low">{low} רגיל</span>}
                {open.length === 0 && tasks.length > 0 && (
                  <span className="badge badge-done">הכל הושלם</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold">+ פרויקט חדש</summary>
        <form action={createProjectAction} className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-sm sm:col-span-2">
            שם הפרויקט / האירוע *
            <input name="name" required className="input mt-1" />
          </label>
          <label className="text-sm">
            איש קשר מהלקוח
            <input name="client_contact" className="input mt-1" />
          </label>
          <label className="text-sm">
            תאריך
            <input name="event_date" type="date" className="input mt-1" />
          </label>
          <label className="text-sm">
            שעות
            <input name="hours" className="input mt-1" />
          </label>
          <label className="text-sm">
            כמות אנשים
            <input name="headcount" className="input mt-1" />
          </label>
          <label className="text-sm">
            מיקום
            <input name="location" className="input mt-1" />
          </label>
          <label className="text-sm">
            צוות נוכח
            <input name="team_present" className="input mt-1" />
          </label>
          <label className="text-sm">
            אחראי/ת הצעת מחיר
            <input name="proposal_owner" className="input mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            הערות כלליות
            <textarea name="general_notes" className="input mt-1" rows={2} />
          </label>
          <div className="sm:col-span-2">
            <button className="btn btn-primary" type="submit">
              צור פרויקט
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
