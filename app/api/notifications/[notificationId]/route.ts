import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { requireApiCurrentUser } from "@/lib/auth";
import { deleteNotification, markNotificationRead } from "@/lib/notifications";

type NotificationRouteProps = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function PATCH(_: Request, { params }: NotificationRouteProps) {
  try {
    await requireApiCurrentUser();
    const { notificationId } = await params;

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notification information." }, { status: 400 });
    }

    await markNotificationRead(notificationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications/[notificationId]", action: "PATCH" });
  }
}

export async function DELETE(_: Request, { params }: NotificationRouteProps) {
  try {
    await requireApiCurrentUser();
    const { notificationId } = await params;

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notification information." }, { status: 400 });
    }

    await deleteNotification(notificationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications/[notificationId]", action: "DELETE" });
  }
}
