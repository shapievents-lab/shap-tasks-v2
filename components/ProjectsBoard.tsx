"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project, ProjectTaskCounts } from "@/lib/data";
import { reorderProjectsAction, archiveProjectQuickAction } from "@/app/actions";
import { formatEventRange } from "@/lib/dates";

export type ProjectRow = Project & { counts?: ProjectTaskCounts };

/** Draggable project list for "סדר ידני" mode — reorders instantly on the client for a snappy
 * feel, then persists the new order in the background via a server action. */
export default function ProjectsBoard({
  projects,
  canArchive,
}: {
  projects: ProjectRow[];
  canArchive: boolean;
}) {
  const [items, setItems] = useState(projects);
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = items.findIndex((p) => p.id === dragId);
    const to = items.findIndex((p) => p.id === targetId);
    setDragId(null);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    void reorderProjectsAction(next.map((p) => p.id));
  }

  return (
    <div className="grid gap-3">
      {items.map((p) => {
        const counts = p.counts;
        const high = counts?.high ?? 0;
        const low = counts?.low ?? 0;
        const openTotal = counts?.openTotal ?? 0;
        const taskTotal = counts?.taskTotal ?? 0;
        const dateLabel = formatEventRange(p.event_date, p.event_date_end);
        const archiveThisQuick = archiveProjectQuickAction.bind(null, p.id);
        const accent = high > 0 ? "card-accent-high" : openTotal === 0 && taskTotal > 0 ? "card-accent-done" : "";
        const dragging = dragId === p.id;
        return (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragId(p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(p.id)}
            onDragEnd={() => setDragId(null)}
            className={`card flex items-center gap-2 justify-between hover:border-indigo-400 transition cursor-grab active:cursor-grabbing ${accent} ${
              dragging ? "opacity-50" : ""
            }`}
          >
            <span className="text-slate-300 select-none text-lg leading-none" title="גררי לשינוי סדר">
              ⠿
            </span>
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
