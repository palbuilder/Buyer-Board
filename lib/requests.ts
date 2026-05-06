import { sellerOffers as mockSellerOffers, wantedRequests, getOffersForRequest as getMockOffers, getRequestBySlug as getMockRequestBySlug } from "@/lib/mock-data";
import { ensureProfileForUser, getCurrentProfile, getCurrentUser, getRequestOrigin, requireMarketplaceAccess, requireVerifiedPhone } from "@/lib/auth";
import { derivePublicLocationLabel } from "@/lib/location";
import { parseMediaUrls } from "@/lib/media";
import { createNotification } from "@/lib/notifications";
import { logBuyerBoardEvent } from "@/lib/observability";
import {
  assertRateLimit,
  limitStringArrayLength,
  normalizeOptionalText,
  requireIntegerInRange,
  requireNumberInRange,
  requireTrimmedText,
} from "@/lib/runtime-guards";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createStripeServerClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ActiveClaim,
  AdminDispute,
  AdminListingReport,
  AdminTrustAppeal,
  AdminTrustMember,
  BuyerDashboardSummary,
  CompletedPurchase,
  DirectNegotiationContext,
  MarketplaceHighlights,
  MarketplaceTrendItem,
  MemberTrustAppeal,
  NegotiationOfferHistoryItem,
  PublicSellerProfile,
  SellerIssue,
  SellerOffer,
  SellerPerformance,
  SellerDashboardSummary,
  SellerReviewSnippet,
  SavedRequestFilter,
  TrustHistoryEntry,
  WantedRequest,
} from "@/lib/types";

type DbRequestRow = {
  id: string;
  buyer_id?: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  shipping_preference: string | null;
  location_label: string | null;
  target_price_cents: number;
  status: WantedRequest["status"];
  image_urls?: string[] | null;
  hold_expires_at?: string | null;
  fulfilled_offer_id?: string | null;
  last_active_confirmation_at?: string | null;
  stale_confirmation_requested_at?: string | null;
  stale_confirmation_miss_count?: number | null;
  created_at: string;
};

type DbOfferRow = {
  id: string;
  request_id: string;
  seller_id?: string;
  image_urls?: string[] | null;
  offer_price_cents: number;
  message: string;
  shipping_note: string | null;
  estimated_ship_time: string | null;
  status: SellerOffer["status"];
  created_at?: string;
};

type DbClaimEventRow = {
  id: string;
  request_id: string;
  seller_id: string;
  claimed_at?: string;
  expires_at: string;
  released_at: string | null;
};

type DbTransactionRow = {
  id: string;
  request_id: string;
  buyer_id: string;
  seller_id: string;
  final_price_cents: number;
  completed_at: string;
  payment_status?: string;
};

type DbReviewRow = {
  id: string;
  transaction_id: string;
  request_id: string;
  buyer_id: string;
  seller_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
};

type DbDisputeRow = {
  id: string;
  transaction_id: string;
  request_id: string;
  buyer_id: string;
  seller_id: string;
  reason: "wrong_item" | "defective_item" | "not_as_described" | "shipping_issue" | "other";
  details: string;
  buyer_evidence?: string | null;
  buyer_evidence_images?: string[] | null;
  status: "open" | "under_review" | "resolved_buyer" | "resolved_seller" | "closed";
  created_at: string;
  seller_response?: string | null;
  seller_evidence?: string | null;
  seller_evidence_images?: string[] | null;
};

type DbListingReportRow = {
  id: string;
  request_id: string;
  reporter_id: string;
  offer_id?: string | null;
  report_target?: "request" | "offer" | null;
  reason: "tos_violation" | "illegal_item" | "unsafe_item" | "harassment" | "spam" | "other";
  details: string;
  image_urls?: string[] | null;
  status: "open" | "reviewed" | "removed" | "dismissed";
  created_at: string;
  admin_note?: string | null;
};

type DbTrustAppealRow = {
  id: string;
  profile_id: string;
  status: "open" | "approved" | "rejected";
  member_message: string;
  admin_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

type DbSavedRequestFilterRow = {
  id: string;
  profile_id: string;
  name: string;
  search_query?: string | null;
  category?: string | null;
  subcategory?: string | null;
  shipping?: string | null;
  status?: string | null;
  sort_order?: string | null;
  alert_enabled?: boolean | null;
};

type CreateRequestInput = {
  title: string;
  category: string;
  subcategory: string;
  targetBudget: number;
  conditionPreference: string;
  shippingPreference: string;
  description: string;
  vehicleFitment?: string;
  imageUrls: string[];
};

type SellerResponseInput = {
  requestId: string;
  offeredPrice: number;
  message: string;
  proposedClaimWindowHours: number;
  imageUrls: string[];
};

type ClaimOfferDecision = "accepted" | "declined" | "countered";

const requestWriteLimits = {
  requestTitle: 120,
  requestDescription: 4_000,
  requestLocation: 120,
  requestCategory: 60,
  requestSubcategory: 60,
  vehicleFitment: 140,
  offerMessage: 2_000,
  buyerComment: 1_200,
  reportDetails: 2_500,
  disputeDetails: 4_000,
  evidenceNotes: 2_500,
  reviewText: 1_500,
  adminNote: 1_500,
  maxImages: 6,
} as const;

const mappedRequestSelectFields =
  "id, buyer_id, slug, title, category, description, shipping_preference, location_label, target_price_cents, status, image_urls, hold_expires_at, fulfilled_offer_id, last_active_confirmation_at, stale_confirmation_requested_at, stale_confirmation_miss_count, created_at";
const staleRequestIntervalMs = 14 * 24 * 60 * 60 * 1000;

export function isDemoMode() {
  return !hasSupabaseEnv();
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
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

function formatClaimTimer(expiresAtInput: string) {
  const expiresAt = new Date(expiresAtInput);
  const diffMs = expiresAt.getTime() - Date.now();

  if (diffMs <= 0) {
    return {
      timerLabel: "Claim window expired",
      timerState: "expired" as const,
    };
  }

  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return {
      timerLabel: `${days}d ${hours}h left in claim window`,
      timerState: "active" as const,
    };
  }

  if (hours > 0) {
    return {
      timerLabel: `${hours}h ${minutes}m left in claim window`,
      timerState: "active" as const,
    };
  }

  return {
    timerLabel: `${minutes}m left in claim window`,
    timerState: "active" as const,
  };
}

function formatDisputeReason(reason: DbDisputeRow["reason"]) {
  const labels: Record<DbDisputeRow["reason"], string> = {
    wrong_item: "Wrong item received",
    defective_item: "Item arrived defective",
    not_as_described: "Item not as described",
    shipping_issue: "Shipping issue",
    other: "Other issue",
  };

  return labels[reason];
}

function formatDisputeStatus(status: DbDisputeRow["status"]) {
  const labels: Record<DbDisputeRow["status"], string> = {
    open: "Open dispute",
    under_review: "Under review",
    resolved_buyer: "Resolved for buyer",
    resolved_seller: "Resolved for seller",
    closed: "Closed",
  };

  return labels[status];
}

function formatListingReportReason(reason: DbListingReportRow["reason"]) {
  const labels: Record<DbListingReportRow["reason"], string> = {
    tos_violation: "Terms of Service violation",
    illegal_item: "Illegal item",
    unsafe_item: "Unsafe item",
    harassment: "Harassment or abusive content",
    spam: "Spam or scam listing",
    other: "Other issue",
  };

  return labels[reason];
}

function formatListingReportStatus(status: DbListingReportRow["status"]) {
  const labels: Record<DbListingReportRow["status"], string> = {
    open: "Open report",
    reviewed: "Reviewed",
    removed: "Listing removed",
    dismissed: "Dismissed",
  };

  return labels[status];
}

function formatRatingLabel(rating: number) {
  return `${rating.toFixed(1)} / 5`;
}

function buildSummary(description: string) {
  const trimmed = description.trim();
  if (trimmed.length <= 110) {
    return trimmed;
  }

  return `${trimmed.slice(0, 107).trimEnd()}...`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function normalizeMarketplaceLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function buildTrendItems(input: {
  requests: Array<Pick<WantedRequest, "title" | "category" | "subcategory">>;
  offersByRequestId?: Map<string, number>;
  requestIdsByLabel?: Map<string, string[]>;
}) {
  const grouped = new Map<string, MarketplaceTrendItem>();

  for (const request of input.requests) {
    const normalizedLabel = normalizeMarketplaceLabel(request.title);

    if (!normalizedLabel) {
      continue;
    }

    const requestIds = input.requestIdsByLabel?.get(normalizedLabel) ?? [];
    const offerCount = requestIds.reduce((sum, requestId) => sum + (input.offersByRequestId?.get(requestId) ?? 0), 0);
    const existing = grouped.get(normalizedLabel);

    if (existing) {
      existing.requestCount += 1;
      existing.offerCount = offerCount;
      continue;
    }

    grouped.set(normalizedLabel, {
      label: toTitleCase(normalizedLabel),
      category: request.category,
      subcategory: request.subcategory,
      requestCount: 1,
      offerCount,
    });
  }

  return Array.from(grouped.values());
}

function sortTrendItems(items: MarketplaceTrendItem[], mode: "requests" | "offers") {
  return [...items].sort((left, right) => {
    if (mode === "requests" && right.requestCount !== left.requestCount) {
      return right.requestCount - left.requestCount;
    }

    if (mode === "offers" && right.offerCount !== left.offerCount) {
      return right.offerCount - left.offerCount;
    }

    if (right.requestCount !== left.requestCount) {
      return right.requestCount - left.requestCount;
    }

    return left.label.localeCompare(right.label);
  });
}

function requestMatchesSavedFilter(input: {
  request: {
    title: string;
    category: string;
    subcategory: string;
    shipping: string;
    status: string;
    location: string;
    details: string;
  };
  filter: {
    search_query?: string | null;
    category?: string | null;
    subcategory?: string | null;
    shipping?: string | null;
    status?: string | null;
  };
}) {
  const searchQuery = input.filter.search_query?.trim().toLowerCase() ?? "";
  const haystack = [
    input.request.title,
    input.request.category,
    input.request.subcategory,
    input.request.location,
    input.request.details,
  ]
    .join(" ")
    .toLowerCase();

  const textMatch = !searchQuery || haystack.includes(searchQuery);
  const categoryMatch = !input.filter.category || input.request.category === input.filter.category;
  const subcategoryMatch = !input.filter.subcategory || input.request.subcategory === input.filter.subcategory;
  const shippingMatch = !input.filter.shipping || input.request.shipping === input.filter.shipping;
  const statusMatch = !input.filter.status || input.request.status === input.filter.status;

  return textMatch && categoryMatch && subcategoryMatch && shippingMatch && statusMatch;
}

function extractDescriptionMeta(rawDescription: string) {
  const lines = rawDescription
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let subcategory = "Other";
  let vehicleFitment: string | undefined;
  const descriptionLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("Subcategory:")) {
      subcategory = line.replace("Subcategory:", "").trim() || "Other";
      continue;
    }

    if (line.startsWith("Vehicle fitment:")) {
      vehicleFitment = line.replace("Vehicle fitment:", "").trim();
      continue;
    }

    descriptionLines.push(line);
  }

  return {
    subcategory,
    vehicleFitment,
    description: descriptionLines.join("\n\n"),
  };
}

function buildRequestTags(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values) {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      continue;
    }

    const dedupeKey = normalizedValue.toLowerCase();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    tags.push(normalizedValue);
  }

  return tags;
}

function buildRequestFreshnessState(row: DbRequestRow) {
  const needsFreshnessConfirmation = Boolean(row.stale_confirmation_requested_at) && (row.status === "open" || row.status === "negotiating");
  const missedFreshnessChecks = row.stale_confirmation_miss_count ?? 0;

  if (!needsFreshnessConfirmation) {
    return {
      needsFreshnessConfirmation: false,
      freshnessConfirmationLabel: undefined,
      missedFreshnessChecks,
    };
  }

  return {
    needsFreshnessConfirmation: true,
    freshnessConfirmationLabel:
      missedFreshnessChecks > 0
        ? "Please confirm this request again before BuyerBoard archives it."
        : "Please confirm that this request should stay live.",
    missedFreshnessChecks,
  };
}

