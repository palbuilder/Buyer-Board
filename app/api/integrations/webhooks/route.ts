import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { createWebhookSubscription, getWebhookSubscriptions } from "@/lib/integrations";

export async function GET() {
  try {
    const subscriptions = await getWebhookSubscriptions();
    return NextResponse.json({ subscriptions });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/integrations/webhooks", action: "GET" });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      endpointUrl?: unknown;
      eventTypes?: unknown;
    };

    const endpointUrl = typeof body.endpointUrl === "string" ? body.endpointUrl.trim() : "";
    const eventTypes = Array.isArray(body.eventTypes)
      ? body.eventTypes.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    await createWebhookSubscription({
      endpointUrl,
      eventTypes,
    });

    const subscriptions = await getWebhookSubscriptions();
    return NextResponse.json({ success: true, subscriptions }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/integrations/webhooks", action: "POST" });
  }
}
