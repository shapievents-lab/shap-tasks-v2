import { query, id } from "./db";

/**
 * Creates an in-app notification, and attempts to also send it over WhatsApp.
 *
 * WhatsApp sending is intentionally a stub right now: sher hasn't connected a
 * WhatsApp Business API account yet. Once that's connected (e.g. via a
 * Composio/Twilio WhatsApp connector), swap the body of sendWhatsApp() for a
 * real API call — everything else (in-app notifications, the "tag someone on
 * a task" flow) already works end to end without waiting on that.
 */
export async function notifyEmployee(params: {
  employeeId: string;
  taskId?: string;
  message: string;
  phone?: string | null;
}) {
  const notifId = id();
  await query(
    `INSERT INTO notifications (id, employee_id, task_id, message, read, whatsapp_sent)
     VALUES ($1, $2, $3, $4, FALSE, FALSE)`,
    [notifId, params.employeeId, params.taskId ?? null, params.message]
  );

  const sent = await sendWhatsApp(params.phone, params.message);
  if (sent) {
    await query("UPDATE notifications SET whatsapp_sent = TRUE WHERE id = $1", [notifId]);
  }
  return notifId;
}

async function sendWhatsApp(phone: string | null | undefined, message: string): Promise<boolean> {
  if (!phone) return false;
  // TODO: once a WhatsApp Business API connection exists, call it here.
  // For now this is a no-op so the rest of the notification flow can be
  // built, tested, and used (in-app notifications work today).
  return false;
}
