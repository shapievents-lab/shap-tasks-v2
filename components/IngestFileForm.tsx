"use client";

import { useActionState, useEffect, useRef } from "react";
import { ingestFileAction, type IngestFileState } from "@/app/admin/ingest/actions";

export default function IngestFileForm() {
  const [state, formAction, isPending] = useActionState<IngestFileState, FormData>(
    ingestFileAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div>
        <label className="text-sm text-slate-600 block mb-1">
          קובץ (PDF / DOCX / PPTX / XLSX / TXT / CSV)
        </label>
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv"
          required
          className="input"
        />
      </div>
      <div>
        <label className="text-sm text-slate-600 block mb-1">כותרת (אופציונלי)</label>
        <input type="text" name="title" className="input" placeholder="ברירת מחדל: שם הקובץ" />
      </div>
      <div>
        <label className="text-sm text-slate-600 block mb-1">נתיב / הערת מקור (אופציונלי)</label>
        <input type="text" name="path" className="input" placeholder='למשל: "AKT- אביטל"' />
      </div>
      <button className="btn btn-primary w-fit" type="submit" disabled={isPending}>
        {isPending ? "מעלה..." : "העלה והזן לבסיס הידע"}
      </button>

      {state && state.ok && (
        <div className="card text-sm text-green-700">
          ✓ &quot;{state.title}&quot;{" "}
          {state.skipped
            ? "לא השתנה מאז ההעלאה הקודמת — לא הוזן מחדש."
            : `נכנס לבסיס הידע (${state.chunkCount} קטעים).`}
        </div>
      )}
      {state && !state.ok && <div className="card text-sm text-red-700">שגיאה: {state.error}</div>}
    </form>
  );
}
