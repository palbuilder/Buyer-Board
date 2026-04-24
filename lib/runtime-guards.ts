declare global {
  var __buyerboardRateLimitStore: Map<string, { count: number; resetAt: number }> | undefined;
}

type RateLimitInput = {
  scope: string;
  actorKey: string;
  limit: number;
  windowMs: number;
  message?: string;
};

const rateLimitStore = globalThis.__buyerboardRateLimitStore ?? new Map<string, { count: number; resetAt: number }>();
globalThis.__buyerboardRateLimitStore = rateLimitStore;

function cleanupExpiredRateLimitBuckets(now: number) {
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function assertRateLimit(input: RateLimitInput) {
  const now = Date.now();

  if (rateLimitStore.size > 2_000) {
    cleanupExpiredRateLimitBuckets(now);
  }

  // This is intentionally lightweight and in-process. It is not a replacement for
  // Supabase/Auth/Turnstile or future edge-level limits, but it does stop the most
  // obvious duplicate-click and burst-spam cases while we stay launch-lightweight.
  const bucketKey = `${input.scope}:${input.actorKey}`;
  const existingBucket = rateLimitStore.get(bucketKey);

  if (!existingBucket || existingBucket.resetAt <= now) {
    rateLimitStore.set(bucketKey, {
      count: 1,
      resetAt: now + input.windowMs,
    });
    return;
  }

  if (existingBucket.count >= input.limit) {
    throw new Error(input.message ?? "Too many requests. Please slow down and try again.");
  }

  existingBucket.count += 1;
  rateLimitStore.set(bucketKey, existingBucket);
}

export function requireTrimmedText(input: {
  value: string;
  label: string;
  maxLength: number;
  minLength?: number;
}) {
  const trimmed = input.value.trim();
  const minLength = input.minLength ?? 1;

  if (trimmed.length < minLength) {
    throw new Error(`${input.label} is required.`);
  }

  if (trimmed.length > input.maxLength) {
    throw new Error(`${input.label} must be ${input.maxLength} characters or fewer.`);
  }

  return trimmed;
}

export function normalizeOptionalText(input: {
  value?: string | null;
  maxLength: number;
  label: string;
}) {
  const trimmed = input.value?.trim() ?? "";

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > input.maxLength) {
    throw new Error(`${input.label} must be ${input.maxLength} characters or fewer.`);
  }

  return trimmed;
}

export function requireNumberInRange(input: {
  value: number;
  label: string;
  min: number;
  max: number;
}) {
  if (!Number.isFinite(input.value) || input.value < input.min || input.value > input.max) {
    throw new Error(`${input.label} must be between ${input.min} and ${input.max}.`);
  }

  return input.value;
}

export function requireIntegerInRange(input: {
  value: number;
  label: string;
  min: number;
  max: number;
}) {
  if (!Number.isInteger(input.value) || input.value < input.min || input.value > input.max) {
    throw new Error(`${input.label} must be between ${input.min} and ${input.max}.`);
  }

  return input.value;
}

export function limitStringArrayLength(input: {
  values: string[];
  maxItems: number;
  label: string;
}) {
  if (input.values.length > input.maxItems) {
    throw new Error(`${input.label} allows up to ${input.maxItems} items.`);
  }

  return input.values;
}

export function assertDistinctActorTarget(input: {
  actorId: string;
  targetId: string;
  message: string;
}) {
  if (input.actorId === input.targetId) {
    throw new Error(input.message);
  }
}

export function requireHttpsUrl(input: {
  value: string;
  label: string;
}) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input.value);
  } catch {
    throw new Error(`${input.label} must be a valid https URL.`);
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(`${input.label} must be a valid https URL.`);
  }

  return parsedUrl.toString();
}
