import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRequestOrigin } from "@/lib/auth";
import { canUseLocalCaptchaBypass, hasTurnstileEnv } from "@/lib/turnstile/config";
import { SignInForm } from "./sign-in-form";

type AuthPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    next?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { notice, error, next } = await searchParams;
  const nextPath = next || "/dashboard";
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath.startsWith("/") ? nextPath : "/dashboard");
  }

  const captchaReady = hasTurnstileEnv();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const requestOrigin = await getRequestOrigin();
  const localCaptchaBypassReady = canUseLocalCaptchaBypass({
    host: requestOrigin,
  });

  return (
    <main className="page-shell flex min-h-screen items-center py-6">
      <div className="section-card grid w-full gap-5 rounded-[1.35rem] p-5 lg:grid-cols-[1fr_0.9fr] sm:p-6">
        <section>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Secure sign in</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Start with email, then layer trust as activity grows.</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
            Use a secure email link to get into BuyerBoard. Extra trust checks only show up when they are actually needed.
          </p>

          <div className="mt-6 space-y-3">
            <div className="data-card rounded-[1rem] p-4 text-sm leading-7 text-[var(--ink-soft)]">
              Browse requests, post what you need, and compare seller offers in one place.
            </div>
            <div className="data-card rounded-[1rem] p-4 text-sm leading-7 text-[var(--ink-soft)]">
              Higher-trust and business features can be added later without slowing down day-one sign-in.
            </div>
            <div className="data-card rounded-[1rem] p-4 text-sm leading-7 text-[var(--ink-soft)]">
              {localCaptchaBypassReady
                ? "Local-only CAPTCHA bypass is active for localhost testing."
                : captchaReady
                  ? "CAPTCHA is active on sign-in."
                  : "CAPTCHA setup is still incomplete."}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/">
              Back home
            </Link>
            <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/requests">
              Browse requests first
            </Link>
          </div>
        </section>

        <section className="data-card rounded-[1.15rem] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Email link sign in</p>
          <h2 className="mt-2 text-2xl font-semibold">Send a secure login link</h2>

          {notice ? (
            <div className="mt-5 rounded-[1.25rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
              {error}
            </div>
          ) : null}

          <SignInForm
            nextPath={nextPath}
            captchaReady={captchaReady}
            localCaptchaBypassReady={localCaptchaBypassReady}
            siteKey={siteKey}
          />

          <p className="mt-4 text-xs leading-6 text-stone-500">
            Need help? Open the Help button in the bottom-right corner.
          </p>
        </section>
      </div>
    </main>
  );
}
