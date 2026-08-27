import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { listDocuments } from "@/lib/louis-data";
import IngestFileForm from "@/components/IngestFileForm";

export default async function AdminIngestPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  const documents = await listDocuments();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">הזנת מסמכים ללואי (בדיקה)</h1>
      <p className="text-sm text-slate-500">
        העלאת קובץ PDF / DOCX / TXT בודד לבסיס הידע של לואי — לבדיקה עם כמה מסמכי דוגמה לפני חיבור
        סנכרון קבוע מתיקיית הדרייב. העלאה חוזרת של קובץ עם אותו שם מעדכנת אותו.
      </p>
      <IngestFileForm />

      <div className="flex flex-col gap-2 mt-4">
        <h2 className="font-semibold text-sm text-slate-600">מסמכים שהוזנו</h2>
        {documents.length === 0 && (
          <p className="text-sm text-slate-500">עדיין לא הוזן שום מסמך.</p>
        )}
        {documents.map((d) => (
          <Link
            key={d.id}
            href={`/admin/ingest/${d.id}`}
            className="card flex items-center justify-between text-sm hover:bg-slate-50"
          >
            <div>
              <div className="font-medium">{d.title || "(ללא כותרת)"}</div>
              {d.path && <div className="text-xs text-slate-400">{d.path}</div>}
            </div>
            <div className="text-xs text-slate-400">
              {d.chunk_count} קטעים ·{" "}
              {new Date(d.updated_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
