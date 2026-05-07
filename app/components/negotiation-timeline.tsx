import Link from "next/link";
import type { NegotiationTimelineItem, SellerOffer } from "@/lib/types";

type TimelineRequestSummary = {
  title: string;
  postedLabel: string;
  budgetLabel: string;
};

export function getOfferCurrentState(status: SellerOffer["status"]) {
  const states: Record<SellerOffer["status"], { label: string; detail: string }> = {
    pending: {
      label: "Awaiting buyer review",
      detail: "The seller has terms on the table. The buyer can accept, counter, or decline.",
    },
    countered: {
      label: "Seller reviewing counteroffer",
      detail: "The buyer asked for a change. The seller should update the offer or move on.",
    },
    accepted: {
      label: "Accepted",
      detail: "The buyer accepted this offer. Funding and fulfillment are the next operational steps.",
    },
    declined: {
      label: "Declined",
      detail: "The buyer declined this offer. No more action is needed on this negotiation.",
    },
  };

  return states[status];
}

export function buildNegotiationTimeline(input: {
  request: TimelineRequestSummary;
  offer: SellerOffer;
  priceDeltaLabel?: string;
}): NegotiationTimelineItem[] {
  const items: NegotiationTimelineItem[] = [
    {
      id: `request-${input.offer.requestId}`,
      actorLabel: "Buyer",
      title: "Original request posted",
      detail: input.request.title,
      timestampLabel: input.request.postedLabel,
      priceLabel: input.request.budgetLabel,
    },
    {
      id: `offer-${input.offer.id}`,
      actorLabel: "Seller",
      title: input.offer.createdLabel ? "Seller sent offer" : "Seller offer",
      detail: input.offer.message,
      timestampLabel: input.offer.createdLabel ?? "Recently",
      priceLabel: input.offer.offeredPriceLabel,
      priceDeltaLabel: input.priceDeltaLabel ?? input.offer.priceDeltaLabel,
      claimWindowLabel: `${input.offer.proposedClaimWindowHours} hours`,
      statusLabel: getOfferCurrentState(input.offer.status).label,
      isCurrent: input.offer.status === "pending" && (input.offer.timelineMessages ?? []).length === 0,
    },
  ];

  for (const message of input.offer.timelineMessages ?? []) {
    const normalizedBody = message.body.trim();

    if (message.actorLabel === "Seller" && normalizedBody === input.offer.message.trim()) {
      continue;
    }

    const isSellerUpdate = normalizedBody.toLowerCase().startsWith("seller updated offer:");
    const isBuyerDecision = message.actorLabel === "Buyer" && input.offer.status !== "pending";

    items.push({
      id: `message-${message.id}`,
      actorLabel: message.actorLabel,
      title: isSellerUpdate ? "Seller updated offer" : isBuyerDecision ? getOfferCurrentState(input.offer.status).label : `${message.actorLabel} message`,
      detail: normalizedBody,
      timestampLabel: message.createdLabel,
      isCurrent: isSellerUpdate && input.offer.status === "pending",
    });
  }

  const hasCurrentItem = items.some((item) => item.isCurrent);

  if (!hasCurrentItem && input.offer.status !== "pending") {
    items.push({
      id: `current-${input.offer.id}`,
      actorLabel: input.offer.status === "countered" ? "Buyer" : "System",
      title: getOfferCurrentState(input.offer.status).label,
      detail: getOfferCurrentState(input.offer.status).detail,
      timestampLabel: "Current state",
      statusLabel: getOfferCurrentState(input.offer.status).label,
      isCurrent: true,
    });
  }

  return items;
}

export function NegotiationTimeline({
  currentStateLabel,
  currentStateDetail,
  items,
  requestHref,
}: {
  currentStateLabel: string;
  currentStateDetail: string;
  items: NegotiationTimelineItem[];
  requestHref?: string;
}) {
  return (
    <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Negotiation timeline</p>
          <h3 className="mt-1 text-lg font-semibold">{currentStateLabel}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{currentStateDetail}</p>
        </div>
        {requestHref ? (
          <Link className="ghost-action" href={requestHref}>
            Open request
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-[1rem] border px-4 py-3 ${
              item.isCurrent ? "border-[var(--hero)] bg-[var(--accent-soft)]/45" : "border-stone-200 bg-stone-50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.title}</p>
              <span className="text-xs text-stone-500">{item.timestampLabel}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">
              {item.actorLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.priceLabel ? <span className="soft-chip-muted">{item.priceLabel}</span> : null}
              {item.priceDeltaLabel ? <span className="soft-chip-muted">{item.priceDeltaLabel}</span> : null}
              {item.claimWindowLabel ? <span className="soft-chip-muted">{item.claimWindowLabel} claim window</span> : null}
              {item.statusLabel ? <span className="soft-chip">{item.statusLabel}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
