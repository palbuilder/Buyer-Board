import { getCurrentProfile, requireMarketplaceAccess, requireCurrentUser } from "@/lib/auth";
import { hasEmailDeliveryEnv } from "@/lib/email/config";
import { sendBuyerBoardEmail } from "@/lib/email/server";
import { logBuyerBoardEvent } from "@/lib/observability";
import { getWantedRequests } from "@/lib/requests";
import {
  assertRateLimit,
  normalizeOptionalText,
  requireHttpsUrl,
  requireIntegerInRange,
  requireNumberInRange,
  requireTrimmedText,
} from "@/lib/runtime-guards";
import { createClient } from "@/lib/supabase/server";
import type {
  DailyRequestDigest,
  DailyRequestDigestItem,
  SellerDigestSubscription,
  SellerOpportunityFeed,
  WebhookSubscription,
  WantedRequest,
} from "@/lib/types";

type DigestFilters = {
  category?: string;
  subcategory?: string;
  state?: string;
  sinceHours?: number;
  minBudget?: number;
};

type DbWebhookRow = {
  id: string;
  endpoint_url: string;
  event_types: string[] | null;
  is_active: boolean | null;
  created_at: string;
  last_delivery_at?: string | null;
  last_error?: string | null;
};

type DbSellerDigestRow = {
  id: string;
  profile_id?: string | null;
  email?: string | null;
  name: string | null;
  category: string | null;
  subcategory: string | null;
  state: string | null;
  min_budget: number | null;
  since_hours: number | null;
  is_active: boolean | null;
  delivery_enabled: boolean | null;
  last_sent_at: string | null;
  last_error?: string | null;
  created_at: string;
};

export const webhookEventOptions = [
  "request.created",
  "offer.created",
  "claim.accepted",
  "transaction.funded",
  "dispute.created",
] as const;

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

function getStateFromLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
}

function requestFallsWithinHours(request: WantedRequest, sinceHours: number) {
  // Seller digests need an exact cutoff. Using the raw timestamp avoids drift from
  // rounded UI labels such as "1 day ago", which are fine for display but too fuzzy
  // for automation and exports.
  const createdAtMs = new Date(request.createdAt).getTime();

  if (!Number.isFinite(createdAtMs)) {
    return true;
  }

  const hoursSinceCreated = (Date.now() - createdAtMs) / (1000 * 60 * 60);
  return hoursSinceCreated <= sinceHours;
}

function filterRequests(requests: WantedRequest[], filters: DigestFilters) {
  const sinceHours = filters.sinceHours && Number.isFinite(filters.sinceHours) ? Math.max(1, filters.sinceHours) : 24;

  return requests.filter((request) => {
    const categoryMatch = !filters.category || request.category === filters.category;
    const subcategoryMatch = !filters.subcategory || request.subcategory === filters.subcategory;
    const stateMatch = !filters.state || getStateFromLocation(request.location) === filters.state.toUpperCase();
    const budgetMatch = !filters.minBudget || request.targetBudget >= filters.minBudget;
    const relativeMatch = requestFallsWithinHours(request, sinceHours);

    return categoryMatch && subcategoryMatch && stateMatch && budgetMatch && relativeMatch;
  });
}

async function getOfferCountsByRequestId(requestIds: string[]) {
  const supabase = await createClient();
  const counts = new Map<string, number>();

  if (!supabase || requestIds.length === 0) {
    return counts;
  }

  const { data } = await supabase
    .from("offers")
    .select("request_id, status")
    .in("request_id", requestIds)
    .in("status", ["pending", "accepted", "countered"]);

  for (const row of (data ?? []) as Array<{ request_id: string }>) {
    counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1);
  }

  return counts;
}

function mapDigestItems(requests: WantedRequest[], offerCounts: Map<string, number>) {
  return requests.map((request) => ({
    requestId: request.id,
    slug: request.slug,
    title: request.title,
    category: request.category,
    subcategory: request.subcategory,
    location: request.location,
    targetBudget: request.targetBudget,
    budgetLabel: request.budgetLabel,
    shipping: request.shipping,
    status: request.status,
    postedLabel: request.postedLabel,
    offerCount: offerCounts.get(request.id) ?? 0,
  })) satisfies DailyRequestDigestItem[];
}

