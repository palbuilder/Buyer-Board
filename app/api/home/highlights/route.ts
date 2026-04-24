import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getMarketplaceHighlights } from "@/lib/requests";

export async function GET() {
  try {
    const highlights = await getMarketplaceHighlights();
    return NextResponse.json({ highlights });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