async function requireAuthenticatedActor() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Sign in required.");
  }

  await ensureProfileForUser(user);
  return user;
}

async function requireAdminActionReviewer() {
  await requireAuthenticatedActor();
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    // Report/dispute resolution is too sensitive to trust the page layer alone.
    // The library guard keeps future callers from bypassing admin-only rules.
    throw new Error("Admin access is required.");
  }

  return profile;
}

function normalizeRequestCreateInput(input: CreateRequestInput) {
  return {
    title: requireTrimmedText({
      value: input.title,
      label: "Request title",
      maxLength: requestWriteLimits.requestTitle,
    }),
    category: requireTrimmedText({
      value: input.category,
      label: "Category",
      maxLength: requestWriteLimits.requestCategory,
    }),
    subcategory:
      normalizeOptionalText({
        value: input.subcategory,
        label: "Subcategory",
        maxLength: requestWriteLimits.requestSubcategory,
      }) ?? "Other",
    conditionPreference:
      normalizeOptionalText({
        value: input.conditionPreference,
        label: "Condition preference",
        maxLength: 80,
      }) ?? "",
    shippingPreference: requireTrimmedText({
      value: input.shippingPreference,
      label: "Shipping preference",
      maxLength: 80,
    }),
    description: requireTrimmedText({
      value: input.description,
      label: "Description",
      maxLength: requestWriteLimits.requestDescription,
    }),
    vehicleFitment: normalizeOptionalText({
      value: input.vehicleFitment,
      label: "Vehicle fitment",
      maxLength: requestWriteLimits.vehicleFitment,
    }),
    imageUrls: limitStringArrayLength({
      values: input.imageUrls,
      maxItems: requestWriteLimits.maxImages,
      label: "Request photos",
    }),
    targetBudget: requireNumberInRange({
      value: input.targetBudget,
      label: "Target price",
      min: 1,
      max: 500_000,
    }),
  };
}

function normalizeSellerResponseInput(input: SellerResponseInput) {
  return {
    requestId: requireTrimmedText({
      value: input.requestId,
      label: "Request information",
      maxLength: 120,
    }),
    offeredPrice: requireNumberInRange({
      value: input.offeredPrice,
      label: "Offer price",
      min: 1,
      max: 500_000,
    }),
    message: requireTrimmedText({
      value: input.message,
      label: "Offer message",
      maxLength: requestWriteLimits.offerMessage,
    }),
    proposedClaimWindowHours: requireIntegerInRange({
      value: input.proposedClaimWindowHours,
      label: "Claim window hours",
      min: 1,
      max: 168,
    }),
    imageUrls: limitStringArrayLength({
      values: input.imageUrls,
      maxItems: requestWriteLimits.maxImages,
      label: "Offer photos",
    }),
  };
}

function mapRequest(row: DbRequestRow): WantedRequest {
  const meta = extractDescriptionMeta(row.description);
  const detailText = meta.vehicleFitment
    ? `Vehicle fitment: ${meta.vehicleFitment}. ${meta.description}`
    : meta.description;
  const freshnessState = buildRequestFreshnessState(row);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    subcategory: meta.subcategory,
    imageUrls: parseMediaUrls(row.image_urls),
    targetBudget: row.target_price_cents / 100,
    budgetLabel: `${formatCurrencyFromCents(row.target_price_cents)} target`,
    status: row.status,
    location: row.location_label ?? "Location pending",
    shipping: row.shipping_preference ?? "Shipping details pending",
    summary: buildSummary(detailText),
    details: detailText,
    tags: buildRequestTags([row.category, meta.subcategory, row.status]),
    buyerName: "Buyer",
    needsFreshnessConfirmation: freshnessState.needsFreshnessConfirmation,
    freshnessConfirmationLabel: freshnessState.freshnessConfirmationLabel,
    missedFreshnessChecks: freshnessState.missedFreshnessChecks,
    // Keep the raw timestamp on the shared request model so digest/export logic can make
    // exact time-window decisions instead of reverse-parsing rounded labels like "2 days ago".
    createdAt: row.created_at,
    postedLabel: formatRelativeDate(row.created_at),
  };
}

function mapOffer(row: DbOfferRow, request?: { slug?: string; title?: string }): SellerOffer {
  const proposedHours = Number.parseInt(row.shipping_note?.replace(/[^0-9]/g, "") || "48", 10) || 48;
  const sellerName = row.estimated_ship_time?.startsWith("Seller:")
    ? row.estimated_ship_time.replace("Seller:", "").trim()
    : "Seller";

  return {
    id: row.id,
    requestId: row.request_id,
    requestSlug: request?.slug,
    requestTitle: request?.title,
    sellerId: row.seller_id,
    sellerName,
    imageUrls: parseMediaUrls(row.image_urls),
    sellerRating: 5,
    sellerReviewCount: 0,
    shippedWithinWindowRate: 0,
    offeredPrice: row.offer_price_cents / 100,
    offeredPriceLabel: formatCurrencyFromCents(row.offer_price_cents),
    message: row.message,
    etaLabel: "Message sent and offer pending buyer review",
    proposedClaimWindowHours: proposedHours,
    claimLabel: `Proposed claim window: ${proposedHours} hours, pending buyer approval`,
    status: row.status,
  };
}

function formatOfferStatusLabel(status: SellerOffer["status"]) {
  const labels: Record<SellerOffer["status"], string> = {
    pending: "Awaiting buyer review",
    accepted: "Accepted by buyer",
    declined: "Denied by buyer",
    countered: "Countered by buyer",
  };

  return labels[status];
}

async function getSellerSnapshots(sellerIds: string[]) {
  const supabase = await createClient();

  if (!supabase || sellerIds.length === 0) {
    return new Map<string, { sellerRating: number; sellerReviewCount: number; shippedWithinWindowRate: number }>();
  }

  const [{ data: transactionRows }, { data: reviewRows }, { data: claimRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, request_id, seller_id, completed_at")
      .in("seller_id", sellerIds),
    supabase
      .from("reviews")
      .select("id, transaction_id, request_id, buyer_id, seller_id, rating, review_text, created_at")
      .in("seller_id", sellerIds),
    supabase
      .from("claim_events")
      .select("id, request_id, seller_id, claimed_at, expires_at, released_at")
      .in("seller_id", sellerIds),
  ]);

  const reviewsBySeller = new Map<string, DbReviewRow[]>();
  for (const review of (reviewRows ?? []) as DbReviewRow[]) {
    const current = reviewsBySeller.get(review.seller_id) ?? [];
    current.push(review);
    reviewsBySeller.set(review.seller_id, current);
  }

  const claimsBySellerRequest = new Map<string, { expires_at: string }>();
  for (const claim of (claimRows ?? []) as Array<{ request_id: string; seller_id: string; expires_at: string }>) {
    claimsBySellerRequest.set(`${claim.seller_id}:${claim.request_id}`, claim);
  }

  const transactionStatsBySeller = new Map<string, { completed: number; onTime: number }>();
  for (const transaction of (transactionRows ?? []) as Array<{ seller_id: string; request_id: string; completed_at: string }>) {
    const current = transactionStatsBySeller.get(transaction.seller_id) ?? { completed: 0, onTime: 0 };
    current.completed += 1;
    const claim = claimsBySellerRequest.get(`${transaction.seller_id}:${transaction.request_id}`);
    if (claim && new Date(transaction.completed_at).getTime() <= new Date(claim.expires_at).getTime()) {
      current.onTime += 1;
    }
    transactionStatsBySeller.set(transaction.seller_id, current);
  }

  const snapshots = new Map<string, { sellerRating: number; sellerReviewCount: number; shippedWithinWindowRate: number }>();

  for (const sellerId of sellerIds) {
    const sellerReviews = reviewsBySeller.get(sellerId) ?? [];
    const reviewCount = sellerReviews.length;
    const sellerRating =
      reviewCount > 0
        ? Number((sellerReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
        : 5;
    const shippingStats = transactionStatsBySeller.get(sellerId) ?? { completed: 0, onTime: 0 };
    const shippedWithinWindowRate =
      shippingStats.completed > 0 ? Math.round((shippingStats.onTime / shippingStats.completed) * 100) : 0;

    snapshots.set(sellerId, {
      sellerRating,
      sellerReviewCount: reviewCount,
      shippedWithinWindowRate,
    });
  }

  return snapshots;
}

function mapActiveClaim(input: {
  claim: DbClaimEventRow;
  request: DbRequestRow;
  offer?: DbOfferRow;
  paymentStatus?: ActiveClaim["paymentStatus"];
}): ActiveClaim {
  const timer = formatClaimTimer(input.claim.expires_at);
  const sellerName = input.offer?.estimated_ship_time?.startsWith("Seller:")
    ? input.offer.estimated_ship_time.replace("Seller:", "").trim()
    : "Seller";
  const approvedOfferCents = input.offer?.offer_price_cents ?? 0;
  const approvedOfferLabel = input.offer ? formatCurrencyFromCents(approvedOfferCents) : "Approved offer";
  const paymentStatus = input.paymentStatus ?? "awaiting_payment";
  const paymentLabel =
    paymentStatus === "funded"
      ? "Buyer payment secured"
      : paymentStatus === "on_hold"
        ? "Payment on hold for review"
        : paymentStatus === "released"
          ? "Funds released"
          : paymentStatus === "refunded"
            ? "Buyer refunded"
            : paymentStatus === "completed"
              ? "Transaction completed"
              : "Buyer funding still needed";

  return {
    claimId: input.claim.id,
    requestId: input.request.id,
    requestSlug: input.request.slug,
    requestTitle: input.request.title,
    sellerId: input.claim.seller_id,
    sellerName,
    approvedOfferId: input.request.fulfilled_offer_id ?? input.offer?.id ?? input.claim.id,
    approvedOfferLabel,
    approvedOfferCents,
    expiresAt: input.claim.expires_at,
    timerLabel: timer.timerLabel,
    timerState: timer.timerState,
    paymentStatus,
    paymentLabel,
  };
}

export async function getWantedRequests(): Promise<WantedRequest[]> {
  const supabase = await createClient();

  if (!supabase) {
    return wantedRequests;
  }

  const { data, error } = await supabase
    .from("requests")
    .select(mappedRequestSelectFields)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return wantedRequests;
  }

  return data.map(mapRequest);
}

export async function getMarketplaceHighlights(): Promise<MarketplaceHighlights> {
  const supabase = await createClient();

  if (!supabase) {
    const activeRequests = wantedRequests.filter((request) => request.status !== "closed" && request.status !== "fulfilled");
    const newestRequests = activeRequests.slice(0, 3);
    const offersByRequestId = new Map<string, number>();

    for (const offer of mockSellerOffers) {
      offersByRequestId.set(offer.requestId, (offersByRequestId.get(offer.requestId) ?? 0) + 1);
    }

    const requestIdsByLabel = new Map<string, string[]>();
    for (const request of activeRequests) {
      const key = normalizeMarketplaceLabel(request.title);
      requestIdsByLabel.set(key, [...(requestIdsByLabel.get(key) ?? []), request.id]);
    }

    const trendItems = buildTrendItems({
      requests: activeRequests,
      offersByRequestId,
      requestIdsByLabel,
    });

    return {
      newestRequests,
      topRequestedItems: sortTrendItems(trendItems, "requests").slice(0, 5),
      topOfferMagnetItems: sortTrendItems(trendItems, "offers").filter((item) => item.offerCount > 0).slice(0, 5),
      openRequestCount: activeRequests.filter((request) => request.status === "open" || request.status === "negotiating").length,
      activeOfferCount: mockSellerOffers.length,
    };
  }

  const [{ data: requestRows, error: requestError }, { data: offerRows, error: offerError }] = await Promise.all([
    supabase
      .from("requests")
      .select(mappedRequestSelectFields)
      .order("created_at", { ascending: false }),
    supabase
      .from("offers")
      .select("id, request_id, status")
      .in("status", ["pending", "accepted", "countered"]),
  ]);

  if (requestError || !requestRows || offerError || !offerRows) {
    return getMarketplaceHighlightsFromFallback();
  }

  const mappedRequests = requestRows.map(mapRequest);
  const activeRequests = mappedRequests.filter((request) => request.status !== "closed" && request.status !== "fulfilled");
  const newestRequests = activeRequests.slice(0, 3);
  const offersByRequestId = new Map<string, number>();

  for (const offer of offerRows as Array<{ request_id: string }>) {
    offersByRequestId.set(offer.request_id, (offersByRequestId.get(offer.request_id) ?? 0) + 1);
  }

  const requestIdsByLabel = new Map<string, string[]>();
  for (const request of activeRequests) {
    const key = normalizeMarketplaceLabel(request.title);
    requestIdsByLabel.set(key, [...(requestIdsByLabel.get(key) ?? []), request.id]);
  }

  const trendItems = buildTrendItems({
    requests: activeRequests,
    offersByRequestId,
    requestIdsByLabel,
  });

  return {
    newestRequests,
    topRequestedItems: sortTrendItems(trendItems, "requests").slice(0, 5),
    topOfferMagnetItems: sortTrendItems(trendItems, "offers").filter((item) => item.offerCount > 0).slice(0, 5),
    openRequestCount: activeRequests.filter((request) => request.status === "open" || request.status === "negotiating").length,
    activeOfferCount: offerRows.length,
  };
}

function getMarketplaceHighlightsFromFallback(): MarketplaceHighlights {
  const activeRequests = wantedRequests.filter((request) => request.status !== "closed" && request.status !== "fulfilled");
  const offersByRequestId = new Map<string, number>();

  for (const offer of mockSellerOffers) {
    offersByRequestId.set(offer.requestId, (offersByRequestId.get(offer.requestId) ?? 0) + 1);
  }

  const requestIdsByLabel = new Map<string, string[]>();
  for (const request of activeRequests) {
    const key = normalizeMarketplaceLabel(request.title);
    requestIdsByLabel.set(key, [...(requestIdsByLabel.get(key) ?? []), request.id]);
  }

  const trendItems = buildTrendItems({
    requests: activeRequests,
    offersByRequestId,
    requestIdsByLabel,
  });

  return {
    newestRequests: activeRequests.slice(0, 3),
    topRequestedItems: sortTrendItems(trendItems, "requests").slice(0, 5),
    topOfferMagnetItems: sortTrendItems(trendItems, "offers").filter((item) => item.offerCount > 0).slice(0, 5),
    openRequestCount: activeRequests.filter((request) => request.status === "open" || request.status === "negotiating").length,
    activeOfferCount: mockSellerOffers.length,
  };
}

export async function getWantedRequestBySlug(slug: string): Promise<WantedRequest | undefined> {
  const supabase = await createClient();

  if (!supabase) {
    return getMockRequestBySlug(slug);
  }

  const { data, error } = await supabase
    .from("requests")
    .select(mappedRequestSelectFields)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return getMockRequestBySlug(slug);
  }

  return mapRequest(data);
}

