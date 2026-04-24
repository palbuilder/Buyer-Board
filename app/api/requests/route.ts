import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { validateMarketplaceListing } from "@/lib/moderation";
import { createWantedRequest, getWantedRequests } from "@/lib/requests";

function parseBudget(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "").trim();
    return Number.parseFloat(cleaned);
  }

  return Number.NaN;
}

export async function GET() {
  try {
    const requests = await getWantedRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/requests", action: "GET" });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      title?: unknown;
      category?: unknown;
      subcategory?: unknown;
      targetBudget?: unknown;
      conditionPreference?: unknown;
      shippingPreference?: unknown;
      description?: unknown;
      vehicleYear?: unknown;
      vehicleMake?: unknown;
      vehicleModel?: unknown;
      imageUrls?: unknown;
    };

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const subcategory = typeof body.subcategory === "string" && body.subcategory.trim() ? body.subcategory.trim() : "Other";
    const conditionPreference = typeof body.conditionPreference === "string" ? body.conditionPreference.trim() : "";
    const shippingPreference = typeof body.shippingPreference === "string" ? body.shippingPreference.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const vehicleYear = typeof body.vehicleYear === "string" ? body.vehicleYear.trim() : "";
    const vehicleMake = typeof body.vehicleMake === "string" ? body.vehicleMake.trim() : "";
    const vehicleModel = typeof body.vehicleModel === "string" ? body.vehicleModel.trim() : "";
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
    const targetBudget = parseBudget(body.targetBudget);

    if (!title || !category || !description || !shippingPreference || !Number.isFinite(targetBudget) || targetBudget <= 0) {
      return NextResponse.json({ error: "Please complete all required fields with a valid USD target price." }, { status: 400 });
    }

    if (category === "Auto Parts" && (!vehicleYear || !vehicleMake || !vehicleModel)) {
      return NextResponse.json({ error: "Auto parts requests require year, make, and model." }, { status: 400 });
    }

    const moderationError = validateMarketplaceListing({ title, description });

    if (moderationError) {
      return NextResponse.json({ error: moderationError }, { status: 400 });
    }

    const slug = await createWantedRequest({
      title,
      category,
      subcategory,
      targetBudget,
      conditionPreference,
      shippingPreference,
      description,
      imageUrls,
      vehicleFitment: category === "Auto Parts" ? `${vehicleYear} ${vehicleMake} ${vehicleModel}` : undefined,
    });

    return NextResponse.json({ slug }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/requests", action: "POST" });
  }
}
