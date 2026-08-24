import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentEmployee } from "@/lib/auth";
import { listNotifications } from "@/lib/data";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions";

export default async function NotificationsPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const notifications = await listNotifications(me.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">התראות</h1>
        <form action={markAllNotificationsReadAction}>
          <button className="btn btn-secondary btn-sm" type="submit">
            סמן הכל כנקרא
          </button>
        </form>
      </div>

      {notifications.length === 0 && <p className="text-slate-500">אין התראות.</p>}

      <div className="flex flex-col gap-2">
        {notifications.map((n) => {
          const markRead = markNotificationReadAction.bind(null, n.id);
          return (
            <div
              key={n.id}
              className={`card flex items-center justify-between gap-3 ${n.read ? "opacity-60" : ""}`}
            >
              <div>
                <div className="text-sm">{n.message}</div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  {new Date(n.created_at).toLocaleString("he-IL", {
                    timeZone: "Asia/Jerusalem",
                  })}
                  {n.project_id && (
                    <Link href={`/projects/${n.project_id}`} className="text-indigo-600 underline">
                      לפרויקט
                    </Link>
                  )}
                  {!n.whatsapp_sent && (
                    <span title="וואטסאפ עוד לא מחובר">📱 לא נשלח בוואטסאפ</span>
                  )}
                </div>
              </div>
              {!n.read && (
                <form action={markRead}>
                  <button className="btn btn-secondary btn-sm" type="submit">
                    סמן כנקרא
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
