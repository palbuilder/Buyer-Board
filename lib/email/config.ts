export function hasEmailDeliveryEnv() {
  return Boolean(process.env.RESEND_API_KEY && process.env.BUYERBOARD_EMAIL_FROM);
}

export function getBuyerBoardAppUrl() {
  return process.env.BUYERBOARD_APP_URL?.trim() || "http://localhost:3000";
}

export function buildBuyerBoardUrl(href = "/") {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  const origin = getBuyerBoardAppUrl().replace(/\/$/, "");
  return `${origin}${href.startsWith("/") ? href : `/${href}`}`;
}
