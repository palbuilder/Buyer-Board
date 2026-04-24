import Link from "next/link";
import { ImageStrip } from "@/app/components/image-strip";
import { requireAdminUser } from "@/lib/auth";
import { getAdminDisputes } from "@/lib/requests";
import { resolveAdminDispute } from "./actions";

type AdminDisputesPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function AdminDisputesPage({ searchParams }: AdminDisputesPageProps) {
  await requireAdminUser("/admin/disputes");
  const { notice, error } = await searchParams;
  const disputes = await getAdminDisputes();

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Admin review</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Dispute queue and payment holds</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Review wrong-item and defective-item cases, decide the outcome, and move payment status toward refund, release, or normal completion.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/policy">
              Trust policy
            </Link>
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/reports">
              Listing reports
            </Link>
            <Link className="brand-hero-button tight-button text-sm font-medium" href="/dashboard">
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
          {disputes.length > 0 ? (
            disputes.map((dispute) => (
              <div key={dispute.disputeId} className="data-card rounded-[1.15rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{dispute.requestTitle}</p>
                    <h2 className="mt-2 text-2xl font-semibold">{dispute.reasonLabel}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="brand-pill rounded-full px-3 py-1 text-sm font-medium">{dispute.statusLabel}</span>
                    <span className="rounded-full border border-black/10 px-3 py-1 text-sm font-medium">
                      Payment: {dispute.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)] md:grid-cols-2">
                  <p>Buyer ID: {dispute.buyerId}</p>
                  <p>Seller ID: {dispute.sellerId}</p>
                  <p>Reported: {dispute.createdLabel}</p>
                  <p>Transaction ID: {dispute.transactionId}</p>
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-[var(--accent-soft)] px-4 py-3 text-sm leading-7 text-[var(--foreground)]">
                  {dispute.details}
                </div>
                {dispute.buyerEvidence ? (
                  <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-white px-4 py-3 text-sm leading-7 text-[var(--foreground)]">
                    <p className="font-medium">Buyer evidence</p>
                    <p className="mt-2">{dispute.buyerEvidence}</p>
                    <ImageStrip imageUrls={dispute.buyerEvidenceImageUrls} altPrefix={`${dispute.requestTitle} buyer evidence`} />
                  </div>
                ) : null}

                {dispute.sellerResponse ? (
                  <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                    <p className="font-medium">Seller response</p>
                    <p className="mt-2">{dispute.sellerResponse}</p>
                    {dispute.sellerEvidence ? <p className="mt-2">Seller evidence: {dispute.sellerEvidence}</p> : null}
                    <ImageStrip imageUrls={dispute.sellerEvidenceImageUrls} altPrefix={`${dispute.requestTitle} seller evidence`} />
                  </div>
                ) : (
                  <div className="empty-state mt-4">
                    Seller has not responded yet.
                  </div>
                )}

                <form action={resolveAdminDispute} className="mt-5 grid gap-3">
                  <input type="hidden" name="disputeId" value={dispute.disputeId} />
                  <label className="grid gap-2 text-sm font-medium">
                    Resolution
                    <select name="resolution" className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <option value="resolved_buyer">Resolve for buyer and refund / keep funds held</option>
                      <option value="resolved_seller">Resolve for seller and release funds</option>
                      <option value="closed">Close case with no further action</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Admin note
                    <textarea
                      name="resolutionNote"
                      className="min-h-28 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                      placeholder="Summarize the evidence and why the case was resolved this way."
                    />
                  </label>
                  <button className="brand-button w-fit rounded-full px-4 py-2 text-sm font-medium">Save resolution</button>
                </form>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No disputes are waiting for admin review.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
