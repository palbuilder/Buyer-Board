export const requestStatuses = [
  "open",
  "negotiating",
  "claimed",
  "fulfilled",
  "closed",
] as const;

export type RequestStatus = (typeof requestStatuses)[number];

export type WantedRequest = {
  id: string;
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  imageUrls: string[];
  targetBudget: number;
  budgetLabel: string;
  status: RequestStatus;
  location: string;
  shipping: string;
  summary: string;
  details: string;
  tags: string[];
  buyerName: string;
  needsFreshnessConfirmation: boolean;
  freshnessConfirmationLabel?: string;
  missedFreshnessChecks: number;
  createdAt: string;
  postedLabel: string;
};

export type SellerOffer = {
  id: string;
  requestId: string;
  requestSlug?: string;
  requestTitle?: string;
  requestBudgetLabel?: string;
  requestPostedLabel?: string;
  sellerId?: string;
  sellerName: string;
  imageUrls: string[];
  sellerRating: number;
  sellerReviewCount: number;
  shippedWithinWindowRate: number;
  offeredPrice: number;
  offeredPriceLabel: string;
  priceDeltaLabel?: string;
  message: string;
  etaLabel: string;
  proposedClaimWindowHours: number;
  claimLabel: string;
  status: "pending" | "accepted" | "declined" | "countered";
  createdAt?: string;
  createdLabel?: string;
  timelineMessages?: NegotiationTimelineMessage[];
};

export type RelationshipStatus = {
  isFollowing: boolean;
  isBlocked: boolean;
  hasActiveBlock: boolean;
  blockedByOtherMember: boolean;
};

export type DirectThreadSummary = {
  threadId: string;
  otherMemberId: string;
  otherMemberName: string;
  lastMessagePreview: string;
  updatedLabel: string;
  lastMessageDirection?: "sent" | "received";
};

export type DirectMessageCandidate = {
  memberId: string;
  displayName: string;
  subtitle: string;
};

export type NegotiationOfferHistoryItem = {
  id: string;
  offeredPriceLabel: string;
  claimWindowLabel: string;
  statusLabel: string;
  createdLabel: string;
};

export type NegotiationTimelineMessage = {
  id: string;
  senderId: string;
  actorLabel: "Buyer" | "Seller";
  body: string;
  createdAt: string;
  createdLabel: string;
};

export type DirectNegotiationContext = {
  requestId: string;
  requestSlug: string;
  requestTitle: string;
  buyerId: string;
  sellerId: string;
  latestOfferStatus: SellerOffer["status"];
  latestOfferPriceLabel: string;
  latestOfferPriceDeltaLabel?: string;
  latestClaimWindowLabel: string;
  latestOfferStatusLabel: string;
  shippingLabel: string;
  locationLabel: string;
  history: NegotiationOfferHistoryItem[];
};

export type NegotiationTimelineItem = {
  id: string;
  actorLabel: "Buyer" | "Seller" | "System";
  title: string;
  detail: string;
  timestampLabel: string;
  priceLabel?: string;
  priceDeltaLabel?: string;
  claimWindowLabel?: string;
  statusLabel?: string;
  isCurrent?: boolean;
};

export type DirectMessageItem = {
  id: string;
  senderId: string;
  body: string;
  createdLabel: string;
  moderationState: "clean" | "flagged" | "reviewed";
};

export type ActiveClaim = {
  claimId: string;
  requestId: string;
  requestSlug: string;
  requestTitle: string;
  sellerId: string;
  sellerName: string;
  approvedOfferId: string;
  approvedOfferLabel: string;
  approvedOfferCents: number;
  expiresAt: string;
  timerLabel: string;
  timerState: "active" | "expired";
  paymentStatus: "awaiting_payment" | "funded" | "on_hold" | "released" | "refunded" | "completed";
  paymentLabel: string;
};

export type SellerPerformance = {
  sellerRating: number;
  reviewCount: number;
  shippedWithinWindowRate: number;
  completedShipments: number;
  onTimeShipments: number;
};

export type SellerReviewSnippet = {
  id: string;
  buyerName: string;
  rating: number;
  ratingLabel: string;
  reviewText: string | undefined;
  createdLabel: string;
};

export type CompletedPurchase = {
  transactionId: string;
  requestId: string;
  requestSlug: string;
  requestTitle: string;
  sellerId: string;
  sellerName: string;
  finalPriceLabel: string;
  completedLabel: string;
  issueStatus: "none" | "open" | "under_review" | "resolved_buyer" | "resolved_seller" | "closed";
  issueReason: string | undefined;
  issueDetails: string | undefined;
  issueEvidence: string | undefined;
  issueImageUrls: string[];
  reviewId: string | undefined;
  reviewRating: number | undefined;
  reviewText: string | undefined;
};

export type PublicSellerProfile = {
  sellerId: string;
  sellerName: string;
  publicLocation: string;
  accountType: "individual" | "business";
  planTier: "free" | "premium" | "business";
  sellerRating: number;
  reviewCount: number;
  shippedWithinWindowRate: number;
  completedShipments: number;
  onTimeShipments: number;
  recentOfferCount: number;
  followerCount: number;
  phoneVerified: boolean;
  memberSinceLabel: string;
  recentReviews: SellerReviewSnippet[];
};

export type SellerIssue = {
  disputeId: string;
  requestId: string;
  requestSlug: string;
  requestTitle: string;
  reasonLabel: string;
  details: string;
  buyerEvidence: string | undefined;
  buyerEvidenceImageUrls: string[];
  statusLabel: string;
  createdLabel: string;
  sellerResponse: string | undefined;
  sellerEvidence: string | undefined;
  sellerEvidenceImageUrls: string[];
};

