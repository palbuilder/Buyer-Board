import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { getDirectInbox, startDirectConversation } from "@/lib/community";

export async function GET() {
  try {
    const threads = await getDirectInbox();
    return NextResponse.json({ threads });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/messages/threads", action: "GET" });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      memberId?: unknown;
      requestId?: unknown;
      transactionId?: unknown;
    };

    const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const transactionId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";

    if (!memberId) {
      return NextResponse.json({ error: "Missing member information." }, { status: 400 });
    }

    const threadId = await startDirectConversation({
      targetMemberId: memberId,
      requestId: requestId || undefined,
      transactionId: transactionId || undefined,
    });
    return NextResponse.json({ threadId }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/messages/threads", action: "POST" });
  }
}
