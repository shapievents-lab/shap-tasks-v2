import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { getConversationWithEmployee, listMessages } from "@/lib/louis-data";

export default async function OwnerLouisConversationPage(props: PageProps<"/owner/louis/[id]">) {
  const { id: conversationId } = await props.params;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  const conversation = await getConversationWithEmployee(conversationId);
  if (!conversation) notFound();

  const messages = await listMessages(conversationId);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/owner/louis" className="text-sm text-indigo-600 hover:underline w-fit">
        ← כל השיחות
      </Link>
      <div>
        <h1 className="text-xl font-bold">{conversation.title || "שיחה ללא כותרת"}</h1>
        <p className="text-sm text-slate-500">עובד/ת: {conversation.employee_name}</p>
      </div>

      <div className="flex flex-col gap-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`card max-w-[85%] ${
              m.role === "user" ? "self-end bg-indigo-50" : "self-start"
            }`}
          >
            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            {m.flagged && <div className="text-xs text-amber-600 mt-1">⚠ סומן לבדיקת הנהלה</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
