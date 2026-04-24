"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { blockMember, followMember, sendDirectMessage, startDirectConversation, unblockMember, unfollowMember } from "@/lib/community";
import { validateMarketplaceMessage } from "@/lib/moderation";

async function updateRelationship(
  formData: FormData,
  handler: (memberId: string) => Promise<void>,
  notice: string,
) {
  const memberId = String(formData.get("memberId") ?? "").trim();
  const threadId = String(formData.get("threadId") ?? "").trim();

  if (!memberId) {
    redirect("/messages?error=Missing member information.");
  }

  try {
    await handler(memberId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update this member relationship.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/messages");
    }
    redirect(`/messages?thread=${encodeURIComponent(threadId)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/messages");
  redirect(`/messages?thread=${encodeURIComponent(threadId)}&notice=${encodeURIComponent(notice)}`);
}

export async function followConversationMember(formData: FormData) {
  return updateRelationship(formData, followMember, "Member followed");
}

export async function unfollowConversationMember(formData: FormData) {
  return updateRelationship(formData, unfollowMember, "Member unfollowed");
}

export async function blockConversationMember(formData: FormData) {
  return updateRelationship(formData, blockMember, "Member blocked");
}

export async function unblockConversationMember(formData: FormData) {
  return updateRelationship(formData, unblockMember, "Member unblocked");
}

export async function startAdminConversationFromMessages(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "").trim();

  if (!memberId) {
    redirect("/messages?error=Choose a BuyerBoard member to message.");
  }

  try {
    const threadId = await startDirectConversation(memberId);
    revalidatePath("/messages");
    redirect(`/messages?thread=${encodeURIComponent(threadId)}&notice=${encodeURIComponent("Admin outreach ready")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a private conversation right now.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/messages");
    }
    if (message === "Admin access is required.") {
      redirect("/messages?error=Only admins can start a brand-new outreach thread from the inbox.");
    }
    redirect(`/messages?error=${encodeURIComponent(message)}`);
  }
}

export async function sendPrivateMessage(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!threadId || !body) {
    redirect(`/messages?thread=${encodeURIComponent(threadId)}&error=Write a message before sending.`);
  }

  const moderationError = validateMarketplaceMessage({
    message: body,
  });

  if (moderationError) {
    redirect(`/messages?thread=${encodeURIComponent(threadId)}&error=${encodeURIComponent(moderationError)}`);
  }

  try {
    const moderationState = await sendDirectMessage({
      threadId,
      body,
    });

    revalidatePath("/messages");

    if (moderationState === "flagged") {
      redirect(
        `/messages?thread=${encodeURIComponent(threadId)}&notice=${encodeURIComponent(
          "Message held for review because it appears to share off-platform contact or payment details.",
        )}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send this private message right now.";
    if (message === "Sign in required.") {
      redirect("/auth?next=/messages");
    }
    redirect(`/messages?thread=${encodeURIComponent(threadId)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/messages");
  redirect(`/messages?thread=${encodeURIComponent(threadId)}&notice=${encodeURIComponent("Message sent")}`);
}
