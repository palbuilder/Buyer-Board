import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { authorizeInternalCronRequest } from "@/lib/internal-cron";
import { logBuyerBoardEvent } from "@/lib/observability";
import { processStaleRequestConfirmations } from "@/lib/requests";

export async function POST(request: NextRequest) {
  try {
    if (!authorizeInternalCronRequest(request)) {
      logBuyerBoardEvent("warn", "stale_request_run_unauthorized", {
        hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      });
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const force = request.nextUrl.searchParams.get("force") === "true";
    logBuyerBoardEvent("info", "stale_request_run_requested", {
      force,
    });
    const result = await processStaleRequestConfirmations({ force });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, {
      route: "/api/internal/requests/stale/run",
      action: "POST",
    });
  }
}
