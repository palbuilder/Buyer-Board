import { NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { logBuyerBoardEvent, serializeError } from "@/lib/observability";

function getStatusCodeForMessage(message: string) {
  if (message === "Unauthorized.") {
    return 401;
  }

  if (message === "Sign in required.") {
    return 401;
  }

  if (message.includes("Too many requests")) {
    return 429;
  }

  if (
    message.includes("Admin access is required") ||
    message.includes("Phone verification required") ||
    message.includes("suspended from marketplace activity") ||
    message.includes("temporarily blocked")
  ) {
    return 403;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("not configured")) {
    return 500;
  }

  return 400;
}

function getApiRedirectMessage(error: unknown) {
  if (!isRedirectError(error)) {
    return null;
  }

  const redirectUrl = getURLFromRedirectError(error);

  if (!redirectUrl) {
    return {
      status: 401,
      message: "Sign in required.",
    };
  }

  const parsedUrl = new URL(redirectUrl, "http://buyerboard.local");
  const redirectErrorMessage = parsedUrl.searchParams.get("error")?.trim();

  if (parsedUrl.pathname.startsWith("/auth")) {
    return {
      status: 401,
      message: "Sign in required.",
    };
  }

  if (redirectErrorMessage) {
    return {
      status: getStatusCodeForMessage(redirectErrorMessage),
      message: redirectErrorMessage,
    };
  }

  return {
    status: 403,
    message: "This action is not available.",
  };
}

export function apiErrorResponse(error: unknown, context?: { route?: string; action?: string }) {
  const redirectFailure = getApiRedirectMessage(error);

  if (redirectFailure) {
    logBuyerBoardEvent("warn", "api_redirect_guard_rewritten", {
      route: context?.route,
      action: context?.action,
      status: redirectFailure.status,
      error: serializeError(error),
    });

    return NextResponse.json({ error: redirectFailure.message }, { status: redirectFailure.status });
  }

  const message = error instanceof Error ? error.message : "Something went wrong.";
  const status = getStatusCodeForMessage(message);

  if (status >= 500) {
    logBuyerBoardEvent("error", "api_failure", {
      route: context?.route,
      action: context?.action,
      status,
      error: serializeError(error),
    });
  } else if (status === 401 || status === 403 || status === 429) {
    logBuyerBoardEvent("warn", "api_guard_rejection", {
      route: context?.route,
      action: context?.action,
      status,
      error: serializeError(error),
    });
  }

  return NextResponse.json({ error: message }, { status });
}
