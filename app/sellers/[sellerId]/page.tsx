import Link from "next/link";
import { notFound } from "next/navigation";
import { getOptionalCurrentProfile } from "@/lib/auth";
import { getPublicSellerProfile } from "@/lib/requests";

function getRatingTone(rating: number) {
  if (rating < 2) {
    return "text-rose-700";
  }

  if (rating < 4) {
    return "text-amber-700";
  }

  return "text-[var(--foreground)]";
}

type SellerProfilePageProps = {
  params: Promise<{
    sellerId: string;
  }>;
};

export default async function SellerProfilePage({ params }: SellerProfilePageProps) {
  const { sellerId } = await params;
  const [seller, profile] = await Promise.all([getPublicSellerProfile(sellerId), getOptionalCurrentProfile()]);

  if (!seller) {
    notFound();
  }

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Public seller profile</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{seller.sellerName}</h1>
            <p className="mt-3 text-base leading-8 text-[var(--ink-soft)]">
              Seller based in {seller.publicLocation}. Member since {seller.memberSinceLabel}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
              {seller.phoneVerified ? (
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-medium text-teal-950">Phone verified</span>
              ) : (
                <span className="rounded-full border border-stone-200 px-3 py-1">Phone not verified</span>
              )}
            </div>
          </div>
          <div className="data-card rounded-[1.1rem] p-5 md:min-w-72">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-teal-900">Seller snapshot</p>
            <p className="mt-4 text-sm leading-7 text-teal-950/85">
              Use a request, offer, or completed-order context to start a new conversation with this seller. Existing message threads still stay in the inbox.
            </p>
            {profile?.role === "admin" ? (
              <div className="mt-3 rounded-[1rem] border border-dashed border-teal-900/20 bg-white px-3 py-3 text-xs leading-6 text-teal-950/80">
                Admin note: if you need to reach this member directly, start the outreach thread from the Messages inbox admin search.
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-sm text-teal-950/80">Seller rating</p>
                <p className={`text-3xl font-semibold ${getRatingTone(seller.sellerRating)}`}>{seller.sellerRating.toFixed(1)} / 5</p>
                <p className="text-xs text-teal-950/75">{seller.reviewCount} buyer review{seller.reviewCount === 1 ? "" : "s"}</p>
              </div>
              <div>
                <p className="text-sm text-teal-950/80">Claim fulfillment rate</p>
                <p className="text-2xl font-semibold text-teal-950">{seller.shippedWithinWindowRate}%</p>
                <p className="text-xs text-teal-950/75">Shipped inside agreed claim window</p>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="data-card rounded-[1rem] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Review count</p>
            <p className="mt-2 text-3xl font-semibold">{seller.reviewCount}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Completed-order reviews left by buyers.</p>
          </div>
          <div className="data-card rounded-[1rem] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Completed shipments</p>
            <p className="mt-2 text-3xl font-semibold">{seller.completedShipments}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Orders this seller has marked complete.</p>
          </div>
          <div className="data-card rounded-[1rem] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Recent offers</p>
            <p className="mt-2 text-3xl font-semibold">{seller.recentOfferCount}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Recent marketplace activity from this seller.</p>
          </div>
          <div className="data-card rounded-[1rem] p-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Followers</p>
            <p className="mt-2 text-3xl font-semibold">{seller.followerCount}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Members who want to keep tabs on this seller.</p>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Trust details</p>
            <h2 className="mt-2 text-2xl font-semibold">What buyers can quickly check</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Completed shipments</p>
                <p className="mt-2 text-3xl font-semibold">{seller.completedShipments}</p>
              </div>
              <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">On-time shipments</p>
                <p className="mt-2 text-3xl font-semibold">{seller.onTimeShipments}</p>
              </div>
              <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Recent offers</p>
                <p className="mt-2 text-3xl font-semibold">{seller.recentOfferCount}</p>
              </div>
              <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Followers</p>
                <p className="mt-2 text-3xl font-semibold">{seller.followerCount}</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--ink-soft)]">
              BuyerBoard shows city/state instead of full address, tracks whether sellers ship inside their claim windows, and lets buyers review completed orders.
            </p>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Recent buyer reviews</p>
            <h2 className="mt-2 text-2xl font-semibold">Public feedback on completed orders</h2>
            <div className="mt-5 grid gap-3">
              {seller.recentReviews.length > 0 ? (
                seller.recentReviews.map((review) => (
                  <div key={review.id} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`font-semibold ${getRatingTone(review.rating)}`}>{review.ratingLabel}</p>
                      <span className="text-xs text-stone-500">{review.createdLabel}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">From {review.buyerName}</p>
                    {review.reviewText ? <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{review.reviewText}</p> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-stone-300 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                  No buyer reviews yet. Completed orders will start building this public profile.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="outline-button tight-button text-sm font-medium transition" href="/requests">
            Back to request board
          </Link>
          <Link className="brand-hero-button tight-button text-sm font-medium" href="/dashboard">
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
