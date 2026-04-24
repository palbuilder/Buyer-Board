import Image from "next/image";
import Link from "next/link";
import { ImageStrip } from "@/app/components/image-strip";
import { getOptionalCurrentProfile } from "@/lib/auth";
import { getSavedRequestFilters, getWantedRequests, isDemoMode } from "@/lib/requests";
import type { SavedRequestFilter } from "@/lib/types";
import { saveRequestFilterPreset } from "./actions";
import { RequestFilters } from "./request-filters";

function ListViewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
      <path d="M2 3.25h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 6.75h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 10.25h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 13.75h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GalleryViewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1.5" fill="currentColor" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function buildRequestsViewHref(input: {
  currentParams: URLSearchParams;
  view: "list" | "gallery";
}) {
  const nextParams = new URLSearchParams(input.currentParams.toString());

  if (input.view === "list") {
    nextParams.delete("view");
  } else {
    nextParams.set("view", input.view);
  }

  const query = nextParams.toString();
  return query ? `/requests?${query}` : "/requests";
}

function getRequestSignals(request: Awaited<ReturnType<typeof getWantedRequests>>[number]) {
  const signals: Array<{ label: string; tone: "hero" | "accent" | "neutral" }> = [];

  if (request.postedLabel.includes("hour")) {
    signals.push({ label: "Fresh demand", tone: "hero" });
  }

  if (request.targetBudget >= 500) {
    signals.push({ label: "Strong budget", tone: "accent" });
  }

  if (request.shipping === "Any") {
    signals.push({ label: "Flexible shipping", tone: "neutral" });
  }

  if (request.details.length >= 140) {
    signals.push({ label: "Detailed brief", tone: "neutral" });
  }

  if (request.status === "negotiating") {
    signals.push({ label: "Active negotiation", tone: "hero" });
  }

  return signals.slice(0, 3);
}

type RequestsPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
    q?: string;
    category?: string;
    subcategory?: string;
    shipping?: string;
    status?: string;
    sort?: string;
    view?: string;
    photos?: string;
  }>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const [requests, profile, params] = await Promise.all([getWantedRequests(), getOptionalCurrentProfile(), searchParams]);
  const demoMode = isDemoMode();
  const localSeedApplyReady = process.env.NODE_ENV !== "production" && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const {
    notice,
    error,
    q = "",
    category = "All categories",
    subcategory = "All subcategories",
    shipping = "Any",
    status = "All statuses",
    sort = "Newest first",
    view = "list",
    photos = "all",
  } = params;
  const savedFilters: SavedRequestFilter[] = profile ? await getSavedRequestFilters(profile.id) : [];
  const normalizedQuery = q.trim().toLowerCase();
  const activeView = view === "gallery" ? "gallery" : "list";
  const activePhotoFilter = photos === "has-photo" ? "has-photo" : "all";
  const currentParams = new URLSearchParams();

  if (q) currentParams.set("q", q);
  if (category !== "All categories") currentParams.set("category", category);
  if (subcategory !== "All subcategories") currentParams.set("subcategory", subcategory);
  if (shipping !== "Any") currentParams.set("shipping", shipping);
  if (status !== "All statuses") currentParams.set("status", status);
  if (sort !== "Newest first") currentParams.set("sort", sort);
  if (activePhotoFilter === "has-photo") currentParams.set("photos", activePhotoFilter);

  const filteredRequests = requests
    .filter((request) => {
      const textMatch =
        !normalizedQuery ||
        [request.title, request.category, request.subcategory, request.details, request.location]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const categoryMatch = category === "All categories" || request.category === category;
      const subcategoryMatch = subcategory === "All subcategories" || request.subcategory === subcategory;
      const shippingMatch = shipping === "Any" || request.shipping === shipping;
      const statusMatch = status === "All statuses" || request.status === status;
      const photoMatch = activePhotoFilter === "all" || request.imageUrls.length > 0;
      return textMatch && categoryMatch && subcategoryMatch && shippingMatch && statusMatch && photoMatch;
    })
    .sort((left, right) => {
      if (sort === "Budget high to low") {
        return right.targetBudget - left.targetBudget;
      }

      if (sort === "Budget low to high") {
        return left.targetBudget - right.targetBudget;
      }

      return 0;
    });
  const freshRequestCount = filteredRequests.filter((request) => request.postedLabel.includes("hour")).length;
  const strongBudgetCount = filteredRequests.filter((request) => request.targetBudget >= 500).length;
  const flexibleShippingCount = filteredRequests.filter((request) => request.shipping === "Any").length;
  const negotiatingCount = filteredRequests.filter((request) => request.status === "negotiating").length;
  const photoBackedCount = filteredRequests.filter((request) => request.imageUrls.length > 0).length;
  const averageBudget =
    filteredRequests.length > 0
      ? Math.round(filteredRequests.reduce((sum, request) => sum + request.targetBudget, 0) / filteredRequests.length)
      : 0;

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Demand board</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Open buyer requests</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Sellers browse active requests, filter by category and subcategory, then decide whether to start a conversation.
            </p>
          </div>
          <Link className="brand-hero-button tight-button text-sm font-medium" href="/requests/new">
            Post a request
          </Link>
        </div>

        {demoMode ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
            Showing sample requests until Supabase keys are added in `.env.local`.
          </div>
        ) : null}

        {!demoMode && !localSeedApplyReady ? (
          <div className="mt-6 rounded-[1.5rem] border border-sky-300/70 bg-sky-50 px-4 py-3 text-sm leading-7 text-sky-950">
            Local note: `node scripts/dev-seed.mjs` is only a preview. Add `SUPABASE_SERVICE_ROLE_KEY` and run `npm run seed:dev` if you want recent test requests from other users to appear here.
          </div>
        ) : null}

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

        <RequestFilters
          searchQuery={q}
          category={category}
          subcategory={subcategory}
          shipping={shipping}
          status={status}
          sort={sort}
          photoFilter={activePhotoFilter}
          savedFilters={savedFilters}
        />

        {filteredRequests.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Matching requests</p>
              <p className="mt-2 text-2xl font-semibold">{filteredRequests.length}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Total requests in the current board view.</p>
            </div>
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Fresh demand</p>
              <p className="mt-2 text-2xl font-semibold">{freshRequestCount}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Requests posted within the last day.</p>
            </div>
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Strong budget</p>
              <p className="mt-2 text-2xl font-semibold">{strongBudgetCount}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Requests at $500 target or higher.</p>
            </div>
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Flexible shipping</p>
              <p className="mt-2 text-2xl font-semibold">{flexibleShippingCount}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Buyers open to shipping or pickup.</p>
            </div>
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Active negotiation</p>
              <p className="mt-2 text-2xl font-semibold">{negotiatingCount}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Requests where sellers are already engaging.</p>
            </div>
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Average target</p>
              <p className="mt-2 text-2xl font-semibold">${averageBudget}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Typical buyer target price in this filtered view.</p>
            </div>
            <div className="data-card rounded-[1rem] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Photo-backed</p>
              <p className="mt-2 text-2xl font-semibold">{photoBackedCount}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">Requests with at least one photo ready for gallery browsing.</p>
            </div>
          </div>
        ) : null}

        {profile ? (
          <div className="mt-4 rounded-[1.5rem] border border-black/8 bg-white/70 p-4">
            <form action={saveRequestFilterPreset} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Save current board filters
                  <input
                    name="filterName"
                    className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                    placeholder="Example: Georgia auto parts under $300"
                  />
                </label>
                <input type="hidden" name="searchQuery" value={q} />
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="subcategory" value={subcategory} />
                <input type="hidden" name="shipping" value={shipping} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="sort" value={sort} />
                <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                  <input type="checkbox" name="alertEnabled" className="h-4 w-4 rounded border-stone-300" />
                  Alert me when a new request matches this saved filter
                </label>
              </div>
              <button className="brand-button rounded-full px-5 py-3 text-sm font-medium">Save this filter</button>
            </form>

            {savedFilters.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {savedFilters.map((filter) => (
                  <span key={filter.id} className="soft-chip">
                    {filter.name}
                    {filter.alertEnabled ? " - alerts on" : ""}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <div className="mb-4 flex items-center justify-start">
            {/* View mode is presentation-only, so it lives with the board results instead of inside the data filters. */}
            <div className="view-toggle-shell inline-flex rounded-[1rem] p-1">
              <Link
                href={buildRequestsViewHref({ currentParams, view: "gallery" })}
                className={`view-toggle-option inline-flex items-center gap-2 rounded-[0.8rem] px-3 py-2 text-sm font-medium transition ${
                  activeView === "gallery"
                    ? "view-toggle-option-active text-[var(--foreground)]"
                    : "text-[var(--ink-soft)] hover:text-[var(--foreground)]"
                }`}
                aria-current={activeView === "gallery" ? "page" : undefined}
              >
                <GalleryViewIcon />
                <span>Gallery</span>
              </Link>
              <Link
                href={buildRequestsViewHref({ currentParams, view: "list" })}
                className={`view-toggle-option inline-flex items-center gap-2 rounded-[0.8rem] px-3 py-2 text-sm font-medium transition ${
                  activeView === "list"
                    ? "view-toggle-option-active text-[var(--foreground)]"
                    : "text-[var(--ink-soft)] hover:text-[var(--foreground)]"
                }`}
                aria-current={activeView === "list" ? "page" : undefined}
              >
                <ListViewIcon />
                <span>List</span>
              </Link>
            </div>
          </div>

          <div className={activeView === "gallery" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}>
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <Link
                key={request.slug}
                href={`/requests/${request.slug}`}
                className={
                  activeView === "gallery"
                    ? "modern-card gallery-request-card rounded-[1.5rem] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(66,54,30,0.12)]"
                    : "modern-card rounded-[1.75rem] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(66,54,30,0.12)] sm:p-6"
                }
              >
                {activeView === "gallery" ? (
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{request.category}</p>
                        <h2 className="mt-2 line-clamp-2 text-lg font-semibold">{request.title}</h2>
                      </div>
                      <span className="soft-chip whitespace-nowrap">{request.postedLabel}</span>
                    </div>
                    <div className="rounded-[1rem] border border-[var(--hero)]/10 bg-[var(--accent-soft)] px-4 py-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--foreground)]">Buyer target</p>
                      <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{request.budgetLabel}</p>
                    </div>
                    <div className="gallery-media-frame relative overflow-hidden rounded-[1rem] border border-black/8 bg-white/80">
                      {request.imageUrls[0] ? (
                        // Gallery view is intentionally photo-first so sellers can scan demand quickly.
                        <Image src={request.imageUrls[0]} alt={request.title} fill className="object-cover" sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw" />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--ink-soft)]">
                          No photo yet
                        </div>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 text-sm text-[var(--ink-soft)]">
                      <span className="truncate">{request.location}</span>
                      <span className="soft-chip-muted whitespace-nowrap">{request.status}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                        <span>{request.category}</span>
                        <span>/</span>
                        <span>{request.subcategory}</span>
                        <span>/</span>
                        <span>{request.postedLabel}</span>
                        <span>/</span>
                        <span>{request.location}</span>
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold">{request.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{request.summary}</p>
                      {request.imageUrls[0] ? <ImageStrip imageUrls={request.imageUrls.slice(0, 1)} altPrefix={request.title} /> : null}
                      {getRequestSignals(request).length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {getRequestSignals(request).map((signal) => (
                            <span
                              key={signal.label}
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                signal.tone === "hero"
                                  ? "bg-[var(--hero)] text-white"
                                  : signal.tone === "accent"
                                    ? "bg-[var(--accent)] text-white"
                                    : "border border-stone-200 bg-white text-[var(--foreground)]"
                              }`}
                            >
                              {signal.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-stone-600">
                        {request.tags.map((tag) => (
                          <span key={tag} className="soft-chip-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-52 rounded-[1.5rem] border border-[var(--hero)]/10 bg-[var(--accent-soft)] p-4">
                      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--foreground)]">Buyer target</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{request.budgetLabel}</p>
                      <p className="mt-3 text-sm text-[var(--foreground)]/80">{request.shipping}</p>
                      <p className="mt-4 inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-medium text-teal-950">
                        {request.status}
                      </p>
                    </div>
                  </div>
                )}
              </Link>
            ))
          ) : (
              <div className="empty-state rounded-[1rem] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">No matching requests</p>
              <h2 className="mt-2 text-2xl font-semibold">Try a broader filter.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
                There are currently no requests matching that filter combination. Try changing category, subcategory, shipping, or status.
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