export async function getWantedRequestById(requestId: string): Promise<WantedRequest | undefined> {
  const supabase = await createClient();

  if (!supabase) {
    return wantedRequests.find((request) => request.id === requestId);
  }

  const { data, error } = await supabase
    .from("requests")
    .select(mappedRequestSelectFields)
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return mapRequest(data);
}

export async function getSellerOffersForRequest(requestId: string): Promise<SellerOffer[]> {
  const supabase = await createClient();

  if (!supabase) {
    return getMockOffers(requestId);
  }

  const { data, error } = await supabase
    .from("offers")
    .select("id, request_id, seller_id, image_urls, offer_price_cents, message, shipping_note, estimated_ship_time, status, created_at")
    .eq("request_id", requestId)
    .in("status", ["pending", "accepted", "declined", "countered"])
    .order("created_at", { ascending: false });

  if (error || !data) {
    return getMockOffers(requestId);
  }

  const mappedOffers = data.map((offer) => mapOffer(offer));
  const sellerIds = [...new Set(mappedOffers.map((offer) => offer.sellerId).filter((sellerId): sellerId is string => Boolean(sellerId)))];
  const snapshots = await getSellerSnapshots(sellerIds);

  return mappedOffers.map((offer) => {
    const snapshot = offer.sellerId ? snapshots.get(offer.sellerId) : undefined;

    return snapshot
      ? {
          ...offer,
          sellerRating: snapshot.sellerRating,
          sellerReviewCount: snapshot.sellerReviewCount,
          shippedWithinWindowRate: snapshot.shippedWithinWindowRate,
        }
      : offer;
  });
}

export async function getNegotiationContextForMembers(memberAId: string, memberBId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return undefined as DirectNegotiationContext | undefined;
  }

  const [{ data: requestRows }, { data: offerRows }] = await Promise.all([
    supabase
      .from("requests")
      .select("id, slug, title, buyer_id, shipping_preference, location_label, status, created_at")
      .in("buyer_id", [memberAId, memberBId]),
    supabase
      .from("offers")
      .select("id, request_id, seller_id, offer_price_cents, shipping_note, status, created_at")
      .in("seller_id", [memberAId, memberBId])
      .order("created_at", { ascending: false }),
  ]);

  const requests = (requestRows ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    buyer_id: string;
    shipping_preference: string | null;
    location_label: string | null;
    status: WantedRequest["status"];
    created_at: string;
  }>;
  const offers = (offerRows ?? []) as DbOfferRow[];
  const requestsById = new Map(requests.map((request) => [request.id, request]));

  const sharedOffers = offers.filter((offer) => {
    if (!offer.seller_id) {
      return false;
    }

    const request = requestsById.get(offer.request_id);

    if (!request) {
      return false;
    }

    const buyerSellerMatch =
      (request.buyer_id === memberAId && offer.seller_id === memberBId) ||
      (request.buyer_id === memberBId && offer.seller_id === memberAId);

    return buyerSellerMatch;
  });

  const latestOffer = sharedOffers[0];

  if (!latestOffer) {
    return undefined;
  }

  const latestRequest = requestsById.get(latestOffer.request_id);

  if (!latestRequest || !latestOffer.seller_id) {
    return undefined;
  }

  const history = sharedOffers
    .filter((offer) => offer.request_id === latestRequest.id && offer.seller_id === latestOffer.seller_id)
    .slice(0, 5)
    .map((offer) => {
      const proposedHours = Number.parseInt(offer.shipping_note?.replace(/[^0-9]/g, "") || "48", 10) || 48;

      return {
        id: offer.id,
        offeredPriceLabel: formatCurrencyFromCents(offer.offer_price_cents),
        claimWindowLabel: `${proposedHours} hours`,
        statusLabel: formatOfferStatusLabel(offer.status),
        createdLabel: offer.created_at ? formatRelativeDate(offer.created_at) : "Recently",
      } satisfies NegotiationOfferHistoryItem;
    });

  const latestHours = Number.parseInt(latestOffer.shipping_note?.replace(/[^0-9]/g, "") || "48", 10) || 48;

  return {
    requestId: latestRequest.id,
    requestSlug: latestRequest.slug,
    requestTitle: latestRequest.title,
    buyerId: latestRequest.buyer_id,
    sellerId: latestOffer.seller_id,
    latestOfferStatus: latestOffer.status,
    latestOfferPriceLabel: formatCurrencyFromCents(latestOffer.offer_price_cents),
    latestClaimWindowLabel: `${latestHours} hours`,
    latestOfferStatusLabel: formatOfferStatusLabel(latestOffer.status),
    shippingLabel: latestRequest.shipping_preference ?? "Shipping details pending",
    locationLabel: latestRequest.location_label ?? "Location pending",
    history,
  } satisfies DirectNegotiationContext;
}

export async function getBuyerDashboardData(actorId?: string) {
  // Server pages that already required auth can pass the actor id directly and
  // skip a second auth guard. That keeps dashboard tab switches user-friendly
  // while preserving the stricter fallback for other callers.
  const user = actorId ? { id: actorId } : await requireAuthenticatedActor();
  const supabase = await createClient();

  if (!supabase) {
    return {
      requests: wantedRequests.slice(0, 6),
      offersByRequest: wantedRequests.slice(0, 6).map((request) => ({
        request,
        offers: getMockOffers(request.id),
      })),
      activeClaims: [],
      completedPurchases: [],
    };
  }

  const { data, error } = await supabase
    .from("requests")
    .select(mappedRequestSelectFields)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const buyerRequests = error || !data ? [] : data.map(mapRequest);
  const offers = await Promise.all(buyerRequests.map((request) => getSellerOffersForRequest(request.id)));

  const [activeClaims, completedPurchases] = await Promise.all([
    getActiveClaimsForBuyer(buyerRequests),
    getBuyerCompletedPurchases(user.id),
  ]);

  return {
    requests: buyerRequests,
    offersByRequest: buyerRequests.map((request, index) => ({
      request,
      offers: offers[index] ?? [],
    })),
    activeClaims,
    completedPurchases,
  };
}

export async function getBuyerDashboardSummary(actorId?: string): Promise<BuyerDashboardSummary> {
  const dashboard = await getBuyerDashboardData(actorId);

  return {
    requestCount: dashboard.requests.length,
    pendingOfferCount: dashboard.offersByRequest.reduce(
      (sum, group) => sum + group.offers.filter((offer) => offer.status === "pending" || offer.status === "countered").length,
      0,
    ),
    activeClaimCount: dashboard.activeClaims.length,
    completedPurchaseCount: dashboard.completedPurchases.length,
  };
}

export async function getSellerDashboardData(actorId?: string) {
  // See the buyer variant above. Reusing the verified actor id avoids showing a
  // low-level auth error when the dashboard is simply switching tabs.
  const user = actorId ? { id: actorId } : await requireAuthenticatedActor();
  const supabase = await createClient();

  if (!supabase) {
    return {
      sentOffers: sellerOffersFromMock(),
      activeClaims: [],
      performance: getMockSellerPerformance(),
      recentReviews: getMockSellerReviews(),
      openIssues: [],
    };
  }

  const { data, error } = await supabase
    .from("offers")
    .select("id, request_id, seller_id, image_urls, offer_price_cents, message, shipping_note, estimated_ship_time, status")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return {
      sentOffers: sellerOffersFromMock(),
      activeClaims: [],
      performance: getMockSellerPerformance(),
      recentReviews: getMockSellerReviews(),
      openIssues: [],
    };
  }

  const requestIds = [...new Set(data.map((offer) => offer.request_id))];
  const [{ data: requestRows }, activeClaims, performance, recentReviews] = await Promise.all([
    requestIds.length > 0
      ? supabase.from("requests").select("id, slug, title").in("id", requestIds)
      : Promise.resolve({ data: [] }),
    getActiveClaimsForSeller(user.id),
    getSellerPerformance(user.id),
    getSellerRecentReviews(user.id),
  ]);
  const openIssues = await getSellerIssues(user.id);
  const requestsById = new Map((requestRows ?? []).map((request) => [request.id, request]));

  return {
    sentOffers: data.map((offer) => mapOffer(offer, requestsById.get(offer.request_id))),
    activeClaims,
    performance,
    recentReviews,
    openIssues,
  };
}

export async function getSellerDashboardSummary(actorId?: string): Promise<SellerDashboardSummary> {
  const dashboard = await getSellerDashboardData(actorId);

  return {
    sentOfferCount: dashboard.sentOffers.length,
    pendingOfferCount: dashboard.sentOffers.filter((offer) => offer.status === "pending" || offer.status === "countered").length,
    activeClaimCount: dashboard.activeClaims.length,
    openIssueCount: dashboard.openIssues.length,
    sellerRating: dashboard.performance.sellerRating,
    fulfillmentRate: dashboard.performance.shippedWithinWindowRate,
  };
}

