"use server";

import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import { ingestDocument } from "@/lib/ingest";
import { extractText } from "@/lib/extract-text";

export type IngestFileState =
  | { ok: true; title: string; chunkCount: number; skipped: boolean }
  | { ok: false; error: string }
  | null;

/** Owner-only: upload a single PDF/DOCX/TXT file and add it to Louis's knowledge base. */
export async function ingestFileAction(
  _prev: IngestFileState,
  formData: FormData
): Promise<IngestFileState> {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") {
    return { ok: false, error: "רק בעלים יכולים להזין מסמכים." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "יש לבחור קובץ." };
  }

  const path = String(formData.get("path") ?? "").trim() || null;
  const sensitivity = String(formData.get("sensitivity") ?? "normal").trim() || "normal";
  const title = String(formData.get("title") ?? "").trim() || file.name;

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractText(file.name, buffer);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "שגיאה בחילוץ טקסט מהקובץ." };
  }

  if (!text.trim()) {
    return { ok: false, error: "לא נמצא טקסט בקובץ (ייתכן שזה PDF סרוק כתמונה, ללא שכבת טקסט)." };
  }

  const result = await ingestDocument({
    source: "manual-upload",
    sourceId: `manual-upload:${file.name}`,
    title,
    path,
    content: text,
    sensitivity,
  });

  return { ok: true, title, chunkCount: result.chunkCount, skipped: result.skipped };
}
