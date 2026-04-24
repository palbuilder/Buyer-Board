import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPhoneVerificationRequest, getCurrentProfile, getSellerTrustGate, requireCurrentUser } from "@/lib/auth";
import { ImageStrip } from "@/app/components/image-strip";
import { getCurrentNotificationPreferences, getCurrentNotifications } from "@/lib/notifications";
import { formatStoredUsPhoneNumber } from "@/lib/phone";
import { hasEmailDeliveryEnv } from "@/lib/email/config";
import { usStateOptions } from "@/lib/us-states";
import type { CompletedPurchase, SellerIssue } from "@/lib/types";
import { getSellerDigestSubscriptions, getSellerOpportunityFeed } from "@/lib/integrations";
import { saveNotificationPreferences, sendTestNotificationEmail } from "@/app/notifications/actions";
import { PurchaseIssueForm } from "./purchase-issue-form";
import { PurchaseReviewForm } from "./purchase-review-form";
import { SellerDisputeResponseForm } from "./seller-dispute-response-form";
import { PhoneVerificationPanel } from "./phone-verification-panel";
import {
  acceptClaimOffer,
  beginClaimCheckout,
  confirmBuyerRequestFreshness,
  completeClaimShipment,
  counterClaimOffer,
  denyClaimOffer,
  saveMemberProfile,
  startBuyerBillingSetup,
  startSellerPayoutOnboarding,
  submitPurchaseIssue,
  submitPurchaseReview,
  submitSellerDisputeResponse,
  submitPhoneVerificationRequest,
  submitTrustAppeal,
  addWebhookSubscription,
  removeWebhookSubscription,
  toggleSellerDigestDelivery,
  toggleWebhookSubscription,
} from "./actions";
import { getBuyerDashboardData, getBuyerDashboardSummary, getCurrentTrustAppeal, getSellerDashboardData, getSellerDashboardSummary, syncBuyerBillingSetup, syncClaimCheckoutPayment, syncSellerPayoutStatus } from "@/lib/requests";

type DashboardPageProps = {
  searchParams: Promise<{
    tab?: string;
    notice?: string;
    error?: string;
    checkout?: string;
    billing_setup?: string;
    stripe_connect?: string;
    request_id?: string;
    session_id?: string;
    intelCategory?: string;
    intelSubcategory?: string;
    intelState?: string;
    intelMinBudget?: string;
    intelSinceHours?: string;
  }>;
};

const statusLabels: Record<string, string> = {
  pending: "Awaiting buyer review",
  accepted: "Accepted by buyer",
  declined: "Denied by buyer",
  countered: "Countered by buyer",
};

function getRatingTone(rating: number) {
  if (rating < 2) {
    return "text-rose-700";
  }

  if (rating < 4) {
    return "text-amber-700";
  }

  return "text-[var(--foreground)]";
}

