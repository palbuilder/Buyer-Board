import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { reportListing } from "@/lib/requests";

export async function POST(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      requestId?: unknown;
      offerId?: unknown;
      reportTarget?: unknown;
      reason?: unknown;
      details?: unknown;
      imageUrls?: unknown;
    };

    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
    const reportTarget = body.reportTarget === "offer" ? "offer" : "request";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];

    const allowedReasons = new Set(["tos_violation", "illegal_item", "unsafe_item", "harassment", "spam", "other"]);

    if (!requestId || !details || !allowedReasons.has(reason)) {
      return NextResponse.json({ error: "Choose a report reason and explain the issue." }, { status: 400 });
    }

    await reportListing({
      requestId,
      offerId: offerId || undefined,
      reportTarget,
      reason: reason as "tos_violation" | "illegal_item" | "unsafe_item" | "harassment" | "spam" | "other",
      details,
      imageUrls,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/reports", action: "POST" });
  }
}
