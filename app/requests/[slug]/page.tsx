import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageStrip } from "@/app/components/image-strip";
import { NegotiationTimeline, buildNegotiationTimeline, getOfferCurrentState } from "@/app/components/negotiation-timeline";
import { getOptionalCurrentProfile } from "@/lib/auth";
import { getRelationshipStatus } from "@/lib/community";
import { formatOfferPriceDeltaLabel, getSellerOffersForRequest, getWantedRequestBySlug, isDemoMode } from "@/lib/requests";
import {
  blockSeller,
  followSeller,
  startSellerMessage,
  submitListingReport,
  submitSellerResponse,
  unfollowSeller,
  unblockSeller,
} from "./actions";
import { ListingReportForm } from "./listing-report-form";
import { OfferReportForm } from "./offer-report-form";
import { SellerResponseForm } from "./seller-response-form";

function getRatingTone(rating: number) {
  if (rating < 2) {
    return "text-rose-700";
  }

  if (rating < 4) {
    return "text-amber-700";
  }

  return "text-[var(--foreground)]";
}

type RequestDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    created?: string;
    responded?: string;
    reported?: string;
    notice?: string;
    error?: string;
    sort?: string;
  }>;
};

type OfferSortKey = "best_value" | "lowest_price" | "highest_rating" | "fastest_claim";

const offerSortOptions: Array<{ key: OfferSortKey; label: string }> = [
  { key: "best_value", label: "Best overall" },
  { key: "lowest_price", label: "Lowest price" },
  { key: "highest_rating", label: "Highest rating" },
  { key: "fastest_claim", label: "Fastest lead time" },
];

function sortOffers(sortKey: OfferSortKey, offers: Awaited<ReturnType<typeof getSellerOffersForRequest>>) {
  return [...offers].sort((a, b) => {
    if (sortKey === "lowest_price") {
      return a.offeredPrice - b.offeredPrice || b.sellerRating - a.sellerRating;
    }

    if (sortKey === "highest_rating") {
      return b.sellerRating - a.sellerRating || a.offeredPrice - b.offeredPrice;
    }

    if (sortKey === "fastest_claim") {
      return a.proposedClaimWindowHours - b.proposedClaimWindowHours || a.offeredPrice - b.offeredPrice;
    }

    const aScore = a.sellerRating * 18 + a.shippedWithinWindowRate * 0.5 + a.sellerReviewCount * 0.35 - a.offeredPrice * 0.05 - a.proposedClaimWindowHours * 0.12;
    const bScore = b.sellerRating * 18 + b.shippedWithinWindowRate * 0.5 + b.sellerReviewCount * 0.35 - b.offeredPrice * 0.05 - b.proposedClaimWindowHours * 0.12;
    return bScore - aScore;
  });
}

function getRequestHeaderStats(request: NonNullable<Awaited<ReturnType<typeof getWantedRequestBySlug>>>, offerCount: number) {
  return [
    {
      label: "Buyer target",
      value: request.budgetLabel,
      detail: "The buyer's current target price.",
    },
    {
      label: "Shipping",
      value: request.shipping,
      detail: "How the buyer wants fulfillment handled.",
    },
    {
      label: "Live offers",
      value: offerCount.toString(),
      detail: offerCount > 0 ? "Sellers are already responding." : "No seller offers yet.",
    },
    {
      label: "Photos",
      value: request.imageUrls.length > 0 ? `${request.imageUrls.length}` : "None",
      detail: request.imageUrls.length > 0 ? "Buyer included photos." : "Photo still needed.",
    },
  ];
}