export async function getAdminDisputes() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as AdminDispute[];
  }

  const [{ data: disputeRows }, { data: requestRows }, { data: transactionRows }] = await Promise.all([
    supabase
      .from("disputes")
      .select("id, transaction_id, request_id, buyer_id, seller_id, reason, details, buyer_evidence, buyer_evidence_images, status, created_at, seller_response, seller_evidence, seller_evidence_images")
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select(mappedRequestSelectFields),
    supabase
      .from("transactions")
      .select("id, request_id, buyer_id, seller_id, final_price_cents, completed_at, payment_status"),
  ]);

  const disputes = (disputeRows ?? []) as DbDisputeRow[];
  const requestsById = new Map(((requestRows ?? []) as DbRequestRow[]).map((row) => [row.id, row]));
  const transactionsById = new Map(((transactionRows ?? []) as DbTransactionRow[]).map((row) => [row.id, row]));

  return disputes
    .map((dispute) => {
      const request = requestsById.get(dispute.request_id);
      const transaction = transactionsById.get(dispute.transaction_id);

      if (!request || !transaction) {
        return undefined;
      }

      return {
        disputeId: dispute.id,
        transactionId: dispute.transaction_id,
        requestId: dispute.request_id,
        requestSlug: request.slug,
        requestTitle: request.title,
        buyerId: dispute.buyer_id,
        sellerId: dispute.seller_id,
        reasonLabel: formatDisputeReason(dispute.reason),
        details: dispute.details,
        buyerEvidence: dispute.buyer_evidence ?? undefined,
        buyerEvidenceImageUrls: parseMediaUrls(dispute.buyer_evidence_images),
        sellerResponse: dispute.seller_response ?? undefined,
        sellerEvidence: dispute.seller_evidence ?? undefined,
        sellerEvidenceImageUrls: parseMediaUrls(dispute.seller_evidence_images),
        statusLabel: formatDisputeStatus(dispute.status),
        createdLabel: formatRelativeDate(dispute.created_at),
        paymentStatus: transaction.payment_status ?? "completed",
      } satisfies AdminDispute;
    })
    .filter((dispute): dispute is AdminDispute => Boolean(dispute));
}

export async function getAdminListingReports() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as AdminListingReport[];
  }

  const [{ data: reportRows }, { data: requestRows }] = await Promise.all([
    supabase
      .from("listing_reports")
      .select("id, request_id, reporter_id, offer_id, report_target, reason, details, image_urls, status, created_at, admin_note")
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id, slug, title"),
  ]);

  const offerIds = ((reportRows ?? []) as DbListingReportRow[])
    .map((report) => report.offer_id)
    .filter((offerId): offerId is string => Boolean(offerId));
  const { data: offerRows } = offerIds.length
    ? await supabase
        .from("offers")
        .select("id, estimated_ship_time")
        .in("id", offerIds)
    : { data: [] as { id: string; estimated_ship_time: string | null }[] };
  const offersById = new Map((offerRows ?? []).map((offer) => [offer.id, offer]));

  const requestsById = new Map((requestRows ?? []).map((row) => [row.id, row]));

  return ((reportRows ?? []) as DbListingReportRow[])
    .map((report) => {
      const request = requestsById.get(report.request_id);

      if (!request) {
        return undefined;
      }

      return {
        reportId: report.id,
        requestId: report.request_id,
        requestSlug: request.slug,
        requestTitle: request.title,
        reportTarget: report.report_target === "offer" ? "offer" : "request",
        offerId: report.offer_id ?? undefined,
        offerSellerName: report.offer_id ? offersById.get(report.offer_id)?.estimated_ship_time?.replace("Seller:", "").trim() ?? "Seller" : undefined,
        reportedById: report.reporter_id,
        reasonLabel: formatListingReportReason(report.reason),
        details: report.details,
        imageUrls: parseMediaUrls(report.image_urls),
        statusLabel: formatListingReportStatus(report.status),
        createdLabel: formatRelativeDate(report.created_at),
        adminNote: report.admin_note ?? undefined,
      } satisfies AdminListingReport;
    })
    .filter((report): report is NonNullable<typeof report> => Boolean(report));
}

export async function getCurrentTrustAppeal(profileId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return {
      status: "none",
      memberMessage: "",
      adminNote: undefined,
      createdLabel: undefined,
      reviewedLabel: undefined,
    } satisfies MemberTrustAppeal;
  }

  const { data } = await supabase
    .from("trust_appeals")
    .select("id, profile_id, status, member_message, admin_note, created_at, reviewed_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      status: "none",
      memberMessage: "",
      adminNote: undefined,
      createdLabel: undefined,
      reviewedLabel: undefined,
    } satisfies MemberTrustAppeal;
  }

  return {
    status: data.status,
    memberMessage: data.member_message,
    adminNote: data.admin_note ?? undefined,
    createdLabel: formatRelativeDate(data.created_at),
    reviewedLabel: data.reviewed_at ? formatRelativeDate(data.reviewed_at) : undefined,
  } satisfies MemberTrustAppeal;
}

export async function getAdminTrustAppeals() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as AdminTrustAppeal[];
  }

  const { data } = await supabase
    .from("trust_appeals")
    .select("id, profile_id, status, member_message, admin_note, created_at, reviewed_at")
    .order("created_at", { ascending: false });

  const appeals = (data ?? []) as DbTrustAppealRow[];

  if (appeals.length === 0) {
    return [] as AdminTrustAppeal[];
  }

  const profileIds = [...new Set(appeals.map((appeal) => appeal.profile_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name, account_status")
    .in("id", profileIds);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return appeals.map((appeal) => {
    const profile = profilesById.get(appeal.profile_id);

    return {
      appealId: appeal.id,
      profileId: appeal.profile_id,
      memberEmail: profile?.email ?? "Unknown",
      memberName: profile?.display_name ?? "BuyerBoard Member",
      accountStatus:
        profile?.account_status === "suspended"
          ? "suspended"
          : profile?.account_status === "flagged"
            ? "flagged"
            : "active",
      memberMessage: appeal.member_message,
      status: appeal.status,
      createdLabel: formatRelativeDate(appeal.created_at),
      adminNote: appeal.admin_note ?? undefined,
      reviewedLabel: appeal.reviewed_at ? formatRelativeDate(appeal.reviewed_at) : undefined,
    } satisfies AdminTrustAppeal;
  });
}

export async function getSavedRequestFilters(profileId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as SavedRequestFilter[];
  }

  const { data } = await supabase
    .from("saved_request_filters")
    .select("id, profile_id, name, search_query, category, subcategory, shipping, status, sort_order, alert_enabled")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as DbSavedRequestFilterRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    searchQuery: row.search_query ?? "",
    category: row.category ?? "All categories",
    subcategory: row.subcategory ?? "All subcategories",
    shipping: row.shipping ?? "Any",
    status: row.status ?? "All statuses",
    sort: row.sort_order ?? "Newest first",
    alertEnabled: Boolean(row.alert_enabled),
  }));
}

export async function getAdminTrustMembers() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as AdminTrustMember[];
  }

  const [{ data: profiles }, { data: transactions }, { data: disputes }, { data: flaggedMessages }, { data: listingReports }, { data: trustEvents }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email, account_type, plan_tier, phone_verified_at, stripe_payouts_enabled_at, account_status, admin_risk_note")
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, seller_id"),
    supabase
      .from("disputes")
      .select("id, seller_id"),
    supabase
      .from("direct_messages")
      .select("id, sender_id, moderation_state")
      .eq("moderation_state", "flagged"),
    supabase
      .from("listing_reports")
      .select("id, reporter_id"),
    supabase
      .from("trust_events")
      .select("id, profile_id, event_type, note, event_value, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const completedSalesBySeller = new Map<string, number>();
  for (const transaction of transactions ?? []) {
    completedSalesBySeller.set(transaction.seller_id, (completedSalesBySeller.get(transaction.seller_id) ?? 0) + 1);
  }

  const disputesBySeller = new Map<string, number>();
  for (const dispute of disputes ?? []) {
    disputesBySeller.set(dispute.seller_id, (disputesBySeller.get(dispute.seller_id) ?? 0) + 1);
  }

  const flaggedMessagesBySender = new Map<string, number>();
  for (const flaggedMessage of flaggedMessages ?? []) {
    flaggedMessagesBySender.set(
      flaggedMessage.sender_id,
      (flaggedMessagesBySender.get(flaggedMessage.sender_id) ?? 0) + 1,
    );
  }

  const listingReportsByReporter = new Map<string, number>();
  for (const listingReport of listingReports ?? []) {
    listingReportsByReporter.set(
      listingReport.reporter_id,
      (listingReportsByReporter.get(listingReport.reporter_id) ?? 0) + 1,
    );
  }

  const historyByProfileId = new Map<string, TrustHistoryEntry[]>();
  const eventLabelMap = {
    account_status: "Account warning or probation update",
    phone_review: "Phone verification review",
    flagged_message_review: "Flagged private message review",
    appeal_submitted: "Member appeal submitted",
    appeal_review: "Appeal review decision",
  } as const;

  for (const event of trustEvents ?? []) {
    const current = historyByProfileId.get(event.profile_id) ?? [];

    if (current.length >= 6) {
      continue;
    }

    current.push({
      id: event.id,
      eventLabel: eventLabelMap[event.event_type as keyof typeof eventLabelMap] ?? "Trust review event",
      note: event.note,
      createdLabel: formatRelativeDate(event.created_at),
    });
    historyByProfileId.set(event.profile_id, current);
  }

  return (profiles ?? []).map((profile) => {
    const completedSales = completedSalesBySeller.get(profile.id) ?? 0;
    const disputeCount = disputesBySeller.get(profile.id) ?? 0;
    const flaggedMessageCount = flaggedMessagesBySender.get(profile.id) ?? 0;
    const submittedReportCount = listingReportsByReporter.get(profile.id) ?? 0;
    const disputeRate = completedSales > 0 ? disputeCount / completedSales : 0;
    const disputeRateLabel = completedSales > 0 ? `${Math.round(disputeRate * 100)}%` : "0%";
    const riskLabel =
      disputeCount >= 3 || disputeRate >= 0.35 || flaggedMessageCount >= 2
        ? "High risk"
        : disputeCount >= 1 || disputeRate >= 0.15 || flaggedMessageCount >= 1
          ? "Moderate risk"
          : "Low risk";

    return {
      profileId: profile.id,
      displayName: profile.display_name ?? "BuyerBoard Member",
      email: profile.email ?? "Unknown",
      accountType: profile.account_type === "business" ? "business" : "individual",
      planTier: profile.plan_tier === "premium" || profile.plan_tier === "business" ? profile.plan_tier : "free",
      accountStatus: profile.account_status === "suspended" ? "suspended" : profile.account_status === "flagged" ? "flagged" : "active",
      phoneVerified: Boolean(profile.phone_verified_at),
      payoutReady: Boolean(profile.stripe_payouts_enabled_at),
      completedSales,
      disputeCount,
      flaggedMessageCount,
      submittedReportCount,
      disputeRateLabel,
      riskLabel,
      adminRiskNote: profile.admin_risk_note ?? undefined,
      warningHistory: historyByProfileId.get(profile.id) ?? [],
    } satisfies AdminTrustMember;
  });
}

function sellerOffersFromMock() {
  return getMockOffers("req_2").concat(getMockOffers("req_3"));
}

function getMockSellerPerformance(): SellerPerformance {
  return {
    sellerRating: 4.8,
    reviewCount: 24,
    shippedWithinWindowRate: 96,
    completedShipments: 24,
    onTimeShipments: 23,
  };
}

function getMockSellerReviews(): SellerReviewSnippet[] {
  return [
    {
      id: "mock-review-1",
      buyerName: "Augusta Auto Fix",
      rating: 5,
      ratingLabel: formatRatingLabel(5),
      reviewText: "Part matched the listing and arrived inside the claim window.",
      createdLabel: "2 days ago",
    },
    {
      id: "mock-review-2",
      buyerName: "Savannah Salvage",
      rating: 4,
      ratingLabel: formatRatingLabel(4),
      reviewText: "Good communication and the item worked as expected.",
      createdLabel: "5 days ago",
    },
  ];
}

async function getBuyerCompletedPurchases(buyerId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as CompletedPurchase[];
  }

  const [{ data: transactionRows }, { data: disputeRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, request_id, buyer_id, seller_id, final_price_cents, completed_at, payment_status")
      .eq("buyer_id", buyerId)
      .order("completed_at", { ascending: false }),
    supabase
      .from("disputes")
      .select("id, transaction_id, request_id, buyer_id, seller_id, reason, details, buyer_evidence, buyer_evidence_images, status, created_at, seller_response, seller_evidence, seller_evidence_images")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, transaction_id, request_id, buyer_id, seller_id, rating, review_text, created_at")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false }),
  ]);

  const transactions = (transactionRows ?? []) as DbTransactionRow[];

  if (transactions.length === 0) {
    return [] as CompletedPurchase[];
  }

  const requestIds = [...new Set(transactions.map((row) => row.request_id))];
  const sellerIds = [...new Set(transactions.map((row) => row.seller_id))];
  const { data: requestRows } = await supabase
    .from("requests")
    .select(mappedRequestSelectFields)
    .in("id", requestIds);
  const { data: sellerRows } = sellerIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", sellerIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const requestsById = new Map((requestRows ?? []).map((row) => [row.id, row as DbRequestRow]));
  const disputesByTransactionId = new Map(((disputeRows ?? []) as DbDisputeRow[]).map((row) => [row.transaction_id, row]));
  const reviewsByTransactionId = new Map(((reviewRows ?? []) as DbReviewRow[]).map((row) => [row.transaction_id, row]));
  const sellersById = new Map((sellerRows ?? []).map((row) => [row.id, row]));

  return transactions
    .map((transaction) => {
      const request = requestsById.get(transaction.request_id);
      if (!request) {
        return undefined;
      }

      const dispute = disputesByTransactionId.get(transaction.id);
      const review = reviewsByTransactionId.get(transaction.id);
      const seller = sellersById.get(transaction.seller_id);

      return {
        transactionId: transaction.id,
        requestId: transaction.request_id,
        requestSlug: request.slug,
        requestTitle: request.title,
        sellerId: transaction.seller_id,
        sellerName: seller?.display_name?.trim() || "Seller",
        finalPriceLabel: formatCurrencyFromCents(transaction.final_price_cents),
        completedLabel: formatRelativeDate(transaction.completed_at),
        issueStatus: dispute?.status ?? "none",
        issueReason: dispute ? formatDisputeReason(dispute.reason) : undefined,
        issueDetails: dispute?.details,
        issueEvidence: dispute?.buyer_evidence ?? undefined,
        issueImageUrls: parseMediaUrls(dispute?.buyer_evidence_images),
        reviewId: review?.id,
        reviewRating: review?.rating,
        reviewText: review?.review_text ?? undefined,
      } satisfies CompletedPurchase;
    })
    .filter((purchase): purchase is CompletedPurchase => Boolean(purchase));
}

