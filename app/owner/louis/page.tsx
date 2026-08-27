import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listAllConversations } from "@/lib/louis-data";

export default async function OwnerLouisPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  const conversations = await listAllConversations();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">לואי — כל השיחות (לקריאה בלבד)</h1>

      {conversations.length === 0 && <p className="text-slate-500">אין עדיין שיחות.</p>}

      <div className="flex flex-col gap-2">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/owner/louis/${c.id}`}
            className="card flex items-center justify-between text-sm hover:bg-slate-50"
          >
            <span className="font-medium">{c.title || "שיחה ללא כותרת"}</span>
            <span className="text-slate-400 text-xs">
              {c.employee_name} ·{" "}
              {new Date(c.started_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
