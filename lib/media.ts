export const MARKETPLACE_MEDIA_BUCKET = "buyerboard-media";

export function parseMediaUrls(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function parseImageUrlsFromFormValue(rawValue: string) {
  if (!rawValue.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parseMediaUrls(parsed).slice(0, 6);
  } catch {
    return [] as string[];
  }
}
