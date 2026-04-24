import Link from "next/link";
import { ImageStrip } from "@/app/components/image-strip";
import { signOutMember } from "@/app/auth/actions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { getMarketplaceHighlights, isDemoMode } from "@/lib/requests";

const steps = [
  {
    title: "Post what you want",
    text: "Buyers describe the item, set a target price, and explain condition or shipping requirements.",
  },
  {
    title: "Get matched by supply",
    text: "Resellers, collectors, and part-out shops browse real demand instead of hoping the right buyer finds them.",
  },
  {
    title: "Fund, fulfill, and close",
    text: "The buyer approves a claim, funds the order, and the platform tracks completion and trust signals.",
  },
];

const productPanels = [
  {
    label: "Buyer flow",
    title: "Wanted-item posting",
    text: "Budget, fitment, shipping, and condition get captured up front so sellers can quote against real demand.",
  },
  {
    label: "Seller flow",
    title: "Offer and claim negotiation",
    text: "Sellers send claim offers with price, lead time, photos, and trust signals in one place.",
  },
  {
    label: "Platform flow",
    title: "Funding and trust review",
    text: "Payment, disputes, moderation, reviews, and fulfillment timing stay on-platform instead of spilling into text threads.",
  },
];

export default async function Home() {
  const highlights = await getMarketplaceHighlights();
  const newestRequests = highlights.newestRequests;
  const demoMode = isDemoMode();
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;

  const metrics = [
    { label: "Open requests", value: String(highlights.openRequestCount) },
    { label: "Live offers", value: String(highlights.activeOfferCount) },
    { label: "New today", value: String(newestRequests.length) },
  ];

  return (
    <main className="page-shell min-h-screen text-stone-900">
      <section className="section-card rounded-[1.35rem] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[var(--accent-strong)]">Demand-first marketplace</p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem] lg:text-[3.3rem]">
              Buyers post intent first. Sellers respond with price, timing, and trust.
            </h1>
            <p className="mt-2.5 max-w-3xl text-sm leading-6 text-[var(--ink-soft)] sm:text-[15px]">
              Buyers post what they need first. Sellers respond with real offers, so the buyer can compare price, timing, and trust in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className="outline-button tight-button font-medium" href="/requests">
              Browse requests
            </Link>
            <Link className="outline-button tight-button font-medium" href="/rules">
              Rules
            </Link>
            {user ? (
              <>
                <Link className="outline-button tight-button font-medium" href="/dashboard">
                  Dashboard
                </Link>
                {profile?.role === "admin" ? (
                  <>
                    <Link className="outline-button tight-button font-medium" href="/admin/disputes">
                      Disputes
                    </Link>
                    <Link className="outline-button tight-button font-medium" href="/admin/trust">
                      Trust
                    </Link>
                  </>
                ) : null}
                <form action={signOutMember}>
                  <button className="outline-button tight-button font-medium">Sign out</button>
                </form>
              </>
            ) : (
              <Link className="outline-button tight-button font-medium" href="/auth?next=/dashboard">
                Sign in
              </Link>
            )}
            <Link className="brand-hero-button tight-button font-medium" href="/requests/new">
              Post a request
            </Link>
          </div>
        </div>
      </section>

      <section className="section-card mt-3 rounded-[1.2rem] px-4 py-3.5 sm:px-5">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="metric-tile rounded-[0.95rem] px-3.5 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">{metric.label}</p>
              <p className="mt-1 text-[1.75rem] font-semibold tracking-[-0.03em]">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      {demoMode ? (
        <div className="subtle-panel mt-3 rounded-[0.95rem] px-4 py-2.5 text-sm leading-6 text-stone-800">
          Demo mode is active. Add Supabase keys in <code>.env.local</code> to switch these screens from sample data to live database records.
        </div>
      ) : null}

      <section className="mt-4 grid items-start gap-3.5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <section className="section-card rounded-[1.35rem] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">Live request feed</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Newest demand hitting the board</h2>
            </div>
            <Link className="text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/requests">
              View all
            </Link>
          </div>
          <div className="mt-3 grid gap-2.5">
            {newestRequests.length > 0 ? (
              newestRequests.map((request) => (
                <Link
                  key={request.slug}
                  href={`/requests/${request.slug}`}
                  className="data-card grid gap-3 rounded-[0.95rem] px-3.5 py-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(66,54,30,0.1)] lg:grid-cols-[minmax(0,1fr)_168px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">{request.category}</p>
                        <h3 className="mt-1 text-[1.05rem] font-semibold">{request.title}</h3>
                      </div>
                      <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1.5 text-sm font-medium text-[var(--foreground)]">
                        {request.budgetLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{request.summary}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs text-stone-600">
                      {request.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-stone-200 px-2.5 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex h-full items-center">
                    {request.imageUrls[0] ? (
                      <ImageStrip imageUrls={request.imageUrls.slice(0, 1)} altPrefix={request.title} />
                    ) : (
                      <div className="subtle-panel flex min-h-[104px] w-full items-center justify-center rounded-[0.95rem] px-3 text-sm text-[var(--ink-soft)]">
                        No photo yet
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[0.95rem] border border-dashed border-stone-300 bg-white/70 px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]">
                No live requests yet. Post the first wanted item and this area will start filling from your database.
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-start">
            <Link className="brand-button tight-button text-sm font-medium" href="/requests">
              Open full request board
            </Link>
          </div>
        </section>

        <aside className="grid gap-3.5">
          <section className="section-card rounded-[1.2rem] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">How it works</p>
                <h2 className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.02em]">Three clean steps</h2>
              </div>
            </div>
            <div className="mt-3 space-y-2.5">
              {steps.map((step, index) => (
                <div key={step.title} className="data-card rounded-[0.95rem] px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm font-semibold text-[var(--foreground)]">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-5.5 text-[var(--ink-soft)]">{step.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section-card rounded-[1.2rem] px-4 py-4">
            <div className="grid gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">Popular demand</p>
                <h2 className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.02em]">Top requested items</h2>
              </div>
              <div className="space-y-2.5">
                {highlights.topRequestedItems.length > 0 ? (
                  highlights.topRequestedItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="data-card flex items-start justify-between gap-3 rounded-[0.95rem] px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">
                          {item.category} / {item.subcategory}
                        </p>
                        <h3 className="mt-1 text-base font-semibold">{item.label}</h3>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">Requests</p>
                        <p className="mt-1 text-2xl font-semibold">{item.requestCount}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[0.95rem] border border-dashed border-stone-300 bg-white/70 px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]">
                    Once buyers start requesting the same item type, the hot list will appear here.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="section-card rounded-[1.2rem] px-4 py-4">
            <div className="grid gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">Seller activity</p>
                <h2 className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.02em]">Items pulling offers</h2>
              </div>
              <div className="space-y-2.5">
                {highlights.topOfferMagnetItems.length > 0 ? (
                  highlights.topOfferMagnetItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="data-card flex items-start justify-between gap-3 rounded-[0.95rem] px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">
                          {item.category} / {item.subcategory}
                        </p>
                        <h3 className="mt-1 text-base font-semibold">{item.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                          {item.requestCount} request{item.requestCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">Offers</p>
                        <p className="mt-1 text-2xl font-semibold">{item.offerCount}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[0.95rem] border border-dashed border-stone-300 bg-white/70 px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]">
                    As sellers respond to requests, this panel will show which items are easiest to source and quote.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="section-card rounded-[1.2rem] px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">How BuyerBoard runs</p>
            <div className="mt-3 space-y-2.5">
              {productPanels.map((panel) => (
                <div key={panel.title} className="subtle-panel rounded-[0.9rem] px-3.5 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500">{panel.label}</p>
                  <h3 className="mt-1 text-sm font-semibold">{panel.title}</h3>
                  <p className="mt-1 text-sm leading-5.5 text-[var(--ink-soft)]">{panel.text}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
