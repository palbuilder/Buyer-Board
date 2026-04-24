import { headers } from "next/headers";
import { getTurnstileEnv, hasTurnstileEnv } from "@/lib/turnstile/config";

type TurnstileVerificationResult = {
  success: boolean;
  errorCodes: string[];
};

export async function verifyTurnstileToken(token: string): Promise<TurnstileVerificationResult> {
  if (!hasTurnstileEnv()) {
    return {
      success: true,
      errorCodes: [],
    };
  }

  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return {
      success: false,
      errorCodes: ["missing-input-response"],
    };
  }

  const { secretKey } = getTurnstileEnv();

  if (!secretKey) {
    return {
      success: false,
      errorCodes: ["missing-secret"],
    };
  }

  const headerStore = await headers();
  const remoteIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret: secretKey,
      response: trimmedToken,
      remoteip: remoteIp,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      success: false,
      errorCodes: ["siteverify-unavailable"],
    };
  }

  const payload = (await response.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  return {
    success: Boolean(payload.success),
    errorCodes: payload["error-codes"] ?? [],
  };
}
