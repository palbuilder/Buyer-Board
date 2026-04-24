import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { submitTransactionReview } from "@/lib/requests";

export async function POST(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      transactionId?: unknown;
      requestId?: unknown;
      rating?: unknown;
      reviewText?: unknown;
    };

    const transactionId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const rating = typeof body.rating === "number" ? body.rating : Number.parseInt(String(body.rating ?? ""), 10);
    const reviewText = typeof body.reviewText === "string" ? body.reviewText.trim() : "";

    if (!transactionId || !requestId || Number.isNaN(rating)) {
      return NextResponse.json({ error: "Choose a rating before sending your review." }, { status: 400 });
    }

    await submitTransactionReview({
      transactionId,
      requestId,
      rating,
      reviewText: reviewText || undefined,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/reviews", action: "POST" });
  }
}
