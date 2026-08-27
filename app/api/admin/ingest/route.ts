import { NextRequest, NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth";
import { ingestDocument } from "@/lib/ingest";

/**
 * Owner-only manual ingest endpoint for testing Louis end-to-end with sample
 * documents before a live Google Drive sync exists (see lib/ingest.ts).
 */
export async function POST(request: NextRequest) {
  const me = await getCurrentEmployee();
  if (!me || me.role !== "owner") {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.source !== "string" ||
    typeof body.sourceId !== "string" ||
    typeof body.content !== "string"
  ) {
    return NextResponse.json(
      { error: "נדרשים השדות source, sourceId, content (מחרוזות)." },
      { status: 400 }
    );
  }

  const result = await ingestDocument({
    source: body.source,
    sourceId: body.sourceId,
    title: typeof body.title === "string" ? body.title : null,
    path: typeof body.path === "string" ? body.path : null,
    content: body.content,
    sensitivity: typeof body.sensitivity === "string" ? body.sensitivity : undefined,
  });

  return NextResponse.json(result);
}
