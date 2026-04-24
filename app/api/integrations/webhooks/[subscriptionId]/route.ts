import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { deleteWebhookSubscription, getWebhookSubscriptions, updateWebhookSubscription } from "@/lib/integrations";

type WebhookRouteProps = {
  params: Promise<{
    subscriptionId: string;
  }>;
};

export async function PATCH(request: Request, { params }: WebhookRouteProps) {
  try {
    await requireApiCurrentUser();
    const { subscriptionId } = await params;
    const body = (await request.json()) as {
      endpointUrl?: unknown;
      eventTypes?: unknown;
      isActive?: unknown;
    };

    await updateWebhookSubscription({
      subscriptionId,
      endpointUrl: typeof body.endpointUrl === "string" ? body.endpointUrl.trim() : undefined,
      eventTypes: Array.isArray(body.eventTypes)
        ? body.eventTypes.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });

    const subscriptions = await getWebhookSubscriptions();
    return NextResponse.json({ success: true, subscriptions });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/integrations/webhooks/[subscriptionId]", action: "PATCH" });
  }
}

export async function DELETE(_: Request, { params }: WebhookRouteProps) {
  try {
    await requireApiCurrentUser();
    const { subscriptionId } = await params;
    await deleteWebhookSubscription(subscriptionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/integrations/webhooks/[subscriptionId]", action: "DELETE" });
  }
}
