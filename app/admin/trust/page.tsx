import Link from "next/link";
import { getAdminPhoneVerificationRequests, requireAdminUser } from "@/lib/auth";
import { getAdminFlaggedMessages } from "@/lib/community";
import { getAdminTrustAppeals, getAdminTrustMembers } from "@/lib/requests";
import { reviewFlaggedPrivateMessage, reviewMemberRiskStatus, reviewPhoneVerificationRequest, reviewTrustAppeal } from "./actions";

type AdminTrustPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function AdminTrustPage({ searchParams }: AdminTrustPageProps) {
  await requireAdminUser("/admin/trust");
  const { notice, error } = await searchParams;
  const requests = await getAdminPhoneVerificationRequests();
  const flaggedMessages = await getAdminFlaggedMessages();
  const appeals = await getAdminTrustAppeals();
  const members = await getAdminTrustMembers();

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Admin trust queue</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Trust review and phone checks</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Review member trust status, phone checks, flagged messages, and appeals before sellers can unlock more marketplace access.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/policy">
              Trust policy
            </Link>
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/reports">
              Listing reports
            </Link>
            <Link className="brand-hero-button tight-button text-sm font-medium" href="/admin/disputes">
              Open dispute queue
            </Link>
            <Link className="outline-button tight-button text-sm font-medium" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
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

        <section className="mt-8 grid gap-4">
          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Member trust overview</p>
            <h2 className="mt-2 text-2xl font-semibold">Seller risk and readiness snapshot</h2>
            <div className="mt-5 grid gap-4">
              {members.length > 0 ? (
                members.map((member) => (
                  <div key={member.profileId} className="data-card rounded-[1rem] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{member.email}</p>
                        <p className="mt-1 text-xl font-semibold">{member.displayName}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          member.riskLabel === "High risk"
                            ? "bg-rose-100 text-rose-900"
                            : member.riskLabel === "Moderate risk"
                              ? "bg-amber-100 text-amber-900"
                              : "brand-pill"
                        }`}
                      >
                        {member.riskLabel}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)] md:grid-cols-3">
                      <p>Status: {member.accountStatus}</p>
                      <p>Plan: {member.planTier}</p>
                      <p>Account: {member.accountType}</p>
                      <p>Phone verified: {member.phoneVerified ? "Yes" : "No"}</p>
                      <p>Payout ready: {member.payoutReady ? "Yes" : "No"}</p>
                      <p>Completed sales: {member.completedSales}</p>
                      <p>Disputes: {member.disputeCount}</p>
                      <p>Flagged PMs: {member.flaggedMessageCount}</p>
                      <p>Reports submitted: {member.submittedReportCount}</p>
                      <p className="md:col-span-3">Dispute rate: {member.disputeRateLabel}</p>
                    </div>
                    {member.adminRiskNote ? (
                      <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                        <p className="font-medium">Current admin note</p>
                        <p className="mt-2">{member.adminRiskNote}</p>
                      </div>
                    ) : null}
                    {member.warningHistory.length > 0 ? (
                      <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3">
                        <p className="font-medium">Warning and review history</p>
                        <div className="mt-3 grid gap-3">
                          {member.warningHistory.map((entry) => (
                            <div key={entry.id} className="rounded-[1rem] border border-stone-200 bg-stone-50 px-3 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                              <p className="font-medium text-[var(--foreground)]">{entry.eventLabel}</p>
                              <p className="mt-1">{entry.note}</p>
                              <p className="mt-2 text-xs text-stone-500">{entry.createdLabel}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <form action={reviewMemberRiskStatus} className="mt-5 grid gap-3">
                      <input type="hidden" name="profileId" value={member.profileId} />
                      <label className="grid gap-2 text-sm font-medium">
                        Marketplace status
                        <select name="accountStatus" defaultValue={member.accountStatus} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                          <option value="active">Active</option>
                          <option value="flagged">Flagged for review</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Admin risk note
                        <textarea
                          name="adminRiskNote"
                          defaultValue={member.adminRiskNote}
                          className="min-h-24 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                          placeholder="Explain why this member is active, flagged, or suspended."
                        />
                      </label>
                      <button className="brand-button w-fit rounded-full px-4 py-2 text-sm font-medium">Save member status</button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No member trust data yet.
                </div>
              )}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Phone verification queue</p>
            <h2 className="mt-2 text-2xl font-semibold">Pending manual phone reviews</h2>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Appeals and reinstatement</p>
            <h2 className="mt-2 text-2xl font-semibold">Members asking for another review</h2>
            <div className="mt-5 grid gap-4">
              {appeals.length > 0 ? (
                appeals.map((appeal) => (
                  <div key={appeal.appealId} className="data-card rounded-[1rem] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{appeal.memberEmail}</p>
                        <p className="mt-1 text-xl font-semibold">{appeal.memberName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-900">{appeal.accountStatus}</span>
                        <span className="brand-pill rounded-full px-3 py-1 text-sm font-medium">{appeal.status}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">Submitted {appeal.createdLabel}</p>
                    <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm leading-7 text-[var(--foreground)]">
                      {appeal.memberMessage}
                    </div>
                    {appeal.adminNote ? (
                      <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                        <p className="font-medium">Latest admin note</p>
                        <p className="mt-2">{appeal.adminNote}</p>
                        {appeal.reviewedLabel ? <p className="mt-2 text-xs text-stone-600">Reviewed {appeal.reviewedLabel}</p> : null}
                      </div>
                    ) : null}
                    {appeal.status === "open" ? (
                      <form action={reviewTrustAppeal} className="mt-5 grid gap-3">
                        <input type="hidden" name="appealId" value={appeal.appealId} />
                        <input type="hidden" name="profileId" value={appeal.profileId} />
                        <label className="grid gap-2 text-sm font-medium">
                          Appeal decision
                          <select name="decision" className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                            <option value="approved">Approve and reinstate account</option>
                            <option value="rejected">Reject and keep warning/probation</option>
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                          Admin note
                          <textarea
                            name="adminNote"
                            className="min-h-24 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                            placeholder="Explain why this appeal was approved or rejected."
                          />
                        </label>
                        <button className="brand-button w-fit rounded-full px-4 py-2 text-sm font-medium">Save appeal decision</button>
                      </form>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No appeals are waiting for review.
                </div>
              )}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Flagged private messages</p>
            <h2 className="mt-2 text-2xl font-semibold">Potential off-platform sale attempts</h2>
            <div className="mt-5 grid gap-4">
              {flaggedMessages.length > 0 ? (
                flaggedMessages.map((message) => (
                  <div key={message.messageId} className="data-card rounded-[1rem] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
                          {message.senderName} to {message.recipientName}
                        </p>
                        <p className="mt-1 text-lg font-semibold">Flagged private message</p>
                      </div>
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-900">{message.createdLabel}</span>
                    </div>
                    <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm leading-7 text-[var(--foreground)]">
                      {message.body}
                    </div>
                    {message.reviewNote ? (
                      <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                        <p className="font-medium">Latest moderation note</p>
                        <p className="mt-2">{message.reviewNote}</p>
                      </div>
                    ) : null}
                    <form action={reviewFlaggedPrivateMessage} className="mt-5 grid gap-3">
                      <input type="hidden" name="messageId" value={message.messageId} />
                      <label className="grid gap-2 text-sm font-medium">
                        Moderation note
                        <textarea
                          name="reviewNote"
                          className="min-h-24 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                          placeholder="Explain why this flagged message was reviewed and whether the sender needs closer monitoring."
                        />
                      </label>
                      <button className="brand-button w-fit rounded-full px-4 py-2 text-sm font-medium">Mark message reviewed</button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No flagged private messages are waiting for review.
                </div>
              )}
            </div>
          </div>

          {requests.length > 0 ? (
            requests.map((request) => (
              <div key={request.requestId} className="data-card rounded-[1.15rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{request.memberName}</p>
                    <h2 className="mt-2 text-2xl font-semibold">{request.phoneNumber}</h2>
                  </div>
                  <span className="brand-pill rounded-full px-3 py-1 text-sm font-medium">{request.status}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)] md:grid-cols-2">
                  <p>Email: {request.memberEmail}</p>
                  <p>Submitted: {request.createdLabel}</p>
                </div>
                {request.reviewNote ? (
                  <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                    <p className="font-medium">Latest admin note</p>
                    <p className="mt-2">{request.reviewNote}</p>
                  </div>
                ) : null}
                <form action={reviewPhoneVerificationRequest} className="mt-5 grid gap-3">
                  <input type="hidden" name="requestId" value={request.requestId} />
                  <input type="hidden" name="profileId" value={request.profileId} />
                  <label className="grid gap-2 text-sm font-medium">
                    Review decision
                    <select name="decision" className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <option value="approved">Approve phone verification</option>
                      <option value="rejected">Reject and request a better number</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Admin note
                    <textarea
                      name="reviewNote"
                      className="min-h-24 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                      placeholder="Leave a note explaining approval or why the request was rejected."
                    />
                  </label>
                  <button className="brand-button w-fit rounded-full px-4 py-2 text-sm font-medium">Save phone review</button>
                </form>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No phone verification requests are waiting.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
