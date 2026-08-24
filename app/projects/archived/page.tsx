import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listArchivedProjects } from "@/lib/data";
import { unarchiveProjectAction } from "@/app/actions";

export default async function ArchivedProjectsPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const projects = await listArchivedProjects();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">פרויקטים שהסתיימו / בארכיון</h1>
        <Link href="/projects" className="text-sm text-slate-500 hover:text-slate-800">
          → חזרה לפרויקטים פעילים
        </Link>
      </div>

      <div className="grid gap-3">
        {projects.length === 0 && <p className="text-slate-500">אין עדיין פרויקטים בארכיון.</p>}
        {projects.map((p) => {
          const dateLabel =
            p.event_date && p.event_date_end && p.event_date_end !== p.event_date
              ? `${p.event_date} – ${p.event_date_end}`
              : p.event_date;
          const unarchiveThis = unarchiveProjectAction.bind(null, p.id);
          return (
            <div key={p.id} className="card flex items-center justify-between opacity-80">
              <Link href={`/projects/${p.id}`} className="flex-1">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-slate-500">
                  {[dateLabel, p.location, p.client_contact].filter(Boolean).join(" · ") ||
                    "אין עדיין פרטים"}
                </div>
              </Link>
              {me.role === "owner" && (
                <form action={unarchiveThis}>
                  <button className="btn btn-secondary btn-sm" type="submit">
                    שחזר לפעילים
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
