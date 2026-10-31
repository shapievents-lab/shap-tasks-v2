import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { getProject, listProjects, type Project } from "@/lib/data";
import { getAgentCard, isReviewer, SOURCE_LABEL, type CardSegment, type TaskChange } from "@/lib/agent";
import { approveAgentCardAction, rejectAgentCardAction } from "../actions";

const ACTION_LABEL: Record<TaskChange["action"], string> = {
  new_task: "משימה חדשה",
  add_items: "להוסיף סעיפים ל",
  update_item: "לעדכן סעיפים ב",
  close_item: "לסמן כבוצע ב",
};

function Quote({ text }: { text?: string }) {
  if (!text) return null;
  return <div className="text-xs text-slate-400 mt-0.5">מהשיחה: &quot;{text}&quot;</div>;
}

function Segment({ seg, i, projects, readOnly }: { seg: CardSegment; i: number; projects: Project[]; readOnly: boolean }) {
  const defaultTarget = seg.project_id ?? (seg.new_project ? "__new__" : "__skip__");
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">פרויקט:</span>
        <select name={`seg${i}_project`} defaultValue={defaultTarget} className="input input-sm max-w-xs" disabled={readOnly}>
          <option value="__skip__">לא להכניס (לדלג על החלק הזה)</option>
          <option value="__new__">פרויקט חדש</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {(seg.new_project || !seg.project_id) && (
          <input
            name={`seg${i}_newname`}
            defaultValue={seg.new_project_name ?? ""}
            placeholder="שם לפרויקט חדש"
            className="input input-sm max-w-xs"
            disabled={readOnly}
          />
        )}
      </div>
      {seg.needs_you_reason && <div className="text-sm text-amber-700">צריך אותך: {seg.needs_you_reason}</div>}

      {(seg.task_changes ?? []).map((tc, j) => (
        <div key={j} className="border-r-4 border-indigo-200 pr-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={`seg${i}_tc${j}_on`} defaultChecked disabled={readOnly} />
            <span className="text-slate-500">{ACTION_LABEL[tc.action]}</span>
            {tc.action === "new_task" ? (
              <input name={`seg${i}_tc${j}_title`} defaultValue={tc.title} className="input input-sm max-w-xs font-medium" disabled={readOnly} />
            ) : (
              <span className="font-medium">&quot;{tc.title}&quot;</span>
            )}
          </label>
          {tc.action === "new_task" && (
            <div className="text-xs text-slate-500">
              דחיפות: {tc.urgency === "low" ? "נמוכה" : "גבוהה"}
              {tc.due_date ? ` · תאריך יעד: ${tc.due_date}` : ""}
              {tc.responsible_contact ? ` · איש קשר: ${tc.responsible_contact}` : ""}
              {tc.owner_employee ? ` · אחראי/ת: ${tc.owner_employee}` : ""}
            </div>
          )}
          {tc.items.map((it, k) => (
            <div key={k}>
              <textarea
                name={`seg${i}_tc${j}_it${k}`}
                defaultValue={it.text}
                rows={Math.min(5, Math.ceil(it.text.length / 90) + 1)}
                className="input w-full text-sm"
                disabled={readOnly}
              />
              {it.replaces && <div className="text-xs text-slate-500">במקום: &quot;{it.replaces}&quot;</div>}
              <Quote text={it.source_quote} />
            </div>
          ))}
        </div>
      ))}

      {!!seg.already_exists?.length && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500">כבר קיים - לא הצעתי ({seg.already_exists.length})</summary>
          <ul className="list-disc pr-5 mt-1 text-slate-600">
            {seg.already_exists.map((a, k) => (
              <li key={k}>
                &quot;{a.existing_task_title}&quot;: {a.item}
              </li>
            ))}
          </ul>
        </details>
      )}

      {!!seg.event_details?.length && (
        <div className="flex flex-col gap-2">
          <div className="font-medium text-sm">פרטי אירוע</div>
          {seg.event_details.map((d, k) => (
            <div key={k}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`seg${i}_ed${k}_on`} defaultChecked disabled={readOnly} />
                <span className="w-28 shrink-0">{d.label || d.field}</span>
                <input name={`seg${i}_ed${k}_value`} defaultValue={d.value} className="input input-sm flex-1" disabled={readOnly} />
              </label>
              <div className="text-xs text-slate-500 pr-6">
                {d.status === "changed" ? `שינוי - היה: "${d.previous ?? ""}"` : "חדש"}
              </div>
              <Quote text={d.source_quote} />
            </div>
          ))}
        </div>
      )}

      {!!seg.contacts?.length && (
        <div className="flex flex-col gap-2">
          <div className="font-medium text-sm">אנשי קשר וספקים</div>
          {seg.contacts.map((c, k) => (
            <label key={k} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="checkbox" name={`seg${i}_ct${k}_on`} defaultChecked disabled={readOnly} />
              <input name={`seg${i}_ct${k}_name`} defaultValue={c.name} className="input input-sm w-36" disabled={readOnly} />
              <input name={`seg${i}_ct${k}_role`} defaultValue={c.role ?? ""} placeholder="תפקיד" className="input input-sm w-56" disabled={readOnly} />
              <input name={`seg${i}_ct${k}_phone`} defaultValue={c.phone ?? ""} placeholder="טלפון" className="input input-sm w-32" disabled={readOnly} />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AgentCardPage(props: PageProps<"/agent-cards/[id]">) {
  const { id } = await props.params;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (!isReviewer(me)) redirect("/projects");

  const row = await getAgentCard(id);
  if (!row) notFound();
  const card = row.status === "approved" ? row.final_card ?? row.proposed_card : row.proposed_card;
  const readOnly = row.status !== "pending";

  const projects = await listProjects();
  for (const seg of card?.segments ?? []) {
    if (seg.project_id && !projects.some((p) => p.id === seg.project_id)) {
      const archived = await getProject(seg.project_id);
      if (archived) projects.push(archived);
    }
  }

  const approve = approveAgentCardAction.bind(null, id);
  const reject = rejectAgentCardAction.bind(null, id);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/agent-cards" className="text-sm text-indigo-600">← כל הכרטיסים</Link>
      <div>
        <h1 className="text-xl font-bold">{card?.card_title ?? row.title ?? "(בלי נושא)"}</h1>
        <div className="text-sm text-slate-500 mt-1">
          {SOURCE_LABEL[row.source] ?? row.source} · {row.conversation_at}
          {row.reason ? ` · ${row.reason}` : ""}
        </div>
      </div>

      {row.status === "approved" && (
        <div className="card bg-green-50">
          <div className="font-medium mb-1">אושר ונכנס ל-SHAP TASKS:</div>
          <ul className="list-disc pr-5 text-sm">
            {(row.apply_log ?? []).map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {row.status === "rejected" && <div className="card bg-slate-100 text-sm">הכרטיס נדחה. שום דבר לא נכנס.</div>}

      {card && (
        <form action={approve} className="flex flex-col gap-4">
          {!!card.needs_you?.length && (
            <div className="card bg-amber-50">
              <div className="font-semibold mb-1">צריך אותך</div>
              <ul className="list-disc pr-5 text-sm">
                {card.needs_you.map((n, k) => (
                  <li key={k}>{n}</li>
                ))}
              </ul>
              {!readOnly && (
                <div className="text-xs text-slate-500 mt-2">
                  אפשר לענות ישר בתוך הסעיפים למטה - לתקן את הטקסט, לבחור פרויקט, או להוריד את הסימון.
                </div>
              )}
            </div>
          )}

          {card.segments.map((seg, i) => (
            <Segment key={i} seg={seg} i={i} projects={projects} readOnly={readOnly} />
          ))}

          {!!card.filtered?.length && (
            <div className="card bg-red-50">
              <div className="font-semibold mb-1">סונן - לא נכנס (רק את רואה את זה)</div>
              <ul className="list-disc pr-5 text-sm">
                {card.filtered.map((f, k) => (
                  <li key={k}>
                    <span className="text-slate-500">[{f.category}]</span> {f.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!card.not_items?.length && (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500">שורות שלא נכנסו ({card.not_items.length})</summary>
              <ul className="list-disc pr-5 mt-1 text-slate-600">
                {card.not_items.map((n, k) => (
                  <li key={k}>
                    {n.line} - {n.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!readOnly && (
            <div className="flex gap-2 sticky bottom-2">
              <button type="submit" className="btn btn-primary">אישור - להכניס ל-SHAP TASKS</button>
              <button type="submit" formAction={reject} className="btn btn-secondary">לדחות את כל הכרטיס</button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