export type AdminDispute = {
  disputeId: string;
  transactionId: string;
  requestId: string;
  requestSlug: string;
  requestTitle: string;
  buyerId: string;
  sellerId: string;
  reasonLabel: string;
  details: string;
  buyerEvidence: string | undefined;
  buyerEvidenceImageUrls: string[];
  sellerResponse: string | undefined;
  sellerEvidence: string | undefined;
  sellerEvidenceImageUrls: string[];
  statusLabel: string;
  createdLabel: string;
  paymentStatus: string;
};

export type AdminListingReport = {
  reportId: string;
  requestId: string;
  requestSlug: string;
  requestTitle: string;
  reportTarget: "request" | "offer";
  offerId?: string;
  offerSellerName?: string;
  reportedById: string;
  reasonLabel: string;
  details: string;
  imageUrls: string[];
  statusLabel: string;
  createdLabel: string;
  adminNote: string | undefined;
};

export type PhoneVerificationRequest = {
  status: "none" | "requested" | "approved" | "rejected";
  phoneNumber: string;
  createdLabel: string | undefined;
  reviewNote: string | undefined;
};

export type MemberTrustAppeal = {
  status: "none" | "open" | "approved" | "rejected";
  memberMessage: string;
  adminNote: string | undefined;
  createdLabel: string | undefined;
  reviewedLabel: string | undefined;
};

export type AdminPhoneVerificationRequest = {
  requestId: string;
  profileId: string;
  memberEmail: string;
  memberName: string;
  phoneNumber: string;
  status: "requested" | "approved" | "rejected";
  createdLabel: string;
  reviewNote: string | undefined;
};

export type AdminTrustMember = {
  profileId: string;
  displayName: string;
  email: string;
  accountType: "individual" | "business";
  planTier: "free" | "premium" | "business";
  accountStatus: "active" | "flagged" | "suspended";
  phoneVerified: boolean;
  payoutReady: boolean;
  completedSales: number;
  disputeCount: number;
  flaggedMessageCount: number;
  submittedReportCount: number;
  disputeRateLabel: string;
  riskLabel: "Low risk" | "Moderate risk" | "High risk";
  adminRiskNote: string | undefined;
  warningHistory: TrustHistoryEntry[];
};

export type TrustHistoryEntry = {
  id: string;
  eventLabel: string;
  note: string;
  createdLabel: string;
};

export type AdminTrustAppeal = {
  appealId: string;
  profileId: string;
  memberEmail: string;
  memberName: string;
  accountStatus: "active" | "flagged" | "suspended";
  memberMessage: string;
  status: "open" | "approved" | "rejected";
  createdLabel: string;
  adminNote: string | undefined;
  reviewedLabel: string | undefined;
};

export type AdminFlaggedMessage = {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  recipientName: string;
  body: string;
  createdLabel: string;
  reviewNote: string | undefined;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | undefined;
  read: boolean;
  createdAt: string;
  createdLabel: string;
};

export type NotificationPreferenceKey =
  | "watchlist"
  | "offers_claims"
  | "disputes"
  | "trust_safety"
  | "moderation";

export type NotificationPreferences = {
  watchlist: boolean;
  offersClaims: boolean;
  disputes: boolean;
  trustSafety: boolean;
  moderation: boolean;
  emailOptIn: boolean;
};

export type SavedRequestFilter = {
  id: string;
  name: string;
  searchQuery: string;
  category: string;
  subcategory: string;
  shipping: string;
  status: string;
  sort: string;
  alertEnabled: boolean;
};

export type MarketplaceTrendItem = {
  label: string;
  category: string;
  subcategory: string;
  requestCount: number;
  offerCount: number;
};

export type MarketplaceHighlights = {
  newestRequests: WantedRequest[];
  topRequestedItems: MarketplaceTrendItem[];
  topOfferMagnetItems: MarketplaceTrendItem[];
  openRequestCount: number;
  activeOfferCount: number;
};

export type BuyerDashboardSummary = {
  requestCount: number;
  pendingOfferCount: number;
  activeClaimCount: number;
  completedPurchaseCount: number;
};

export type SellerDashboardSummary = {
  sentOfferCount: number;
  pendingOfferCount: number;
  activeClaimCount: number;
  openIssueCount: number;
  sellerRating: number;
  fulfillmentRate: number;
};

export type DailyRequestDigestItem = {
  requestId: string;
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  location: string;
  targetBudget: number;
  budgetLabel: string;
  shipping: string;
  status: string;
  postedLabel: string;
  offerCount: number;
};

export type DailyRequestDigest = {
  generatedAt: string;
  sinceHours: number;
  filters: {
    category?: string;
    subcategory?: string;
    state?: string;
  };
  totalNewRequests: number;
  totalMatchingRequests: number;
  totalOffersOnMatchingRequests: number;
  requests: DailyRequestDigestItem[];
};

export type SellerOpportunityFeed = {
  generatedAt: string;
  filters: {
    category?: string;
    subcategory?: string;
    state?: string;
    minBudget?: number;
  };
  totalMatches: number;
  averageBudget: number;
  flexibleShippingCount: number;
  negotiatingCount: number;
  hotCategories: Array<{
    category: string;
    requestCount: number;
  }>;
  requests: DailyRequestDigestItem[];
};

export type WebhookSubscription = {
  id: string;
  endpointUrl: string;
  eventTypes: string[];
  isActive: boolean;
  createdLabel: string;
  lastDeliveryLabel?: string;
  lastError?: string;
};

export type SellerDigestSubscription = {
  id: string;
  name: string;
  label: string;
  category?: string;
  subcategory?: string;
  state?: string;
  minBudget?: number;
  sinceHours: number;
  isActive: boolean;
  deliveryEnabled: boolean;
  lastDeliveredLabel?: string;
  createdLabel: string;
};
