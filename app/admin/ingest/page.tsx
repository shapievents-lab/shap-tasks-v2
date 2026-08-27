import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import IngestFileForm from "@/components/IngestFileForm";

export default async function AdminIngestPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">הזנת מסמכים ללואי (בדיקה)</h1>
      <p className="text-sm text-slate-500">
        העלאת קובץ PDF / DOCX / TXT בודד לבסיס הידע של לואי — לבדיקה עם כמה מסמכי דוגמה לפני חיבור
        סנכרון קבוע מתיקיית הדרייב. העלאה חוזרת של קובץ עם אותו שם מעדכנת אותו.
      </p>
      <IngestFileForm />
    </div>
  );
}
