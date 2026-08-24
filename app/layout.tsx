import type { Metadata } from "next";
import "./globals.css";
import { getCurrentEmployee } from "@/lib/auth";
import { unreadNotificationCount } from "@/lib/data";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Shap Tasks",
  description: "מערכת ניהול המשימות של Shap Productions",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const me = await getCurrentEmployee();
  const unread = me ? await unreadNotificationCount(me.id) : 0;

  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {me && <NavBar name={me.name} role={me.role} unread={unread} />}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
