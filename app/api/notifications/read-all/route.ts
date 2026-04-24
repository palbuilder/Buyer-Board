import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function POST() {
  try {
    await markAllNotificationsRead();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/notifications/read-all", action: "POST" });
  }
}
