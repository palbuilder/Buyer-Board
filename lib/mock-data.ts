import type { SellerOffer, WantedRequest } from "@/lib/types";

export const wantedRequests: WantedRequest[] = [
  {
    id: "req_1",
    slug: "stihl-ms-261-chainsaw",
    title: "Stihl MS 261 chainsaw",
    category: "Tools",
    subcategory: "Lawn Equipment",
    imageUrls: [],
    targetBudget: 425,
    budgetLabel: "$425 target",
    status: "open",
    location: "Pittsburgh, PA",
    shipping: "Ship only",
    summary: "Looking for a clean homeowner or light pro saw before spring cleanup starts.",
    details:
      "Buyer wants a running Stihl MS 261 with bar and chain included. Cosmetic wear is fine, but no cracked case, stripped threads, or major compression issues.",
    tags: ["Tools", "Lawn Equipment", "open"],
    buyerName: "Mason R.",
    needsFreshnessConfirmation: false,
    freshnessConfirmationLabel: undefined,
    missedFreshnessChecks: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    postedLabel: "2 hours ago",
  },
  {
    id: "req_2",
    slug: "apple-watch-ultra-2",
    title: "Apple Watch Ultra 2",
    category: "Electronics",
    subcategory: "Wearables",
    imageUrls: [],
    targetBudget: 540,
    budgetLabel: "$540 max",
    status: "negotiating",
    location: "Columbus, OH",
    shipping: "Any",
    summary: "Prefer black titanium or a bundle with extra band.",
    details:
      "Buyer is flexible on cosmetic condition but wants battery health in good shape and no activation lock. Original charger is a plus.",
    tags: ["Electronics", "Wearables", "negotiating"],
    buyerName: "Kiera T.",
    needsFreshnessConfirmation: false,
    freshnessConfirmationLabel: undefined,
    missedFreshnessChecks: 0,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    postedLabel: "5 hours ago",
  },
  {
    id: "req_3",
    slug: "toyota-tacoma-tailgate-2018",
    title: "2018 Toyota Tacoma tailgate",
    category: "Auto Parts",
    subcategory: "Body",
    imageUrls: [],
    targetBudget: 300,
    budgetLabel: "$300 target",
    status: "claimed",
    location: "Nashville, TN",
    shipping: "Any",
    summary: "Silver preferred, but any straight tailgate works.",
    details:
      "Vehicle fitment: 2018 Toyota Tacoma. Buyer needs a straight tailgate with hinge hardware intact. Paint mismatch is acceptable. Seller must confirm dents, rust, and latch condition before shipment.",
    tags: ["Auto Parts", "Body", "claimed"],
    buyerName: "Devon L.",
    needsFreshnessConfirmation: false,
    freshnessConfirmationLabel: undefined,
    missedFreshnessChecks: 0,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    postedLabel: "1 day ago",
  },
];

export const sellerOffers: SellerOffer[] = [
  {
    id: "offer_1",
    requestId: "req_2",
    sellerName: "WatchCycle Co.",
    imageUrls: [],
    sellerRating: 4.8,
    sellerReviewCount: 18,
    shippedWithinWindowRate: 96,
    offeredPrice: 565,
    offeredPriceLabel: "$565 shipped",
    message:
      "Black titanium, light bezel wear, original charger included. I can hold this claim for 36 hours while I source and pack it.",
    etaLabel: "Buyer review pending",
    proposedClaimWindowHours: 36,
    claimLabel: "Proposed claim window: 36 hours, pending buyer approval",
    status: "pending",
  },
  {
    id: "offer_2",
    requestId: "req_3",
    sellerName: "MidSouth Parts",
    imageUrls: [],
    sellerRating: 4.9,
    sellerReviewCount: 42,
    shippedWithinWindowRate: 98,
    offeredPrice: 320,
    offeredPriceLabel: "$320 freight quote pending",
    message: "Straight tailgate with latch hardware intact. Paint has scratches but no major dents.",
    etaLabel: "Claim approved and packing now",
    proposedClaimWindowHours: 48,
    claimLabel: "Claim approved for 48 hours",
    status: "accepted",
  },
];

export function getRequestBySlug(slug: string) {
  return wantedRequests.find((request) => request.slug === slug);
}

export function getOffersForRequest(requestId: string) {
  return sellerOffers.filter((offer) => offer.requestId === requestId);
}