async function getSellerIssues(sellerId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as SellerIssue[];
  }

  const { data: disputeRows } = await supabase
    .from("disputes")
    .select("id, transaction_id, request_id, buyer_id, seller_id, reason, details, buyer_evidence, buyer_evidence_images, status, created_at, seller_response, seller_evidence, seller_evidence_images")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  const disputes = (disputeRows ?? []) as DbDisputeRow[];

  if (disputes.length === 0) {
    return [] as SellerIssue[];
  }

  const requestIds = [...new Set(disputes.map((row) => row.request_id))];
  const { data: requestRows } = await supabase
    .from("requests")
    .select(mappedRequestSelectFields)
    .in("id", requestIds);

  const requestsById = new Map((requestRows ?? []).map((row) => [row.id, row as DbRequestRow]));

  return disputes
    .map((dispute) => {
      const request = requestsById.get(dispute.request_id);
      if (!request) {
        return undefined;
      }

      return {
        disputeId: dispute.id,
        requestId: dispute.request_id,
        requestSlug: request.slug,
        requestTitle: request.title,
        reasonLabel: formatDisputeReason(dispute.reason),
        details: dispute.details,
        buyerEvidence: dispute.buyer_evidence ?? undefined,
        buyerEvidenceImageUrls: parseMediaUrls(dispute.buyer_evidence_images),
        statusLabel: formatDisputeStatus(dispute.status),
        createdLabel: formatRelativeDate(dispute.created_at),
        sellerResponse: dispute.seller_response ?? undefined,
        sellerEvidence: dispute.seller_evidence ?? undefined,
        sellerEvidenceImageUrls: parseMediaUrls(dispute.seller_evidence_images),
      } satisfies SellerIssue;
    })
    .filter((issue): issue is SellerIssue => Boolean(issue));
}

async function getActiveClaimsForBuyer(requests: WantedRequest[]) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as ActiveClaim[];
  }

  const claimedRequestIds = requests.filter((request) => request.status === "claimed").map((request) => request.id);

  if (claimedRequestIds.length === 0) {
    return [] as ActiveClaim[];
  }

  const [{ data: requestRows }, { data: claimRows }, { data: offerRows }, { data: transactionRows }] = await Promise.all([
    supabase
      .from("requests")
      .select(mappedRequestSelectFields)
      .in("id", claimedRequestIds),
    supabase
      .from("claim_events")
      .select("id, request_id, seller_id, expires_at, released_at")
      .in("request_id", claimedRequestIds)
      .is("released_at", null)
      .order("claimed_at", { ascending: false }),
    supabase
      .from("offers")
      .select("id, request_id, seller_id, image_urls, offer_price_cents, message, shipping_note, estimated_ship_time, status")
      .in("request_id", claimedRequestIds),
    supabase
      .from("transactions")
      .select("id, request_id, payment_status")
      .in("request_id", claimedRequestIds),
  ]);

  if (!requestRows || !claimRows) {
    return [] as ActiveClaim[];
  }

  const requestsById = new Map(requestRows.map((row) => [row.id, row]));
  const offersById = new Map((offerRows ?? []).map((row) => [row.id, row]));
  const paymentStatusByRequestId = new Map((transactionRows ?? []).map((row) => [row.request_id, row.payment_status ?? "completed"]));

  return claimRows
    .map((claim) => {
      const request = requestsById.get(claim.request_id);
      if (!request) {
        return undefined;
      }

      const offer = request.fulfilled_offer_id ? offersById.get(request.fulfilled_offer_id) : undefined;
      return mapActiveClaim({
        claim,
        request,
        offer,
        paymentStatus: (paymentStatusByRequestId.get(request.id) as ActiveClaim["paymentStatus"] | undefined) ?? "awaiting_payment",
      });
    })
    .filter((claim): claim is ActiveClaim => Boolean(claim));
}

async function getActiveClaimsForSeller(sellerId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as ActiveClaim[];
  }

  const { data: claimRows } = await supabase
    .from("claim_events")
    .select("id, request_id, seller_id, expires_at, released_at")
    .eq("seller_id", sellerId)
    .is("released_at", null)
    .order("claimed_at", { ascending: false });

  if (!claimRows || claimRows.length === 0) {
    return [] as ActiveClaim[];
  }

  const claimRequestIds = claimRows.map((claim) => claim.request_id);

  const [{ data: requestRows }, { data: offerRows }, { data: transactionRows }] = await Promise.all([
    supabase
      .from("requests")
      .select(mappedRequestSelectFields)
      .in("id", claimRequestIds)
      .eq("status", "claimed"),
    supabase
      .from("offers")
      .select("id, request_id, seller_id, image_urls, offer_price_cents, message, shipping_note, estimated_ship_time, status")
      .eq("seller_id", sellerId)
      .in("request_id", claimRequestIds),
    supabase
      .from("transactions")
      .select("id, request_id, payment_status")
      .in("request_id", claimRequestIds),
  ]);

  if (!requestRows) {
    return [] as ActiveClaim[];
  }

  const requestsById = new Map(requestRows.map((row) => [row.id, row]));
  const offersById = new Map((offerRows ?? []).map((row) => [row.id, row]));
  const paymentStatusByRequestId = new Map((transactionRows ?? []).map((row) => [row.request_id, row.payment_status ?? "completed"]));

  return claimRows
    .map((claim) => {
      const request = requestsById.get(claim.request_id);
      if (!request) {
        return undefined;
      }

      const offer = request.fulfilled_offer_id ? offersById.get(request.fulfilled_offer_id) : undefined;
      return mapActiveClaim({
        claim,
        request,
        offer,
        paymentStatus: (paymentStatusByRequestId.get(request.id) as ActiveClaim["paymentStatus"] | undefined) ?? "awaiting_payment",
      });
    })
    .filter((claim): claim is ActiveClaim => Boolean(claim));
}

async function getSellerPerformance(sellerId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return getMockSellerPerformance();
  }

  const [{ data: claimRows }, { data: transactionRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("claim_events")
      .select("id, request_id, seller_id, claimed_at, expires_at, released_at")
      .eq("seller_id", sellerId),
    supabase
      .from("transactions")
      .select("id, request_id, seller_id, final_price_cents, platform_fee_cents, completed_at")
      .eq("seller_id", sellerId),
    supabase
      .from("reviews")
      .select("id, transaction_id, request_id, buyer_id, seller_id, rating, review_text, created_at")
      .eq("seller_id", sellerId),
  ]);

  const claims = claimRows ?? [];
  const transactions = transactionRows ?? [];
  const reviews = (reviewRows ?? []) as DbReviewRow[];

  if (transactions.length === 0) {
    return {
      sellerRating: 5,
      reviewCount: 0,
      shippedWithinWindowRate: 0,
      completedShipments: 0,
      onTimeShipments: 0,
    } satisfies SellerPerformance;
  }

  const claimsByRequestId = new Map(claims.map((claim) => [claim.request_id, claim]));
  const onTimeShipments = transactions.filter((transaction) => {
    const claim = claimsByRequestId.get(transaction.request_id);
    if (!claim) {
      return false;
    }

    return new Date(transaction.completed_at).getTime() <= new Date(claim.expires_at).getTime();
  }).length;

  const completedShipments = transactions.length;
  const shippedWithinWindowRate = Math.round((onTimeShipments / completedShipments) * 100);
  const reviewCount = reviews.length;
  const sellerRating =
    reviewCount > 0
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1))
      : Math.max(3.5, Math.min(5, Number((4 + shippedWithinWindowRate / 100).toFixed(1))));

  return {
    sellerRating,
    reviewCount,
    shippedWithinWindowRate,
    completedShipments,
    onTimeShipments,
  } satisfies SellerPerformance;
}

async function getSellerRecentReviews(sellerId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return getMockSellerReviews();
  }

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, transaction_id, request_id, buyer_id, seller_id, rating, review_text, created_at")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(4);

  const reviews = (reviewRows ?? []) as DbReviewRow[];

  if (reviews.length === 0) {
    return [] as SellerReviewSnippet[];
  }

  const buyerIds = [...new Set(reviews.map((review) => review.buyer_id))];
  const { data: buyerRows } = buyerIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", buyerIds)
    : { data: [] as { id: string; display_name: string | null }[] };

  const buyersById = new Map((buyerRows ?? []).map((row) => [row.id, row]));

  return reviews.map((review) => ({
    id: review.id,
    buyerName: buyersById.get(review.buyer_id)?.display_name?.trim() || "BuyerBoard Member",
    rating: review.rating,
    ratingLabel: formatRatingLabel(review.rating),
    reviewText: review.review_text ?? undefined,
    createdLabel: formatRelativeDate(review.created_at),
  })) satisfies SellerReviewSnippet[];
}

