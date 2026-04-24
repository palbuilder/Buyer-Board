import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { deleteNotifications, getNotificationBellState, markAllNotificationsRead, markNotificationsRead } from "@/lib/notifications";

export async function GET() {
  try {
    await requireApiCurrentUser();
    const bellState = await getNotificationBellState(50);
    return NextResponse.json({
      notifications: bellState.notifications,
      unreadCount: bellState.unreadCount,
    });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications", action: "GET" });
  }
}

function parseNotificationIds(body: { notificationIds?: unknown }) {
  return Array.isArray(body.notificationIds)
    ? body.notificationIds.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)
    : [];
}

export async function PATCH(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      notificationIds?: unknown;
      markAll?: unknown;
    };

    if (body.markAll === true) {
      await markAllNotificationsRead();
      return NextResponse.json({ success: true, updatedCount: "all" });
    }

    const notificationIds = parseNotificationIds(body);

    if (notificationIds.length === 0) {
      return NextResponse.json({ error: "Choose at least one notification." }, { status: 400 });
    }

    const updatedCount = await markNotificationsRead(notificationIds);
    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications", action: "PATCH" });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiCurrentUser();

    const body = (await request.json()) as {
      notificationIds?: unknown;
    };

    const notificationIds = parseNotificationIds(body);

    if (notificationIds.length === 0) {
      return NextResponse.json({ error: "Choose at least one notification." }, { status: 400 });
    }

    const deletedCount = await deleteNotifications(notificationIds);
    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications", action: "DELETE" });
  }
}
