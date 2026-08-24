import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listProjects, listProjectsCustomOrder, listProjectTaskCounts } from "@/lib/data";
import { createProjectAction, archiveProjectQuickAction } from "@/app/actions";
import { formatEventRange } from "@/lib/dates";
import ProjectsBoard, { type ProjectRow } from "@/components/ProjectsBoard";

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const searchParams = await props.searchParams;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const sortMode = searchParams?.sort === "custom" ? "custom" : "auto";
  const [projects, taskCounts] = await Promise.all([
    sortMode === "custom" ? listProjectsCustomOrder() : listProjects(),
    listProjectTaskCounts(),
  ]);
  const rows: ProjectRow[] = projects.map((p) => ({ ...p, counts: taskCounts[p.id] }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">פרויקטים</h1>
        <Link href="/projects/archived" className="text-sm text-slate-500 hover:text-slate-800">
          פרויקטים שהסתיימו / בארכיון ←
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <a href="/projects?sort=auto" className={`btn btn-sm ${sortMode === "auto" ? "btn-primary" : "btn-secondary"}`}>
          מיון לפי תאריך
        </a>
        <a
          href="/projects?sort=custom"
          className={`btn btn-sm ${sortMode === "custom" ? "btn-primary" : "btn-secondary"}`}
        >
          סדר ידני (גררי)
        </a>
        {sortMode === "custom" && (
          <span className="text-xs text-slate-500">גררי כרטיס למקום הרצוי כדי לשנות את הסדר</span>
        )}
      </div>

      {projects.length === 0 && <p className="text-slate-500">אין עדיין פרויקטים. אפשר להוסיף אחד למטה.</p>}
      {projects.length > 0 &&
        (sortMode === "custom" ? (
          <ProjectsBoard projects={rows} canArchive={me.role === "owner"} />
        ) : (
          <StaticProjectList projects={rows} canArchive={me.role === "owner"} />
        ))}

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
            תאריך התחלה (מלא: 2026-11-05, או רק חודש: 2026-11)
            <input name="event_date" type="text" placeholder="2026-11-05 או 2026-11" className="input mt-1" dir="ltr" />
          </label>
          <label className="text-sm">
            תאריך סיום (אם מדובר ביותר מיום אחד)
            <input name="event_date_end" type="text" placeholder="2026-11-07" className="input mt-1" dir="ltr" />
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

/** Read-only project list for the automatic (date-sorted) view — no drag handles or client JS. */
function StaticProjectList({ projects, canArchive }: { projects: ProjectRow[]; canArchive: boolean }) {
  return (
    <div className="grid gap-3">
      {projects.map((p) => {
        const counts = p.counts;
        const high = counts?.high ?? 0;
        const low = counts?.low ?? 0;
        const openTotal = counts?.openTotal ?? 0;
        const taskTotal = counts?.taskTotal ?? 0;
        const dateLabel = formatEventRange(p.event_date, p.event_date_end);
        const archiveThisQuick = archiveProjectQuickAction.bind(null, p.id);
        const accent = high > 0 ? "card-accent-high" : openTotal === 0 && taskTotal > 0 ? "card-accent-done" : "";
        return (
          <div
            key={p.id}
            className={`card flex items-center justify-between hover:border-indigo-400 transition ${accent}`}
          >
            <Link href={`/projects/${p.id}`} className="flex-1">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-slate-500">
                {[dateLabel, p.location, p.client_contact].filter(Boolean).join(" · ") || "אין עדיין פרטים"}
              </div>
            </Link>
            <div className="flex items-center gap-2">
              {high > 0 && <span className="badge badge-high">{high} דחוף</span>}
              {low > 0 && <span className="badge badge-low">{low} רגיל</span>}
              {openTotal === 0 && taskTotal > 0 && <span className="badge badge-done">הכל הושלם</span>}
              {canArchive && (
                <form action={archiveThisQuick}>
                  <button className="btn btn-secondary btn-sm" type="submit">
                    העבר לארכיון
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
