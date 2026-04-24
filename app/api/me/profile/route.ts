import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { getOptionalCurrentProfile, requireApiCurrentUser } from "@/lib/auth";
import { normalizeUsPhoneNumber } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireApiCurrentUser();
    const profile = await getOptionalCurrentProfile();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/me/profile", action: "GET" });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiCurrentUser();
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      displayName?: unknown;
      publicLocation?: unknown;
      shippingName?: unknown;
      shippingAddressLine1?: unknown;
      shippingAddressLine2?: unknown;
      shippingCity?: unknown;
      shippingState?: unknown;
      shippingPostalCode?: unknown;
      accountType?: unknown;
      planTier?: unknown;
      businessName?: unknown;
      phoneNumber?: unknown;
    };

    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const publicLocation = typeof body.publicLocation === "string" ? body.publicLocation.trim() : "";
    const shippingName = typeof body.shippingName === "string" ? body.shippingName.trim() : "";
    const shippingAddressLine1 = typeof body.shippingAddressLine1 === "string" ? body.shippingAddressLine1.trim() : "";
    const shippingAddressLine2 = typeof body.shippingAddressLine2 === "string" ? body.shippingAddressLine2.trim() : "";
    const shippingCity = typeof body.shippingCity === "string" ? body.shippingCity.trim() : "";
    const shippingState = typeof body.shippingState === "string" ? body.shippingState.trim() : "";
    const shippingPostalCode = typeof body.shippingPostalCode === "string" ? body.shippingPostalCode.trim() : "";
    const accountType = body.accountType === "business" ? "business" : "individual";
    const requestedPlanTier = body.planTier === "premium" || body.planTier === "business" ? body.planTier : "free";
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const phoneNumberRaw = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const normalizedPhoneNumber = phoneNumberRaw ? normalizeUsPhoneNumber(phoneNumberRaw) : null;

    if (phoneNumberRaw && !normalizedPhoneNumber) {
      return NextResponse.json({ error: "Enter a valid 10-digit US phone number." }, { status: 400 });
    }

    const planTier = accountType === "business" && requestedPlanTier === "free" ? "business" : requestedPlanTier;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        public_location_label: publicLocation || null,
        preferred_shipping_name: shippingName || null,
        preferred_shipping_address_line1: shippingAddressLine1 || null,
        preferred_shipping_address_line2: shippingAddressLine2 || null,
        preferred_shipping_city: shippingCity || null,
        preferred_shipping_state: shippingState || null,
        preferred_shipping_postal_code: shippingPostalCode || null,
        account_type: accountType,
        plan_tier: planTier,
        business_name: businessName || null,
        phone_number: normalizedPhoneNumber || null,
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const profile = await getOptionalCurrentProfile();
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return apiErrorResponse(error, { route: "/api/me/profile", action: "PATCH" });
  }
}
