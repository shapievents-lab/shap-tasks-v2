"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentEmployee, listEmployees } from "@/lib/auth";
import {
  createConversation,
  getConversation,
  listMessages,
  addMessage,
  setConversationTitleIfEmpty,
} from "@/lib/louis-data";
import { askLouis, type ChatTurn } from "@/lib/louis";
import { notifyEmployee } from "@/lib/notify";

export async function createLouisConversationAction() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  const conversationId = await createConversation(me.id, null);
  revalidatePath("/louis");
  redirect(`/louis?c=${conversationId}`);
}

export type SendLouisMessageState = { ok: boolean; error?: string } | null;

export async function sendLouisMessageAction(
  conversationId: string,
  _prev: SendLouisMessageState,
  formData: FormData
): Promise<SendLouisMessageState> {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.employee_id !== me.id) {
    return { ok: false, error: "השיחה לא נמצאה." };
  }

  const question = String(formData.get("message") ?? "").trim();
  if (!question) return { ok: false, error: "הקלד/י שאלה." };

  await addMessage(conversationId, "user", question);
  await setConversationTitleIfEmpty(conversationId, question.slice(0, 60));

  const priorMessages = await listMessages(conversationId);
  const history: ChatTurn[] = priorMessages
    .slice(0, -1) // exclude the question we just inserted — sent separately below
    .map((m) => ({ role: m.role, content: m.content }));

  let result: { answer: string; flagged: boolean };
  try {
    result = await askLouis(history, question);
  } catch {
    return { ok: false, error: "שגיאה בפנייה ללואי. נסה/י שוב." };
  }

  await addMessage(conversationId, "assistant", result.answer, result.flagged);

  if (result.flagged) {
    const employees = await listEmployees();
    const owners = employees.filter((e) => e.role === "owner");
    for (const owner of owners) {
      await notifyEmployee({
        employeeId: owner.id,
        message: `לואי סימן שאלה של ${me.name} לבדיקה: "${question}"`,
      });
    }
  }

  revalidatePath("/louis");
  return { ok: true };
}
