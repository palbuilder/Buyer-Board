"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getCurrentProfile, getRequestOrigin, getSellerTrustGate, requireCurrentUser, requireVerifiedPhone } from "@/lib/auth";
import { derivePublicLocationLabel } from "@/lib/location";
import { parseImageUrlsFromFormValue } from "@/lib/media";
import { createNotification } from "@/lib/notifications";
import { normalizeUsPhoneNumber } from "@/lib/phone";
import { createStripeServerClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createSellerDigestSubscription, deleteSellerDigestSubscription, updateSellerDigestSubscription } from "@/lib/integrations";
import { completeSellerClaim, confirmRequestFreshness, reportTransactionIssue, respondToDispute, startClaimCheckout as beginClaimCheckoutRequest, updateClaimOfferDecision } from "@/lib/requests";
import { submitTransactionReview as saveTransactionReview } from "@/lib/requests";

function rethrowRedirect(error: unknown) {
  if (isRedirectError(error)) {
    throw error;
  }
}

async function submitBuyerOfferDecision(input: {
  offerId: string;
  requestId: string;
  decision: "accepted" | "declined" | "countered";
  buyerComment?: string;
  successNotice: string;
  fallbackError: string;
}) {
  // Buyer offer actions all share the same redirect/error behavior. Keeping them in one
  // helper reduces the chance that accept/deny/counter drift apart during future edits.
  if (!input.offerId || !input.requestId) {
    redirect("/dashboard?tab=buyer&error=Missing claim offer information.");
  }

  try {
    await updateClaimOfferDecision({
      offerId: input.offerId,
      requestId: input.requestId,
      decision: input.decision,
      buyerComment: input.buyerComment,
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : input.fallbackError;
    if (message === "Sign in required.") {
      redirect("/auth?next=/dashboard");
    }
    redirect(`/dashboard?tab=buyer&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/requests");
  redirect(`/dashboard?tab=buyer&notice=${encodeURIComponent(input.successNotice)}`);
}

export async function acceptClaimOffer(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  return submitBuyerOfferDecision({
    offerId,
    requestId,
    decision: "accepted",
    buyerComment: "Buyer approved this claim offer.",
    successNotice: "Offer accepted. Next step: fund the order.",
    fallbackError: "Unable to accept claim offer.",
  });
}

export async function denyClaimOffer(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();

  return submitBuyerOfferDecision({
    offerId,
    requestId,
    decision: "declined",
    buyerComment: "Buyer declined this claim offer.",
    successNotice: "Offer denied",
    fallbackError: "Unable to deny claim offer.",
  });
}

export async function counterClaimOffer(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const buyerComment = String(formData.get("buyerComment") ?? "").trim();

  if (!offerId || !requestId || !buyerComment) {
    redirect("/dashboard?tab=buyer&error=Add a counteroffer comment before sending.");
  }

  return submitBuyerOfferDecision({
    offerId,
    requestId,
    decision: "countered",
    buyerComment,
    successNotice: "Counteroffer sent to seller",
    fallbackError: "Unable to counter claim offer.",
  });
}

export async function confirmBuyerRequestFreshness(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!requestId) {
    redirect("/dashboard?tab=buyer&error=Missing request information.");
  }

  try {
    await confirmRequestFreshness(requestId);
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to confirm this request right now.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/dashboard?tab=buyer");
    }
    redirect(`/dashboard?tab=buyer&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/requests");
  redirect("/dashboard?tab=buyer&notice=Request kept active");
}

export async function completeClaimShipment(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const claimId = String(formData.get("claimId") ?? "").trim();

  if (!requestId || !claimId) {
    redirect("/dashboard?tab=seller&error=Missing active claim information.");
  }

  try {
    await completeSellerClaim({
      requestId,
      claimId,
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to complete claim.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/dashboard?tab=seller");
    }
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/requests");
  redirect("/dashboard?tab=seller&notice=Claim marked complete");
}

export async function saveMemberProfile(formData: FormData) {
  const user = await requireCurrentUser("/dashboard");
  const supabase = await createClient();

  if (!supabase) {
    redirect("/dashboard?error=Supabase is not configured.");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const publicLocation = String(formData.get("publicLocation") ?? "").trim();
  const shippingName = String(formData.get("shippingName") ?? "").trim();
  const shippingAddressLine1 = String(formData.get("shippingAddressLine1") ?? "").trim();
  const shippingAddressLine2 = String(formData.get("shippingAddressLine2") ?? "").trim();
  const shippingCity = String(formData.get("shippingCity") ?? "").trim();
  const shippingState = String(formData.get("shippingState") ?? "").trim();
  const shippingPostalCode = String(formData.get("shippingPostalCode") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const phoneNumberRaw = String(formData.get("phoneNumber") ?? "").trim();
  const normalizedPhoneNumber = phoneNumberRaw ? normalizeUsPhoneNumber(phoneNumberRaw) : null;
  const safePublicLocation = derivePublicLocationLabel({
    publicLocation,
    shippingCity,
    shippingState,
  });

  if (phoneNumberRaw && !normalizedPhoneNumber) {
    redirect("/dashboard?error=Enter a valid 10-digit US phone number.");
  }

  const profilePatch = {
    display_name: displayName || null,
    public_location_label: safePublicLocation ?? null,
    preferred_shipping_name: shippingName || null,
    preferred_shipping_address_line1: shippingAddressLine1 || null,
    preferred_shipping_address_line2: shippingAddressLine2 || null,
    preferred_shipping_city: shippingCity || null,
    preferred_shipping_state: shippingState || null,
    preferred_shipping_postal_code: shippingPostalCode || null,
    business_name: businessName || null,
    phone_number: normalizedPhoneNumber || null,
  };

  const { data: savedProfile, error } = await supabase
    .from("profiles")
    .update(profilePatch)
    .eq("id", user.id)
    .select(
      "display_name, public_location_label, preferred_shipping_name, preferred_shipping_address_line1, preferred_shipping_address_line2, preferred_shipping_city, preferred_shipping_state, preferred_shipping_postal_code, business_name, phone_number",
    )
    .maybeSingle();

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  if (!savedProfile) {
    redirect("/dashboard?error=We could not save your profile right now. Refresh and try again.");
  }

  const savedProfileMatches =
    (savedProfile.display_name ?? null) === profilePatch.display_name &&
    (savedProfile.public_location_label ?? null) === profilePatch.public_location_label &&
    (savedProfile.preferred_shipping_name ?? null) === profilePatch.preferred_shipping_name &&
    (savedProfile.preferred_shipping_address_line1 ?? null) === profilePatch.preferred_shipping_address_line1 &&
    (savedProfile.preferred_shipping_address_line2 ?? null) === profilePatch.preferred_shipping_address_line2 &&
    (savedProfile.preferred_shipping_city ?? null) === profilePatch.preferred_shipping_city &&
    (savedProfile.preferred_shipping_state ?? null) === profilePatch.preferred_shipping_state &&
    (savedProfile.preferred_shipping_postal_code ?? null) === profilePatch.preferred_shipping_postal_code &&
    (savedProfile.business_name ?? null) === profilePatch.business_name &&
    (savedProfile.phone_number ?? null) === profilePatch.phone_number;

  if (!savedProfileMatches) {
    // The dashboard was previously willing to say "saved" even if nothing actually
    // changed in storage. Read-after-write keeps profile persistence honest.
    redirect("/dashboard?error=Your profile changes did not stick. Please try again.");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?notice=Profile saved");
}

export async function startBuyerBillingSetup() {
  try {
    const user = await requireCurrentUser("/dashboard");
    await getCurrentProfile();
    const supabase = await createClient();
    const stripe = createStripeServerClient();

    if (!supabase || !stripe) {
      redirect("/dashboard?error=Stripe is not configured yet. Add Stripe keys to continue.");
    }

    const { data: freshProfile, error: freshProfileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email, display_name")
      .eq("id", user.id)
      .single();

    if (freshProfileError) {
      throw new Error(freshProfileError.message);
    }

    let customerId = freshProfile?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? freshProfile?.email ?? undefined,
        name: freshProfile?.display_name ?? undefined,
        metadata: {
          buyerboard_user_id: user.id,
        },
      });

      customerId = customer.id;

      const { error: profileUpdateError } = await supabase.from("profiles").update({
        stripe_customer_id: customerId,
      }).eq("id", user.id);

      if (profileUpdateError) {
        throw new Error(profileUpdateError.message);
      }
    }

    const origin = await getRequestOrigin();
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        customer: customerId,
        currency: "usd",
        payment_method_types: ["card"],
        success_url: `${origin}/dashboard?billing_setup=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard?error=${encodeURIComponent("Buyer billing setup was canceled")}`,
        metadata: {
          buyerboard_user_id: user.id,
          buyerboard_flow: "buyer_billing_setup",
        },
      });

    if (!session.url) {
      redirect("/dashboard?error=Unable to start buyer billing setup.");
    }

    redirect(session.url);
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to start buyer billing setup.";
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }
}

export async function beginClaimCheckout(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();

  if (!requestId) {
    redirect("/dashboard?tab=buyer&error=Missing claim funding information.");
  }

  try {
    const checkoutUrl = await beginClaimCheckoutRequest({ requestId });

    if (!checkoutUrl) {
      redirect("/dashboard?tab=buyer&error=Unable to start buyer funding.");
    }

    redirect(checkoutUrl);
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to start buyer funding.";
    redirect(`/dashboard?tab=buyer&error=${encodeURIComponent(message)}`);
  }
}

export async function startSellerPayoutOnboarding() {
  try {
    const user = await requireCurrentUser("/dashboard?tab=seller");
    await requireVerifiedPhone();
    const trustGate = await getSellerTrustGate();

    if (trustGate.payoutBlocked) {
      redirect(`/dashboard?tab=seller&error=${encodeURIComponent(trustGate.payoutReason ?? "Payouts are temporarily blocked for trust review.")}`);
    }

    const supabase = await createClient();
    const stripe = createStripeServerClient();

    if (!supabase || !stripe) {
      redirect("/dashboard?tab=seller&error=Stripe is not configured yet. Add Stripe keys to continue.");
    }

    const origin = await getRequestOrigin();

    const { data: profile, error: profileReadError } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, email, display_name, business_name, public_location_label")
      .eq("id", user.id)
      .single();

    if (profileReadError) {
      throw new Error(profileReadError.message);
    }

    let accountId = profile?.stripe_connect_account_id ?? undefined;
    const savedBusinessName = profile?.business_name?.trim() || "";
    const isBusinessSeller = Boolean(savedBusinessName);
    const sellerDisplayName = profile?.display_name?.trim() || user.email?.split("@")[0] || "BuyerBoard seller";
    const isLocalOrigin = origin.includes("localhost") || origin.includes("127.0.0.1");
    const sellerProfileUrl = `${origin}/sellers/${user.id}`;
    const sellerMarketDescription =
      "Marketplace seller on BuyerBoard. Individual and business members use this account to fulfill buyer requests for parts, tools, gear, and everyday items.";
    const accountUpdatePayload = {
      business_profile: {
        mcc: "5399",
        // Only prefill the company-facing business profile name when the seller actually
        // provided a business name. Individual sellers should stay on the simpler path.
        name: isBusinessSeller ? savedBusinessName : undefined,
        product_description: sellerMarketDescription,
        support_url: isLocalOrigin ? undefined : origin,
        url: isLocalOrigin ? undefined : sellerProfileUrl,
      },
      metadata: {
        buyerboard_user_id: user.id,
        buyerboard_seller_display_name: sellerDisplayName,
        buyerboard_marketplace_origin: origin,
        buyerboard_profile_url: sellerProfileUrl,
        buyerboard_public_location: profile?.public_location_label ?? "",
        buyerboard_seller_mode: isBusinessSeller ? "business" : "individual",
      },
    } as const;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? profile?.email ?? undefined,
        business_type: isBusinessSeller ? "company" : "individual",
        business_profile: accountUpdatePayload.business_profile,
        individual: isBusinessSeller
          ? undefined
          : {
              email: user.email ?? profile?.email ?? undefined,
            },
        company: isBusinessSeller
          ? {
              name: savedBusinessName,
            }
          : undefined,
        metadata: accountUpdatePayload.metadata,
      });

      accountId = account.id;

      const { error: connectAccountUpdateError } = await supabase.from("profiles").update({
        stripe_connect_account_id: accountId,
      }).eq("id", user.id);

      if (connectAccountUpdateError) {
        throw new Error(connectAccountUpdateError.message);
      }
    }

    await stripe.accounts.update(accountId, accountUpdatePayload);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?tab=seller&error=${encodeURIComponent("Seller payout onboarding expired. Start it again to continue.")}`,
      return_url: `${origin}/dashboard?tab=seller&stripe_connect=return`,
      type: "account_onboarding",
    });

    redirect(accountLink.url);
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to start seller payout onboarding.";
    if (message === "Phone verification required.") {
      redirect("/dashboard?tab=seller&error=Phone verification is required before seller payout onboarding.");
    }
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }
}

export async function submitPurchaseIssue(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const reasonValue = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const buyerEvidence = String(formData.get("buyerEvidence") ?? "").trim();
  const buyerEvidenceImageUrls = parseImageUrlsFromFormValue(String(formData.get("buyerEvidenceImageUrls") ?? ""));

  const allowedReasons = new Set(["wrong_item", "defective_item", "not_as_described", "shipping_issue", "other"]);
  const reason = allowedReasons.has(reasonValue) ? reasonValue : "";

  if (!transactionId || !requestId || !reason || !details) {
    redirect("/dashboard?tab=buyer&error=Choose an issue reason and describe what went wrong.");
  }

  try {
    await reportTransactionIssue({
      transactionId,
      requestId,
      reason: reason as "wrong_item" | "defective_item" | "not_as_described" | "shipping_issue" | "other",
      details,
      buyerEvidence: buyerEvidence || undefined,
      buyerEvidenceImageUrls,
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to report this issue.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/dashboard");
    }
    redirect(`/dashboard?tab=buyer&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=buyer&notice=Issue reported for review");
}

export async function submitPurchaseReview(formData: FormData) {
  const transactionId = String(formData.get("transactionId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const rating = Number.parseInt(String(formData.get("rating") ?? "").trim(), 10);
  const reviewText = String(formData.get("reviewText") ?? "").trim();

  if (!transactionId || !requestId || Number.isNaN(rating)) {
    redirect("/dashboard?tab=buyer&error=Choose a rating before sending your review.");
  }

  try {
    await saveTransactionReview({
      transactionId,
      requestId,
      rating,
      reviewText: reviewText || undefined,
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to save this review.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/dashboard");
    }
    redirect(`/dashboard?tab=buyer&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=buyer&notice=Review submitted");
}

export async function submitSellerDisputeResponse(formData: FormData) {
  const disputeId = String(formData.get("disputeId") ?? "").trim();
  const response = String(formData.get("response") ?? "").trim();
  const sellerEvidence = String(formData.get("sellerEvidence") ?? "").trim();
  const sellerEvidenceImageUrls = parseImageUrlsFromFormValue(String(formData.get("sellerEvidenceImageUrls") ?? ""));

  if (!disputeId || !response) {
    redirect("/dashboard?tab=seller&error=Add a seller response before sending.");
  }

  try {
    await respondToDispute({
      disputeId,
      response,
      sellerEvidence: sellerEvidence || undefined,
      sellerEvidenceImageUrls,
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to respond to dispute.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/dashboard?tab=seller");
    }
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=seller&notice=Dispute response sent");
}

export async function submitPhoneVerificationRequest(formData: FormData) {
  const user = await requireCurrentUser("/dashboard");
  const supabase = await createClient();

  if (!supabase) {
    redirect("/dashboard?error=Supabase is not configured.");
  }

  const phoneNumberRaw = String(formData.get("phoneNumber") ?? "").trim();
  const normalizedPhoneNumber = normalizeUsPhoneNumber(phoneNumberRaw);

  if (!phoneNumberRaw) {
    redirect("/dashboard?error=Add a phone number before requesting verification.");
  }

  if (!normalizedPhoneNumber) {
    redirect("/dashboard?error=Enter a valid 10-digit US phone number for manual review.");
  }

  const { error } = await supabase.from("verification_requests").upsert({
    profile_id: user.id,
    phone_number: normalizedPhoneNumber,
    status: "requested",
    review_note: null,
    reviewed_at: null,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?notice=Phone verification request submitted");
}

export async function submitTrustAppeal(formData: FormData) {
  const user = await requireCurrentUser("/dashboard");
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  if (!supabase) {
    redirect("/dashboard?error=Supabase is not configured.");
  }

  if (!profile || profile.accountStatus === "active") {
    redirect("/dashboard?error=Appeals are only available for accounts on warning or suspension.");
  }

  const memberMessage = String(formData.get("memberMessage") ?? "").trim();

  if (!memberMessage) {
    redirect("/dashboard?error=Add a short explanation before sending your appeal.");
  }

  const { data: openAppeal, error: openAppealError } = await supabase
    .from("trust_appeals")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "open")
    .maybeSingle();

  if (openAppealError) {
    redirect(`/dashboard?error=${encodeURIComponent(openAppealError.message)}`);
  }

  if (openAppeal) {
    redirect("/dashboard?error=You already have an appeal waiting for admin review.");
  }

  const { error: appealError } = await supabase.from("trust_appeals").insert({
    profile_id: user.id,
    member_message: memberMessage,
    status: "open",
  });

  if (appealError) {
    redirect(`/dashboard?error=${encodeURIComponent(appealError.message)}`);
  }

  // Appeal submission is the user-facing primary action. If the audit trail insert
  // fails afterward, we log it so support/admin can investigate without pretending
  // the appeal itself was never submitted.
  const { error: trustEventError } = await supabase.from("trust_events").insert({
    profile_id: user.id,
    event_type: "appeal_submitted",
    note: memberMessage,
    event_value: profile.accountStatus,
  });

  if (trustEventError) {
    console.error("BuyerBoard trust event insert failed after appeal submission", trustEventError);
  }

  await createNotification({
    profileId: user.id,
    title: "Appeal submitted",
    body: "Your appeal was sent to the admin trust queue for review.",
    href: "/dashboard",
    preferenceKey: "trust_safety",
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin/trust");
  redirect("/dashboard?notice=Appeal submitted for admin review");
}

export async function addWebhookSubscription(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const subcategory = String(formData.get("subcategory") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const minBudgetRaw = String(formData.get("minBudget") ?? "").trim();
  const sinceHoursRaw = String(formData.get("sinceHours") ?? "24").trim();
  const deliveryEnabled = formData.get("deliveryEnabled") === "on";
  const minBudget = Number.parseInt(minBudgetRaw, 10);
  const sinceHours = Number.parseInt(sinceHoursRaw, 10);

  try {
    await createSellerDigestSubscription({
      name: name || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      state: state || undefined,
      minBudget: Number.isFinite(minBudget) ? minBudget : undefined,
      sinceHours: Number.isFinite(sinceHours) ? sinceHours : 24,
      deliveryEnabled,
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to save seller digest.";
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=seller&notice=Seller digest saved");
}

export async function toggleWebhookSubscription(formData: FormData) {
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  const nextState = String(formData.get("nextState") ?? "").trim();

  if (!subscriptionId || !nextState) {
    redirect("/dashboard?tab=seller&error=Missing webhook subscription details.");
  }

  try {
    await updateSellerDigestSubscription({
      subscriptionId,
      isActive: nextState === "active",
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to update seller digest.";
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?tab=seller&notice=${encodeURIComponent(nextState === "active" ? "Seller digest activated" : "Seller digest paused")}`);
}

export async function toggleSellerDigestDelivery(formData: FormData) {
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  const nextDeliveryState = String(formData.get("nextDeliveryState") ?? "").trim();

  if (!subscriptionId || !nextDeliveryState) {
    redirect("/dashboard?tab=seller&error=Missing seller digest delivery details.");
  }

  try {
    await updateSellerDigestSubscription({
      subscriptionId,
      deliveryEnabled: nextDeliveryState === "enabled",
    });
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to update digest delivery.";
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?tab=seller&notice=${encodeURIComponent(nextDeliveryState === "enabled" ? "Daily digest delivery enabled" : "Daily digest delivery turned off")}`);
}

export async function removeWebhookSubscription(formData: FormData) {
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();

  if (!subscriptionId) {
    redirect("/dashboard?tab=seller&error=Missing webhook subscription details.");
  }

  try {
    await deleteSellerDigestSubscription(subscriptionId);
  } catch (error) {
    rethrowRedirect(error);
    const message = error instanceof Error ? error.message : "Unable to remove seller digest.";
    redirect(`/dashboard?tab=seller&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?tab=seller&notice=Seller digest removed");
}
