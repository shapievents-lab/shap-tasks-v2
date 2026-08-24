"use client";

import { useActionState } from "react";
import { bulkImportAction } from "@/app/actions";

type ImportResult =
  | { ok: true; projectCount: number; contactCount: number; taskCount: number }
  | { ok: false; error: string }
  | null;

export default function ImportForm() {
  const [result, formAction, isPending] = useActionState<ImportResult, FormData>(
    async (_prev, formData) => {
      return (await bulkImportAction(formData)) as ImportResult;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="payload"
        rows={16}
        className="input font-mono text-xs"
        placeholder='{"projects": [...]}'
        required
      />
      <button className="btn btn-primary w-fit" type="submit" disabled={isPending}>
        {isPending ? "מייבא..." : "ייבוא"}
      </button>

      {result && result.ok && (
        <div className="card text-sm text-green-700">
          ✓ יובאו {result.projectCount} פרויקטים, {result.contactCount} אנשי קשר, {result.taskCount}{" "}
          משימות.
        </div>
      )}
      {result && !result.ok && (
        <div className="card text-sm text-red-700">שגיאה: {result.error}</div>
      )}
    </form>
  );
}
