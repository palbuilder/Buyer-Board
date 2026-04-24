import { ensureProfileForUser, getCurrentProfile, getCurrentUser, requireMarketplaceAccess } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { logBuyerBoardEvent } from "@/lib/observability";
import { assertDistinctActorTarget, assertRateLimit, requireTrimmedText } from "@/lib/runtime-guards";
import { createClient } from "@/lib/supabase/server";
import type { AdminFlaggedMessage, DirectMessageCandidate, DirectMessageItem, DirectThreadSummary, RelationshipStatus } from "@/lib/types";

type DbDirectThreadRow = {
  id: string;
  member_a_id: string;
  member_b_id: string;
  updated_at: string;
};

type DbDirectMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  moderation_state: "clean" | "flagged" | "reviewed";
  created_at: string;
  review_note?: string | null;
};

function formatRelativeDate(dateInput: string) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.max(1, Math.round(diffHours / 24));
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function truncateMessage(text: string) {
  const trimmed = text.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 69).trimEnd()}...` : trimmed;
}

function getHeldMessageCopy() {
  return "Message held for review to keep payments and contact details on BuyerBoard.";
}

export function isOffPlatformMessageRisky(message: string) {
  const normalized = message.toLowerCase();
  const riskyTerms = [
    "cashapp",
    "venmo",
    "zelle",
    "paypal friends",
    "wire me",
    "text me at",
    "call me at",
    "email me at",
    "@gmail.com",
    "@hotmail.com",
    "@yahoo.com",
  ];

  const hasRiskyTerm = riskyTerms.some((term) => normalized.includes(term));
  const hasPhonePattern = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(message);
  const hasEmailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(message);

  return hasRiskyTerm || hasPhonePattern || hasEmailPattern;
}

async function requireAuthenticatedMember() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Sign in required.");
  }

  await ensureProfileForUser(user);
  return user;
}

async function requireAdminMessageModerator() {
  const user = await requireAuthenticatedMember();
  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    throw new Error("Admin access is required.");
  }

  return user;
}

async function readBlockStatus(memberAId: string, memberBId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return false;
  }

  const { data } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`and(blocker_id.eq.${memberAId},blocked_id.eq.${memberBId}),and(blocker_id.eq.${memberBId},blocked_id.eq.${memberAId})`);

  return Boolean(data && data.length > 0);
}

async function assertMemberTargetAllowed(input: {
  actorId: string;
  targetMemberId: string;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
}) {
  assertDistinctActorTarget({
    actorId: input.actorId,
    targetId: input.targetMemberId,
    message: "Choose another BuyerBoard member for that action.",
  });

  const { data: targetProfile, error: targetProfileError } = await input.supabase
    .from("profiles")
    .select("id")
    .eq("id", input.targetMemberId)
    .maybeSingle();

  if (targetProfileError) {
    throw new Error(targetProfileError.message);
  }

  if (!targetProfile) {
    throw new Error("BuyerBoard member not found.");
  }
}

async function findExistingDirectThreadId(input: {
  memberAId: string;
  memberBId: string;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
}) {
  const [memberAId, memberBId] = [input.memberAId, input.memberBId].sort();
  const { data: threadRow, error } = await input.supabase
    .from("direct_threads")
    .select("id")
    .eq("member_a_id", memberAId)
    .eq("member_b_id", memberBId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return threadRow?.id;
}

async function hasRequestConversationContext(input: {
  actorId: string;
  targetMemberId: string;
  requestId?: string;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
}) {
  const requestId = input.requestId?.trim();

  if (!requestId) {
    return false;
  }

  const { data: requestRow, error: requestError } = await input.supabase
    .from("requests")
    .select("id, buyer_id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    throw new Error(requestError.message);
  }

  if (!requestRow) {
    throw new Error("Request not found.");
  }

  if (requestRow.buyer_id === input.actorId) {
    const { data: sellerOffer, error: sellerOfferError } = await input.supabase
      .from("offers")
      .select("id")
      .eq("request_id", requestId)
      .eq("seller_id", input.targetMemberId)
      .limit(1)
      .maybeSingle();

    if (sellerOfferError) {
      throw new Error(sellerOfferError.message);
    }

    return Boolean(sellerOffer);
  }

  if (requestRow.buyer_id === input.targetMemberId) {
    const { data: actorOffer, error: actorOfferError } = await input.supabase
      .from("offers")
      .select("id")
      .eq("request_id", requestId)
      .eq("seller_id", input.actorId)
      .limit(1)
      .maybeSingle();

    if (actorOfferError) {
      throw new Error(actorOfferError.message);
    }

    return Boolean(actorOffer);
  }

  return false;
}

async function hasTransactionConversationContext(input: {
  actorId: string;
  targetMemberId: string;
  transactionId?: string;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
}) {
  const transactionId = input.transactionId?.trim();

  if (!transactionId) {
    return false;
  }

  const { data: transactionRow, error: transactionError } = await input.supabase
    .from("transactions")
    .select("id, buyer_id, seller_id")
    .eq("id", transactionId)
    .maybeSingle();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  if (!transactionRow) {
    throw new Error("Transaction not found.");
  }

  const members = [transactionRow.buyer_id, transactionRow.seller_id];

  return members.includes(input.actorId) && members.includes(input.targetMemberId);
}

async function assertDirectConversationStartAllowed(input: {
  actorId: string;
  actorRole: "buyer" | "seller" | "admin";
  targetMemberId: string;
  requestId?: string;
  transactionId?: string;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
}) {
  if (input.actorRole === "admin") {
    return;
  }

  const requestContextAllowed = await hasRequestConversationContext(input);

  if (requestContextAllowed) {
    return;
  }

  const transactionContextAllowed = await hasTransactionConversationContext(input);

  if (transactionContextAllowed) {
    return;
  }

  throw new Error("Start new conversations from a request or completed order on BuyerBoard.");
}

export async function getRelationshipStatus(targetMemberId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return {
      isFollowing: false,
      isBlocked: false,
      hasActiveBlock: false,
      blockedByOtherMember: false,
    } satisfies RelationshipStatus;
  }

  const user = await requireAuthenticatedMember();

  const [{ data: follows }, { data: blocks }, { data: blockedByOtherMember }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followed_id", targetMemberId)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select("blocker_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetMemberId)
      .maybeSingle(),
    // Messaging needs to know whether either side has blocked the thread so the
    // page can disable sending before the member types a reply that can never go through.
    supabase
      .from("blocks")
      .select("blocker_id")
      .eq("blocker_id", targetMemberId)
      .eq("blocked_id", user.id)
      .maybeSingle(),
  ]);

  const isBlocked = Boolean(blocks);
  const isBlockedByOtherMember = Boolean(blockedByOtherMember);

  return {
    isFollowing: Boolean(follows),
    isBlocked,
    hasActiveBlock: isBlocked || isBlockedByOtherMember,
    blockedByOtherMember: isBlockedByOtherMember,
  } satisfies RelationshipStatus;
}

export async function searchDirectMessageMembers(query: string) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as DirectMessageCandidate[];
  }

  const user = await requireAdminMessageModerator();
  const searchQuery = query.trim();

  if (!searchQuery) {
    return [] as DirectMessageCandidate[];
  }

  const likeQuery = `%${searchQuery.replace(/\s+/g, "%")}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, business_name, public_location_label, email")
    .neq("id", user.id)
    .or(`display_name.ilike.${likeQuery},business_name.ilike.${likeQuery},email.ilike.${likeQuery}`)
    .order("display_name", { ascending: true })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((profile) => ({
    memberId: profile.id,
    displayName: profile.display_name?.trim() || profile.business_name?.trim() || "BuyerBoard Member",
    subtitle: profile.business_name?.trim() || profile.public_location_label?.trim() || profile.email?.trim() || "BuyerBoard member",
  })) satisfies DirectMessageCandidate[];
}