export default async function RequestDetailPage({ params, searchParams }: RequestDetailPageProps) {
  const { slug } = await params;
  const { created, responded, reported, notice, error, sort } = await searchParams;
  const request = await getWantedRequestBySlug(slug);

  if (!request) {
    notFound();
  }

  const offers = await getSellerOffersForRequest(request.id);
  const activeSort: OfferSortKey = offerSortOptions.some((option) => option.key === sort) ? (sort as OfferSortKey) : "best_value";
  const sortedOffers = sortOffers(activeSort, offers);
  const leadOffer = sortedOffers[0];
  const lowestOffer = offers.length > 0 ? [...offers].sort((a, b) => a.offeredPrice - b.offeredPrice)[0] : undefined;
  const highestRatedOffer = offers.length > 0 ? [...offers].sort((a, b) => b.sellerRating - a.sellerRating || b.sellerReviewCount - a.sellerReviewCount)[0] : undefined;
  const fastestOffer = offers.length > 0 ? [...offers].sort((a, b) => a.proposedClaimWindowHours - b.proposedClaimWindowHours || a.offeredPrice - b.offeredPrice)[0] : undefined;
  const demoMode = isDemoMode();
  const hasConversation = offers.length > 0;
  const requestHeaderStats = getRequestHeaderStats(request, offers.length);
  const profile = await getOptionalCurrentProfile();
  const sellerIds = [...new Set(sortedOffers.map((offer) => offer.sellerId).filter((sellerId): sellerId is string => Boolean(sellerId)))];
  const sellerRelationships = new Map(
    await Promise.all(
      sellerIds.map(async (sellerId) => [
        sellerId,
        profile && profile.id !== sellerId ? await getRelationshipStatus(sellerId) : { isFollowing: false, isBlocked: false },
      ] as const),
    ),
  );

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        {created ? (
          <div className="mb-6 rounded-[1.5rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
            Request created successfully.
          </div>
        ) : null}

        {responded ? (
          <div className="mb-6 rounded-[1.5rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
            Seller response sent. The buyer can review it now.
          </div>
        ) : null}

        {reported ? (
          <div className="mb-6 rounded-[1.5rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
            Listing report submitted for review.
          </div>
        ) : null}

        {notice ? (
          <div className="mb-6 rounded-[1.5rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-[1.5rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
            {error}
          </div>
        ) : null}

        {demoMode ? (
          <div className="mb-6 rounded-[1.5rem] border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
            Demo mode is active on this request.
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
          <section className="modern-card rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
              <span>{request.category}</span>
              <span>/</span>
              <span>{request.subcategory}</span>
              <span>/</span>
              <span>{request.location}</span>
              <span>/</span>
              <span>{request.postedLabel}</span>
            </div>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold sm:text-4xl">{request.title}</h1>
                <p className="mt-3 text-base leading-8 text-[var(--ink-soft)]">{request.summary}</p>
              </div>
              <span className="status-pill status-pill-accent">{request.status}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {requestHeaderStats.map((stat) => (
                <div key={stat.label} className="data-card rounded-[1rem] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">{stat.label}</p>
                  <p className="mt-2 text-lg font-semibold">{stat.value}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{stat.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="data-card rounded-[1.5rem] p-5 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Request snapshot</p>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
              <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
                <p className="font-medium text-[var(--foreground)]">Status</p>
                <p className="mt-1">{request.status}</p>
              </div>
              <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
                <p className="font-medium text-[var(--foreground)]">Shipping</p>
                <p className="mt-1">{request.shipping}</p>
              </div>
              <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
                <p className="font-medium text-[var(--foreground)]">Posted</p>
                <p className="mt-1">{request.postedLabel}</p>
              </div>
              <div className="rounded-[1rem] border border-black/8 bg-white/80 px-4 py-3">
                <p className="font-medium text-[var(--foreground)]">Location</p>
                <p className="mt-1">{request.location}</p>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
          <section className="modern-card rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Request details</p>
                <h2 className="mt-2 text-2xl font-semibold">What the buyer needs</h2>
              </div>
              {request.tags.length > 0 ? <span className="soft-chip">{request.tags.length} tags</span> : null}
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{request.details}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
              {request.tags.map((tag, index) => (
                <span key={`${tag}-${index}`} className="soft-chip-muted">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="modern-card rounded-[1.5rem] p-5 sm:p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Photos</p>
            <h2 className="mt-2 text-2xl font-semibold">Buyer reference images</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Photos help sellers judge condition and fit before they respond.
            </p>
            {request.imageUrls.length > 0 ? (
              <div className="mt-4">
                <ImageStrip imageUrls={request.imageUrls} altPrefix={request.title} />
              </div>
            ) : (
              <div className="empty-state mt-4 rounded-[1rem]">
                No buyer photos yet. Sellers may need to ask follow-up questions before making their best offer.
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <section className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Buyer notes</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{request.summary}</p>
            <div className="empty-state mt-6 rounded-[1rem]">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Claim approval rule</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Sellers send an offer first. The buyer decides whether to accept, deny, or counter.
              </p>
            </div>
            <ListingReportForm action={submitListingReport} requestId={request.id} slug={request.slug} />
          </section>

        <aside className="rounded-[1.15rem] border border-[var(--hero)]/10 bg-[var(--hero)] p-5 text-stone-50 shadow-[0_14px_36px_rgba(18,101,144,0.18)]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-teal-200">Seller actions</p>
            <h2 className="mt-3 text-2xl font-semibold">Start the negotiation</h2>
            <p className="mt-3 text-sm leading-7 text-teal-50/90">
              Send your price, your timing, and anything the buyer should know.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                disabled={!hasConversation}
                className={`rounded-full px-5 py-3 text-sm font-medium transition ${
                  hasConversation ? "bg-white text-stone-900 hover:bg-stone-200" : "cursor-not-allowed bg-white/15 text-white/60"
                }`}
              >
                {hasConversation ? "Buyer review in progress" : "Claim review begins after the first offer"}
              </button>
            </div>
            <div className="mt-4 rounded-[1rem] border border-white/12 bg-white/8 px-4 py-3 text-sm leading-7 text-teal-50/90">
              If your offer is approved and funded, it moves into your active claims queue.
            </div>
            <SellerResponseForm
              action={submitSellerResponse}
              requestId={request.id}
              slug={request.slug}
              hasExistingConversation={hasConversation}
              sellerDisplayName={profile?.displayName ?? null}
            />
          </aside>
        </div>

        {leadOffer ? (
          <section className="modern-card mt-8 rounded-[1.75rem] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Offer compare</p>
                <h2 className="mt-2 text-2xl font-semibold">Current lead offer</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Compare price, trust, and lead time before choosing a seller.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {offerSortOptions.map((option) => (
                  <Link
                    key={option.key}
                    href={`/requests/${request.slug}?sort=${option.key}`}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      activeSort === option.key
                        ? "brand-button"
                        : "ghost-action"
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Lead seller</p>
                    <p className="mt-1 text-2xl font-semibold">{leadOffer.sellerName}</p>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-teal-950">
                    Sorted by {offerSortOptions.find((option) => option.key === activeSort)?.label.toLowerCase()}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Offer</p>
                    <p className="mt-2 text-lg font-semibold">{leadOffer.offeredPriceLabel}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {leadOffer.priceDeltaLabel ?? formatOfferPriceDeltaLabel(leadOffer.offeredPrice, request.targetBudget)}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Claim window</p>
                    <p className="mt-2 text-sm font-medium">{leadOffer.proposedClaimWindowHours} hours</p>
                  </div>
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Seller rating</p>
                    <p className={`mt-2 text-lg font-semibold ${getRatingTone(leadOffer.sellerRating)}`}>{leadOffer.sellerRating.toFixed(1)} / 5</p>
                    <p className="mt-1 text-xs text-stone-500">{leadOffer.sellerReviewCount} review{leadOffer.sellerReviewCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Fulfillment rate</p>
                    <p className="mt-2 text-lg font-semibold">{leadOffer.shippedWithinWindowRate}%</p>
                    <p className="mt-1 text-xs text-stone-500">On-time claim completion</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {leadOffer.sellerId ? (
                    <>
                      <Link className="brand-button rounded-full px-4 py-2 text-sm font-medium" href={`/sellers/${leadOffer.sellerId}`}>
                        Open seller profile
                      </Link>
                      <form action={startSellerMessage}>
                        <input type="hidden" name="memberId" value={leadOffer.sellerId} />
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="slug" value={request.slug} />
                        <input type="hidden" name="requestTitle" value={request.title} />
                        <button className="ghost-action">
                          Message seller
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Quick compare</p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3">
                    <p className="text-sm text-stone-500">Lowest price</p>
                    <p className="mt-1 font-semibold">{lowestOffer?.offeredPriceLabel ?? "No offers yet"}</p>
                    {lowestOffer ? <p className="mt-1 text-sm text-[var(--ink-soft)]">{lowestOffer.sellerName}</p> : null}
                    {lowestOffer ? (
                      <p className="mt-1 text-xs text-stone-500">
                        {lowestOffer.priceDeltaLabel ?? formatOfferPriceDeltaLabel(lowestOffer.offeredPrice, request.targetBudget)}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3">
                    <p className="text-sm text-stone-500">Highest rating</p>
                    <p className={`mt-1 font-semibold ${highestRatedOffer ? getRatingTone(highestRatedOffer.sellerRating) : ""}`}>
                      {highestRatedOffer ? `${highestRatedOffer.sellerRating.toFixed(1)} / 5` : "No offers yet"}
                    </p>
                    {highestRatedOffer ? <p className="mt-1 text-sm text-[var(--ink-soft)]">{highestRatedOffer.sellerName}</p> : null}
                  </div>
                  <div className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3">
                    <p className="text-sm text-stone-500">Fastest claim window</p>
                    <p className="mt-1 font-semibold">{fastestOffer ? `${fastestOffer.proposedClaimWindowHours} hours` : "No offers yet"}</p>
                    {fastestOffer ? <p className="mt-1 text-sm text-[var(--ink-soft)]">{fastestOffer.sellerName}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="modern-card mt-8 rounded-[1.75rem] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Seller offers</p>
              <h2 className="mt-2 text-2xl font-semibold">Compare live seller offers</h2>
            </div>
            <p className="text-sm text-[var(--ink-soft)]">{sortedOffers.length} active offer(s)</p>
          </div>

          <div className="mt-5 grid max-h-[52rem] gap-4 overflow-y-auto pr-1">
            {sortedOffers.length > 0 ? (
              sortedOffers.map((offer, index) => {
                const currentState = getOfferCurrentState(offer.status);
                const priceDeltaLabel = offer.priceDeltaLabel ?? formatOfferPriceDeltaLabel(offer.offeredPrice, request.targetBudget);
                const timelineItems = buildNegotiationTimeline({
                  request,
                  offer,
                  priceDeltaLabel,
                });

                return (
                <div key={offer.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                        {index === 0 ? "Lead offer" : `Offer ${index + 1}`} / {offer.sellerName}
                      </p>
                      <p className="mt-1 text-xl font-semibold">{offer.offeredPriceLabel}</p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">{priceDeltaLabel}</p>
                    </div>
                    <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-teal-950">
                      {offer.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{offer.message}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Offer</p>
                      <p className="mt-2 text-lg font-semibold">{offer.offeredPriceLabel}</p>
                    </div>
                    <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Claim window</p>
                      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{offer.proposedClaimWindowHours} hours</p>
                    </div>
                    <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Seller rating</p>
                      <p className={`mt-2 text-lg font-semibold ${getRatingTone(offer.sellerRating)}`}>{offer.sellerRating.toFixed(1)} / 5</p>
                      <p className="mt-1 text-xs text-stone-500">{offer.sellerReviewCount} review{offer.sellerReviewCount === 1 ? "" : "s"}</p>
                    </div>
                    <div className="rounded-[1rem] border border-stone-200 bg-white px-3 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Fulfillment rate</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{offer.shippedWithinWindowRate}%</p>
                      <p className="mt-1 text-xs text-stone-500">Shipped inside claim window</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-stone-700 md:grid-cols-2">
                    <p>{offer.claimLabel}</p>
                    <p>{offer.etaLabel}</p>
                  </div>
                  <NegotiationTimeline
                    currentStateLabel={currentState.label}
                    currentStateDetail={currentState.detail}
                    items={timelineItems}
                    requestHref={`/requests/${request.slug}`}
                  />
                  <ImageStrip imageUrls={offer.imageUrls} altPrefix={`${offer.sellerName} offer photo`} />
                  <OfferReportForm action={submitListingReport} requestId={request.id} slug={request.slug} offerId={offer.id} />
                  {offer.sellerId && profile?.id !== offer.sellerId ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/sellers/${offer.sellerId}`}
                        className="ghost-action"
                      >
                        View seller profile
                      </Link>
                      <form action={startSellerMessage}>
                        <input type="hidden" name="memberId" value={offer.sellerId} />
                        <input type="hidden" name="requestId" value={request.id} />
                        <input type="hidden" name="slug" value={request.slug} />
                        <input type="hidden" name="requestTitle" value={request.title} />
                        <button className="brand-button rounded-full px-4 py-2 text-sm font-medium">Message seller</button>
                      </form>
                      {sellerRelationships.get(offer.sellerId)?.isFollowing ? (
                        <form action={unfollowSeller}>
                          <input type="hidden" name="memberId" value={offer.sellerId} />
                          <input type="hidden" name="slug" value={request.slug} />
                          <button className="ghost-action">
                            Unfollow
                          </button>
                        </form>
                      ) : (
                        <form action={followSeller}>
                          <input type="hidden" name="memberId" value={offer.sellerId} />
                          <input type="hidden" name="slug" value={request.slug} />
                          <button className="ghost-action">
                            Follow
                          </button>
                        </form>
                      )}
                      {sellerRelationships.get(offer.sellerId)?.isBlocked ? (
                        <form action={unblockSeller}>
                          <input type="hidden" name="memberId" value={offer.sellerId} />
                          <input type="hidden" name="slug" value={request.slug} />
                          <button className="danger-action">
                            Unblock
                          </button>
                        </form>
                      ) : (
                        <form action={blockSeller}>
                          <input type="hidden" name="memberId" value={offer.sellerId} />
                          <input type="hidden" name="slug" value={request.slug} />
                          <button className="danger-action">
                            Block
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}
                </div>
                );
              })
            ) : (
              <div className="empty-state rounded-[1rem]">
                No live offers yet. The first seller response will start the conversation and introduce a proposed claim window.
              </div>
            )}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="ghost-action px-5 py-3" href="/requests">
            Back to request board
          </Link>
          <Link className="brand-hero-button rounded-full px-5 py-3 text-sm font-medium" href="/requests/new">
            Post another request
          </Link>
        </div>
      </div>
    </main>
  );
}
