import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getSellerDashboardSummary } from "@/lib/requests";

export async function GET() {
  try {
    const summary = await getSellerDashboardSummary();
    return NextResponse.json({ summary });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
