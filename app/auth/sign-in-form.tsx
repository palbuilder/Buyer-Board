"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import { useFormStatus } from "react-dom";
import { sendSignInLink } from "./actions";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

function SubmitButton({
  captchaReady,
  hasToken,
  localCaptchaBypassReady,
}: {
  captchaReady: boolean;
  hasToken: boolean;
  localCaptchaBypassReady: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="brand-button tight-button text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending || (captchaReady && !localCaptchaBypassReady && !hasToken)}
    >
      {pending ? "Sending sign-in link..." : "Email me a sign-in link"}
    </button>
  );
}

type SignInFormProps = {
  nextPath: string;
  captchaReady: boolean;
  localCaptchaBypassReady: boolean;
  siteKey?: string;
};

export function SignInForm({ nextPath, captchaReady, localCaptchaBypassReady, siteKey }: SignInFormProps) {
  const [captchaToken, setCaptchaToken] = useState("");
  const [localError, setLocalError] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (captchaReady && !localCaptchaBypassReady && !captchaToken) {
      event.preventDefault();
      setLocalError("Complete the CAPTCHA check before sending the sign-in link.");
    }
  }

  useEffect(() => {
    if (
      !captchaReady ||
      localCaptchaBypassReady ||
      !siteKey ||
      !scriptLoaded ||
      !containerRef.current ||
      widgetIdRef.current ||
      !window.turnstile
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "light",
      size: "flexible",
      callback: (token) => {
        setCaptchaToken(token);
        setLocalError("");
      },
      "expired-callback": () => setCaptchaToken(""),
      "error-callback": () => setCaptchaToken(""),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [captchaReady, localCaptchaBypassReady, scriptLoaded, siteKey]);

  return (
    <form action={sendSignInLink} onSubmit={handleSubmit} className="mt-5 grid gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="cf-turnstile-response" value={captchaToken} />
      <label className="field-label">
        Email address
        <input
          type="email"
          name="email"
          className="field-input"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      {captchaReady && !localCaptchaBypassReady && siteKey ? (
        <div className="grid gap-2">
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
          <div ref={containerRef} className="min-h-[70px]" />
          <p className="text-xs leading-6 text-stone-500">
            Complete the CAPTCHA before sending the sign-in link.
          </p>
        </div>
      ) : null}
      {localCaptchaBypassReady ? (
        <div className="rounded-[1.25rem] border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
          Local testing bypass is enabled on this localhost session, so BuyerBoard can generate the sign-in link without showing CAPTCHA here.
        </div>
      ) : null}
      {localError ? (
        <div className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
          {localError}
        </div>
      ) : null}
      <SubmitButton
        captchaReady={captchaReady}
        hasToken={Boolean(captchaToken)}
        localCaptchaBypassReady={localCaptchaBypassReady}
      />
    </form>
  );
}
