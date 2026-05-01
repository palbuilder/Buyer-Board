import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/auth";

const supportedOtpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function parseEmailOtpType(type: string | null): EmailOtpType | null {
  if (!type || !supportedOtpTypes.has(type)) {
    return null;
  }

  return type as EmailOtpType;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = parseEmailOtpType(requestUrl.searchParams.get("type"));
  const requestedNext = requestUrl.searchParams.get("next") || "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";
  const origin = requestUrl.origin;
  const authError = requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(authError)}&next=${encodeURIComponent(next)}`);
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent("Missing sign-in code.")}`);
  }

  if (tokenHash && !otpType) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent("Invalid sign-in link type.")}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent("Supabase is not configured.")}`);
  }

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: otpType!,
      });

  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureProfileForUser(user);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
