import { ensureProfileForUser, getCurrentUser, requireCurrentUser } from "@/lib/auth";
import { sendBuyerBoardEmail } from "@/lib/email/server";
import { assertRateLimit } from "@/lib/runtime-guards";
import { createClient } from "@/lib/supabase/server";
import type { NotificationItem, NotificationPreferenceKey, NotificationPreferences } from "@/lib/types";

type DbNotificationRow = {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  href?: string | null;
  read_at?: string | null;
  created_at: string;
};

type DbNotificationPreferenceRow = {
  profile_id: string;
  watchlist_enabled?: boolean | null;
  offers_claims_enabled?: boolean | null;
  disputes_enabled?: boolean | null;
  trust_safety_enabled?: boolean | null;
  moderation_enabled?: boolean | null;
  email_opt_in?: boolean | null;
};

const defaultPreferences: NotificationPreferences = {
  watchlist: true,
  offersClaims: true,
  disputes: true,
  trustSafety: true,
  moderation: true,
  emailOptIn: false,
};

function mapPreferences(row?: DbNotificationPreferenceRow | null) {
  return {
    watchlist: row?.watchlist_enabled ?? true,
    offersClaims: row?.offers_claims_enabled ?? true,
    disputes: row?.disputes_enabled ?? true,
    trustSafety: row?.trust_safety_enabled ?? true,
    moderation: row?.moderation_enabled ?? true,
    emailOptIn: row?.email_opt_in ?? false,
  } satisfies NotificationPreferences;
}

function formatRelativeDate(dateInput: string) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.max(1, Math.round(diffHours / 24));
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function mapNotification(row: DbNotificationRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    read: Boolean(row.read_at),
    createdAt: row.created_at,
    createdLabel: formatRelativeDate(row.created_at),
  } satisfies NotificationItem;
}

function normalizeNotificationIds(values: string[]) {
  const ids = [...new Set(values.map((value) => value.trim()).filter(Boolean))];

  if (ids.length === 0) {
    throw new Error("Choose at least one notification.");
  }

  if (ids.length > 100) {
    throw new Error("Too many notifications were selected at once.");
  }

  return ids;
}

