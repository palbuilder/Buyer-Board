import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { authorizeInternalCronRequest } from "@/lib/internal-cron";
import { logBuyerBoardEvent } from "@/lib/observability";
import { processSellerDigestDeliveries } from "@/lib/integrations";

export async function POST(request: NextRequest) {
  try {
    if (!authorizeInternalCronRequest(request)) {
      logBuyerBoardEvent("warn", "digest_run_unauthorized", {
        hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      });
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const profileId = searchParams.get("profileId")?.trim() || undefined;
    const force = searchParams.get("force") === "true";
    logBuyerBoardEvent("info", "digest_run_requested", {
      profileId,
      force,
    });
    const result = await processSellerDigestDeliveries({ force, profileId });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, {
      route: "/api/internal/digests/run",
      action: "POST",
    });
  }
}
