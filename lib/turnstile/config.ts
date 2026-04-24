const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;
const localCaptchaBypassFlag = process.env.BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS;

export function hasTurnstileEnv() {
  return Boolean(turnstileSiteKey && turnstileSecretKey);
}

export function isLocalHostValue(value?: string | null): boolean {
  const rawValue = value?.trim();

  if (!rawValue) {
    return false;
  }

  try {
    return isLocalHostValue(new URL(rawValue).hostname);
  } catch {
    const normalizedHost = rawValue.toLowerCase().replace(/^\[|\]$/g, "").split(":")[0];
    return normalizedHost === "localhost" || normalizedHost === "127.0.0.1" || normalizedHost === "::1";
  }
}

export function canUseLocalCaptchaBypass(input?: {
  flagEnabled?: boolean;
  host?: string | null;
  nodeEnv?: string | null;
  serviceRoleReady?: boolean;
}) {
  const flagEnabled = input?.flagEnabled ?? localCaptchaBypassFlag === "true";
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV ?? "";
  const host = input?.host ?? process.env.BUYERBOARD_APP_URL ?? "";
  const serviceRoleReady = input?.serviceRoleReady ?? Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  return flagEnabled && nodeEnv !== "production" && serviceRoleReady && isLocalHostValue(host);
}

export function getTurnstileEnv() {
  return {
    siteKey: turnstileSiteKey,
    secretKey: turnstileSecretKey,
  };
}
