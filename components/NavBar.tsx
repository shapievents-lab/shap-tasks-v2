import Link from "next/link";
import { logoutAction } from "@/app/actions";

export default function NavBar({
  name,
  role,
  unread,
}: {
  name: string;
  role: string;
  unread: number;
}) {
  return (
    <header className="border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/projects" className="font-bold text-indigo-600 text-lg">
            Shap Tasks
          </Link>
          <Link href="/projects" className="text-sm text-slate-600 hover:text-slate-900">
            פרויקטים
          </Link>
          <Link href="/my-tasks" className="text-sm text-slate-600 hover:text-slate-900">
            המשימות שלי
          </Link>
          <Link href="/team" className="text-sm text-slate-600 hover:text-slate-900">
            משימות הצוות
          </Link>
          {role === "owner" && (
            <Link href="/owner" className="text-sm text-slate-600 hover:text-slate-900">
              דשבורד בעלים
            </Link>
          )}
          <Link href="/notifications" className="text-sm text-slate-600 hover:text-slate-900 relative">
            התראות
            {unread > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white rounded-full text-[10px] px-1.5 py-0.5 leading-none">
                {unread}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>שלום, {name}</span>
          <form action={logoutAction}>
            <button className="btn btn-secondary btn-sm" type="submit">
              יציאה
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
