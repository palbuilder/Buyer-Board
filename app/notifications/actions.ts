"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { hasEmailDeliveryEnv } from "@/lib/email/config";
import { sendBuyerBoardEmail } from "@/lib/email/server";
import {
  deleteNotification,
  deleteNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsRead,
  saveCurrentNotificationPreferences,
} from "@/lib/notifications";

function getNotificationsReturnPath(formData: FormData | undefined, fallbackPath = "/notifications") {
  const rawPath = String(formData?.get("returnTo") ?? "").trim();
  return rawPath.startsWith("/") ? rawPath : fallbackPath;
}

function withStatus(path: string, key: "notice" | "error", value: string) {
  const [pathWithoutHash, hash = ""] = path.split("#");
  const [pathname, queryString = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(queryString);
  params.delete("notice");
  params.delete("error");
  params.set(key, value);
  const nextQuery = params.toString();
  const nextHash = hash ? `#${hash}` : "";
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${nextHash}`;
}

export async function markOneNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const returnTo = getNotificationsReturnPath(formData);

  if (!notificationId) {
    redirect(withStatus(returnTo, "error", "Missing notification information."));
  }

  try {
    await markNotificationRead(notificationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark this notification as read.";
    redirect(withStatus(returnTo, "error", message));
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(withStatus(returnTo, "notice", "Notification marked read"));
}

export async function markEveryNotificationRead(formData: FormData) {
  const returnTo = getNotificationsReturnPath(formData);

  try {
    await markAllNotificationsRead();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark all notifications as read.";
    redirect(withStatus(returnTo, "error", message));
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(withStatus(returnTo, "notice", "All notifications marked read"));
}

export async function markSelectedNotificationsRead(formData: FormData) {
  const returnTo = getNotificationsReturnPath(formData);
  const notificationIds = formData
    .getAll("notificationId")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  try {
    await markNotificationsRead(notificationIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark those notifications as read.";
    redirect(withStatus(returnTo, "error", message));
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(withStatus(returnTo, "notice", "Selected notifications marked read"));
}

export async function deleteOneNotification(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const returnTo = getNotificationsReturnPath(formData);

  if (!notificationId) {
    redirect(withStatus(returnTo, "error", "Missing notification information."));
  }

  try {
    await deleteNotification(notificationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete this notification.";
    redirect(withStatus(returnTo, "error", message));
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(withStatus(returnTo, "notice", "Notification deleted"));
}

export async function deleteSelectedNotifications(formData: FormData) {
  const returnTo = getNotificationsReturnPath(formData);
  const notificationIds = formData
    .getAll("notificationId")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  try {
    await deleteNotifications(notificationIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete those notifications.";
    redirect(withStatus(returnTo, "error", message));
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(withStatus(returnTo, "notice", "Selected notifications deleted"));
}

export async function saveNotificationPreferences(formData: FormData) {
  const returnTo = getNotificationsReturnPath(formData, "/dashboard?tab=buyer#notification-settings");

  try {
    await saveCurrentNotificationPreferences({
      watchlist: String(formData.get("watchlist") ?? "") === "on",
      offersClaims: String(formData.get("offersClaims") ?? "") === "on",
      disputes: String(formData.get("disputes") ?? "") === "on",
      trustSafety: String(formData.get("trustSafety") ?? "") === "on",
      moderation: String(formData.get("moderation") ?? "") === "on",
      emailOptIn: String(formData.get("emailOptIn") ?? "") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save notification preferences.";
    redirect(withStatus(returnTo, "error", message));
  }

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  redirect(withStatus(returnTo, "notice", "Notification preferences saved"));
}

export async function sendTestNotificationEmail(formData: FormData) {
  const returnTo = getNotificationsReturnPath(formData, "/dashboard?tab=buyer#notification-settings");
  const user = await requireCurrentUser("/notifications");

  if (!hasEmailDeliveryEnv()) {
    redirect(withStatus(returnTo, "error", "Email delivery is not configured yet."));
  }

  if (!user.email) {
    redirect(withStatus(returnTo, "error", "No email address is available on this account."));
  }

  await sendBuyerBoardEmail({
    to: user.email,
    subject: "BuyerBoard test email",
    body: "This is a test message from your BuyerBoard notification system. If you received it, email delivery is connected correctly.",
    href: "/dashboard?tab=buyer#notification-settings",
  });

  redirect(withStatus(returnTo, "notice", "Test email sent"));
}
