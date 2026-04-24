import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { respondToDispute } from "@/lib/requests";

type SellerDisputeRouteProps = {
  params: Promise<{
    disputeId: string;
  }>;
};

export async function POST(request: Request, { params }: SellerDisputeRouteProps) {
  try {
    await requireApiCurrentUser();
    const { disputeId } = await params;
    const body = (await request.json()) as {
      response?: unknown;
      sellerEvidence?: unknown;
      sellerEvidenceImageUrls?: unknown;
    };

    const response = typeof body.response === "string" ? body.response.trim() : "";
    const sellerEvidence = typeof body.sellerEvidence === "string" ? body.sellerEvidence.trim() : "";
    const sellerEvidenceImageUrls = Array.isArray(body.sellerEvidenceImageUrls)
      ? body.sellerEvidenceImageUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    if (!disputeId || !response) {
      return NextResponse.json({ error: "Add a seller response before sending." }, { status: 400 });
    }

    await respondToDispute({
      disputeId,
      response,
      sellerEvidence: sellerEvidence || undefined,
      sellerEvidenceImageUrls,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/disputes/[disputeId]/seller-response", action: "POST" });
  }
}
