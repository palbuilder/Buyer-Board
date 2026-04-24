import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { updateClaimOfferDecision } from "@/lib/requests";

type ClaimDecisionRouteProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function POST(request: Request, { params }: ClaimDecisionRouteProps) {
  try {
    await requireApiCurrentUser();
    const { requestId } = await params;
    const body = (await request.json()) as {
      offerId?: unknown;
      decision?: unknown;
      buyerComment?: unknown;
    };

    const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
    const decision =
      body.decision === "accepted" || body.decision === "declined" || body.decision === "countered"
        ? body.decision
        : "";
    const buyerComment = typeof body.buyerComment === "string" ? body.buyerComment.trim() : "";

    if (!requestId || !offerId || !decision) {
      return NextResponse.json({ error: "Missing claim decision information." }, { status: 400 });
    }

    if (decision === "countered" && !buyerComment) {
      return NextResponse.json({ error: "Add a counteroffer comment before sending." }, { status: 400 });
    }

    await updateClaimOfferDecision({
      requestId,
      offerId,
      decision,
      buyerComment: buyerComment || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/requests/[requestId]/claim-decision", action: "POST" });
  }
}