export async function getDailyRequestDigest(filters: DigestFilters = {}): Promise<DailyRequestDigest> {
  await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();

  return buildDailyRequestDigest(filters);
}

async function buildDailyRequestDigest(filters: DigestFilters = {}): Promise<DailyRequestDigest> {
  const allRequests = await getWantedRequests();
  const sinceHours = filters.sinceHours && Number.isFinite(filters.sinceHours) ? Math.max(1, filters.sinceHours) : 24;
  const matchingRequests = filterRequests(allRequests, filters);
  const offerCounts = await getOfferCountsByRequestId(matchingRequests.map((request) => request.id));
  const digestItems = mapDigestItems(matchingRequests, offerCounts);

  return {
    generatedAt: new Date().toISOString(),
    sinceHours,
    filters: {
      category: filters.category,
      subcategory: filters.subcategory,
      state: filters.state?.toUpperCase(),
    },
    totalNewRequests: digestItems.length,
    totalMatchingRequests: matchingRequests.length,
    totalOffersOnMatchingRequests: digestItems.reduce((sum, item) => sum + item.offerCount, 0),
    requests: digestItems,
  };
}

export async function getSellerOpportunityFeed(filters: DigestFilters = {}): Promise<SellerOpportunityFeed> {
  await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();

  const allRequests = await getWantedRequests();
  const matchingRequests = filterRequests(allRequests, filters);
  const offerCounts = await getOfferCountsByRequestId(matchingRequests.map((request) => request.id));
  const items = mapDigestItems(matchingRequests, offerCounts);
  const averageBudget = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.targetBudget, 0) / items.length) : 0;
  const categoryCounts = new Map<string, number>();

  for (const item of items) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }

  const hotCategories = Array.from(categoryCounts.entries())
    .map(([category, requestCount]) => ({ category, requestCount }))
    .sort((left, right) => right.requestCount - left.requestCount || left.category.localeCompare(right.category))
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      category: filters.category,
      subcategory: filters.subcategory,
      state: filters.state?.toUpperCase(),
      minBudget: filters.minBudget,
    },
    totalMatches: items.length,
    averageBudget,
    flexibleShippingCount: items.filter((item) => item.shipping === "Any").length,
    negotiatingCount: items.filter((item) => item.status === "negotiating").length,
    hotCategories,
    requests: items,
  };
}

function mapWebhookRow(row: DbWebhookRow): WebhookSubscription {
  return {
    id: row.id,
    endpointUrl: row.endpoint_url,
    eventTypes: row.event_types ?? [],
    isActive: row.is_active !== false,
    createdLabel: formatRelativeDate(row.created_at),
    lastDeliveryLabel: row.last_delivery_at ? formatRelativeDate(row.last_delivery_at) : undefined,
    lastError: row.last_error ?? undefined,
  };
}

export async function getWebhookSubscriptions() {
  const user = await requireCurrentUser("/dashboard");
  const supabase = await createClient();

  if (!supabase) {
    return [] as WebhookSubscription[];
  }

  const { data } = await supabase
    .from("webhook_subscriptions")
    .select("id, endpoint_url, event_types, is_active, created_at, last_delivery_at, last_error")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as DbWebhookRow[]).map(mapWebhookRow);
}