export async function getPublicSellerProfile(sellerId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return undefined as PublicSellerProfile | undefined;
  }

  const [{ data: profileRow }, performance, recentReviews, { count: recentOfferCount }, { count: followerCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, business_name, public_location_label, account_type, plan_tier, phone_verified_at, created_at")
      .eq("id", sellerId)
      .maybeSingle(),
    getSellerPerformance(sellerId),
    getSellerRecentReviews(sellerId),
    supabase
      .from("offers")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", sellerId),
  ]);

  if (!profileRow) {
    return undefined;
  }

  const sellerName = profileRow.business_name?.trim() || profileRow.display_name?.trim() || "BuyerBoard Seller";

  return {
    sellerId,
    sellerName,
    publicLocation: profileRow.public_location_label?.trim() || "Location not shared",
    accountType: (profileRow.account_type as "individual" | "business") ?? "individual",
    planTier: (profileRow.plan_tier as "free" | "premium" | "business") ?? "free",
    sellerRating: performance.sellerRating,
    reviewCount: performance.reviewCount,
    shippedWithinWindowRate: performance.shippedWithinWindowRate,
    completedShipments: performance.completedShipments,
    onTimeShipments: performance.onTimeShipments,
    recentOfferCount: recentOfferCount ?? 0,
    followerCount: followerCount ?? 0,
    phoneVerified: Boolean(profileRow.phone_verified_at),
    memberSinceLabel: formatRelativeDate(profileRow.created_at),
    recentReviews,
  } satisfies PublicSellerProfile;
}

export async function createWantedRequest(input: CreateRequestInput) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  assertRateLimit({
    scope: "request-create",
    actorKey: user.id,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: "Too many requests were posted too quickly. Please wait a minute and try again.",
  });

  const normalizedInput = normalizeRequestCreateInput(input);
  const profile = await getCurrentProfile();
  const publicRequestLocation = derivePublicLocationLabel({
    publicLocation: profile?.publicLocation,
    shippingCity: profile?.shippingCity,
    shippingState: profile?.shippingState,
  });

  if (!publicRequestLocation) {
    throw new Error("Save a public city/state or shipping city/state in your dashboard before posting a request.");
  }

  if (normalizedInput.category === "Auto Parts" && !normalizedInput.vehicleFitment) {
    throw new Error("Auto parts requests require vehicle fitment details.");
  }
  const { data: recentRequests, error: recentRequestsError } = await supabase
    .from("requests")
    .select("id, title, created_at")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentRequestsError) {
    throw new Error(recentRequestsError.message);
  }

  // This is a lightweight duplicate-submit guard, not a permanent uniqueness rule.
  // It only stops obvious accidental double posts from the same buyer in the same burst.
  const duplicateRequest = (recentRequests ?? []).find((request) => {
    const postedWithinFiveMinutes = Date.now() - new Date(request.created_at).getTime() <= 5 * 60 * 1000;
    return postedWithinFiveMinutes && request.title.trim().toLowerCase() === normalizedInput.title.toLowerCase();
  });

  if (duplicateRequest) {
    throw new Error("This request looks like a duplicate of one you just posted.");
  }

  const baseSlug = slugify(normalizedInput.title) || "wanted-item";
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
  const description = [
    `Subcategory: ${normalizedInput.subcategory}`,
    normalizedInput.vehicleFitment ? `Vehicle fitment: ${normalizedInput.vehicleFitment}` : undefined,
    normalizedInput.description,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data, error } = await supabase
    .from("requests")
    .insert({
      buyer_id: user.id,
      slug,
      title: normalizedInput.title,
      category: normalizedInput.category,
      description,
      image_urls: normalizedInput.imageUrls,
      condition_preference: normalizedInput.conditionPreference,
      shipping_preference: normalizedInput.shippingPreference,
      location_label: publicRequestLocation,
      target_price_cents: Math.round(normalizedInput.targetBudget * 100),
      status: "open",
    })
    .select("slug")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create request.");
  }

  await createNotification({
    profileId: user.id,
    title: "Request posted",
    body: `${normalizedInput.title} is now live on the board.`,
    href: `/requests/${data.slug}`,
    preferenceKey: "offers_claims",
  });

  const { data: savedFilters, error: savedFiltersError } = await supabase
    .from("saved_request_filters")
    .select("profile_id, name, search_query, category, subcategory, shipping, status, alert_enabled")
    .eq("alert_enabled", true)
    .neq("profile_id", user.id);

  if (savedFiltersError) {
    logBuyerBoardEvent("error", "watchlist_lookup_failed", {
      buyerId: user.id,
      requestTitle: normalizedInput.title,
      error: savedFiltersError,
    });
  }

  const newRequestForMatching = {
    title: normalizedInput.title,
    category: normalizedInput.category,
    subcategory: normalizedInput.subcategory,
    shipping: normalizedInput.shippingPreference,
    status: "open",
    location: publicRequestLocation,
    details: normalizedInput.description,
  };

  for (const filter of (savedFilters ?? []) as DbSavedRequestFilterRow[]) {
    if (
      requestMatchesSavedFilter({
        request: newRequestForMatching,
        filter,
      })
    ) {
      await createNotification({
        profileId: filter.profile_id,
        title: "New request matches your watchlist",
        body: `${normalizedInput.title} matched your saved filter "${filter.name}".`,
        href: `/requests/${data.slug}`,
        preferenceKey: "watchlist",
        sendEmail: true,
      });
    }
  }

  return data.slug;
}

