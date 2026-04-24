import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AdminPhoneVerificationRequest, PhoneVerificationRequest } from "@/lib/types";

export type MemberProfile = {
  id: string;
  role: "buyer" | "seller" | "admin";
  email: string;
  displayName: string;
  publicLocation: string;
  shippingName: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  accountType: "individual" | "business";
  planTier: "free" | "premium" | "business";
  phoneNumber: string;
  phoneVerified: boolean;
  businessName: string;
  stripeCustomerReady: boolean;
  payoutReady: boolean;
  accountStatus: "active" | "flagged" | "suspended";
  adminRiskNote: string;
};

export type SellerTrustGate = {
  payoutBlocked: boolean;
  payoutReason: string | undefined;
};

type DbProfileRow = {
  id: string;
  role: string | null;
  email: string | null;
  display_name: string | null;
  public_location_label: string | null;
  preferred_shipping_name: string | null;
  preferred_shipping_address_line1: string | null;
  preferred_shipping_address_line2: string | null;
  preferred_shipping_city: string | null;
  preferred_shipping_state: string | null;
  preferred_shipping_postal_code: string | null;
  account_type: string | null;
  plan_tier: string | null;
  phone_number: string | null;
  phone_verified_at: string | null;
  business_name: string | null;
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_customer_ready_at: string | null;
  stripe_connect_onboarded_at: string | null;
  stripe_charges_enabled_at: string | null;
  stripe_payouts_enabled_at: string | null;
  account_status: string | null;
  admin_risk_note: string | null;
};

function buildDisplayName(user: User) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : undefined;

  if (metadataName?.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "BuyerBoard Member";
}

export async function getCurrentUser() {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function ensureProfileForUser(user: User) {
  const supabase = await createClient();

  if (!supabase) {
    return;
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id, role, email, display_name, public_location_label, account_type, plan_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(existingProfileError.message);
  }

  if (!existingProfile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      role: "buyer",
      display_name: buildDisplayName(user),
      location_label: "United States",
      public_location_label: "United States",
      email: user.email ?? null,
      account_type: "individual",
      plan_tier: "free",
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return;
  }

  const profilePatch: Record<string, string | null> = {};

  if (!existingProfile.email && user.email) {
    profilePatch.email = user.email;
  }

  if (!existingProfile.display_name?.trim()) {
    profilePatch.display_name = buildDisplayName(user);
  }

  if (!existingProfile.public_location_label?.trim()) {
    profilePatch.public_location_label = "United States";
  }

  if (Object.keys(profilePatch).length > 0) {
    // Profile bootstrap is foundational for the rest of the app, so we surface
    // backfill failures immediately instead of letting later marketplace actions
    // break in confusing ways because the profile row was never updated.
    const { error: patchError } = await supabase.from("profiles").update(profilePatch).eq("id", user.id);

    if (patchError) {
      throw new Error(patchError.message);
    }
  }
}

function mapProfileRecord(data: DbProfileRow, user: User) {
  return {
    id: data.id,
    role: data.role === "admin" ? "admin" : data.role === "seller" ? "seller" : "buyer",
    email: data.email ?? user.email ?? "",
    displayName: data.display_name ?? buildDisplayName(user),
    publicLocation: data.public_location_label ?? "",
    shippingName: data.preferred_shipping_name ?? "",
    shippingAddressLine1: data.preferred_shipping_address_line1 ?? "",
    shippingAddressLine2: data.preferred_shipping_address_line2 ?? "",
    shippingCity: data.preferred_shipping_city ?? "",
    shippingState: data.preferred_shipping_state ?? "",
    shippingPostalCode: data.preferred_shipping_postal_code ?? "",
    accountType: data.account_type === "business" ? "business" : "individual",
    planTier: data.plan_tier === "premium" || data.plan_tier === "business" ? data.plan_tier : "free",
    phoneNumber: data.phone_number ?? "",
    phoneVerified: Boolean(data.phone_verified_at),
    businessName: data.business_name ?? "",
    stripeCustomerReady: Boolean(data.stripe_customer_ready_at),
    // "Ready" should mean Stripe has actually enabled payouts, not just that onboarding started.
    payoutReady: Boolean(data.stripe_payouts_enabled_at),
    accountStatus: data.account_status === "suspended" ? "suspended" : data.account_status === "flagged" ? "flagged" : "active",
    adminRiskNote: data.admin_risk_note ?? "",
  } satisfies MemberProfile;
}

export async function getCurrentProfile() {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, email, display_name, public_location_label, preferred_shipping_name, preferred_shipping_address_line1, preferred_shipping_address_line2, preferred_shipping_city, preferred_shipping_state, preferred_shipping_postal_code, account_type, plan_tier, phone_number, phone_verified_at, business_name, stripe_customer_id, stripe_connect_account_id, stripe_customer_ready_at, stripe_connect_onboarded_at, stripe_charges_enabled_at, stripe_payouts_enabled_at, account_status, admin_risk_note",
    )
    .eq("id", user.id)
    .single();

  if (!data) {
    return null;
  }

  return mapProfileRecord(data as DbProfileRow, user);
}

