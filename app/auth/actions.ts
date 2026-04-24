"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseLocalCaptchaBypass, hasTurnstileEnv } from "@/lib/turnstile/config";

async function ensureLocalBypassUserExists(
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    const existingUser = users.find((user) => user.email?.trim().toLowerCase() === email);

    if (existingUser) {
      return;
    }

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  const { error } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendSignInLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/dashboard").trim() || "/dashboard";
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "").trim();

  if (!email) {
    redirect(`/auth?error=${encodeURIComponent("Enter your email address.")}&next=${encodeURIComponent(next)}`);
  }

  const origin = await getRequestOrigin();
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const localCaptchaBypassReady = canUseLocalCaptchaBypass({
    host: origin,
  });

  if (hasTurnstileEnv() && !localCaptchaBypassReady && !captchaToken) {
    redirect(
      `/auth?error=${encodeURIComponent("Please complete the CAPTCHA check and try again.")}&next=${encodeURIComponent(next)}`,
    );
  }

  if (localCaptchaBypassReady) {
    const adminClient = createAdminClient();

    if (!adminClient) {
      redirect(
        `/auth?error=${encodeURIComponent("Local CAPTCHA bypass needs SUPABASE_SERVICE_ROLE_KEY in .env.local.")}&next=${encodeURIComponent(next)}`,
      );
    }

    let actionLink = "";

    try {
      await ensureLocalBypassUserExists(adminClient, email);
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: emailRedirectTo,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      actionLink = data.properties?.action_link ?? "";

      if (!actionLink) {
        throw new Error("Supabase did not return a usable magic link.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate the local sign-in link.";
      redirect(`/auth?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
    }

    redirect(actionLink);
  }

  const supabase = await createClient();

  if (!supabase) {
    redirect(`/auth?error=${encodeURIComponent("Supabase is not configured.")}&next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
      captchaToken: captchaToken || undefined,
    },
  });

  if (error) {
    redirect(`/auth?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  redirect(`/auth?notice=${encodeURIComponent(`Check ${email} for your secure sign-in link.`)}&next=${encodeURIComponent(next)}`);
}

export async function signOutMember() {
  const supabase = await createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/");
}
