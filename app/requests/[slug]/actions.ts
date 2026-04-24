"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseImageUrlsFromFormValue } from "@/lib/media";
import { blockMember, followMember, startDirectConversation, unblockMember, unfollowMember } from "@/lib/community";
import { validateMarketplaceMessage } from "@/lib/moderation";
import { createSellerResponse, reportListing } from "@/lib/requests";

function parseOffer(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "").trim();
  return Number.parseFloat(cleaned);
}

export async function submitSellerResponse(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const offeredPriceRaw = String(formData.get("offeredPrice") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const imageUrls = parseImageUrlsFromFormValue(String(formData.get("imageUrls") ?? ""));
  const claimWindowHours = Number.parseInt(String(formData.get("claimWindowHours") ?? "48"), 10);
  const offeredPrice = parseOffer(offeredPriceRaw);

  if (!requestId || !slug || !message || !Number.isFinite(offeredPrice) || offeredPrice <= 0 || !Number.isFinite(claimWindowHours) || claimWindowHours <= 0) {
    redirect(`/requests/${slug}?error=Complete all seller response fields before sending.`);
  }

  const moderationError = validateMarketplaceMessage({
    message,
  });

  if (moderationError) {
    redirect(`/requests/${slug}?error=${encodeURIComponent(moderationError)}`);
  }

  try {
    await createSellerResponse({
      requestId,
      offeredPrice,
      message,
      proposedClaimWindowHours: claimWindowHours,
      imageUrls,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unable to save seller response right now.";
    if (messageText === "Sign in required.") {
      redirect(`/auth?next=${encodeURIComponent(`/requests/${slug}`)}`);
    }
    if (messageText === "Phone verification required.") {
      redirect(`/dashboard?tab=seller&error=${encodeURIComponent("Phone verification is required before sending seller claim offers.")}`);
    }
    redirect(`/requests/${slug}?error=${encodeURIComponent(messageText)}`);
  }

  revalidatePath("/requests");
  revalidatePath(`/requests/${slug}`);
  revalidatePath("/dashboard");
  redirect(`/requests/${slug}?responded=1`);
}

export async function submitListingReport(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const offerId = String(formData.get("offerId") ?? "").trim();
  const reportTargetRaw = String(formData.get("reportTarget") ?? "request").trim();
  const reasonValue = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const imageUrls = parseImageUrlsFromFormValue(String(formData.get("imageUrls") ?? ""));
  const reportTarget = reportTargetRaw === "offer" ? "offer" : "request";

  const allowedReasons = new Set(["tos_violation", "illegal_item", "unsafe_item", "harassment", "spam", "other"]);
  const reason = allowedReasons.has(reasonValue) ? reasonValue : "";

  if (!requestId || !slug || !reason || !details) {
    redirect(`/requests/${slug}?error=Choose a report reason and explain the issue.`);
  }

  try {
    await reportListing({
      requestId,
      offerId: offerId || undefined,
      reportTarget,
      reason: reason as "tos_violation" | "illegal_item" | "unsafe_item" | "harassment" | "spam" | "other",
      details,
      imageUrls,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unable to report this listing right now.";
    if (messageText === "Sign in required.") {
      redirect(`/auth?next=${encodeURIComponent(`/requests/${slug}`)}`);
    }
    redirect(`/requests/${slug}?error=${encodeURIComponent(messageText)}`);
  }

  revalidatePath(`/requests/${slug}`);
  redirect(`/requests/${slug}?reported=1`);
}

async function mutateRelationship(
  formData: FormData,
  handler: (memberId: string) => Promise<void>,
  notice: string,
) {
  const memberId = String(formData.get("memberId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();

  if (!memberId || !slug) {
    redirect("/requests?error=Missing member information.");
  }

  try {
    await handler(memberId);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unable to update this member relationship right now.";
    if (messageText === "Sign in required.") {
      redirect(`/auth?next=${encodeURIComponent(`/requests/${slug}`)}`);
    }
    redirect(`/requests/${slug}?error=${encodeURIComponent(messageText)}`);
  }

  revalidatePath(`/requests/${slug}`);
  revalidatePath("/messages");
  redirect(`/requests/${slug}?notice=${encodeURIComponent(notice)}`);
}

export async function followSeller(formData: FormData) {
  return mutateRelationship(formData, followMember, "Seller followed");
}

export async function unfollowSeller(formData: FormData) {
  return mutateRelationship(formData, unfollowMember, "Seller unfollowed");
}

export async function blockSeller(formData: FormData) {
  return mutateRelationship(formData, blockMember, "Seller blocked");
}

export async function unblockSeller(formData: FormData) {
  return mutateRelationship(formData, unblockMember, "Seller unblocked");
}

export async function startSellerMessage(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const requestTitle = String(formData.get("requestTitle") ?? "").trim();

  if (!memberId || !requestId || !slug) {
    redirect("/requests?error=Missing member information.");
  }

  try {
    const threadId = await startDirectConversation({
      targetMemberId: memberId,
      requestId,
    });
    revalidatePath("/messages");
    const params = new URLSearchParams({
      thread: threadId,
    });

    if (requestTitle) {
      params.set("request", requestTitle);
    }

    if (slug) {
      params.set("slug", slug);
    }

    redirect(`/messages?${params.toString()}`);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unable to start a private conversation right now.";
    if (messageText === "Sign in required.") {
      redirect(`/auth?next=${encodeURIComponent(`/requests/${slug}`)}`);
    }
    redirect(`/requests/${slug}?error=${encodeURIComponent(messageText)}`);
  }
}
