import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { completeSellerClaim } from "@/lib/requests";

type CompleteClaimRouteProps = {
  params: Promise<{
    claimId: string;
  }>;
};

export async function POST(request: Request, { params }: CompleteClaimRouteProps) {
  try {
    await requireApiCurrentUser();
    const { claimId } = await params;
    const body = (await request.json()) as {
      requestId?: unknown;
    };

    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";

    if (!claimId || !requestId) {
      return NextResponse.json({ error: "Missing active claim information." }, { status: 400 });
    }

    await completeSellerClaim({ claimId, requestId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/claims/[claimId]/complete", action: "POST" });
  }
}
