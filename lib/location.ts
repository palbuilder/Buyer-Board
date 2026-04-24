function normalizeCompactText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function looksLikeStreetAddress(value: string) {
  return /\d/.test(value) || /\b(apt|apartment|suite|ste|unit|street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd|drive|dr\.|lane|ln\.)\b/i.test(value);
}

export function formatPublicLocationFromShipping(input: {
  shippingCity?: string | null;
  shippingState?: string | null;
}) {
  const city = normalizeCompactText(input.shippingCity);
  const state = normalizeCompactText(input.shippingState);

  if (city && state) {
    return `${city}, ${state}`;
  }

  return city || state || undefined;
}

export function derivePublicLocationLabel(input: {
  publicLocation?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
}) {
  const explicitLocation = normalizeCompactText(input.publicLocation);

  if (explicitLocation && !looksLikeStreetAddress(explicitLocation)) {
    return explicitLocation;
  }

  return formatPublicLocationFromShipping(input);
}