export async function createWebhookSubscription(input: { endpointUrl: string; eventTypes: string[] }) {
  const user = await requireCurrentUser("/dashboard");
  const profile = await getCurrentProfile();
  await requireMarketplaceAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  assertRateLimit({
    scope: "webhook-create",
    actorKey: user.id,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  const endpointUrl = requireHttpsUrl({
    value: input.endpointUrl.trim(),
    label: "Webhook URL",
  });

  const cleanEventTypes = Array.from(new Set(input.eventTypes)).filter((eventType): eventType is string =>
    webhookEventOptions.includes(eventType as (typeof webhookEventOptions)[number]),
  );

  if (cleanEventTypes.length === 0) {
    throw new Error("Choose at least one webhook event.");
  }

  const { error } = await supabase.from("webhook_subscriptions").insert({
    profile_id: user.id,
    endpoint_url: endpointUrl,
    event_types: cleanEventTypes,
    is_active: true,
    subscription_tier: profile?.planTier ?? "free",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateWebhookSubscription(input: {
  subscriptionId: string;
  endpointUrl?: string;
  eventTypes?: string[];
  isActive?: boolean;
}) {
  const user = await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  requireTrimmedText({
    value: input.subscriptionId,
    label: "Webhook subscription",
    maxLength: 120,
  });

  const patch: Record<string, unknown> = {};

  if (input.endpointUrl !== undefined) {
    patch.endpoint_url = requireHttpsUrl({
      value: input.endpointUrl.trim(),
      label: "Webhook URL",
    });
  }

  if (input.eventTypes !== undefined) {
    const cleanEventTypes = Array.from(new Set(input.eventTypes)).filter((eventType): eventType is string =>
      webhookEventOptions.includes(eventType as (typeof webhookEventOptions)[number]),
    );

    if (cleanEventTypes.length === 0) {
      throw new Error("Choose at least one webhook event.");
    }

    patch.event_types = cleanEventTypes;
  }

  if (input.isActive !== undefined) {
    patch.is_active = input.isActive;
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("webhook_subscriptions")
    .update(patch)
    .eq("id", input.subscriptionId)
    .eq("profile_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteWebhookSubscription(subscriptionId: string) {
  const user = await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  requireTrimmedText({
    value: subscriptionId,
    label: "Webhook subscription",
    maxLength: 120,
  });

  const { error } = await supabase
    .from("webhook_subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("profile_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

function buildSellerDigestLabel(row: DbSellerDigestRow) {
  const parts = [row.category, row.subcategory, row.state].filter(Boolean);

  if (row.min_budget) {
    parts.push(`$${row.min_budget}+`);
  }

  return parts.length > 0 ? parts.join(" / ") : "General seller digest";
}

function mapSellerDigestRow(row: DbSellerDigestRow): SellerDigestSubscription {
  return {
    id: row.id,
    name: row.name?.trim() || buildSellerDigestLabel(row),
    label: buildSellerDigestLabel(row),
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    state: row.state ?? undefined,
    minBudget: row.min_budget ?? undefined,
    sinceHours: row.since_hours ?? 24,
    isActive: row.is_active !== false,
    deliveryEnabled: row.delivery_enabled === true,
    lastDeliveredLabel: row.last_sent_at ? formatRelativeDate(row.last_sent_at) : undefined,
    createdLabel: formatRelativeDate(row.created_at),
  };
}

export async function getSellerDigestSubscriptions(profileId?: string) {
  // Dashboard pages that already verified the member can pass the id directly,
  // which avoids a second auth lookup and keeps tab changes from surfacing raw
  // auth errors if the browser is juggling stale navigation state.
  const user = profileId ? { id: profileId } : await requireCurrentUser("/dashboard");
  const supabase = await createClient();

  if (!supabase) {
    return [] as SellerDigestSubscription[];
  }

  const { data } = await supabase
    .from("seller_digest_subscriptions")
    .select("id, name, category, subcategory, state, min_budget, since_hours, is_active, delivery_enabled, last_sent_at, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as DbSellerDigestRow[]).map(mapSellerDigestRow);
}

export async function createSellerDigestSubscription(input: {
  name?: string;
  category?: string;
  subcategory?: string;
  state?: string;
  minBudget?: number;
  sinceHours: number;
  deliveryEnabled?: boolean;
}) {
  const user = await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  assertRateLimit({
    scope: "seller-digest-create",
    actorKey: user.id,
    limit: 10,
    windowMs: 60 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  const name = normalizeOptionalText({
    value: input.name,
    label: "Digest name",
    maxLength: 80,
  });
  const category = normalizeOptionalText({
    value: input.category,
    label: "Category",
    maxLength: 60,
  });
  const subcategory = normalizeOptionalText({
    value: input.subcategory,
    label: "Subcategory",
    maxLength: 60,
  });
  const state = normalizeOptionalText({
    value: input.state,
    label: "State",
    maxLength: 10,
  });
  const sinceHours = requireIntegerInRange({
    value: input.sinceHours,
    label: "Digest time window",
    min: 1,
    max: 168,
  });
  const minBudget =
    input.minBudget === undefined
      ? undefined
      : requireNumberInRange({
          value: input.minBudget,
          label: "Minimum budget",
          min: 1,
          max: 500_000,
        });

  // Digest creation is a primary user action, so we fail loudly here instead of
  // silently pretending the subscription was saved.
  const { error } = await supabase.from("seller_digest_subscriptions").insert({
    profile_id: user.id,
    name: name ?? null,
    category: category ?? null,
    subcategory: subcategory ?? null,
    state: state ?? null,
    min_budget: minBudget ?? null,
    since_hours: sinceHours,
    is_active: true,
    delivery_enabled: input.deliveryEnabled === true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateSellerDigestSubscription(input: {
  subscriptionId: string;
  isActive?: boolean;
  deliveryEnabled?: boolean;
}) {
  const user = await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  requireTrimmedText({
    value: input.subscriptionId,
    label: "Seller digest",
    maxLength: 120,
  });

  if (input.isActive === undefined && input.deliveryEnabled === undefined) {
    throw new Error("Choose at least one seller digest setting to update.");
  }

  const updatePatch: {
    is_active?: boolean;
    delivery_enabled?: boolean;
    updated_at: string;
  } = {
    // Delivery and active/paused are separate controls. Keeping this patch object
    // explicit prevents the "daily delivery" toggle from accidentally waking a
    // digest the seller intentionally left paused.
    updated_at: new Date().toISOString(),
  };

  if (input.isActive !== undefined) {
    updatePatch.is_active = input.isActive;
  }

  if (input.deliveryEnabled !== undefined) {
    updatePatch.delivery_enabled = input.deliveryEnabled;
  }

  const { error } = await supabase
    .from("seller_digest_subscriptions")
    .update(updatePatch)
    .eq("id", input.subscriptionId)
    .eq("profile_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteSellerDigestSubscription(subscriptionId: string) {
  const user = await requireCurrentUser("/dashboard");
  await requireMarketplaceAccess();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  requireTrimmedText({
    value: subscriptionId,
    label: "Seller digest",
    maxLength: 120,
  });

  const { error } = await supabase
    .from("seller_digest_subscriptions")
    .delete()
    .eq("id", subscriptionId)
    .eq("profile_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

function shouldSendSellerDigest(lastSentAt: string | null) {
  if (!lastSentAt) {
    return true;
  }

  const lastSentMs = new Date(lastSentAt).getTime();
  const hoursSinceSend = (Date.now() - lastSentMs) / (1000 * 60 * 60);
  return hoursSinceSend >= 20;
}

function buildSellerDigestEmail(input: {
  digestName: string;
  digest: DailyRequestDigest;
}) {
  const intro =
    input.digest.requests.length > 0
      ? `Your digest "${input.digestName}" found ${input.digest.requests.length} matching request${input.digest.requests.length === 1 ? "" : "s"} in the last ${input.digest.sinceHours} hours.`
      : `Your digest "${input.digestName}" did not find any matching requests in the last ${input.digest.sinceHours} hours.`;

  const lines = input.digest.requests.slice(0, 8).map((request) => {
    return `- ${request.title} | ${request.budgetLabel} | ${request.location} | ${request.offerCount} offer${request.offerCount === 1 ? "" : "s"}`;
  });

  return {
    subject: `${input.digestName} digest: ${input.digest.totalMatchingRequests} matching request${input.digest.totalMatchingRequests === 1 ? "" : "s"}`,
    body: [intro, ...(lines.length > 0 ? ["", ...lines] : []), "", "Open BuyerBoard to review the full opportunity list."].join(
      "\n",
    ),
    href: "/dashboard?tab=seller",
  };
}

async function updateSellerDigestDeliveryState(input: {
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
  subscriptionId: string;
  lastSentAt?: string | null;
  lastError?: string | null;
}) {
  const { error } = await input.supabase
    .from("seller_digest_subscriptions")
    .update({
      last_sent_at: input.lastSentAt ?? null,
      last_error: input.lastError ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.subscriptionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function processSellerDigestDeliveries(input?: {
  force?: boolean;
  profileId?: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  if (!hasEmailDeliveryEnv()) {
    logBuyerBoardEvent("warn", "digest_delivery_skipped", {
      reason: "email_delivery_not_configured",
      profileId: input?.profileId,
      force: input?.force === true,
    });
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: ["Email delivery is not configured yet."],
    };
  }

  const query = supabase
    .from("seller_digest_subscriptions")
    .select("id, profile_id, name, category, subcategory, state, min_budget, since_hours, is_active, delivery_enabled, last_sent_at, last_error, created_at, profiles(email)")
    .eq("is_active", true)
    .eq("delivery_enabled", true);

  if (input?.profileId) {
    query.eq("profile_id", input.profileId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<
    DbSellerDigestRow & {
      profiles?: {
        email?: string | null;
      } | null;
    }
  >;

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  logBuyerBoardEvent("info", "digest_delivery_started", {
    profileId: input?.profileId,
    force: input?.force === true,
    subscriptionCount: rows.length,
  });

  for (const row of rows) {
    processed += 1;

    if (!input?.force && !shouldSendSellerDigest(row.last_sent_at)) {
      skipped += 1;
      continue;
    }

    const email = row.profiles?.email?.trim();

    if (!email) {
      skipped += 1;
      try {
        await updateSellerDigestDeliveryState({
          supabase,
          subscriptionId: row.id,
          lastError: "No account email was found for this digest subscription.",
        });
      } catch (updateError) {
        const updateMessage =
          updateError instanceof Error ? updateError.message : "Unknown digest state update error.";
        errors.push(`Digest ${row.id}: ${updateMessage}`);
        logBuyerBoardEvent("error", "digest_state_update_failed", {
          subscriptionId: row.id,
          error: updateError,
        });
      }
      continue;
    }

    try {
      const digest = await buildDailyRequestDigest({
        category: row.category ?? undefined,
        subcategory: row.subcategory ?? undefined,
        state: row.state ?? undefined,
        sinceHours: row.since_hours ?? 24,
      });

      const emailPayload = buildSellerDigestEmail({
        digestName: row.name?.trim() || buildSellerDigestLabel(row),
        digest,
      });

      await sendBuyerBoardEmail({
        to: email,
        subject: emailPayload.subject,
        body: emailPayload.body,
        href: emailPayload.href,
      });

      sent += 1;
      // Delivery state is part of the cron audit trail. If it fails to persist,
      // we surface the problem loudly so the next run does not silently resend.
      await updateSellerDigestDeliveryState({
        supabase,
        subscriptionId: row.id,
        lastSentAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (deliveryError) {
      const message = deliveryError instanceof Error ? deliveryError.message : "Unknown digest delivery error.";
      errors.push(`Digest ${row.id}: ${message}`);

      try {
        await updateSellerDigestDeliveryState({
          supabase,
          subscriptionId: row.id,
          lastError: message,
        });
      } catch (updateError) {
        const updateMessage =
          updateError instanceof Error ? updateError.message : "Unknown digest state update error.";
        errors.push(`Digest ${row.id}: ${updateMessage}`);
        logBuyerBoardEvent("error", "digest_state_update_failed", {
          subscriptionId: row.id,
          error: updateError,
        });
      }
    }
  }

  logBuyerBoardEvent(errors.length > 0 ? "warn" : "info", "digest_delivery_finished", {
    profileId: input?.profileId,
    force: input?.force === true,
    processed,
    sent,
    skipped,
    errorCount: errors.length,
  });

  return {
    processed,
    sent,
    skipped,
    errors,
  };
}