export async function followMember(targetMemberId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedMember();
  await requireMarketplaceAccess();
  const normalizedTargetMemberId = requireTrimmedText({
    value: targetMemberId,
    label: "BuyerBoard member",
    maxLength: 120,
  });
  await assertMemberTargetAllowed({
    actorId: user.id,
    targetMemberId: normalizedTargetMemberId,
    supabase,
  });
  assertRateLimit({
    scope: "relationship-follow",
    actorKey: user.id,
    limit: 15,
    windowMs: 10 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  if (await readBlockStatus(user.id, normalizedTargetMemberId)) {
    throw new Error("You cannot follow a member while a block is active.");
  }

  const { error } = await supabase.from("follows").upsert({
    follower_id: user.id,
    followed_id: normalizedTargetMemberId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function unfollowMember(targetMemberId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedMember();
  await requireMarketplaceAccess();
  const normalizedTargetMemberId = requireTrimmedText({
    value: targetMemberId,
    label: "BuyerBoard member",
    maxLength: 120,
  });
  assertDistinctActorTarget({
    actorId: user.id,
    targetId: normalizedTargetMemberId,
    message: "Choose another BuyerBoard member for that action.",
  });

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", normalizedTargetMemberId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function blockMember(targetMemberId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedMember();
  await requireMarketplaceAccess();
  const normalizedTargetMemberId = requireTrimmedText({
    value: targetMemberId,
    label: "BuyerBoard member",
    maxLength: 120,
  });
  await assertMemberTargetAllowed({
    actorId: user.id,
    targetMemberId: normalizedTargetMemberId,
    supabase,
  });
  assertRateLimit({
    scope: "relationship-block",
    actorKey: user.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  const { error } = await supabase.from("blocks").upsert({
    blocker_id: user.id,
    blocked_id: normalizedTargetMemberId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { error: followCleanupError } = await supabase
    .from("follows")
    .delete()
    .or(`and(follower_id.eq.${user.id},followed_id.eq.${normalizedTargetMemberId}),and(follower_id.eq.${normalizedTargetMemberId},followed_id.eq.${user.id})`);

  if (followCleanupError) {
    // The block itself is the security boundary. If the follow cleanup misses, we keep the
    // block in place and log the cleanup failure so trust data can be repaired later.
    logBuyerBoardEvent("error", "block_follow_cleanup_failed", {
      blockerId: user.id,
      blockedId: normalizedTargetMemberId,
      error: followCleanupError,
    });
  }
}

export async function unblockMember(targetMemberId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedMember();
  await requireMarketplaceAccess();
  const normalizedTargetMemberId = requireTrimmedText({
    value: targetMemberId,
    label: "BuyerBoard member",
    maxLength: 120,
  });
  assertDistinctActorTarget({
    actorId: user.id,
    targetId: normalizedTargetMemberId,
    message: "Choose another BuyerBoard member for that action.",
  });

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", normalizedTargetMemberId);

  if (error) {
    throw new Error(error.message);
  }
}

async function getOrCreateDirectThread(memberAId: string, memberBId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const sorted = [memberAId, memberBId].sort();
  const [aId, bId] = sorted;

  const { data: existingThread } = await supabase
    .from("direct_threads")
    .select("id, member_a_id, member_b_id, updated_at")
    .eq("member_a_id", aId)
    .eq("member_b_id", bId)
    .maybeSingle();

  if (existingThread) {
    return existingThread.id;
  }

  const { data: newThread, error } = await supabase
    .from("direct_threads")
    .insert({
      member_a_id: aId,
      member_b_id: bId,
    })
    .select("id")
    .single();

  if (error || !newThread) {
    // Direct thread creation can race if both members click "message" at the same time.
    // In that case we retry the lookup once so the caller gets the existing thread instead
    // of a false "could not start" failure.
    const { data: racedThread } = await supabase
      .from("direct_threads")
      .select("id")
      .eq("member_a_id", aId)
      .eq("member_b_id", bId)
      .maybeSingle();

    if (racedThread?.id) {
      return racedThread.id;
    }

    throw new Error(error?.message ?? "Unable to start a new private conversation.");
  }

  return newThread.id;
}

export async function startDirectConversation(
  input:
    | string
    | {
        targetMemberId: string;
        requestId?: string;
        transactionId?: string;
      },
) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedMember();
  const actorProfile = await requireMarketplaceAccess();
  const targetMemberId = typeof input === "string" ? input : input.targetMemberId;
  const normalizedTargetMemberId = requireTrimmedText({
    value: targetMemberId,
    label: "BuyerBoard member",
    maxLength: 120,
  });
  await assertMemberTargetAllowed({
    actorId: user.id,
    targetMemberId: normalizedTargetMemberId,
    supabase,
  });
  const existingThreadId = await findExistingDirectThreadId({
    memberAId: user.id,
    memberBId: normalizedTargetMemberId,
    supabase,
  });

  if (existingThreadId) {
    return existingThreadId;
  }

  assertRateLimit({
    scope: "direct-thread-start",
    actorKey: user.id,
    limit: 12,
    windowMs: 10 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  if (await readBlockStatus(user.id, normalizedTargetMemberId)) {
    throw new Error("Private messaging is not available while a block is active.");
  }

  await assertDirectConversationStartAllowed({
    actorId: user.id,
    actorRole: actorProfile.role,
    targetMemberId: normalizedTargetMemberId,
    requestId: typeof input === "string" ? undefined : input.requestId,
    transactionId: typeof input === "string" ? undefined : input.transactionId,
    supabase,
  });

  return getOrCreateDirectThread(user.id, normalizedTargetMemberId);
}

export async function sendDirectMessage(input: { threadId: string; body: string }) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const user = await requireAuthenticatedMember();
  await requireMarketplaceAccess();
  const threadId = requireTrimmedText({
    value: input.threadId,
    label: "Conversation",
    maxLength: 120,
  });
  const cleanBody = requireTrimmedText({
    value: input.body,
    label: "Message",
    maxLength: 2_000,
  });
  assertRateLimit({
    scope: `direct-message:${threadId}`,
    actorKey: user.id,
    limit: 20,
    windowMs: 5 * 60 * 1000,
    message: "Too many requests were sent too quickly. Please wait a minute and try again.",
  });

  // The form already trims on the client, but the API path needs the same guard so
  // blank or whitespace-only messages cannot slip through alternate callers later.
  const { data: threadRow, error: threadError } = await supabase
    .from("direct_threads")
    .select("id, member_a_id, member_b_id")
    .eq("id", threadId)
    .single();

  if (threadError || !threadRow) {
    throw new Error(threadError?.message ?? "Private conversation not found.");
  }

  if (![threadRow.member_a_id, threadRow.member_b_id].includes(user.id)) {
    throw new Error("You are not a member of this private conversation.");
  }

  const otherMemberId = threadRow.member_a_id === user.id ? threadRow.member_b_id : threadRow.member_a_id;

  if (await readBlockStatus(user.id, otherMemberId)) {
    throw new Error("Private messaging is not available while a block is active.");
  }

  const moderationState = isOffPlatformMessageRisky(cleanBody) ? "flagged" : "clean";

  const { error: messageError } = await supabase.from("direct_messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    body: cleanBody,
    moderation_state: moderationState,
  });

  if (messageError) {
    throw new Error(messageError.message);
  }

  const { error: threadUpdateError } = await supabase
    .from("direct_threads")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (threadUpdateError) {
    throw new Error(threadUpdateError.message);
  }

  if (moderationState === "clean") {
    await createNotification({
      profileId: otherMemberId,
      title: "New private message",
      body: "A BuyerBoard member sent you a negotiation message.",
      href: `/messages?thread=${encodeURIComponent(threadId)}`,
      preferenceKey: "offers_claims",
      sendEmail: true,
    });
  }

  return moderationState;
}

export async function getDirectInbox() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as DirectThreadSummary[];
  }

  const user = await requireAuthenticatedMember();
  const { data: threadRows } = await supabase
    .from("direct_threads")
    .select("id, member_a_id, member_b_id, updated_at")
    .or(`member_a_id.eq.${user.id},member_b_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  const threads = (threadRows ?? []) as DbDirectThreadRow[];

  if (threads.length === 0) {
    return [] as DirectThreadSummary[];
  }

  const otherMemberIds = threads.map((thread) => (thread.member_a_id === user.id ? thread.member_b_id : thread.member_a_id));
  const threadIds = threads.map((thread) => thread.id);

  const [{ data: profiles }, { data: messages }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", otherMemberIds),
    supabase
      .from("direct_messages")
      .select("id, thread_id, sender_id, body, moderation_state, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const latestMessageByThread = new Map<string, DbDirectMessageRow>();

  for (const message of (messages ?? []) as DbDirectMessageRow[]) {
    if (!latestMessageByThread.has(message.thread_id)) {
      latestMessageByThread.set(message.thread_id, message);
    }
  }

  return threads.map((thread) => {
    const otherMemberId = thread.member_a_id === user.id ? thread.member_b_id : thread.member_a_id;
    const latestMessage = latestMessageByThread.get(thread.id);
    return {
      threadId: thread.id,
      otherMemberId,
      otherMemberName: profilesById.get(otherMemberId)?.display_name ?? "BuyerBoard Member",
      lastMessagePreview: latestMessage
        ? latestMessage.moderation_state === "flagged"
          ? getHeldMessageCopy()
          : truncateMessage(latestMessage.body)
        : "Start the conversation",
      updatedLabel: formatRelativeDate(thread.updated_at),
      lastMessageDirection: latestMessage ? (latestMessage.sender_id === user.id ? "sent" : "received") : undefined,
    } satisfies DirectThreadSummary;
  });
}

export async function getDirectMessages(threadId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return [] as DirectMessageItem[];
  }

  const user = await requireAuthenticatedMember();
  const { data: threadRow, error: threadError } = await supabase
    .from("direct_threads")
    .select("id, member_a_id, member_b_id")
    .eq("id", threadId)
    .single();

  if (threadError || !threadRow) {
    throw new Error(threadError?.message ?? "Private conversation not found.");
  }

  if (![threadRow.member_a_id, threadRow.member_b_id].includes(user.id)) {
    throw new Error("You are not a member of this private conversation.");
  }

  const { data: messageRows } = await supabase
    .from("direct_messages")
    .select("id, thread_id, sender_id, body, moderation_state, created_at, review_note")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return ((messageRows ?? []) as DbDirectMessageRow[]).map((message) => ({
    id: message.id,
    senderId: message.sender_id,
    body: message.body,
    createdLabel: formatRelativeDate(message.created_at),
    moderationState: message.moderation_state,
  }));
}

export async function getAdminFlaggedMessages() {
  const supabase = await createClient();

  if (!supabase) {
    return [] as AdminFlaggedMessage[];
  }

  const { data: flaggedMessages } = await supabase
    .from("direct_messages")
    .select("id, thread_id, sender_id, body, moderation_state, created_at, review_note")
    .eq("moderation_state", "flagged")
    .order("created_at", { ascending: false });

  const messages = (flaggedMessages ?? []) as DbDirectMessageRow[];

  if (messages.length === 0) {
    return [] as AdminFlaggedMessage[];
  }

  const threadIds = [...new Set(messages.map((message) => message.thread_id))];
  const senderIds = [...new Set(messages.map((message) => message.sender_id))];
  const { data: threads } = await supabase
    .from("direct_threads")
    .select("id, member_a_id, member_b_id")
    .in("id", threadIds);

  const threadsById = new Map((threads ?? []).map((thread) => [thread.id, thread]));
  const recipientIds = [
    ...new Set(
      messages
        .map((message) => {
          const thread = threadsById.get(message.thread_id);
          if (!thread) {
            return undefined;
          }

          return thread.member_a_id === message.sender_id ? thread.member_b_id : thread.member_a_id;
        })
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const memberIds = [...new Set([...senderIds, ...recipientIds])];
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", memberIds);
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return messages.map((message) => {
    const thread = threadsById.get(message.thread_id);
    const recipientId = thread ? (thread.member_a_id === message.sender_id ? thread.member_b_id : thread.member_a_id) : undefined;

    return {
      messageId: message.id,
      threadId: message.thread_id,
      senderId: message.sender_id,
      senderName: profilesById.get(message.sender_id)?.display_name ?? "BuyerBoard Member",
      recipientName: recipientId ? profilesById.get(recipientId)?.display_name ?? "BuyerBoard Member" : "BuyerBoard Member",
      body: message.body,
      createdLabel: formatRelativeDate(message.created_at),
      reviewNote: message.review_note ?? undefined,
    } satisfies AdminFlaggedMessage;
  });
}

export async function reviewFlaggedMessage(input: { messageId: string; reviewNote: string }) {
  await requireAdminMessageModerator();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase
    .from("direct_messages")
    .update({
      moderation_state: "reviewed",
      review_note: requireTrimmedText({
        value: input.reviewNote,
        label: "Review note",
        maxLength: 1_500,
      }),
    })
    .eq("id", input.messageId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getFlaggedMessageSenderId(messageId: string) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("direct_messages")
    .select("sender_id")
    .eq("id", messageId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Flagged message not found.");
  }

  return data.sender_id as string;
}
