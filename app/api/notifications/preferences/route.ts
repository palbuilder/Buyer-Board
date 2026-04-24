import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { getCurrentNotificationPreferences, saveCurrentNotificationPreferences } from "@/lib/notifications";

export async function GET() {
  try {
    const preferences = await getCurrentNotificationPreferences();
    return NextResponse.json({ preferences });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications/preferences", action: "GET" });
  }
}

export async function PUT(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      watchlist?: unknown;
      offersClaims?: unknown;
      disputes?: unknown;
      trustSafety?: unknown;
      moderation?: unknown;
      emailOptIn?: unknown;
    };

    await saveCurrentNotificationPreferences({
      watchlist: body.watchlist !== false,
      offersClaims: body.offersClaims !== false,
      disputes: body.disputes !== false,
      trustSafety: body.trustSafety !== false,
      moderation: body.moderation !== false,
      emailOptIn: body.emailOptIn === true,
    });

    const preferences = await getCurrentNotificationPreferences();
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications/preferences", action: "PUT" });
  }
}
