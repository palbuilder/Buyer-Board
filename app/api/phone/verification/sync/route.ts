import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!user.phone || !user.phone_confirmed_at) {
    return NextResponse.json({ error: "Phone verification is not complete yet." }, { status: 400 });
  }

  const verifiedAt = user.phone_confirmed_at;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      phone_number: user.phone,
      phone_verified_at: verifiedAt,
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  // The verified profile write above is the primary outcome. If this mirrored review
  // row fails, we log it for follow-up instead of telling the user their SMS
  // verification failed after the phone was already marked verified.
  const { error: verificationRequestError } = await supabase.from("verification_requests").upsert({
    profile_id: user.id,
    phone_number: user.phone,
    status: "approved",
    reviewed_at: verifiedAt,
    review_note: "Verified automatically by SMS OTP.",
  });

  if (verificationRequestError) {
    console.error("BuyerBoard verification request sync failed", verificationRequestError);
  }

  return NextResponse.json({ success: true });
}
