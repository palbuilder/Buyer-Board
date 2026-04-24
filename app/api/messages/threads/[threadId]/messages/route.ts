import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { sendDirectMessage } from "@/lib/community";
import { validateMarketplaceMessage } from "@/lib/moderation";

type ThreadMessageRouteProps = {
  params: Promise<{
    threadId: string;
  }>;
};

export async function POST(request: Request, { params }: ThreadMessageRouteProps) {
  try {
    await requireApiCurrentUser();
    const { threadId } = await params;
    const body = (await request.json()) as {
      body?: unknown;
    };

    const messageBody = typeof body.body === "string" ? body.body.trim() : "";

    if (!threadId || !messageBody) {
      return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
    }

    const moderationError = validateMarketplaceMessage({
      message: messageBody,
    });

    if (moderationError) {
      return NextResponse.json({ error: moderationError }, { status: 400 });
    }

    const moderationState = await sendDirectMessage({
      threadId,
      body: messageBody,
    });

    return NextResponse.json({
      success: true,
      moderationState,
      notice:
        moderationState === "flagged"
          ? "Message held for review because it appears to share off-platform contact or payment details."
          : undefined,
    });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/messages/threads/[threadId]/messages", action: "POST" });
  }
}
