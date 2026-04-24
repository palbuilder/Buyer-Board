import Link from "next/link";
import { ImageStrip } from "@/app/components/image-strip";
import { requireAdminUser } from "@/lib/auth";
import { getAdminListingReports } from "@/lib/requests";
import { resolveListingReport } from "./actions";

type AdminReportsPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  await requireAdminUser("/admin/reports");
  const { notice, error } = await searchParams;
  const reports = (await getAdminListingReports()).filter((report) => report != null);

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Admin moderation</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Listing reports and safety review</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Review reports about unsafe, illegal, spammy, or policy-breaking listings and decide whether the listing stays up, loses images, or comes down.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/policy">
              Trust policy
            </Link>
            <Link className="brand-hero-button tight-button text-sm font-medium" href="/admin/disputes">
              Open dispute queue
            </Link>
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/trust">
              Trust queue
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

        <div className="mt-6 data-card rounded-[1.15rem] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">How this queue works</p>
          <h2 className="mt-2 text-2xl font-semibold">Unsafe request reports arrive here</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)] md:grid-cols-2">
            <p>Request and offer report buttons feed this queue, including the “unsafe or dangerous listing” reason from public request pages.</p>
            <p>Admins review the evidence here, choose whether the listing stays up, loses images, or is removed, and leave a short moderation note explaining the decision.</p>
          </div>
        </div>

        <section className="mt-8 grid gap-4">
          {reports.length > 0 ? (
            reports.map((report) => (
              <div key={report.reportId} className="data-card rounded-[1.15rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{report.requestTitle}</p>
                    <h2 className="mt-2 text-2xl font-semibold">{report.reasonLabel}</h2>
                  </div>
                  <span className="brand-pill rounded-full px-3 py-1 text-sm font-medium">{report.statusLabel}</span>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)] md:grid-cols-2">
                  <p>Target: {report.reportTarget === "offer" ? `Seller offer${report.offerSellerName ? ` by ${report.offerSellerName}` : ""}` : "Buyer request listing"}</p>
                  <p>Request ID: {report.requestId}</p>
                  <p>Reported by: {report.reportedById}</p>
                  <p>Reported: {report.createdLabel}</p>
                  <p>
                    Listing:{" "}
                    <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={`/requests/${report.requestSlug}`}>
                      Open listing
                    </Link>
                  </p>
                </div>

                <div className="mt-4 rounded-[1.25rem] border border-black/8 bg-[var(--accent-soft)] px-4 py-3 text-sm leading-7 text-[var(--foreground)]">
                  {report.details}
                </div>
                <ImageStrip imageUrls={report.imageUrls} altPrefix={`${report.requestTitle} report evidence`} />

                {report.adminNote ? (
                  <div className="brand-alert mt-4 rounded-[1.25rem] border border-black/8 px-4 py-3 text-sm leading-7">
                    <p className="font-medium">Current admin note</p>
                    <p className="mt-2">{report.adminNote}</p>
                  </div>
                ) : null}

                <form action={resolveListingReport} className="mt-5 grid gap-3">
                  <input type="hidden" name="reportId" value={report.reportId} />
                  <input type="hidden" name="requestId" value={report.requestId} />
                  <input type="hidden" name="offerId" value={report.offerId ?? ""} />
                  <label className="grid gap-2 text-sm font-medium">
                    Resolution
                    <select name="resolution" className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <option value="reviewed">Reviewed, listing stays up</option>
                      <option value="remove_images">Remove the reported images only</option>
                      <option value="removed">{report.reportTarget === "offer" ? "Remove this seller offer" : "Remove listing from the board"}</option>
                      <option value="dismissed">Dismiss report</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Admin note
                    <textarea
                      name="adminNote"
                      className="min-h-28 rounded-[1.25rem] border border-black/10 bg-white px-4 py-3"
                      placeholder="Summarize why the listing stays up, was removed, or why the report was dismissed."
                    />
                  </label>
                  <button className="brand-button w-fit rounded-full px-4 py-2 text-sm font-medium">Save moderation decision</button>
                </form>
              </div>
            ))
          ) : (
            <div className="empty-state">
              No listing reports are waiting for admin review.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
