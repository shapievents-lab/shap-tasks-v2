import { NextRequest, NextResponse } from "next/server";
import { agentAuthorized, recordAgentCard, type Card } from "@/lib/agent";

const STATUSES = ["pending", "irrelevant", "failed"] as const;

/**
 * The task distributor submits one row per conversation it processed. It can only propose —
 * nothing here touches projects or tasks; that happens after the reviewer approves.
 */
export async function POST(request: NextRequest) {
  if (!agentAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const status = body?.status as (typeof STATUSES)[number];
  if (
    !body ||
    typeof body.source !== "string" ||
    typeof body.source_id !== "string" ||
    !STATUSES.includes(status) ||
    (status === "pending" && (typeof body.card !== "object" || !Array.isArray(body.card?.segments)))
  ) {
    return NextResponse.json(
      { error: "נדרשים source, source_id, status (pending/irrelevant/failed), ו-card כשהסטטוס pending." },
      { status: 400 }
    );
  }
  const result = await recordAgentCard({
    source: body.source,
    source_id: body.source_id,
    title: typeof body.title === "string" ? body.title : null,
    conversation_at: typeof body.conversation_at === "string" ? body.conversation_at : null,
    status,
    reason: typeof body.reason === "string" ? body.reason : null,
    card: status === "pending" ? (body.card as Card) : null,
  });
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
