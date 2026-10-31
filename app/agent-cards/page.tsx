import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { isReviewer, listAgentCards, SOURCE_LABEL, type AgentCardRow } from "@/lib/agent";

const STATUS_LABEL: Record<AgentCardRow["status"], string> = {
  pending: "מחכה לאישור",
  approved: "אושר",
  rejected: "נדחה",
  irrelevant: "לא רלוונטי",
  failed: "נכשל",
};

function CardRow({ c }: { c: AgentCardRow }) {
  const needsYou = c.proposed_card?.needs_you?.length ?? 0;
  return (
    <Link href={`/agent-cards/${c.id}`} className="card flex items-center justify-between gap-3 hover:bg-slate-50">
      <div>
        <div className="font-medium">{c.proposed_card?.card_title ?? c.title ?? "(בלי נושא)"}</div>
        <div className="text-xs text-slate-500 mt-1">
          {SOURCE_LABEL[c.source] ?? c.source} · {c.conversation_at ?? ""}
          {c.reason ? ` · ${c.reason}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {c.status === "pending" && needsYou > 0 && <span className="badge badge-high">צריך אותך: {needsYou}</span>}
        <span className="badge badge-open">{STATUS_LABEL[c.status]}</span>
      </div>
    </Link>
  );
}

export default async function AgentCardsPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (!isReviewer(me)) redirect("/projects");

  const [pending, approved, irrelevant] = await Promise.all([
    listAgentCards("pending"),
    listAgentCards("approved"),
    listAgentCards("irrelevant"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">מחלק המשימות - כרטיסים לאישור</h1>
        <p className="text-sm text-slate-500 mt-1">
          כל שיחה שנכנסה הופכת לכרטיס. שום דבר לא נכנס לפרויקטים לפני שאת מאשרת.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        {pending.length === 0 && <p className="text-slate-500">אין כרטיסים שמחכים לך.</p>}
        {pending.map((c) => (
          <CardRow key={c.id} c={c} />
        ))}
      </section>

      {approved.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-slate-600">אושרו לאחרונה ({approved.length})</summary>
          <div className="flex flex-col gap-2 mt-2">
            {approved.slice(0, 20).map((c) => (
              <CardRow key={c.id} c={c} />
            ))}
          </div>
        </details>
      )}

      {irrelevant.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-slate-600">
            שיחות שהסוכן דילג עליהן כלא רלוונטיות ({irrelevant.length})
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            {irrelevant.slice(0, 20).map((c) => (
              <CardRow key={c.id} c={c} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