export async function confirmRequestFreshness(requestId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  const normalizedRequestId = requireTrimmedText({
    value: requestId,
    label: "Request information",
    maxLength: 120,
  });

  const { data: requestRow, error: requestError } = await supabase
    .from("requests")
    .select("id, slug, title, buyer_id, status")
    .eq("id", normalizedRequestId)
    .maybeSingle();

  if (requestError || !requestRow) {
    throw new Error(requestError?.message ?? "Request not found.");
  }

  if (requestRow.buyer_id !== user.id) {
    throw new Error("Only the buyer who posted this request can confirm freshness.");
  }

  if (!["open", "negotiating"].includes(requestRow.status)) {
    throw new Error("Only active requests can be confirmed.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("requests")
    .update({
      last_active_confirmation_at: now,
      stale_confirmation_requested_at: null,
      stale_confirmation_miss_count: 0,
      updated_at: now,
    })
    .eq("id", normalizedRequestId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await createNotification({
    profileId: user.id,
    title: "Request confirmed active",
    body: `${requestRow.title} will stay live on BuyerBoard.`,
    href: "/dashboard?tab=buyer",
    preferenceKey: "offers_claims",
  });
}

export async function processStaleRequestConfirmations(input?: {
  force?: boolean;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const force = Boolean(input?.force);
  const { data: requestRows, error: requestError } = await supabase
    .from("requests")
    .select("id, slug, title, buyer_id, status, created_at, last_active_confirmation_at, stale_confirmation_requested_at, stale_confirmation_miss_count")
    .in("status", ["open", "negotiating"])
    .order("created_at", { ascending: true });

  if (requestError) {
    throw new Error(requestError.message);
  }

  let reminderCount = 0;
  let archivedCount = 0;

  for (const request of (requestRows ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    buyer_id: string;
    status: WantedRequest["status"];
    created_at: string;
    last_active_confirmation_at?: string | null;
    stale_confirmation_requested_at?: string | null;
    stale_confirmation_miss_count?: number | null;
  }>) {
    const anchorMs = new Date(request.last_active_confirmation_at ?? request.created_at).getTime();
    const requestedAtMs = request.stale_confirmation_requested_at ? new Date(request.stale_confirmation_requested_at).getTime() : null;
    const missedChecks = request.stale_confirmation_miss_count ?? 0;
    const initialDue = anchorMs + staleRequestIntervalMs;

    if (requestedAtMs != null) {
      const followUpDue = requestedAtMs + staleRequestIntervalMs;

      if (!force && now < followUpDue) {
        continue;
      }

      if (missedChecks >= 1) {
        const { error: archiveError } = await supabase
          .from("requests")
          .update({
            status: "closed",
            stale_confirmation_requested_at: null,
            stale_confirmation_miss_count: missedChecks + 1,
            updated_at: nowIso,
          })
          .eq("id", request.id);

        if (archiveError) {
          throw new Error(archiveError.message);
        }

        await createNotification({
          profileId: request.buyer_id,
          title: "Request archived after missed confirmation",
          body: `${request.title} was archived after two missed freshness confirmations.`,
          href: "/dashboard?tab=buyer",
          preferenceKey: "offers_claims",
          sendEmail: true,
        });

        archivedCount += 1;
        continue;
      }

      const { error: secondNoticeError } = await supabase
        .from("requests")
        .update({
          stale_confirmation_requested_at: nowIso,
          stale_confirmation_miss_count: 1,
          updated_at: nowIso,
        })
        .eq("id", request.id);

      if (secondNoticeError) {
        throw new Error(secondNoticeError.message);
      }

      await createNotification({
        profileId: request.buyer_id,
        title: "Second request freshness check",
        body: `${request.title} still needs your confirmation or BuyerBoard will archive it.`,
        href: "/dashboard?tab=buyer",
        preferenceKey: "offers_claims",
        sendEmail: true,
      });

      reminderCount += 1;
      continue;
    }

    if (!force && now < initialDue) {
      continue;
    }

    const { error: reminderError } = await supabase
      .from("requests")
      .update({
        stale_confirmation_requested_at: nowIso,
        stale_confirmation_miss_count: 0,
        updated_at: nowIso,
      })
      .eq("id", request.id);

    if (reminderError) {
      throw new Error(reminderError.message);
    }

    await createNotification({
      profileId: request.buyer_id,
      title: "Please confirm your request is still active",
      body: `${request.title} has been live for over two weeks. Confirm it if you still want offers.`,
      href: "/dashboard?tab=buyer",
      preferenceKey: "offers_claims",
      sendEmail: true,
    });

    reminderCount += 1;
  }

  return {
    reminderCount,
    archivedCount,
    processedAt: nowIso,
  };
}

export async function createSellerResponse(input: SellerResponseInput) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  await requireVerifiedPhone();
  assertRateLimit({
    scope: "offer-create",
    actorKey: user.id,
    limit: 8,
    windowMs: 10 * 60 * 1000,
    message: "Too many offers were sent too quickly. Please wait a minute and try again.",
  });
  const normalizedInput = normalizeSellerResponseInput(input);

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const sellerDisplayName = profileRow?.display_name?.trim() || user.email?.split("@")[0] || "Seller";
  const { data: existingOfferRows, error: existingOfferError } = await supabase
    .from("offers")
    .select("id")
    .eq("request_id", normalizedInput.requestId)
    .eq("seller_id", user.id)
    .in("status", ["pending", "accepted", "countered"])
    .limit(1);

  if (existingOfferError) {
    throw new Error(existingOfferError.message);
  }

  // Active seller offers are intentionally one-at-a-time per seller/request. That keeps
  // negotiations readable and stops duplicate-click spam from generating parallel offers.
  if ((existingOfferRows ?? []).length > 0) {
    throw new Error("You already have an active offer on this request.");
  }

  // The database function owns the lock + write sequence so the request status,
  // negotiation message, and offer row move together instead of drifting apart.
  const { data: sellerResponseRows, error: sellerResponseError } = await supabase.rpc("create_seller_claim_offer", {
    p_request_id: normalizedInput.requestId,
    p_seller_id: user.id,
    p_message: normalizedInput.message,
    p_offer_price_cents: Math.round(normalizedInput.offeredPrice * 100),
    p_image_urls: normalizedInput.imageUrls,
    p_claim_window_hours: normalizedInput.proposedClaimWindowHours,
    p_seller_display_name: sellerDisplayName,
  });

  if (sellerResponseError || !sellerResponseRows || sellerResponseRows.length === 0) {
    throw new Error(sellerResponseError?.message ?? "Unable to save this seller claim offer.");
  }

  const notificationRequestRow = sellerResponseRows[0] as {
    buyer_id: string;
    request_slug: string;
    request_title: string;
    seller_id: string;
  };

  if (notificationRequestRow?.buyer_id) {
    await createNotification({
      profileId: notificationRequestRow.buyer_id,
      title: "New seller claim offer",
      body: `${sellerDisplayName} sent an offer on ${notificationRequestRow.request_title}.`,
      href: notificationRequestRow.request_slug ? `/requests/${notificationRequestRow.request_slug}` : "/dashboard?tab=buyer",
      preferenceKey: "offers_claims",
      sendEmail: true,
    });
  }
}

export async function updateClaimOfferDecision(input: {
  offerId: string;
  requestId: string;
  decision: ClaimOfferDecision;
  buyerComment?: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  assertRateLimit({
    scope: "offer-review",
    actorKey: user.id,
    limit: 20,
    windowMs: 10 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });
  const requestId = requireTrimmedText({
    value: input.requestId,
    label: "Request information",
    maxLength: 120,
  });
  const offerId = requireTrimmedText({
    value: input.offerId,
    label: "Offer information",
    maxLength: 120,
  });
  const buyerComment = normalizeOptionalText({
    value: input.buyerComment,
    label: "Buyer comment",
    maxLength: requestWriteLimits.buyerComment,
  });

  if (!["accepted", "declined", "countered"].includes(input.decision)) {
    throw new Error("Choose a valid buyer decision.");
  }

  if (input.decision === "accepted") {
    const { data: acceptanceRows, error: acceptanceError } = await supabase.rpc("accept_claim_offer", {
      p_request_id: requestId,
      p_offer_id: offerId,
      p_buyer_id: user.id,
      p_buyer_comment: buyerComment ?? null,
    });

    if (acceptanceError || !acceptanceRows || acceptanceRows.length === 0) {
      throw new Error(acceptanceError?.message ?? "Unable to approve this claim offer right now.");
    }

    const acceptedClaim = acceptanceRows[0] as {
      seller_id: string;
      expires_at: string;
      seeded_price_cents: number;
      platform_fee_cents: number;
    };

    await createNotification({
      profileId: acceptedClaim.seller_id,
      title: "Claim offer accepted",
      body: "A buyer approved your claim offer. Buyer funding is the next step.",
      href: "/dashboard?tab=seller",
      preferenceKey: "offers_claims",
      sendEmail: true,
    });
  } else {
    // Counter and decline are also coordinated in the database so the offer status,
    // optional buyer message, and request status stay in sync under one lock.
    const { data: reviewRows, error: reviewError } = await supabase.rpc("review_claim_offer", {
      p_request_id: requestId,
      p_offer_id: offerId,
      p_buyer_id: user.id,
      p_decision: input.decision,
      p_buyer_comment: buyerComment ?? null,
    });

    if (reviewError || !reviewRows || reviewRows.length === 0) {
      throw new Error(reviewError?.message ?? "Unable to update this claim offer.");
    }

    const reviewedOffer = reviewRows[0] as {
      seller_id: string;
      next_status: "open" | "negotiating";
    };

    await createNotification({
      profileId: reviewedOffer.seller_id,
      title: input.decision === "countered" ? "Buyer sent a counteroffer" : "Claim offer denied",
      body:
        input.decision === "countered"
          ? "A buyer sent a counteroffer comment on your claim offer."
          : "A buyer denied your claim offer.",
      href: "/dashboard?tab=seller",
      preferenceKey: "offers_claims",
      sendEmail: true,
    });
  }
}

export async function completeSellerClaim(input: {
  requestId: string;
  claimId: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  const { data: completionRows, error: completionError } = await supabase.rpc("complete_seller_claim", {
    p_request_id: input.requestId,
    p_claim_id: input.claimId,
    p_seller_id: user.id,
  });

  if (completionError || !completionRows || completionRows.length === 0) {
    throw new Error(completionError?.message ?? "Unable to complete this claim right now.");
  }

  const completedClaim = completionRows[0] as {
    buyer_id: string;
  };

  // Shipment-complete chat notes help the buyer understand what happened, but the
  // order itself is already completed above. We log instead of throwing here so a
  // message-table hiccup does not undo the seller's actual completion action.
  const { error: completionMessageError } = await supabase.from("messages").insert({
    request_id: input.requestId,
    sender_id: user.id,
    body: "Seller marked this claim as shipped and completed.",
  });

  if (completionMessageError) {
    console.error("BuyerBoard completion message insert failed", completionMessageError);
  }

  await createNotification({
    profileId: completedClaim.buyer_id,
    title: "Seller marked order complete",
    body: "The seller says this claimed order has shipped or completed.",
    href: "/dashboard?tab=buyer",
    preferenceKey: "offers_claims",
    sendEmail: true,
  });
}

export async function startClaimCheckout(input: { requestId: string }) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const stripe = createStripeServerClient();

  if (!stripe) {
    throw new Error("Stripe is not configured yet. Add Stripe keys to continue.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();

  const { data: requestRow, error: requestError } = await supabase
    .from("requests")
    .select("id, title, buyer_id, fulfilled_offer_id, status")
    .eq("id", input.requestId)
    .single();

  if (requestError || !requestRow) {
    throw new Error(requestError?.message ?? "Claimed request not found.");
  }

  if (requestRow.buyer_id !== user.id) {
    throw new Error("Only the buyer on this request can fund it.");
  }

  if (requestRow.status !== "claimed" || !requestRow.fulfilled_offer_id) {
    throw new Error("Only approved claims can move into checkout.");
  }

  const [{ data: offerRow, error: offerError }, { data: transactionRow, error: transactionReadError }, { data: profileRow, error: profileReadError }] = await Promise.all([
    supabase
      .from("offers")
      .select("id, seller_id, offer_price_cents")
      .eq("id", requestRow.fulfilled_offer_id)
      .single(),
    supabase
      .from("transactions")
      .select("id, payment_status")
      .eq("request_id", requestRow.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("stripe_customer_id, email, display_name")
      .eq("id", user.id)
      .single(),
  ]);

  if (offerError || !offerRow) {
    throw new Error(offerError?.message ?? "Approved offer not found.");
  }

  if (transactionReadError) {
    throw new Error(transactionReadError.message);
  }

  if (profileReadError) {
    throw new Error(profileReadError.message);
  }

  if (transactionRow?.payment_status && transactionRow.payment_status !== "awaiting_payment") {
    throw new Error("This claim no longer needs buyer funding.");
  }

  let customerId = profileRow?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? profileRow?.email ?? undefined,
      name: profileRow?.display_name ?? undefined,
      metadata: {
        buyerboard_user_id: user.id,
      },
    });

    customerId = customer.id;

    const { error: customerSaveError } = await supabase.from("profiles").update({
      stripe_customer_id: customerId,
    }).eq("id", user.id);

    if (customerSaveError) {
      throw new Error(customerSaveError.message);
    }
  }

  const origin = await getRequestOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${origin}/dashboard?tab=buyer&checkout=success&request_id=${encodeURIComponent(requestRow.id)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard?tab=buyer&error=${encodeURIComponent("Buyer funding was canceled")}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: offerRow.offer_price_cents,
          product_data: {
            name: requestRow.title,
            description: "BuyerBoard accepted claim funding",
          },
        },
      },
    ],
    metadata: {
      buyerboard_request_id: requestRow.id,
      buyerboard_offer_id: offerRow.id,
      buyerboard_buyer_id: user.id,
      buyerboard_seller_id: offerRow.seller_id,
    },
  });

  return session.url;
}

export async function syncClaimCheckoutPayment(input: { requestId: string; sessionId: string }) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const stripe = createStripeServerClient();

  if (!stripe) {
    throw new Error("Stripe is not configured yet. Add Stripe keys to continue.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();

  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["payment_intent"],
  });

  if (session.payment_status !== "paid") {
    throw new Error("Stripe has not marked this checkout session as paid yet.");
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("requests")
    .select("id, buyer_id, fulfilled_offer_id, status")
    .eq("id", input.requestId)
    .single();

  if (requestError || !requestRow) {
    throw new Error(requestError?.message ?? "Claimed request not found.");
  }

  if (requestRow.buyer_id !== user.id || !requestRow.fulfilled_offer_id) {
    throw new Error("Only the buyer on this claim can sync payment.");
  }

  if (requestRow.status !== "claimed") {
    throw new Error("Only claimed requests can sync buyer funding.");
  }

  const { data: offerRow, error: offerError } = await supabase
    .from("offers")
    .select("id, seller_id, offer_price_cents")
    .eq("id", requestRow.fulfilled_offer_id)
    .single();

  if (offerError || !offerRow) {
    throw new Error(offerError?.message ?? "Approved offer not found.");
  }

  if (
    session.metadata?.buyerboard_request_id !== requestRow.id ||
    session.metadata?.buyerboard_offer_id !== offerRow.id ||
    session.metadata?.buyerboard_buyer_id !== user.id ||
    session.metadata?.buyerboard_seller_id !== offerRow.seller_id
  ) {
    throw new Error("This checkout session does not match the approved claim on this request.");
  }

  if (session.amount_total !== offerRow.offer_price_cents) {
    throw new Error("This checkout session amount does not match the approved claim offer.");
  }

  const platformFeeCents = Math.round(offerRow.offer_price_cents * 0.08);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  const { error: transactionError } = await supabase.from("transactions").upsert({
    request_id: requestRow.id,
    buyer_id: requestRow.buyer_id,
    seller_id: offerRow.seller_id,
    final_price_cents: offerRow.offer_price_cents,
    platform_fee_cents: platformFeeCents,
    payment_status: "funded",
    stripe_payment_intent_id: paymentIntentId ?? null,
  });

  if (transactionError) {
    throw new Error(transactionError.message);
  }
}

export async function syncBuyerBillingSetup(input: { sessionId: string }) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const stripe = createStripeServerClient();

  if (!stripe) {
    throw new Error("Stripe is not configured yet. Add Stripe keys to continue.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();

  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["setup_intent"],
  });

  if (session.mode !== "setup" || session.status !== "complete") {
    throw new Error("Stripe has not finished buyer billing setup yet.");
  }

  if (session.metadata?.buyerboard_user_id !== user.id || session.metadata?.buyerboard_flow !== "buyer_billing_setup") {
    throw new Error("This billing setup session does not belong to your BuyerBoard account.");
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!customerId) {
    throw new Error("Stripe billing setup did not return a customer record.");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_customer_ready_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }
}

export async function syncSellerPayoutStatus() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const stripe = createStripeServerClient();

  if (!stripe) {
    throw new Error("Stripe is not configured yet. Add Stripe keys to continue.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_onboarded_at, stripe_charges_enabled_at, stripe_payouts_enabled_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRow?.stripe_connect_account_id) {
    throw new Error(profileError?.message ?? "Seller payout onboarding has not been started yet.");
  }

  const account = await stripe.accounts.retrieve(profileRow.stripe_connect_account_id);
  const now = new Date().toISOString();

  // Preserve the first time Stripe reached each milestone so the dashboard/admin
  // trail stays historically meaningful instead of being overwritten on every sync.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      stripe_connect_onboarded_at: account.details_submitted ? profileRow.stripe_connect_onboarded_at ?? now : null,
      stripe_charges_enabled_at: account.charges_enabled ? profileRow.stripe_charges_enabled_at ?? now : null,
      stripe_payouts_enabled_at: account.payouts_enabled ? profileRow.stripe_payouts_enabled_at ?? now : null,
    })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const notice = account.payouts_enabled
    ? "Seller payouts are ready"
    : account.details_submitted
      ? "Stripe received your payout details and may still need to finish verification."
      : "Stripe payout setup is still incomplete.";

  return { notice };
}