export async function getOptionalCurrentProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  await ensureProfileForUser(user);
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, email, display_name, public_location_label, preferred_shipping_name, preferred_shipping_address_line1, preferred_shipping_address_line2, preferred_shipping_city, preferred_shipping_state, preferred_shipping_postal_code, account_type, plan_tier, phone_number, phone_verified_at, business_name, stripe_customer_id, stripe_connect_account_id, stripe_customer_ready_at, stripe_connect_onboarded_at, stripe_charges_enabled_at, stripe_payouts_enabled_at, account_status, admin_risk_note",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return mapProfileRecord(data as DbProfileRow, user);
}

export async function requireApiCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    // Page loads can redirect to sign-in, but JSON routes need a plain auth failure
    // so mobile callers and API smoke checks see a clean 401 instead of NEXT_REDIRECT.
    throw new Error("Sign in required.");
  }

  await ensureProfileForUser(user);
  return user;
}

export async function requireApiAdminUser() {
  const user = await requireApiCurrentUser();
  const profile = await getOptionalCurrentProfile();

  if (profile?.role !== "admin") {
    throw new Error("Admin access is required.");
  }

  return user;
}

export async function requireAdminUser(nextPath = "/admin/disputes") {
  const user = await requireCurrentUser(nextPath);
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    redirect("/dashboard?error=Admin access is required for that page.");
  }

  return user;
}

export async function getCurrentPhoneVerificationRequest() {
  const user = await requireCurrentUser("/dashboard");
  const supabase = await createClient();

  if (!supabase) {
    return {
      status: "none",
      phoneNumber: "",
      createdLabel: undefined,
      reviewNote: undefined,
    } satisfies PhoneVerificationRequest;
  }

  const { data } = await supabase
    .from("verification_requests")
    .select("phone_number, status, created_at, review_note")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!data) {
    return {
      status: "none",
      phoneNumber: "",
      createdLabel: undefined,
      reviewNote: undefined,
    } satisfies PhoneVerificationRequest;
  }

  const createdAt = new Date(data.created_at);
  const diffMs = Date.now() - createdAt.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  const createdLabel = diffHours < 24 ? `${diffHours} hour${diffHours === 1 ? "" : "s"} ago` : `${Math.round(diffHours / 24)} days ago`;

  return {
    status: data.status,
    phoneNumber: data.phone_number ?? "",
    createdLabel,
    reviewNote: data.review_note ?? undefined,
  } satisfies PhoneVerificationRequest;
}

export async function requireVerifiedPhone() {
  const profile = await getCurrentProfile();

  if (!profile?.phoneVerified) {
    throw new Error("Phone verification required.");
  }

  return profile;
}

