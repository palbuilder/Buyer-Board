import Link from "next/link";
import { getOptionalCurrentProfile, requireCurrentUser } from "@/lib/auth";
import { getDirectInbox, getDirectMessages, getRelationshipStatus, searchDirectMessageMembers } from "@/lib/community";
import { getNegotiationContextForMembers } from "@/lib/requests";
import { MessageComposer } from "./message-composer";
import {
  startAdminConversationFromMessages,
  blockConversationMember,
  followConversationMember,
  sendPrivateMessage,
  unblockConversationMember,
  unfollowConversationMember,
} from "./actions";

type MessagesPageProps = {
  searchParams: Promise<{
    thread?: string;
    notice?: string;
    error?: string;
    request?: string;
    slug?: string;
    memberSearch?: string;
  }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  await requireCurrentUser("/messages");
  const { thread, notice, error, request, slug, memberSearch = "" } = await searchParams;
  const profile = await getOptionalCurrentProfile();
  const inbox = await getDirectInbox();
  const canStartAdminOutreach = profile?.role === "admin";
  const memberSearchQuery = memberSearch.trim();
  const memberSearchResults = canStartAdminOutreach && memberSearchQuery ? await searchDirectMessageMembers(memberSearchQuery) : [];
  const selectedThread = inbox.find((item) => item.threadId === thread) ?? inbox[0] ?? null;
  const messages = selectedThread ? await getDirectMessages(selectedThread.threadId) : [];
  const negotiationContext =
    selectedThread && profile?.id
      ? await getNegotiationContextForMembers(profile.id, selectedThread.otherMemberId)
      : undefined;
  const relationship =
    selectedThread && profile?.id !== selectedThread.otherMemberId
      ? await getRelationshipStatus(selectedThread.otherMemberId)
      : { isFollowing: false, isBlocked: false, hasActiveBlock: false, blockedByOtherMember: false };
  const blockNotice = relationship.isBlocked
    ? "You blocked this member. Unblock them before sending new messages."
    : relationship.blockedByOtherMember
      ? "This member has blocked new private messages in this thread."
      : undefined;

  const latestOfferStatus = negotiationContext?.latestOfferStatus ?? "";
  const viewerRoleInThread =
    negotiationContext && profile?.id === negotiationContext.buyerId
      ? "buyer"
      : negotiationContext && profile?.id === negotiationContext.sellerId
        ? "seller"
        : undefined;
  const nextStepMessage =
    latestOfferStatus === "pending"
      ? "A live offer is waiting on the buyer. Use this thread to answer final questions and confirm details."
      : latestOfferStatus === "countered"
        ? "A counteroffer is on the table. Use this thread to agree on updated price or timing before anyone accepts."
        : latestOfferStatus === "accepted"
          ? "The offer was approved. The next step is buyer funding, then shipping inside the claim window."
          : latestOfferStatus === "declined"
            ? "That offer was declined. If the request is still open, use this thread to see whether a revised offer makes sense."
            : "Use this thread to confirm price, fitment, condition, and timing before someone accepts the claim.";

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Private messaging</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Keep the deal conversation in one place.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Private messages are for discussing the request itself. Messages that try to move payment or contact details off BuyerBoard are held for review.
            </p>
          </div>
          <Link className="brand-hero-button tight-button text-sm font-medium" href="/requests">
            Browse requests
          </Link>
        </div>

        {notice ? (
          <div className="mt-6 rounded-[1.5rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="data-card rounded-[1.15rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Inbox</p>
                <h2 className="mt-2 text-2xl font-semibold">Your conversations</h2>
              </div>
              <span className="status-pill status-pill-accent">
                {inbox.length} thread{inbox.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">
                {canStartAdminOutreach ? "Admin outreach" : "Start new threads from marketplace activity"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                {canStartAdminOutreach
                  ? "Admins can search any member by name, business name, or email to open an outreach thread. Existing threads are reused automatically."
                  : "Regular members can only start a brand-new conversation from a request, offer, or completed-order context. Use the request flow to message the other side of the deal."}
              </p>
              {canStartAdminOutreach ? (
                <form method="GET" action="/messages" className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    name="memberSearch"
                    defaultValue={memberSearchQuery}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
                    placeholder="Search a member"
                  />
                  <button className="brand-button rounded-full px-5 py-3 text-sm font-medium">
                    Search members
                  </button>
                </form>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link className="ghost-action" href="/requests">
                    Browse requests
                  </Link>
                </div>
              )}
            </div>

            {canStartAdminOutreach && memberSearchQuery ? (
              <div className="mt-5 grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Search results</p>
                  <span className="text-xs text-stone-500">
                    {memberSearchResults.length} match{memberSearchResults.length === 1 ? "" : "es"}
                  </span>
                </div>
                {memberSearchResults.length > 0 ? (
                  memberSearchResults.map((member) => (
                    <div key={member.memberId} className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-base font-semibold">{member.displayName}</p>
                          <p className="mt-1 text-sm text-[var(--ink-soft)]">{member.subtitle}</p>
                        </div>
                        <form action={startAdminConversationFromMessages}>
                          <input type="hidden" name="memberId" value={member.memberId} />
                          <button className="ghost-action">Open conversation</button>
                        </form>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state rounded-[1rem]">
                    No members matched that search yet.
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {inbox.length > 0 ? (
                inbox.map((threadItem) => {
                  const isActive = selectedThread?.threadId === threadItem.threadId;

                  return (
                    <Link
                      key={threadItem.threadId}
                      href={`/messages?thread=${encodeURIComponent(threadItem.threadId)}`}
                      className={`rounded-[1.5rem] border px-4 py-4 transition ${
                        isActive
                          ? "border-[var(--hero)]/30 bg-[var(--accent-soft)]/55"
                          : "border-stone-200 bg-stone-50 hover:border-[var(--hero)]/20 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-semibold">{threadItem.otherMemberName}</p>
                        <div className="text-right">
                          <span className="text-xs text-stone-500">{threadItem.updatedLabel}</span>
                          {threadItem.lastMessageDirection ? (
                            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">
                              {threadItem.lastMessageDirection === "sent" ? "Last message from you" : "Waiting on you"}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{threadItem.lastMessagePreview}</p>
                    </Link>
                  );
                })
              ) : (
                <div className="empty-state rounded-[1rem]">
                  {canStartAdminOutreach
                    ? "No private conversations yet. Use the admin outreach search above to start one, or open an existing marketplace thread from the inbox."
                    : "No private conversations yet. Start one from a request, offer, or completed-order context."}
                </div>
              )}
            </div>
          </section>

          <section className="modern-card rounded-[1.75rem] p-5">
            {selectedThread ? (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Conversation</p>
                    <h2 className="mt-2 text-2xl font-semibold">{selectedThread.otherMemberName}</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      Use this space to sort out details about the request. Keep payment, phone numbers, email addresses, and off-site sales language out of the thread.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {relationship.isFollowing ? (
                      <form action={unfollowConversationMember}>
                        <input type="hidden" name="memberId" value={selectedThread.otherMemberId} />
                        <input type="hidden" name="threadId" value={selectedThread.threadId} />
                        <button className="ghost-action">Unfollow</button>
                      </form>
                    ) : (
                      <form action={followConversationMember}>
                        <input type="hidden" name="memberId" value={selectedThread.otherMemberId} />
                        <input type="hidden" name="threadId" value={selectedThread.threadId} />
                        <button className="ghost-action">Follow</button>
                      </form>
                    )}
                    {relationship.isBlocked ? (
                      <form action={unblockConversationMember}>
                        <input type="hidden" name="memberId" value={selectedThread.otherMemberId} />
                        <input type="hidden" name="threadId" value={selectedThread.threadId} />
                        <button className="danger-action">Unblock</button>
                      </form>
                    ) : (
                      <form action={blockConversationMember}>
                        <input type="hidden" name="memberId" value={selectedThread.otherMemberId} />
                        <input type="hidden" name="threadId" value={selectedThread.threadId} />
                        <button className="danger-action">Block</button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="brand-alert mt-5 rounded-[1.5rem] border border-black/8 px-4 py-3 text-sm leading-7">
                  Messages that share outside phone numbers, email addresses, or off-platform payment instructions get held automatically.
                </div>

                {relationship.hasActiveBlock ? (
                  <div className="mt-5 rounded-[1.5rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
                    {blockNotice}
                  </div>
                ) : null}

                {request ? (
                  <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Negotiation context</p>
                    <h3 className="mt-2 text-lg font-semibold">{request}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      Use this thread to confirm fitment, condition, shipped price, and a realistic claim window before the buyer accepts.
                    </p>
                    {slug ? (
                      <Link className="mt-3 inline-flex font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/requests/${slug}`}>
                        Back to request page
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                {negotiationContext ? (
                  <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Live deal terms</p>
                        <h3 className="mt-2 text-lg font-semibold">{negotiationContext.requestTitle}</h3>
                        <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                          Current offer: {negotiationContext.latestOfferPriceLabel}. Claim window: {negotiationContext.latestClaimWindowLabel}. Status:{" "}
                          {negotiationContext.latestOfferStatusLabel.toLowerCase()}.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link className="ghost-action" href={`/requests/${negotiationContext.requestSlug}`}>
                        Open request
                      </Link>
                      {viewerRoleInThread === "buyer" && (latestOfferStatus === "pending" || latestOfferStatus === "countered") ? (
                        <Link className="brand-button rounded-full px-4 py-2 text-sm font-medium" href="/dashboard?tab=buyer">
                          Review offer
                        </Link>
                      ) : null}
                      {viewerRoleInThread === "seller" && latestOfferStatus === "countered" ? (
                        <Link className="brand-button rounded-full px-4 py-2 text-sm font-medium" href="/dashboard?tab=seller">
                          Review counteroffer
                        </Link>
                      ) : null}
                      {viewerRoleInThread === "seller" && latestOfferStatus === "pending" ? (
                        <Link className="ghost-action" href="/dashboard?tab=seller">
                          View sent offer
                        </Link>
                      ) : null}
                      {latestOfferStatus === "accepted" ? (
                        <Link className="brand-button rounded-full px-4 py-2 text-sm font-medium" href={`/dashboard?tab=${viewerRoleInThread === "seller" ? "seller" : "buyer"}`}>
                          Open claim queue
                        </Link>
                      ) : null}
                    </div>

                    <div className="subtle-panel mt-4 rounded-[1rem] px-4 py-3">
                      <p className="text-sm leading-7 text-[var(--ink-soft)]">{nextStepMessage}</p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1rem] border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Price</p>
                        <p className="mt-2 text-lg font-semibold">{negotiationContext.latestOfferPriceLabel}</p>
                      </div>
                      <div className="rounded-[1rem] border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Claim window</p>
                        <p className="mt-2 text-lg font-semibold">{negotiationContext.latestClaimWindowLabel}</p>
                      </div>
                      <div className="rounded-[1rem] border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Shipping</p>
                        <p className="mt-2 text-sm font-medium">{negotiationContext.shippingLabel}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1rem] border border-stone-200 bg-stone-50 px-4 py-3">
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Recent negotiation history</p>
                      <div className="mt-3 grid gap-2">
                        {negotiationContext.history.map((entry) => (
                          <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[0.9rem] border border-stone-200 bg-white px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{entry.offeredPriceLabel}</span>
                              <span className="text-stone-400">/</span>
                              <span>{entry.claimWindowLabel}</span>
                              <span className="text-stone-400">/</span>
                              <span className="text-[var(--ink-soft)]">{entry.statusLabel}</span>
                            </div>
                            <span className="text-xs text-stone-500">{entry.createdLabel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Price</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Agree on the final all-in price before anyone accepts the claim.</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Condition</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Confirm wear, defects, included parts, and whether the item matches the request exactly.</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Claim window</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Agree on how long the seller needs to ship once the claim becomes active.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {messages.length > 0 ? (
                    messages.map((message) => {
                      const isCurrentUser = message.senderId === profile?.id;

                      return (
                        <div
                          key={message.id}
                          className={`max-w-[44rem] rounded-[1.5rem] border px-4 py-3 ${
                            isCurrentUser
                              ? "ml-auto border-[var(--hero)]/10 bg-[var(--hero)] text-white"
                              : "border-stone-200 bg-stone-50 text-[var(--foreground)]"
                          }`}
                        >
                          <p className={`text-sm leading-7 ${isCurrentUser ? "text-white/95" : "text-[var(--ink-soft)]"}`}>
                            {message.moderationState === "flagged"
                              ? "Message held for review because it looks like an attempt to move payment or contact details off BuyerBoard."
                              : message.body}
                          </p>
                          <p className={`mt-2 text-xs ${isCurrentUser ? "text-white/72" : "text-stone-500"}`}>{message.createdLabel}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state rounded-[1rem]">
                      No messages yet. Start with the item details, condition questions, and shipping timing.
                    </div>
                  )}
                </div>

                <MessageComposer
                  action={sendPrivateMessage}
                  threadId={selectedThread.threadId}
                  isBlocked={relationship.hasActiveBlock}
                  blockNotice={blockNotice}
                  requestTitle={negotiationContext?.requestTitle ?? request}
                />
              </>
            ) : (
              <div className="empty-state rounded-[1rem] p-6">
                Pick a conversation from the inbox, or search for a member above to start a direct thread.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
