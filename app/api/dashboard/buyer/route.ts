import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getBuyerDashboardSummary } from "@/lib/requests";

export async function GET() {
  try {
    const summary = await getBuyerDashboardSummary();
    return NextResponse.json({ summary });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
