import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listConversationsForEmployee, getConversation, listMessages } from "@/lib/louis-data";
import { createLouisConversationAction } from "./actions";
import LouisChat from "@/components/LouisChat";

export default async function LouisPage(props: PageProps<"/louis">) {
  const searchParams = await props.searchParams;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const conversations = await listConversationsForEmployee(me.id);
  const requestedId = typeof searchParams?.c === "string" ? searchParams.c : undefined;
  const activeId = requestedId ?? conversations[0]?.id;

  let messages: Awaited<ReturnType<typeof listMessages>> = [];
  let activeConversationId: string | null = null;
  if (activeId) {
    const conversation = await getConversation(activeId);
    if (conversation && conversation.employee_id === me.id) {
      activeConversationId = conversation.id;
      messages = await listMessages(activeId);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">לואי — עוזר AI פנימי</h1>
          <p className="text-sm text-slate-500">
            עונה רק מתוך בסיס הידע של החברה. לא זוכר ידע כללי ואינו מבצע פעולות במערכת.
          </p>
        </div>
        <form action={createLouisConversationAction}>
          <button className="btn btn-primary btn-sm" type="submit">
            שיחה חדשה
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-1">
          {conversations.length === 0 && <p className="text-sm text-slate-500">אין עדיין שיחות.</p>}
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/louis?c=${c.id}`}
              className={`text-sm px-2 py-1.5 rounded-lg ${
                c.id === activeConversationId
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {c.title || "שיחה ללא כותרת"}
            </Link>
          ))}
        </aside>

        <section className="card">
          {!activeConversationId ? (
            <p className="text-slate-500">פתח/י שיחה חדשה כדי להתחיל לדבר עם לואי.</p>
          ) : (
            <LouisChat conversationId={activeConversationId} initialMessages={messages} />
          )}
        </section>
      </div>
    </div>
  );
}