export async function reportListing(input: {
  requestId: string;
  offerId?: string;
  reportTarget: "request" | "offer";
  reason: DbListingReportRow["reason"];
  details: string;
  imageUrls: string[];
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  assertRateLimit({
    scope: "listing-report",
    actorKey: user.id,
    limit: 8,
    windowMs: 30 * 60 * 1000,
    message: "Too many reports were sent too quickly. Please wait a minute and try again.",
  });
  const reportDetails = requireTrimmedText({
    value: input.details,
    label: "Report details",
    maxLength: requestWriteLimits.reportDetails,
  });
  limitStringArrayLength({
    values: input.imageUrls,
    maxItems: requestWriteLimits.maxImages,
    label: "Report photos",
  });

  if (!["request", "offer"].includes(input.reportTarget)) {
    throw new Error("Choose a valid report target.");
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("requests")
    .select("id")
    .eq("id", input.requestId)
    .single();

  if (requestError || !requestRow) {
    throw new Error(requestError?.message ?? "Listing not found.");
  }

  if (input.reportTarget === "offer") {
    if (!input.offerId) {
      throw new Error("An offer report must include the related seller offer.");
    }

    const { data: offerRow, error: offerError } = await supabase
      .from("offers")
      .select("id, request_id")
      .eq("id", input.offerId)
      .single();

    if (offerError || !offerRow || offerRow.request_id !== input.requestId) {
      throw new Error("That seller offer could not be matched to this request.");
    }
  }

  // Reports should be reopenable later if the content stays live, but we do not want one
  // member spamming several open reports against the same exact request/offer at once.
  const duplicateReportQuery = supabase
    .from("listing_reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("request_id", input.requestId)
    .eq("report_target", input.reportTarget)
    .eq("status", "open");

  if (input.offerId) {
    duplicateReportQuery.eq("offer_id", input.offerId);
  } else {
    duplicateReportQuery.is("offer_id", null);
  }

  const { data: duplicateReportRows, error: duplicateReportError } = await duplicateReportQuery.limit(1);

  if (duplicateReportError) {
    throw new Error(duplicateReportError.message);
  }

  if ((duplicateReportRows ?? []).length > 0) {
    throw new Error("You already have an open report for this content.");
  }

  const { error } = await supabase.from("listing_reports").insert({
    request_id: input.requestId,
    reporter_id: user.id,
    offer_id: input.offerId ?? null,
    report_target: input.reportTarget,
    reason: input.reason,
    details: reportDetails,
    image_urls: input.imageUrls,
  });

  if (error) {
    throw new Error(error.message);
  }

  await createNotification({
    profileId: user.id,
    title: "Listing report submitted",
    body: "Your report was sent to the admin review queue.",
    href: "/dashboard",
    preferenceKey: "moderation",
  });
}

export async function reviewListingReport(input: {
  reportId: string;
  requestId: string;
  offerId?: string;
  resolution: "reviewed" | "remove_images" | "removed" | "dismissed";
  adminNote: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  await requireAdminActionReviewer();
  const adminNote = requireTrimmedText({
    value: input.adminNote,
    label: "Admin note",
    maxLength: requestWriteLimits.adminNote,
  });

  if (!["reviewed", "remove_images", "removed", "dismissed"].includes(input.resolution)) {
    throw new Error("Choose a valid report resolution.");
  }

  // Admin moderation can touch the report record plus the live offer/request row.
  // The database function keeps those state changes together so content cannot be
  // marked removed in the queue while still staying live on the board.
  const { data: reviewRows, error: reviewError } = await supabase.rpc("review_listing_report", {
    p_report_id: input.reportId,
    p_request_id: input.requestId,
    p_offer_id: input.offerId ?? null,
    p_resolution: input.resolution,
    p_admin_note: adminNote,
  });

  if (reviewError || !reviewRows || reviewRows.length === 0) {
    throw new Error(reviewError?.message ?? "Unable to resolve this listing report right now.");
  }

  const reviewSummary = reviewRows[0] as {
    request_owner_id: string | null;
    offer_owner_id: string | null;
  };

  if (input.resolution === "removed" && input.offerId && reviewSummary.offer_owner_id) {
    await createNotification({
      profileId: reviewSummary.offer_owner_id,
      title: "Seller offer removed",
      body: "An admin removed one of your seller offers after a report review.",
      href: "/dashboard?tab=seller",
      preferenceKey: "moderation",
      sendEmail: true,
    });
    return;
  }

  if (input.resolution === "removed" && !input.offerId && reviewSummary.request_owner_id) {
    await createNotification({
      profileId: reviewSummary.request_owner_id,
      title: "Request removed from the board",
      body: "An admin removed one of your requests after a report review.",
      href: "/dashboard?tab=buyer",
      preferenceKey: "moderation",
      sendEmail: true,
    });
  }
}

export async function reportTransactionIssue(input: {
  transactionId: string;
  requestId: string;
  reason: DbDisputeRow["reason"];
  details: string;
  buyerEvidence?: string;
  buyerEvidenceImageUrls: string[];
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  assertRateLimit({
    scope: "dispute-create",
    actorKey: user.id,
    limit: 6,
    windowMs: 30 * 60 * 1000,
    message: "Too many reports were sent too quickly. Please wait a minute and try again.",
  });
  const details = requireTrimmedText({
    value: input.details,
    label: "Issue details",
    maxLength: requestWriteLimits.disputeDetails,
  });
  const buyerEvidence = normalizeOptionalText({
    value: input.buyerEvidence,
    label: "Buyer evidence",
    maxLength: requestWriteLimits.evidenceNotes,
  });
  limitStringArrayLength({
    values: input.buyerEvidenceImageUrls,
    maxItems: requestWriteLimits.maxImages,
    label: "Evidence photos",
  });

  if (!["wrong_item", "defective_item", "not_as_described", "shipping_issue", "other"].includes(input.reason)) {
    throw new Error("Choose a valid dispute reason.");
  }

  // One active dispute per transaction keeps payment holds and admin review readable.
  // If the buyer needs to add more evidence, it should go onto the same case instead.
  const { data: existingDisputeRows, error: existingDisputeError } = await supabase
    .from("disputes")
    .select("id")
    .eq("transaction_id", input.transactionId)
    .eq("buyer_id", user.id)
    .in("status", ["open", "under_review"])
    .limit(1);

  if (existingDisputeError) {
    throw new Error(existingDisputeError.message);
  }

  if ((existingDisputeRows ?? []).length > 0) {
    throw new Error("There is already an open issue on this order.");
  }

  const { data: disputeRows, error: disputeError } = await supabase.rpc("report_transaction_issue", {
    p_transaction_id: input.transactionId,
    p_request_id: input.requestId,
    p_buyer_id: user.id,
    p_reason: input.reason,
    p_details: details,
    p_buyer_evidence: buyerEvidence ?? null,
    p_buyer_evidence_images: input.buyerEvidenceImageUrls,
  });

  if (disputeError || !disputeRows || disputeRows.length === 0) {
    throw new Error(disputeError?.message ?? "Unable to report this issue right now.");
  }

  const disputeSummary = disputeRows[0] as {
    seller_id: string;
  };

  await createNotification({
    profileId: disputeSummary.seller_id,
    title: "Buyer reported an issue",
    body: "A buyer reported a problem with a completed order and funds are now on hold.",
    href: "/dashboard?tab=seller",
    preferenceKey: "disputes",
    sendEmail: true,
  });
}

export async function submitTransactionReview(input: {
  transactionId: string;
  requestId: string;
  rating: number;
  reviewText?: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  assertRateLimit({
    scope: "review-submit",
    actorKey: user.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
    message: "Too many reviews were sent too quickly. Please wait a minute and try again.",
  });

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Choose a rating from 1 to 5 stars.");
  }

  const reviewText = normalizeOptionalText({
    value: input.reviewText,
    label: "Review text",
    maxLength: requestWriteLimits.reviewText,
  });

  const { data: transactionRow, error: transactionError } = await supabase
    .from("transactions")
    .select("id, request_id, buyer_id, seller_id")
    .eq("id", input.transactionId)
    .single();

  if (transactionError || !transactionRow) {
    throw new Error(transactionError?.message ?? "Completed purchase not found.");
  }

  if (transactionRow.buyer_id !== user.id || transactionRow.request_id !== input.requestId) {
    throw new Error("Only the buyer on this purchase can leave a review.");
  }

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("transaction_id", input.transactionId)
    .maybeSingle();

  if (existingReview) {
    throw new Error("A review was already submitted for this completed order.");
  }

  const { error: reviewError } = await supabase.from("reviews").insert({
    transaction_id: input.transactionId,
    request_id: input.requestId,
    buyer_id: transactionRow.buyer_id,
    seller_id: transactionRow.seller_id,
    rating: input.rating,
    review_text: reviewText ?? null,
  });

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  await createNotification({
    profileId: transactionRow.seller_id,
    title: "New buyer review",
    body: `A buyer left a ${input.rating}-star review on a completed order.`,
    href: "/dashboard?tab=seller",
    preferenceKey: "offers_claims",
    sendEmail: true,
  });
}

export async function respondToDispute(input: {
  disputeId: string;
  response: string;
  sellerEvidence?: string;
  sellerEvidenceImageUrls: string[];
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedActor();
  await requireMarketplaceAccess();
  assertRateLimit({
    scope: "dispute-response",
    actorKey: user.id,
    limit: 10,
    windowMs: 30 * 60 * 1000,
    message: "Too many dispute responses were sent too quickly. Please wait a minute and try again.",
  });
  const response = requireTrimmedText({
    value: input.response,
    label: "Seller response",
    maxLength: requestWriteLimits.disputeDetails,
  });
  const sellerEvidence = normalizeOptionalText({
    value: input.sellerEvidence,
    label: "Seller evidence",
    maxLength: requestWriteLimits.evidenceNotes,
  });
  limitStringArrayLength({
    values: input.sellerEvidenceImageUrls,
    maxItems: requestWriteLimits.maxImages,
    label: "Evidence photos",
  });
  // The database function owns the case-state + payment-hold sequence so the dispute
  // never lands in a "seller responded but funds were not held" split state.
  const { data: disputeResponseRows, error: disputeResponseError } = await supabase.rpc("respond_to_dispute", {
    p_dispute_id: input.disputeId,
    p_seller_id: user.id,
    p_response: response,
    p_seller_evidence: sellerEvidence ?? null,
    p_seller_evidence_images: input.sellerEvidenceImageUrls,
  });

  if (disputeResponseError || !disputeResponseRows || disputeResponseRows.length === 0) {
    throw new Error(disputeResponseError?.message ?? "Unable to respond to this dispute right now.");
  }

  const disputeResponse = disputeResponseRows[0] as {
    buyer_id: string;
  };

  if (disputeResponse?.buyer_id) {
    await createNotification({
      profileId: disputeResponse.buyer_id,
      title: "Seller responded to your dispute",
      body: "The seller added a response and the case remains under review.",
      href: "/dashboard?tab=buyer",
      preferenceKey: "disputes",
      sendEmail: true,
    });
  }
}

export async function resolveDispute(input: {
  disputeId: string;
  resolution: "resolved_buyer" | "resolved_seller" | "closed";
  resolutionNote: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  await requireAdminActionReviewer();
  const resolutionNote = requireTrimmedText({
    value: input.resolutionNote,
    label: "Resolution note",
    maxLength: requestWriteLimits.adminNote,
  });

  if (!["resolved_buyer", "resolved_seller", "closed"].includes(input.resolution)) {
    throw new Error("Choose a valid dispute resolution.");
  }

  const { data: resolutionRows, error: resolutionError } = await supabase.rpc("resolve_dispute_case", {
    p_dispute_id: input.disputeId,
    p_resolution: input.resolution,
    p_resolution_note: resolutionNote,
  });

  if (resolutionError || !resolutionRows || resolutionRows.length === 0) {
    throw new Error(resolutionError?.message ?? "Unable to resolve this dispute right now.");
  }

  const disputeActors = resolutionRows[0] as {
    buyer_id: string | null;
    seller_id: string | null;
  };

  if (disputeActors?.buyer_id) {
    await createNotification({
      profileId: disputeActors.buyer_id,
      title: "Dispute resolved",
      body: `An admin resolved your dispute: ${resolutionNote}`,
      href: "/dashboard?tab=buyer",
      preferenceKey: "disputes",
      sendEmail: true,
    });
  }

  if (disputeActors?.seller_id) {
    await createNotification({
      profileId: disputeActors.seller_id,
      title: "Dispute resolved",
      body: `An admin resolved a buyer dispute: ${resolutionNote}`,
      href: "/dashboard?tab=seller",
      preferenceKey: "disputes",
      sendEmail: true,
    });
  }
}
