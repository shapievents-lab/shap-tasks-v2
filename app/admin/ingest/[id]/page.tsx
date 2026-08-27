import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { getDocument, getDocumentChunks } from "@/lib/louis-data";

export default async function AdminIngestDocumentPage(props: PageProps<"/admin/ingest/[id]">) {
  const { id: documentId } = await props.params;
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  const document = await getDocument(documentId);
  if (!document) notFound();

  const chunks = await getDocumentChunks(documentId);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/ingest" className="text-sm text-indigo-600 hover:underline w-fit">
        ← חזרה לרשימת המסמכים
      </Link>
      <div>
        <h1 className="text-xl font-bold">{document.title || "(ללא כותרת)"}</h1>
        <p className="text-sm text-slate-500">
          {document.path && `${document.path} · `}
          {chunks.length} קטעים · מקור: {document.source}
        </p>
      </div>

      <p className="text-sm text-slate-500">
        זה בדיוק הטקסט שחולץ מהקובץ ונשמר לחיפוש — כדי לבדוק אם מידע שאת יודעת שקיים בקובץ באמת נכנס
        כטקסט חיפושי (ולא, למשל, נשאר כתמונה/גרפיקה בתוך ה-PDF).
      </p>

      <div className="flex flex-col gap-2">
        {chunks.length === 0 && <p className="text-sm text-slate-500">לא נשמרו קטעים למסמך הזה.</p>}
        {chunks.map((c) => (
          <div key={c.id} className="card">
            <div className="text-xs text-slate-400 mb-1">קטע #{c.chunk_index + 1}</div>
            <div className="text-sm whitespace-pre-wrap">{c.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
