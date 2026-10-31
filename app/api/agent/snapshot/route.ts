import { NextRequest, NextResponse } from "next/server";
import { agentAuthorized, getAgentSnapshot } from "@/lib/agent";

/** Read-only snapshot the task distributor needs to match conversations to projects. */
export async function GET(request: NextRequest) {
  if (!agentAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "אין הרשאה." }, { status: 401 });
  }
  return NextResponse.json(await getAgentSnapshot());
}