function sortOfferCards<T extends { offeredPrice: number; sellerRating: number; sellerReviewCount: number; shippedWithinWindowRate: number; proposedClaimWindowHours: number }>(
  offers: T[],
) {
  return [...offers].sort((a, b) => {
    const aScore = a.sellerRating * 18 + a.shippedWithinWindowRate * 0.5 + a.sellerReviewCount * 0.35 - a.offeredPrice * 0.05 - a.proposedClaimWindowHours * 0.12;
    const bScore = b.sellerRating * 18 + b.shippedWithinWindowRate * 0.5 + b.sellerReviewCount * 0.35 - b.offeredPrice * 0.05 - b.proposedClaimWindowHours * 0.12;
    return bScore - aScore;
  });
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await requireCurrentUser("/dashboard");
  const allSearchParams = await searchParams;
  const { tab, notice, error } = allSearchParams;
  const shouldFinalizeCheckout =
    allSearchParams.checkout === "success" &&
    typeof allSearchParams.request_id === "string" &&
    typeof allSearchParams.session_id === "string";
  const shouldFinalizeBillingSetup =
    allSearchParams.billing_setup === "success" &&
    typeof allSearchParams.session_id === "string";
  const shouldSyncSellerPayout = allSearchParams.stripe_connect === "return";

  if (shouldFinalizeCheckout) {
    const requestId = allSearchParams.request_id as string;
    const sessionId = allSearchParams.session_id as string;
    const checkoutNotice = "Buyer funding confirmed";
    try {
      await syncClaimCheckoutPayment({
        requestId,
        sessionId,
      });
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : "Unable to confirm buyer funding.";
      redirect(`/dashboard?tab=buyer&error=${encodeURIComponent(message)}`);
    }
    redirect(`/dashboard?tab=buyer&notice=${encodeURIComponent(checkoutNotice)}`);
  }

  if (shouldFinalizeBillingSetup) {
    const sessionId = allSearchParams.session_id as string;
    const billingNotice = "Buyer billing profile connected";
    try {
      await syncBuyerBillingSetup({ sessionId });
    } catch (billingError) {
      const message = billingError instanceof Error ? billingError.message : "Unable to confirm buyer billing setup.";
      redirect(`/dashboard?error=${encodeURIComponent(message)}`);
    }
    redirect(`/dashboard?notice=${encodeURIComponent(billingNotice)}`);
  }

  if (shouldSyncSellerPayout) {
    let payoutNotice = "Seller payouts updated";
    try {
      const syncResult = await syncSellerPayoutStatus();
      payoutNotice = syncResult.notice;
    } catch (payoutError) {
      const message = payoutError instanceof Error ? payoutError.message : "Unable to confirm seller payout onboarding.";
      redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
    }
    redirect(`/dashboard?tab=seller&notice=${encodeURIComponent(payoutNotice)}`);
  }

  const activeTab = tab === "seller" ? "seller" : "buyer";
  const localSeedApplyReady = process.env.NODE_ENV !== "production" && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const intelCategory = typeof allSearchParams.intelCategory === "string" ? allSearchParams.intelCategory.trim() : "";
  const intelSubcategory = typeof allSearchParams.intelSubcategory === "string" ? allSearchParams.intelSubcategory.trim() : "";
  const intelState = typeof allSearchParams.intelState === "string" ? allSearchParams.intelState.trim() : "";
  const intelMinBudget = typeof allSearchParams.intelMinBudget === "string" ? allSearchParams.intelMinBudget.trim() : "";
  const intelSinceHours = typeof allSearchParams.intelSinceHours === "string" ? allSearchParams.intelSinceHours.trim() : "24";
  const parsedIntelMinBudget = Number.parseInt(intelMinBudget, 10);
  const parsedIntelSinceHours = Number.parseInt(intelSinceHours, 10);
  const profile = await getCurrentProfile();
  const [
    phoneVerification,
    sellerTrustGate,
    notifications,
    notificationPreferences,
    trustAppeal,
    buyerSummary,
    sellerSummary,
    buyerData,
    sellerData,
    sellerOpportunities,
    sellerDigestSubscriptions,
  ] = await Promise.all([
    getCurrentPhoneVerificationRequest(),
    getSellerTrustGate(profile?.id),
    getCurrentNotifications(4, "/dashboard"),
    getCurrentNotificationPreferences(),
    profile
      ? getCurrentTrustAppeal(profile.id)
      : Promise.resolve({
          status: "none" as const,
          memberMessage: "",
          adminNote: undefined,
          createdLabel: undefined,
          reviewedLabel: undefined,
        }),
    // The page already performed the redirect-safe auth check above, so the
    // nested dashboard loaders can reuse this actor id instead of throwing a raw
    // "Sign in required" server error during tab switches.
    activeTab === "buyer"
      ? getBuyerDashboardSummary(currentUser.id)
      : Promise.resolve({
          requestCount: 0,
          pendingOfferCount: 0,
          activeClaimCount: 0,
          completedPurchaseCount: 0,
        }),
    activeTab === "seller"
      ? getSellerDashboardSummary(currentUser.id)
      : Promise.resolve({
          sentOfferCount: 0,
          pendingOfferCount: 0,
          activeClaimCount: 0,
          openIssueCount: 0,
          sellerRating: 0,
          fulfillmentRate: 0,
        }),
    activeTab === "buyer"
      ? getBuyerDashboardData(currentUser.id)
      : Promise.resolve({
          requests: [],
          offersByRequest: [],
          activeClaims: [],
          completedPurchases: [],
        }),
    activeTab === "seller"
      ? getSellerDashboardData(currentUser.id)
      : Promise.resolve({
          sentOffers: [],
          activeClaims: [],
          performance: {
            sellerRating: 0,
            reviewCount: 0,
            shippedWithinWindowRate: 0,
            completedShipments: 0,
            onTimeShipments: 0,
          },
          recentReviews: [],
          openIssues: [],
        }),
    activeTab === "seller"
      ? getSellerOpportunityFeed({
          category: intelCategory || undefined,
          subcategory: intelSubcategory || undefined,
          state: intelState || undefined,
          minBudget: Number.isFinite(parsedIntelMinBudget) ? parsedIntelMinBudget : undefined,
          sinceHours: Number.isFinite(parsedIntelSinceHours) ? parsedIntelSinceHours : 24,
        })
      : Promise.resolve({
          generatedAt: "",
          filters: {},
          totalMatches: 0,
          averageBudget: 0,
          flexibleShippingCount: 0,
          negotiatingCount: 0,
          hotCategories: [],
          requests: [],
        }),
    activeTab === "seller" ? getSellerDigestSubscriptions(currentUser.id) : Promise.resolve([]),
  ]);
  const formattedProfilePhone = formatStoredUsPhoneNumber(profile?.phoneNumber ?? "");
  const emailDeliveryReady = hasEmailDeliveryEnv();
  const completedPurchases = (buyerData.completedPurchases ?? []).filter(
    (purchase): purchase is CompletedPurchase => purchase != null,
  );
  const shippingProfileReady = Boolean(
    profile?.shippingName &&
      profile.shippingAddressLine1 &&
      profile.shippingCity &&
      profile.shippingState &&
      profile.shippingPostalCode,
  );
  const publicLocationReady = Boolean(profile?.publicLocation);
  const buyerBillingReady = Boolean(profile?.stripeCustomerReady);
  const sellerPayoutReady = Boolean(profile?.payoutReady);
  const phoneReady = Boolean(profile?.phoneVerified);
  const emailReady = Boolean(profile?.email);
  const buyerAccountReadinessComplete =
    emailReady && phoneReady && shippingProfileReady && publicLocationReady && buyerBillingReady && sellerPayoutReady;
  const sellerIssues = (sellerData.openIssues ?? []).filter(
    (issue): issue is SellerIssue => issue != null,
  );
  const buyerOfferCards = buyerData.offersByRequest.flatMap(({ request, offers }) =>
    offers.map((offer) => ({
      request,
      offer,
    })),
  );
  const sortedBuyerOfferCards = [
    ...buyerOfferCards.filter(({ offer }) => offer.status === "pending"),
    ...buyerOfferCards.filter(({ offer }) => offer.status === "countered"),
    ...buyerOfferCards.filter(({ offer }) => offer.status === "accepted"),
    ...buyerOfferCards.filter(({ offer }) => offer.status === "declined"),
  ];
  const bestOverallBuyerOffer = sortOfferCards(buyerOfferCards.map((entry) => entry.offer))[0];
  const cheapestBuyerOffer = buyerOfferCards.length > 0 ? [...buyerOfferCards].sort((left, right) => left.offer.offeredPrice - right.offer.offeredPrice)[0] : undefined;
  const fastestBuyerOffer = buyerOfferCards.length > 0 ? [...buyerOfferCards].sort((left, right) => left.offer.proposedClaimWindowHours - right.offer.proposedClaimWindowHours || left.offer.offeredPrice - right.offer.offeredPrice)[0] : undefined;
  const pendingOfferCount = buyerOfferCards.filter(({ offer }) => offer.status === "pending").length;
  const counteredOfferCount = buyerOfferCards.filter(({ offer }) => offer.status === "countered").length;
  const acceptedOfferCount = buyerOfferCards.filter(({ offer }) => offer.status === "accepted").length;
  const declinedOfferCount = buyerOfferCards.filter(({ offer }) => offer.status === "declined").length;

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Member dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Switch between buying and selling.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Use buyer mode when you need something. Use seller mode when you want to respond and fulfill.
            </p>
          </div>
          <Link className="brand-hero-button rounded-full px-5 py-3 text-sm font-medium" href="/requests/new">
            Post a request
          </Link>
        </div>

        {notice ? (
          <div className="mt-6 rounded-[1.5rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
            {error}
          </div>
        ) : null}

        {profile?.role === "admin" ? (
          <div className="mt-6 modern-card rounded-[1.5rem] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Admin queues</p>
                <h2 className="mt-2 text-2xl font-semibold">Moderation shortcuts</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Unsafe or dangerous request reports land in listing reports. Trust reviews and disputes stay in their own admin queues.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link className="ghost-action" href="/admin/reports">
                  Listing reports
                </Link>
                <Link className="ghost-action" href="/admin/disputes">
                  Dispute queue
                </Link>
                <Link className="ghost-action" href="/admin/trust">
                  Trust queue
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {profile?.accountStatus === "flagged" ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-400/80 bg-rose-100 px-4 py-3 text-sm font-medium leading-7 text-rose-950">
            Warning / probation: this account is under trust review. Some actions, including seller payouts, may be temporarily limited.
          </div>
        ) : null}

        {profile?.accountStatus === "suspended" ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-500/80 bg-rose-200 px-4 py-3 text-sm font-medium leading-7 text-rose-950">
            This account is suspended from marketplace activity until an admin clears the trust review.
          </div>
        ) : null}

        {profile && profile.accountStatus !== "active" ? (
          <div className="mt-6 modern-card rounded-[1.5rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Appeals and reinstatement</p>
            <h2 className="mt-2 text-2xl font-semibold">Ask for a second review</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              If you think this warning or suspension should be reconsidered, send a short explanation for review.
            </p>
            {trustAppeal?.status !== "none" ? (
              <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                <p>
                  Latest appeal status: <span className="font-medium capitalize text-[var(--foreground)]">{trustAppeal.status}</span>
                </p>
                {trustAppeal.createdLabel ? <p className="mt-2">Submitted {trustAppeal.createdLabel}.</p> : null}
                <p className="mt-2">{trustAppeal.memberMessage}</p>
                {trustAppeal.adminNote ? <p className="mt-2">Admin note: {trustAppeal.adminNote}</p> : null}
                {trustAppeal.reviewedLabel ? <p className="mt-2">Reviewed {trustAppeal.reviewedLabel}.</p> : null}
              </div>
            ) : null}
            {trustAppeal?.status !== "open" ? (
              <form action={submitTrustAppeal} className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm font-medium">
                  Your appeal
                  <textarea
                    name="memberMessage"
                    className="min-h-28 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                    placeholder="Explain why the account should be restored and what you will do differently."
                  />
                </label>
                <button className="brand-button w-fit rounded-full px-5 py-3 text-sm font-medium">Submit appeal</button>
              </form>
            ) : (
              <p className="mt-4 text-sm leading-7 text-stone-500">
                An appeal is already waiting in the admin review queue. You do not need to send another one yet.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-6 modern-card rounded-[1.5rem] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Notifications</p>
              <h2 className="mt-2 text-2xl font-semibold">Recent updates</h2>
            </div>
            <p className="text-sm text-[var(--ink-soft)]">Use the top-right bell to clear or delete notifications without leaving this page.</p>
          </div>
          <div className="mt-4 grid gap-3">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{notification.title}</p>
                    <span className={`status-pill ${notification.read ? "status-pill-neutral" : "status-pill-accent"}`}>
                      {notification.read ? "Read" : "New"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{notification.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                    <span>{notification.createdLabel}</span>
                    {notification.href ? (
                      <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={notification.href}>
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state rounded-[1rem]">
                No account notifications yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard?tab=buyer"
            className={`rounded-full px-5 py-3 text-sm font-medium transition ${activeTab === "buyer" ? "brand-button" : "brand-outline border hover:bg-white/60"}`}
          >
            Buyer tab
          </Link>
          <Link
            href="/dashboard?tab=seller"
            className={`rounded-full px-5 py-3 text-sm font-medium transition ${activeTab === "seller" ? "brand-button" : "brand-outline border hover:bg-white/60"}`}
          >
            Seller tab
          </Link>
        </div>

        {activeTab === "buyer" ? (
          <section className="mt-8 grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Your requests</p>
                <p className="mt-2 text-3xl font-semibold">{buyerSummary.requestCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Open, negotiating, claimed, and fulfilled requests tied to your account.</p>
              </div>
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Waiting on you</p>
                <p className="mt-2 text-3xl font-semibold">{buyerSummary.pendingOfferCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Seller claim offers still waiting on your accept, deny, or counter.</p>
              </div>
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Active claims</p>
                <p className="mt-2 text-3xl font-semibold">{buyerSummary.activeClaimCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Approved seller holds that are still live and being worked.</p>
              </div>
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Completed purchases</p>
                <p className="mt-2 text-3xl font-semibold">{buyerSummary.completedPurchaseCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Past funded orders that can be reviewed or reported if needed.</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="modern-card rounded-[1.75rem] p-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Buyer profile</p>
                <h2 className="mt-2 text-2xl font-semibold">Saved shipping details</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Save the shipping details you want the app to use at checkout. Public request pages still only show your safer city and state.
                </p>
                <p className="mt-2 text-xs leading-6 text-stone-500">
                  If your browser already knows your address, it can usually autofill these shipping fields as you type.
                </p>
                <form action={saveMemberProfile} className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Display name
                    <input
                      name="displayName"
                      defaultValue={profile?.displayName ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="Jordan Smith"
                      autoComplete="name"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Public location
                    <input
                      name="publicLocation"
                      defaultValue={profile?.publicLocation ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="Atlanta, GA"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Full shipping name
                    <input
                      name="shippingName"
                      defaultValue={profile?.shippingName ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="Jordan Smith"
                      autoComplete="shipping name"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Phone number
                    <input
                      name="phoneNumber"
                      defaultValue={formattedProfilePhone}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="555-555-5555"
                      autoComplete="tel-national"
                      inputMode="tel"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium md:col-span-2">
                    Shipping street address
                    <input
                      name="shippingAddressLine1"
                      defaultValue={profile?.shippingAddressLine1 ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="123 Main St"
                      autoComplete="shipping address-line1"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium md:col-span-2">
                    Address line 2
                    <input
                      name="shippingAddressLine2"
                      defaultValue={profile?.shippingAddressLine2 ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="Suite, unit, or building"
                      autoComplete="shipping address-line2"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    City
                    <input
                      name="shippingCity"
                      defaultValue={profile?.shippingCity ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="Atlanta"
                      autoComplete="shipping address-level2"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    State
                    <select
                      name="shippingState"
                      defaultValue={profile?.shippingState ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      autoComplete="shipping address-level1"
                    >
                      <option value="">Choose state</option>
                      {usStateOptions.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.value} - {state.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    ZIP code
                    <input
                      name="shippingPostalCode"
                      defaultValue={profile?.shippingPostalCode ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="30303"
                      autoComplete="shipping postal-code"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Business name (optional)
                    <input
                      name="businessName"
                      defaultValue={profile?.businessName ?? ""}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                      placeholder="Example: River City Auto Parts"
                    />
                    <span className="text-xs leading-6 text-stone-500">Leave this blank if you sell as an individual instead of under a business name.</span>
                  </label>
                  <div className="md:col-span-2">
                    <button className="brand-button rounded-full px-5 py-3 text-sm font-medium">Save profile</button>
                  </div>
                </form>

                <div id="notification-settings" className="mt-6 border-t border-black/8 pt-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Notification settings</p>
                      <h3 className="mt-2 text-xl font-semibold">Choose which updates follow you</h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        These controls now live with your account settings so your alert choices stay next to the rest of your saved profile details.
                      </p>
                      <p className="mt-2 text-xs leading-6 text-stone-500">
                        Email delivery status: {emailDeliveryReady ? "Ready once you opt in below." : "Email alerts are not connected yet."}
                      </p>
                    </div>
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">Use the bell in the top bar for in-place inbox cleanup.</p>
                  </div>

                  {emailDeliveryReady ? (
                    <form action={sendTestNotificationEmail} className="mt-4">
                      <input type="hidden" name="returnTo" value="/dashboard?tab=buyer#notification-settings" />
                      <button className="outline-button rounded-xl px-4 py-2 text-sm font-medium">
                        Send test email
                      </button>
                    </form>
                  ) : null}

                  <form action={saveNotificationPreferences} className="mt-5 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="returnTo" value="/dashboard?tab=buyer#notification-settings" />
                    <label className="subtle-panel inline-flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm">
                      <input type="checkbox" name="watchlist" defaultChecked={notificationPreferences.watchlist} className="h-4 w-4" />
                      Watchlist matches
                    </label>
                    <label className="subtle-panel inline-flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm">
                      <input type="checkbox" name="offersClaims" defaultChecked={notificationPreferences.offersClaims} className="h-4 w-4" />
                      Claim offers and buyer decisions
                    </label>
                    <label className="subtle-panel inline-flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm">
                      <input type="checkbox" name="disputes" defaultChecked={notificationPreferences.disputes} className="h-4 w-4" />
                      Disputes and issue updates
                    </label>
                    <label className="subtle-panel inline-flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm">
                      <input type="checkbox" name="trustSafety" defaultChecked={notificationPreferences.trustSafety} className="h-4 w-4" />
                      Trust reviews, phone verification, and appeals
                    </label>
                    <label className="subtle-panel inline-flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm">
                      <input type="checkbox" name="moderation" defaultChecked={notificationPreferences.moderation} className="h-4 w-4" />
                      Listing or offer moderation decisions
                    </label>
                    <label className="subtle-panel inline-flex items-center gap-3 rounded-[1rem] px-4 py-3 text-sm">
                      <input type="checkbox" name="emailOptIn" defaultChecked={notificationPreferences.emailOptIn} className="h-4 w-4" />
                      Send important alerts by email
                    </label>
                    <div className="sm:col-span-2">
                      <button className="brand-button tight-button text-sm font-medium">Save notification settings</button>
                    </div>
                  </form>
                </div>
              </div>

                {!buyerAccountReadinessComplete ? (
                  <div className="modern-card rounded-[1.75rem] p-5">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Account readiness</p>
                    <h2 className="mt-2 text-2xl font-semibold">Finish your setup</h2>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                      Complete these items once so checkout and seller tools are ready when you need them.
                    </p>
                    <div className="mt-5 space-y-3">
                      <div className={`rounded-[1.25rem] border p-4 text-sm leading-7 ${emailReady ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-[var(--ink-soft)]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>Email on account</p>
                          <span className={`status-pill ${emailReady ? "status-pill-accent" : "status-pill-neutral"}`}>
                            {emailReady ? "Ready" : "Missing"}
                          </span>
                        </div>
                        <p className="mt-2">{profile?.email || "No email found yet."}</p>
                      </div>

                      <div className={`rounded-[1.25rem] border p-4 text-sm leading-7 ${phoneReady ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-[var(--ink-soft)]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>Phone verification</p>
                          <span className={`status-pill ${phoneReady ? "status-pill-accent" : "status-pill-neutral"}`}>
                            {phoneReady ? "Ready" : "Needs action"}
                          </span>
                        </div>
                        <p className="mt-2">
                          {phoneReady
                            ? "Verified by SMS"
                            : phoneVerification.status === "requested"
                              ? "Manual review requested and waiting for review"
                              : phoneVerification.status === "rejected"
                                ? "Manual review rejected, update number and resubmit"
                                : "Not verified yet"}
                        </p>
                        <div className="mt-3">
                          <PhoneVerificationPanel
                            initialPhoneNumber={profile?.phoneNumber || phoneVerification.phoneNumber}
                            phoneVerified={phoneReady}
                          />
                        </div>
                        {!phoneReady ? (
                          <form action={submitPhoneVerificationRequest} className="mt-4 flex flex-wrap gap-2">
                            <input
                              name="phoneNumber"
                              defaultValue={formatStoredUsPhoneNumber(profile?.phoneNumber || phoneVerification.phoneNumber)}
                              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                              placeholder="555-555-5555"
                              autoComplete="tel-national"
                              inputMode="tel"
                            />
                            <button className="ghost-action">
                              Request manual review instead
                            </button>
                          </form>
                        ) : null}
                        {phoneVerification.reviewNote ? <p className="mt-2">{phoneVerification.reviewNote}</p> : null}
                        {!phoneReady ? (
                          <p className="mt-3 text-xs leading-6 text-stone-500">
                            Seller claim offers and payout setup stay locked until your phone is verified. SMS is the fastest route. Manual review remains available as a fallback.
                          </p>
                        ) : null}
                      </div>

                      <div className={`rounded-[1.25rem] border p-4 text-sm leading-7 ${buyerBillingReady ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-[var(--ink-soft)]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>Buyer billing profile</p>
                          <span className={`status-pill ${buyerBillingReady ? "status-pill-accent" : "status-pill-neutral"}`}>
                            {buyerBillingReady ? "Ready" : "Needs action"}
                          </span>
                        </div>
                        <p className="mt-2">{buyerBillingReady ? "Ready for platform checkout" : "Not connected yet"}</p>
                        <form action={startBuyerBillingSetup} className="mt-3">
                          <button className="ghost-action">
                            {buyerBillingReady ? "Update billing setup" : "Connect billing profile"}
                          </button>
                        </form>
                      </div>

                      <div className={`rounded-[1.25rem] border p-4 text-sm leading-7 ${sellerPayoutReady ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-[var(--ink-soft)]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>Seller payouts</p>
                          <span className={`status-pill ${sellerPayoutReady ? "status-pill-accent" : "status-pill-neutral"}`}>
                            {sellerPayoutReady ? "Ready" : "Needs action"}
                          </span>
                        </div>
                        <p className="mt-2">{sellerPayoutReady ? "Ready to receive payouts" : "Stripe onboarding not started yet"}</p>
                        <form action={startSellerPayoutOnboarding} className="mt-3">
                          <button
                            className="ghost-action disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!phoneReady || sellerTrustGate.payoutBlocked}
                          >
                            {sellerPayoutReady ? "Review payout setup" : "Set up seller payouts"}
                          </button>
                        </form>
                        {!phoneReady ? (
                          <p className="mt-2 text-xs leading-6 text-stone-500">Verify your phone first. Stripe can then continue with either individual-seller or business details.</p>
                        ) : sellerTrustGate.payoutBlocked ? (
                          <p className="mt-2 text-xs leading-6 text-rose-800">{sellerTrustGate.payoutReason}</p>
                        ) : (
                          <p className="mt-2 text-xs leading-6 text-stone-500">Individual sellers can keep business details blank. Stripe will still guide them through the right payout path.</p>
                        )}
                      </div>

                      <div className={`rounded-[1.25rem] border p-4 text-sm leading-7 ${shippingProfileReady ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-[var(--ink-soft)]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>Shipping profile</p>
                          <span className={`status-pill ${shippingProfileReady ? "status-pill-accent" : "status-pill-neutral"}`}>
                            {shippingProfileReady ? "Ready" : "Needs action"}
                          </span>
                        </div>
                        <p className="mt-2">
                          {shippingProfileReady
                            ? "Shipping details are saved for checkout and negotiations."
                            : "Add your shipping name and address so checkout is ready later."}
                        </p>
                      </div>

                      <div className={`rounded-[1.25rem] border p-4 text-sm leading-7 ${publicLocationReady ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-[var(--ink-soft)]"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p>Public location</p>
                          <span className={`status-pill ${publicLocationReady ? "status-pill-accent" : "status-pill-neutral"}`}>
                            {publicLocationReady ? "Ready" : "Needs action"}
                          </span>
                        </div>
                        <p className="mt-2">
                          {publicLocationReady
                            ? "Your public city and state are ready for request pages."
                            : "Add the city and state you want buyers and sellers to see publicly."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
            </div>

            <div className="modern-card rounded-[1.75rem] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Your listings</p>
              <h2 className="mt-2 text-2xl font-semibold">Buyer requests you are managing</h2>
              <div className="mt-5 grid gap-4">
                {buyerData.requests.map((request) => (
                  <div key={request.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                          {request.category} / {request.subcategory}
                        </p>
                        <p className="mt-1 text-xl font-semibold">{request.title}</p>
                      </div>
                      <span className="status-pill status-pill-accent">
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{request.summary}</p>
                    {request.needsFreshnessConfirmation ? (
                      <div className="mt-4 rounded-[1.25rem] border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
                        <p className="font-medium">{request.freshnessConfirmationLabel}</p>
                        <p className="mt-2">
                          Missed freshness confirmations: {request.missedFreshnessChecks} of 2.
                        </p>
                        <form action={confirmBuyerRequestFreshness} className="mt-3">
                          <input type="hidden" name="requestId" value={request.id} />
                          <button className="ghost-action">Yes, keep this request active</button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="modern-card rounded-[1.75rem] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Approved claims</p>
              <h2 className="mt-2 text-2xl font-semibold">Live claim windows currently running</h2>
              <div className="mt-5 grid gap-4">
                {buyerData.activeClaims.length > 0 ? (
                  buyerData.activeClaims.map((claim) => (
                    <div key={claim.claimId} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{claim.requestTitle}</p>
                          <p className="mt-1 text-xl font-semibold">{claim.approvedOfferLabel}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            claim.timerState === "active" ? "bg-[var(--accent-soft)] text-teal-950" : "bg-rose-100 text-rose-900"
                          }`}
                        >
                          {claim.timerLabel}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        Approved seller:{" "}
                        <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/sellers/${claim.sellerId}`}>
                          {claim.sellerName}
                        </Link>
                        . This request is currently in the seller&apos;s claim window.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                          {claim.paymentLabel}
                        </span>
                        {claim.paymentStatus === "awaiting_payment" ? (
                          <form action={beginClaimCheckout}>
                            <input type="hidden" name="requestId" value={claim.requestId} />
                            <button className="brand-button rounded-full px-4 py-2 text-sm font-medium">
                              Fund this order
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state rounded-[1rem]">
                    No approved claims are running yet.
                  </div>
                )}
              </div>
            </div>

            <div className="modern-card rounded-[1.75rem] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Claim offers</p>
              <h2 className="mt-2 text-2xl font-semibold">Compare offers and choose who gets the claim</h2>
              <div className="subtle-panel mt-4 rounded-[1rem] px-4 py-3">
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  Compare price, trust, and claim window first. When you accept one offer, that seller gets the claim hold and the next step is buyer funding.
                </p>
              </div>
              {buyerOfferCards.length > 0 ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Best overall</p>
                    <p className="mt-2 text-lg font-semibold">{bestOverallBuyerOffer?.offeredPriceLabel}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{bestOverallBuyerOffer?.sellerName ?? "No offers yet"}</p>
                    {bestOverallBuyerOffer ? (
                      <p className="mt-1 text-xs text-stone-500">
                        {bestOverallBuyerOffer.proposedClaimWindowHours}h claim window, {bestOverallBuyerOffer.shippedWithinWindowRate}% fulfillment
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Lowest price</p>
                    <p className="mt-2 text-lg font-semibold">{cheapestBuyerOffer?.offer.offeredPriceLabel ?? "No offers yet"}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{cheapestBuyerOffer ? `${cheapestBuyerOffer.offer.sellerName} on ${cheapestBuyerOffer.request.title}` : ""}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Fastest lead time</p>
                    <p className="mt-2 text-lg font-semibold">{fastestBuyerOffer ? `${fastestBuyerOffer.offer.proposedClaimWindowHours} hours` : "No offers yet"}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{fastestBuyerOffer ? `${fastestBuyerOffer.offer.sellerName} on ${fastestBuyerOffer.request.title}` : ""}</p>
                  </div>
                </div>
              ) : null}
              {buyerOfferCards.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="status-pill bg-[var(--hero)] text-white">
                    {pendingOfferCount} pending
                  </span>
                  <span className="soft-chip">
                    {counteredOfferCount} countered
                  </span>
                  <span className="soft-chip">
                    {acceptedOfferCount} accepted
                  </span>
                  <span className="soft-chip">
                    {declinedOfferCount} denied
                  </span>
                </div>
              ) : null}
              <div className="mt-5 grid max-h-[46rem] gap-4 overflow-y-auto pr-1">
                {sortedBuyerOfferCards.map(({ request, offer }) => (
                    <div key={offer.id} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{request.title}</p>
                          <p className="mt-1 text-xl font-semibold">{offer.offeredPriceLabel}</p>
                          {offer.sellerId ? (
                            <p className="mt-2 text-sm text-[var(--ink-soft)]">
                              Seller:{" "}
                              <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/sellers/${offer.sellerId}`}>
                                {offer.sellerName}
                              </Link>
                            </p>
                          ) : null}
                        </div>
                        <span className="status-pill status-pill-accent">
                          {statusLabels[offer.status] ?? offer.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{offer.message}</p>
                      {offer.status === "pending" ? (
                        <div className="mt-3 inline-flex rounded-full bg-[var(--hero)]/12 px-3 py-1 text-xs font-medium text-[var(--hero)]">
                          Waiting on your choice
                        </div>
                      ) : null}
                      {offer.status === "pending" || offer.status === "countered" ? (
                        <div className="subtle-panel mt-3 rounded-[1rem] px-3 py-2.5">
                          <p className="text-xs leading-6 text-[var(--ink-soft)]">
                            If you accept this offer, this seller gets the active claim and you will fund the order next.
                          </p>
                        </div>
                      ) : null}
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="soft-chip-muted">{offer.claimLabel}</span>
                        <span className="soft-chip-muted">{request.shipping}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {offer.sellerId ? (
                          <Link className="ghost-action" href={`/sellers/${offer.sellerId}`}>
                            View seller profile
                          </Link>
                        ) : null}
                        {offer.status !== "accepted" ? (
                          <form action={acceptClaimOffer}>
                            <input type="hidden" name="offerId" value={offer.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <button className="brand-button rounded-full px-4 py-2 text-sm font-medium">Accept and continue</button>
                          </form>
                        ) : null}
                        {offer.status !== "declined" ? (
                          <form action={denyClaimOffer}>
                            <input type="hidden" name="offerId" value={offer.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <button className="ghost-action">Deny claim</button>
                          </form>
                        ) : null}
                        {offer.status !== "accepted" ? (
                          <form action={counterClaimOffer} className="flex flex-wrap gap-2">
                            <input type="hidden" name="offerId" value={offer.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <input
                              name="buyerComment"
                              className="field-input"
                              placeholder="What do you want changed?"
                            />
                            <button className="ghost-action text-teal-800">Send counteroffer</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))}
                {buyerData.offersByRequest.every(({ offers }) => offers.length === 0) ? (
                  <div className="empty-state rounded-[1rem]">
                    No claim offers have been sent yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modern-card rounded-[1.75rem] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Completed purchases</p>
              <h2 className="mt-2 text-2xl font-semibold">Report wrong or defective items</h2>
              <div className="mt-5 grid gap-4">
                {completedPurchases.length > 0 ? (
                  completedPurchases.map((purchase) => (
                    <div key={purchase.transactionId} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{purchase.requestTitle}</p>
                          <p className="mt-1 text-xl font-semibold">{purchase.finalPriceLabel}</p>
                        </div>
                        <span className="status-pill status-pill-accent">
                          {purchase.issueStatus === "none" ? "No issue reported" : purchase.issueStatus.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">Completed {purchase.completedLabel}</p>
                      {purchase.issueStatus === "none" ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                            <p className="text-sm font-medium">Report a problem</p>
                            <PurchaseIssueForm action={submitPurchaseIssue} transactionId={purchase.transactionId} requestId={purchase.requestId} />
                          </div>
                          <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                            <p className="text-sm font-medium">Rate this seller</p>
                            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                              Seller:{" "}
                              <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/sellers/${purchase.sellerId}`}>
                                {purchase.sellerName}
                              </Link>
                            </p>
                            {purchase.reviewId ? (
                              <div className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                                <p className="font-medium text-[var(--foreground)]">
                                  Your rating: {purchase.reviewRating} / 5
                                </p>
                                {purchase.reviewText ? <p className="mt-2">{purchase.reviewText}</p> : null}
                              </div>
                            ) : (
                              <PurchaseReviewForm action={submitPurchaseReview} transactionId={purchase.transactionId} requestId={purchase.requestId} />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                          <p>{purchase.issueReason}</p>
                          <p className="mt-2">{purchase.issueDetails}</p>
                          {purchase.issueEvidence ? <p className="mt-2">Evidence: {purchase.issueEvidence}</p> : null}
                          <ImageStrip imageUrls={purchase.issueImageUrls} altPrefix={`${purchase.requestTitle} evidence`} />
                        </div>
                      )}
                      {purchase.issueStatus !== "none" && purchase.reviewId ? (
                        <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                          <p className="font-medium text-[var(--foreground)]">Your seller review</p>
                          <p className="mt-2">Rating: {purchase.reviewRating} / 5</p>
                          {purchase.reviewText ? <p className="mt-2">{purchase.reviewText}</p> : null}
                        </div>
                      ) : null}
                      {purchase.issueStatus !== "none" && !purchase.reviewId ? (
                        <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                          <p className="text-sm font-medium">Rate this seller</p>
                          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                            Seller:{" "}
                            <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/sellers/${purchase.sellerId}`}>
                              {purchase.sellerName}
                            </Link>
                          </p>
                          <PurchaseReviewForm action={submitPurchaseReview} transactionId={purchase.transactionId} requestId={purchase.requestId} />
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="empty-state rounded-[1rem]">
                    No completed purchases yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-2">
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Offers sent</p>
                <p className="mt-2 text-3xl font-semibold">{sellerSummary.sentOfferCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Every claim offer you have sent so far, whether the buyer accepted it, denied it, or countered it.</p>
              </div>
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Waiting on buyer</p>
                <p className="mt-2 text-3xl font-semibold">{sellerSummary.pendingOfferCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Offers that still need a buyer decision or a response to your latest terms.</p>
              </div>
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Active claims</p>
                <p className="mt-2 text-3xl font-semibold">{sellerSummary.activeClaimCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Approved orders you currently hold and still need to ship inside the claim window.</p>
              </div>
              <div className="modern-card rounded-[1.5rem] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Open issues</p>
                <p className="mt-2 text-3xl font-semibold">{sellerSummary.openIssueCount}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Buyer-reported problems that still need your response, evidence, or admin review.</p>
              </div>
            </div>

            <div className="modern-card rounded-[1.75rem] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Seller profile</p>
              <h2 className="mt-2 text-2xl font-semibold">Performance snapshot</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Seller rating</p>
                  <p className="mt-2 text-3xl font-semibold">{sellerSummary.sellerRating.toFixed(1)} / 5</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                    Based on {sellerData.performance.reviewCount} buyer review{sellerData.performance.reviewCount === 1 ? "" : "s"}.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Shipped in claim window</p>
                  <p className="mt-2 text-3xl font-semibold">{sellerSummary.fulfillmentRate}%</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-[var(--ink-soft)]">
                The strongest seller workflow is simple: send a clear offer, wait for the buyer to choose, then ship on time once the claim is approved and funded.
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Completed shipments: {sellerData.performance.completedShipments}. On-time shipments: {sellerData.performance.onTimeShipments}.
              </p>
              <div className="mt-5 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Recent buyer reviews</p>
                <div className="mt-3 grid gap-3">
                  {sellerData.recentReviews.length > 0 ? (
                    sellerData.recentReviews.map((review) => (
                      <div key={review.id} className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{review.ratingLabel}</p>
                          <span className="text-xs text-stone-500">{review.createdLabel}</span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--ink-soft)]">From {review.buyerName}</p>
                        {review.reviewText ? <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{review.reviewText}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">No buyer reviews yet. Completed orders will start building your public reputation here.</p>
                  )}
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {profile?.id ? (
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                    Public seller profile:{" "}
                    <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/sellers/${profile.id}`}>
                      View what buyers see
                    </Link>
                  </div>
                ) : null}
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                  Seller identity: {profile?.businessName ? profile.businessName : "Selling as an individual"}
                  <p className="mt-2 text-xs leading-6 text-stone-500">Business name is optional. Leaving it blank keeps seller setup on the individual path.</p>
                </div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-[var(--ink-soft)]">
                  Payout onboarding: {profile?.payoutReady ? "Ready for seller payouts" : "Needs Stripe setup"}
                  <form action={startSellerPayoutOnboarding} className="mt-3">
                    <button className="ghost-action disabled:cursor-not-allowed disabled:opacity-60" disabled={!phoneReady || sellerTrustGate.payoutBlocked}>
                      {profile?.payoutReady ? "Review payout setup" : "Set up seller payouts"}
                    </button>
                  </form>
                  {!phoneReady ? (
                    <p className="mt-2 text-xs leading-6 text-stone-500">Phone verification unlocks this step first.</p>
                  ) : sellerTrustGate.payoutBlocked ? (
                    <p className="mt-2 text-xs leading-6 text-rose-800">{sellerTrustGate.payoutReason}</p>
                  ) : (
                    <p className="mt-2 text-xs leading-6 text-stone-500">Stripe supports both individual and business sellers in this flow.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="modern-card rounded-[1.75rem] p-5 lg:col-span-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Seller intelligence</p>
                  <h2 className="mt-2 text-2xl font-semibold">Find the best requests to source next</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    This is the first groundwork for business sellers. You can filter demand and start thinking in terms of daily pull lists, sourcing runs, and category-specific opportunity feeds.
                  </p>
                </div>
                <span className="soft-chip">
                  Built for future paid seller tools
                </span>
              </div>

              <form method="GET" action="/dashboard" className="mt-5 grid gap-3 lg:grid-cols-5">
                <input type="hidden" name="tab" value="seller" />
                <label className="grid gap-2 text-sm font-medium">
                  Category
                  <input
                    name="intelCategory"
                    defaultValue={intelCategory}
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                    placeholder="Auto Parts"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Subcategory
                  <input
                    name="intelSubcategory"
                    defaultValue={intelSubcategory}
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                    placeholder="Engine"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  State
                  <select name="intelState" defaultValue={intelState} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <option value="">All states</option>
                    {usStateOptions.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.value} - {state.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Minimum budget
                  <input
                    name="intelMinBudget"
                    defaultValue={intelMinBudget}
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                    placeholder="250"
                    inputMode="numeric"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Look back
                  <select name="intelSinceHours" defaultValue={intelSinceHours} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <option value="24">Last 24 hours</option>
                    <option value="48">Last 48 hours</option>
                    <option value="72">Last 72 hours</option>
                    <option value="168">Last 7 days</option>
                  </select>
                </label>
                <div className="lg:col-span-5 flex flex-wrap gap-3">
                  <button className="brand-button rounded-full px-5 py-3 text-sm font-medium">Refresh seller feed</button>
                  <Link className="ghost-action px-5 py-3" href="/dashboard?tab=seller">
                    Clear filters
                  </Link>
                  <Link
                    className="ghost-action px-5 py-3"
                    href={`/api/market/opportunities/export?category=${encodeURIComponent(intelCategory)}&subcategory=${encodeURIComponent(
                      intelSubcategory,
                    )}&state=${encodeURIComponent(intelState)}&sinceHours=${encodeURIComponent(intelSinceHours)}&minBudget=${encodeURIComponent(
                      intelMinBudget,
                    )}`}
                  >
                    Export CSV
                  </Link>
                </div>
              </form>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Matching requests</p>
                  <p className="mt-2 text-3xl font-semibold">{sellerOpportunities.totalMatches}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Requests in this filtered sourcing feed.</p>
                </div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Average target</p>
                  <p className="mt-2 text-3xl font-semibold">${sellerOpportunities.averageBudget}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Typical target price in this feed.</p>
                </div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Flexible shipping</p>
                  <p className="mt-2 text-3xl font-semibold">{sellerOpportunities.flexibleShippingCount}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Requests open to shipping or pickup.</p>
                </div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Already negotiating</p>
                  <p className="mt-2 text-3xl font-semibold">{sellerOpportunities.negotiatingCount}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Requests where other sellers are already active.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Hot categories</p>
                  <div className="mt-3 grid gap-3">
                    {sellerOpportunities.hotCategories.length > 0 ? (
                      sellerOpportunities.hotCategories.map((category) => (
                        <div key={category.category} className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{category.category}</p>
                            <span className="soft-chip">
                              {category.requestCount}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-7 text-[var(--ink-soft)]">
                        No category trend stands out yet for this filter set.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Opportunity list</p>
                      <p className="mt-1 text-lg font-semibold">Requests to review first</p>
                    </div>
                    <span className="text-xs text-stone-500">Sorted in current feed order</span>
                  </div>
                  <div className="mt-4 grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
                    {sellerOpportunities.requests.length > 0 ? (
                      sellerOpportunities.requests.slice(0, 12).map((request) => (
                        <Link
                          key={request.requestId}
                          href={`/requests/${request.slug}`}
                          className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(66,54,30,0.08)]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
                                {request.category} / {request.subcategory}
                              </p>
                              <p className="mt-1 text-lg font-semibold">{request.title}</p>
                              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                                {request.location} • {request.shipping} • {request.postedLabel}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold">{request.budgetLabel}</p>
                              <p className="mt-1 text-xs text-stone-500">{request.offerCount} offer{request.offerCount === 1 ? "" : "s"}</p>
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="empty-state rounded-[1rem]">
                        No requests matched this seller feed yet. Try widening the filters or looking back farther.
                        {!localSeedApplyReady ? " Local tip: seeded cross-user requests will not show up here until SUPABASE_SERVICE_ROLE_KEY is added and npm run seed:dev is run for real." : ""}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modern-card rounded-[1.75rem] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Active claims</p>
              <h2 className="mt-2 text-2xl font-semibold">Orders you need to ship now</h2>
              <div className="subtle-panel mt-4 rounded-[1rem] px-4 py-3">
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  Once a buyer accepts and funds an offer, the claim timer goes live. This section is your ship-now queue.
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {sellerData.activeClaims.map((claim) => (
                  <div key={claim.claimId} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{claim.requestTitle}</p>
                        <p className="mt-1 text-lg font-semibold">{claim.approvedOfferLabel}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          claim.timerState === "active" ? "bg-[var(--accent-soft)] text-teal-950" : "bg-rose-100 text-rose-900"
                        }`}
                      >
                        {claim.timerLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--ink-soft)]">
                      Buyer approved this offer. Ship before the timer runs out, or message the buyer if timing needs to change.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/requests/${claim.requestSlug}`}
                        className="ghost-action"
                      >
                        Open request
                      </Link>
                      <form action={completeClaimShipment}>
                        <input type="hidden" name="requestId" value={claim.requestId} />
                        <input type="hidden" name="claimId" value={claim.claimId} />
                        <button className="brand-button rounded-full px-4 py-2 text-sm font-medium">
                          Mark shipped / complete
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
                {sellerData.activeClaims.length === 0 ? (
                  <div className="empty-state rounded-[1rem]">
                    No active claims yet. Once a buyer accepts and funds one of your offers, it will show up here.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/8 bg-white/80 p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Claim offers sent</p>
              <h2 className="mt-2 text-2xl font-semibold">See which offers need your next move</h2>
              <div className="subtle-panel mt-4 rounded-[1rem] px-4 py-3">
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  Pending means wait for the buyer. Countered means check the buyer&apos;s message and send updated terms if you still want the claim.
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {sellerData.sentOffers.map((offer) => (
                  <div key={offer.id} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-lg font-semibold">{offer.offeredPriceLabel}</p>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">{offer.claimLabel}</p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">{offer.message}</p>
                    <ImageStrip imageUrls={offer.imageUrls} altPrefix={`${offer.sellerName} sent offer`} />
                    <p className="status-pill status-pill-accent mt-3">
                      {statusLabels[offer.status] ?? offer.status}
                    </p>
                    {offer.status === "countered" ? (
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        Buyer sent a counteroffer. Open the request or message thread to review it and decide whether to update your terms.
                      </p>
                    ) : null}
                    {offer.status === "pending" ? (
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        Buyer has not decided yet. You usually do not need to do anything unless they message you with questions.
                      </p>
                    ) : null}
                    {offer.status === "accepted" ? (
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        Buyer approved this offer. Watch your active claims section for the funded order and timer.
                      </p>
                    ) : null}
                    {offer.status === "declined" ? (
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                        Buyer passed on this offer. You can move on or respond again later if the request reopens.
                      </p>
                    ) : null}
                  </div>
                ))}
                {sellerData.sentOffers.length === 0 ? (
                  <div className="empty-state rounded-[1rem]">
                    No offers sent yet. Send your first claim offer from a request page to start negotiating.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/8 bg-white/80 p-5 lg:col-span-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Saved seller digests</p>
                  <h2 className="mt-2 text-2xl font-semibold">Save filtered sourcing summaries for later delivery</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    Save the exact sourcing filters you care about. This lets you come back to the same hunt quickly and sets up future daily summaries later.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Delivery status: {emailDeliveryReady ? "Email-ready for future digests" : "Saved locally until email delivery is connected"}
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Save a digest</p>
                  <form action={addWebhookSubscription} className="mt-3 grid gap-3">
                    <label className="grid gap-2 text-sm font-medium">
                      Digest name
                      <input
                        name="name"
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                        placeholder="Georgia junkyard run"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      Category
                      <input
                        name="category"
                        defaultValue={intelCategory}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                        placeholder="Auto Parts"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      Subcategory
                      <input
                        name="subcategory"
                        defaultValue={intelSubcategory}
                        className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                        placeholder="Engine"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium">
                      State
                      <select name="state" defaultValue={intelState} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                        <option value="">All states</option>
                        {usStateOptions.map((state) => (
                          <option key={state.value} value={state.value}>
                            {state.value} - {state.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium">
                        Minimum budget
                        <input
                          name="minBudget"
                          defaultValue={intelMinBudget}
                          className="rounded-2xl border border-black/10 bg-white px-4 py-3"
                          placeholder="250"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Look back
                        <select name="sinceHours" defaultValue={intelSinceHours} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                          <option value="24">Last 24 hours</option>
                          <option value="48">Last 48 hours</option>
                          <option value="72">Last 72 hours</option>
                          <option value="168">Last 7 days</option>
                        </select>
                      </label>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                      <input type="checkbox" name="deliveryEnabled" className="h-4 w-4 rounded border-stone-300" />
                      Turn on future daily delivery for this digest
                    </label>
                    <p className="text-xs leading-6 text-stone-500">
                      {emailDeliveryReady
                        ? "Email delivery is configured, so these saved digests are ready for scheduled summary work."
                        : "Email delivery is not fully configured yet, so this only marks the digest as delivery-ready for the next build step."}
                    </p>
                    <button className="brand-button mt-1 rounded-full px-5 py-3 text-sm font-medium">Save this digest</button>
                  </form>
                </div>
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Saved digest list</p>
                  <div className="mt-3 grid gap-3">
                    {sellerDigestSubscriptions.length > 0 ? (
                      sellerDigestSubscriptions.map((subscription) => (
                        <div key={subscription.id} className="rounded-[1rem] border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                          <p className="font-medium text-[var(--foreground)]">{subscription.name}</p>
                          <p className="mt-1 text-xs text-stone-500">{subscription.label}</p>
                          <p className="mt-2">
                            Window: last {subscription.sinceHours} hour{subscription.sinceHours === 1 ? "" : "s"}
                            {subscription.state ? ` • ${subscription.state}` : ""}
                            {subscription.minBudget ? ` • $${subscription.minBudget}+` : ""}
                          </p>
                          <p className="mt-2">
                            Status: {subscription.isActive ? "Active" : "Paused"} • Saved {subscription.createdLabel}
                          </p>
                          <p className="mt-2">
                            Daily delivery: {subscription.deliveryEnabled ? "On" : "Off"}
                            {subscription.lastDeliveredLabel ? ` • Last sent ${subscription.lastDeliveredLabel}` : ""}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <form action={toggleWebhookSubscription}>
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <input type="hidden" name="nextState" value={subscription.isActive ? "paused" : "active"} />
                              <button className="ghost-action">
                                {subscription.isActive ? "Pause" : "Activate"}
                              </button>
                            </form>
                            <form action={toggleSellerDigestDelivery}>
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <input type="hidden" name="nextDeliveryState" value={subscription.deliveryEnabled ? "disabled" : "enabled"} />
                              <button className="ghost-action">
                                {subscription.deliveryEnabled ? "Turn daily delivery off" : "Turn daily delivery on"}
                              </button>
                            </form>
                            <form action={removeWebhookSubscription}>
                              <input type="hidden" name="subscriptionId" value={subscription.id} />
                              <button className="danger-action">
                                Remove
                              </button>
                            </form>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state rounded-[1rem]">
                        No saved seller digests yet. Save a filter set here and we can later turn it into daily summaries, premium seller tools, or internal sourcing reports.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/8 bg-white/80 p-5 lg:col-span-2">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Reported issues</p>
              <h2 className="mt-2 text-2xl font-semibold">Buyer disputes on completed orders</h2>
              <div className="mt-5 grid gap-4">
                {sellerIssues.length > 0 ? (
                  sellerIssues.map((issue) => (
                    <div key={issue.disputeId} className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{issue.requestTitle}</p>
                          <p className="mt-1 text-xl font-semibold">{issue.reasonLabel}</p>
                        </div>
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-900">
                          {issue.statusLabel}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{issue.details}</p>
                      {issue.buyerEvidence ? <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">Buyer evidence: {issue.buyerEvidence}</p> : null}
                      <ImageStrip imageUrls={issue.buyerEvidenceImageUrls} altPrefix={`${issue.requestTitle} buyer evidence`} />
                      <p className="mt-3 text-sm text-[var(--ink-soft)]">Reported {issue.createdLabel}</p>
                      {issue.sellerResponse ? (
                        <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                          <p className="font-medium">Seller response</p>
                          <p className="mt-2">{issue.sellerResponse}</p>
                          {issue.sellerEvidence ? <p className="mt-2">Seller evidence: {issue.sellerEvidence}</p> : null}
                          <ImageStrip imageUrls={issue.sellerEvidenceImageUrls} altPrefix={`${issue.requestTitle} seller evidence`} />
                        </div>
                      ) : (
                        <SellerDisputeResponseForm action={submitSellerDisputeResponse} disputeId={issue.disputeId} />
                      )}
                      <Link
                        href={`/requests/${issue.requestSlug}`}
                        className="ghost-action mt-4 inline-flex"
                      >
                        Open request
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="empty-state rounded-[1rem]">
                    No buyer issues have been reported on your completed sales.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