export async function createNotification(input: {
  profileId: string;
  title: string;
  body: string;
  href?: string;
  preferenceKey?: NotificationPreferenceKey;
  sendEmail?: boolean;
}) {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  let preferences: NotificationPreferences | null = null;

  if (input.preferenceKey) {
    const { data: preferenceRow, error: preferenceError } = await supabase
      .from("notification_preferences")
      .select("profile_id, watchlist_enabled, offers_claims_enabled, disputes_enabled, trust_safety_enabled, moderation_enabled, email_opt_in")
      .eq("profile_id", input.profileId)
      .maybeSingle();

    // Preference checks should fail closed. If this lookup breaks, it is safer
    // to skip the optional notification than to ignore a user's opt-out choice.
    if (preferenceError) {
      console.error("BuyerBoard notification preference lookup failed", preferenceError);
      return;
    }

    preferences = mapPreferences(preferenceRow as DbNotificationPreferenceRow | null | undefined);
    const enabled =
      input.preferenceKey === "watchlist"
        ? preferences.watchlist
        : input.preferenceKey === "offers_claims"
          ? preferences.offersClaims
          : input.preferenceKey === "disputes"
            ? preferences.disputes
            : input.preferenceKey === "trust_safety"
              ? preferences.trustSafety
              : preferences.moderation;

    if (!enabled) {
      return;
    }
  }

  // Notifications are supporting side effects, not the main transaction. We still want a
  // loud signal in the logs if the insert fails, but we avoid throwing here so an offer,
  // dispute, or review does not fail just because the notification table is unavailable.
  const { error: notificationInsertError } = await supabase.from("notifications").insert({
    profile_id: input.profileId,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
  });

  if (notificationInsertError) {
    console.error("BuyerBoard notification insert failed", notificationInsertError);
    return;
  }

  if (!input.preferenceKey || !input.sendEmail) {
    return;
  }

  if (!preferences?.emailOptIn) {
    return;
  }

  try {
    const { data: profileRow, error: profileLookupError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", input.profileId)
      .maybeSingle();

    if (profileLookupError) {
      console.error("BuyerBoard notification email lookup failed", profileLookupError);
      return;
    }

    if (profileRow?.email) {
      await sendBuyerBoardEmail({
        to: profileRow.email,
        subject: input.title,
        body: input.body,
        href: input.href,
      });
    }
  } catch (error) {
    console.error("BuyerBoard email delivery failed", error);
  }
}

export async function getCurrentNotifications(limit = 20, nextPath = "/notifications") {
  const user = await requireCurrentUser(nextPath);
  const supabase = await createClient();

  if (!supabase) {
    return [] as NotificationItem[];
  }

  const { data } = await supabase
    .from("notifications")
    .select("id, profile_id, title, body, href, read_at, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as DbNotificationRow[]).map(mapNotification);
}

export async function getNotificationBellState(limit = 6) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      isSignedIn: false,
      unreadCount: 0,
      notifications: [] as NotificationItem[],
    };
  }

  await ensureProfileForUser(user);
  const supabase = await createClient();

  if (!supabase) {
    return {
      isSignedIn: true,
      unreadCount: 0,
      notifications: [] as NotificationItem[],
    };
  }

  const [{ data }, { count: unreadCount, error: unreadCountError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, profile_id, title, body, href, read_at, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .is("read_at", null),
  ]);

  if (unreadCountError) {
    throw new Error(unreadCountError.message);
  }

  const notifications = ((data ?? []) as DbNotificationRow[]).map(mapNotification);

  return {
    isSignedIn: true,
    unreadCount: unreadCount ?? notifications.filter((notification) => !notification.read).length,
    notifications,
  };
}

export async function getCurrentNotificationPreferences() {
  const user = await requireCurrentUser("/notifications");
  const supabase = await createClient();

  if (!supabase) {
    return defaultPreferences;
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("profile_id, watchlist_enabled, offers_claims_enabled, disputes_enabled, trust_safety_enabled, moderation_enabled, email_opt_in")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapPreferences(data as DbNotificationPreferenceRow | null | undefined);
}

export async function saveCurrentNotificationPreferences(input: NotificationPreferences) {
  const user = await requireCurrentUser("/notifications");
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  assertRateLimit({
    scope: "notification-preferences-save",
    actorKey: user.id,
    limit: 20,
    windowMs: 10 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  const { error } = await supabase.from("notification_preferences").upsert({
    profile_id: user.id,
    watchlist_enabled: input.watchlist,
    offers_claims_enabled: input.offersClaims,
    disputes_enabled: input.disputes,
    trust_safety_enabled: input.trustSafety,
    moderation_enabled: input.moderation,
    email_opt_in: input.emailOptIn,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function markNotificationRead(notificationId: string) {
  const [id] = normalizeNotificationIds([notificationId]);
  const user = await requireCurrentUser("/notifications");
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Notification not found.");
  }
}

export async function markAllNotificationsRead() {
  const user = await requireCurrentUser("/notifications");
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markNotificationsRead(notificationIds: string[]) {
  const ids = normalizeNotificationIds(notificationIds);
  const user = await requireCurrentUser("/notifications");
  const supabase = await createClient();

  if (!supabase) {
    return 0;
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .in("id", ids)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}

export async function deleteNotification(notificationId: string) {
  const [id] = normalizeNotificationIds([notificationId]);
  const deletedCount = await deleteNotifications([id]);

  if (deletedCount === 0) {
    throw new Error("Notification not found.");
  }
}

export async function deleteNotifications(notificationIds: string[]) {
  const ids = normalizeNotificationIds(notificationIds);
  const user = await requireCurrentUser("/notifications");
  const supabase = await createClient();

  if (!supabase) {
    return 0;
  }

  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("profile_id", user.id)
    .in("id", ids)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}
