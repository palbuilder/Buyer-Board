import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization")?.trim();

  if (!header?.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function secretsMatch(providedSecret: string, configuredSecret: string) {
  const providedBuffer = Buffer.from(providedSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}

export function authorizeInternalCronRequest(request: NextRequest) {
  const configuredSecret = process.env.BUYERBOARD_INTERNAL_CRON_SECRET?.trim();

  if (!configuredSecret) {
    throw new Error("Internal cron secret is not configured. Add BUYERBOARD_INTERNAL_CRON_SECRET to .env.local.");
  }

  const providedSecret =
    readBearerToken(request) ||
    request.headers.get("x-buyerboard-cron-secret")?.trim() ||
    request.nextUrl.searchParams.get("secret")?.trim() ||
    "";

  return Boolean(providedSecret && secretsMatch(providedSecret, configuredSecret));
}
