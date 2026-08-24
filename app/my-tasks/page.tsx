import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee, listEmployees } from "@/lib/auth";
import {
  listTasksForEmployee,
  listOpenTagsForEmployee,
  listTaskTagsForTasks,
  type TaskWithProject,
  type TaskTag,
} from "@/lib/data";
import { resolveTaskTagAction } from "@/app/actions";
import { formatEventDate } from "@/lib/dates";
import TaskCard from "@/components/TaskCard";

export default async function MyTasksPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const [myTasks, openTags, employees] = await Promise.all([
    listTasksForEmployee(me.id),
    listOpenTagsForEmployee(me.id),
    listEmployees(),
  ]);

  const tagsByTask: Record<string, TaskTag[]> = await listTaskTagsForTasks(myTasks.map((t) => t.id));

  // myTasks already comes back ordered soonest-event-first (see listTasksForEmployee), so
  // insertion order into this map is the display order — no extra sort needed here.
  const byProject = new Map<
    string,
    { project_id: string; project_name: string; project_event_date: string | null; tasks: TaskWithProject[] }
  >();
  for (const t of myTasks) {
    if (!byProject.has(t.project_id)) {
      byProject.set(t.project_id, {
        project_id: t.project_id,
        project_name: t.project_name,
        project_event_date: t.project_event_date ?? null,
        tasks: [],
      });
    }
    byProject.get(t.project_id)!.tasks.push(t);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold">המשימות שלי</h1>
        <p className="text-sm text-slate-500 mt-1">
          כל המשימות שמשויכות אליך, מחולקות לפי פרויקט, ממוינות לפי תאריך האירוע הקרוב. סמני סטטוס, תייגי מישהו או אשרי תיוג ישירות מכאן.
        </p>
      </div>

      {openTags.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="badge badge-high">{openTags.length}</span>
            ממתין לתשומת לב / אישור שלך
          </h2>
          <div className="flex flex-col gap-2">
            {openTags.map((tag) => {
              const resolveThis = resolveTaskTagAction.bind(null, tag.id, tag.project_id);
              return (
                <div key={tag.id} className="card flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{tag.task_title}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      <Link href={`/projects/${tag.project_id}`} className="text-indigo-600 underline">
                        {tag.project_name}
                      </Link>
                      {tag.tagged_by_name ? ` · תויגת עי"י ${tag.tagged_by_name}` : ""}
                    </div>
                    {tag.note && <div className="text-sm text-slate-700 mt-2">{tag.note}</div>}
                  </div>
                  <form action={resolveThis}>
                    <button className="btn btn-secondary btn-sm shrink-0" type="submit">
                      טופל ✓
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {byProject.size === 0 && openTags.length === 0 && (
        <p className="text-slate-500">אין כרגע משימות שמשויכות אליך.</p>
      )}

      {[...byProject.values()].map((group) => {
        const high = group.tasks.filter((t) => t.urgency === "high" && t.status !== "done");
        const low = group.tasks.filter((t) => t.urgency === "low" && t.status !== "done");
        const done = group.tasks.filter((t) => t.status === "done");
        const dateLabel = formatEventDate(group.project_event_date);
        return (
          <section key={group.project_id} className="card">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2 flex-wrap">
              <Link href={`/projects/${group.project_id}`} className="hover:text-indigo-600">
                {group.project_name}
              </Link>
              {dateLabel && (
                <span className="text-xs font-normal text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                  {dateLabel}
                </span>
              )}
            </h2>
            <TaskGroup title="דחיפות גבוהה" accent="high" tasks={high} employees={employees} tagsByTask={tagsByTask} />
            <TaskGroup title="דחיפות נמוכה" accent="low" tasks={low} employees={employees} tagsByTask={tagsByTask} />
            <TaskGroup title="הושלמו (הישגים)" accent="done" tasks={done} employees={employees} tagsByTask={tagsByTask} />
          </section>
        );
      })}
    </div>
  );
}

function TaskGroup({
  title,
  accent,
  tasks,
  employees,
  tagsByTask,
}: {
  title: string;
  accent: "high" | "low" | "done";
  tasks: TaskWithProject[];
  employees: { id: string; name: string; code: string; role: "employee" | "owner" }[];
  tagsByTask: Record<string, TaskTag[]>;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <span className={`badge badge-${accent}`}>{tasks.length}</span>
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} employees={employees} tags={tagsByTask[t.id] ?? []} />
        ))}
      </div>
    </div>
  );
}