export async function getSellerTrustGate(profileId?: string) {
  const profile = profileId ? null : await getCurrentProfile();
  const resolvedProfileId = profileId ?? profile?.id;
  const resolvedStatus = profile?.accountStatus;

  if (!resolvedProfileId) {
    return {
      payoutBlocked: true,
      payoutReason: "Sign in required.",
    } satisfies SellerTrustGate;
  }

  const supabase = await createClient();

  if (!supabase) {
    return {
      payoutBlocked: false,
      payoutReason: undefined,
    } satisfies SellerTrustGate;
  }

  let accountStatus = resolvedStatus;

  if (!accountStatus) {
    const { data: statusRow, error: statusError } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", resolvedProfileId)
      .maybeSingle();

    if (statusError || !statusRow) {
      return {
        payoutBlocked: true,
        payoutReason: "Payouts are temporarily blocked until account status can be verified.",
      } satisfies SellerTrustGate;
    }

    accountStatus = statusRow.account_status ?? "active";
  }

  if (accountStatus === "suspended") {
    return {
      payoutBlocked: true,
      payoutReason: "Payouts are blocked while the account is suspended.",
    } satisfies SellerTrustGate;
  }

  if (accountStatus === "flagged") {
    return {
      payoutBlocked: true,
      payoutReason: "Payouts are temporarily blocked while the account is on warning or probation.",
    } satisfies SellerTrustGate;
  }

  const [{ count: flaggedMessageCount }, { count: disputeCount }] = await Promise.all([
    supabase
      .from("direct_messages")
      .select("*", { count: "exact", head: true })
      .eq("sender_id", resolvedProfileId)
      .eq("moderation_state", "flagged"),
    supabase
      .from("disputes")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", resolvedProfileId)
      .in("status", ["open", "under_review"]),
  ]);

  if ((flaggedMessageCount ?? 0) >= 2 || (disputeCount ?? 0) >= 2) {
    return {
      payoutBlocked: true,
      payoutReason: "Payouts are blocked until trust review is cleared.",
    } satisfies SellerTrustGate;
  }

  return {
    payoutBlocked: false,
    payoutReason: undefined,
  } satisfies SellerTrustGate;
}

export async function requireMarketplaceAccess() {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("Sign in required.");
  }

  if (profile.accountStatus === "suspended") {
    throw new Error("This account is suspended from marketplace activity.");
  }

  return profile;
}

export async function getAdminPhoneVerificationRequests() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as AdminPhoneVerificationRequest[];
  }

  const { data } = await supabase
    .from("verification_requests")
    .select("id, profile_id, phone_number, status, created_at, review_note")
    .order("created_at", { ascending: false });

  const requests = data ?? [];

  if (requests.length === 0) {
    return [] as AdminPhoneVerificationRequest[];
  }

  const profileIds = requests.map((request) => request.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", profileIds);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return requests.map((request) => {
    const profile = profilesById.get(request.profile_id);
    const createdAt = new Date(request.created_at);
    const diffMs = Date.now() - createdAt.getTime();
    const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

    return {
      requestId: request.id,
      profileId: request.profile_id,
      memberEmail: profile?.email ?? "Unknown",
      memberName: profile?.display_name ?? "BuyerBoard Member",
      phoneNumber: request.phone_number,
      status: request.status,
      createdLabel: diffHours < 24 ? `${diffHours} hour${diffHours === 1 ? "" : "s"} ago` : `${Math.round(diffHours / 24)} days ago`,
      reviewNote: request.review_note ?? undefined,
    } satisfies AdminPhoneVerificationRequest;
  });
}

export async function requireCurrentUser(nextPath?: string) {
  const user = await getCurrentUser();

  if (!user) {
    const nextParam = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/auth${nextParam}`);
  }

  await ensureProfileForUser(user);
  return user;
}

export async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

