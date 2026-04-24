import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { validateMarketplaceMessage } from "@/lib/moderation";
import { createSellerResponse } from "@/lib/requests";

type OfferRouteProps = {
  params: Promise<{
    requestId: string;
  }>;
};

function parseOffer(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "").trim();
    return Number.parseFloat(cleaned);
  }

  return Number.NaN;
}

export async function POST(request: Request, { params }: OfferRouteProps) {
  try {
    await requireApiCurrentUser();
    const { requestId } = await params;
    const body = (await request.json()) as {
      offeredPrice?: unknown;
      message?: unknown;
      proposedClaimWindowHours?: unknown;
      imageUrls?: unknown;
    };

    const offeredPrice = parseOffer(body.offeredPrice);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const proposedClaimWindowHours =
      typeof body.proposedClaimWindowHours === "number"
        ? body.proposedClaimWindowHours
        : Number.parseInt(String(body.proposedClaimWindowHours ?? "48"), 10);
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];

    if (!requestId || !message || !Number.isFinite(offeredPrice) || offeredPrice <= 0 || !Number.isFinite(proposedClaimWindowHours) || proposedClaimWindowHours <= 0) {
      return NextResponse.json({ error: "Complete all seller response fields before sending." }, { status: 400 });
    }

    const moderationError = validateMarketplaceMessage({ message });

    if (moderationError) {
      return NextResponse.json({ error: moderationError }, { status: 400 });
    }

    await createSellerResponse({
      requestId,
      offeredPrice,
      message,
      proposedClaimWindowHours,
      imageUrls,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/requests/[requestId]/offers", action: "POST" });
  }
}
