import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { reportTransactionIssue } from "@/lib/requests";

export async function POST(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      transactionId?: unknown;
      requestId?: unknown;
      reason?: unknown;
      details?: unknown;
      buyerEvidence?: unknown;
      buyerEvidenceImageUrls?: unknown;
    };

    const transactionId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";
    const buyerEvidence = typeof body.buyerEvidence === "string" ? body.buyerEvidence.trim() : "";
    const buyerEvidenceImageUrls = Array.isArray(body.buyerEvidenceImageUrls)
      ? body.buyerEvidenceImageUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    const allowedReasons = new Set(["wrong_item", "defective_item", "not_as_described", "shipping_issue", "other"]);

    if (!transactionId || !requestId || !details || !allowedReasons.has(reason)) {
      return NextResponse.json({ error: "Choose an issue reason and describe what went wrong." }, { status: 400 });
    }

    await reportTransactionIssue({
      transactionId,
      requestId,
      reason: reason as "wrong_item" | "defective_item" | "not_as_described" | "shipping_issue" | "other",
      details,
      buyerEvidence: buyerEvidence || undefined,
      buyerEvidenceImageUrls,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/disputes", action: "POST" });
  }
}
