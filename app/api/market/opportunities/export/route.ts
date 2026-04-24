import { apiErrorResponse } from "@/lib/api-route";
import { getSellerOpportunityFeed } from "@/lib/integrations";

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function escapeCsvValue(value: string | number) {
  const stringValue = String(value);

  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
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

    const lines = [
      [
        "title",
        "category",
        "subcategory",
        "location",
        "target_budget",
        "budget_label",
        "shipping",
        "status",
        "posted",
        "offer_count",
        "request_url",
      ].join(","),
      ...opportunities.requests.map((requestItem) =>
        [
          requestItem.title,
          requestItem.category,
          requestItem.subcategory,
          requestItem.location,
          requestItem.targetBudget,
          requestItem.budgetLabel,
          requestItem.shipping,
          requestItem.status,
          requestItem.postedLabel,
          requestItem.offerCount,
          `/requests/${requestItem.slug}`,
        ]
          .map(escapeCsvValue)
          .join(","),
      ),
    ];

    const csv = lines.join("\n");
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="buyerboard-opportunities-${today}.csv"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
