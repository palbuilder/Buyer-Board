import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getSellerOpportunityFeed } from "@/lib/integrations";

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const opportunities = await getSellerOpportunityFeed({
      category: searchParams.get("category") ?? undefined,
      subcategory: searchParams.get("subcategory") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      sinceHours: parseNumber(searchParams.get("sinceHours")),
      minBudget: parseNumber(searchParams.get("minBudget")),
    });

    return NextResponse.json({ opportunities });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
