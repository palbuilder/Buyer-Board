"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const faqItems = [
  {
    question: "How does buying work?",
    answer:
      "Post what you want, set your target price, and describe the condition or shipping you need. Sellers respond with claim offers, and you compare price, timing, and trust before accepting one.",
  },
  {
    question: "How does selling work?",
    answer:
      "Browse buyer requests, send a claim offer with your price and timing, and wait for the buyer to accept, deny, or counter. Once accepted and funded, the request moves into your active claims queue.",
  },
  {
    question: "What if something goes wrong?",
    answer:
      "If an item is wrong, defective, unsafe, or misleading, use the built-in report and dispute tools. BuyerBoard keeps those issues on-platform so they can be reviewed instead of getting buried in private messages.",
  },
  {
    question: "Do I need my own website to use BuyerBoard?",
    answer:
      "No. Buyers and sellers should be able to use BuyerBoard directly. Some payment-service setup still works better once BuyerBoard has a public web address, but regular marketplace use does not require your own website.",
  },
  {
    question: "Where do I get help right now?",
    answer:
      "A dedicated support inbox is not live yet. For now, use the Rules page, the reporting tools, and the dispute flow if a listing, offer, or transaction needs review.",
  },
];

export function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const helpLabel = useMemo(() => (open ? "Close help" : "Help"), [open]);

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {open ? (
        <aside className="help-drawer section-card w-[min(26rem,calc(100vw-2rem))] rounded-[1.2rem] px-4 py-4 shadow-[0_20px_50px_rgba(12,24,33,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">Help</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Quick answers</h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--ink-soft)]">
                Use this panel when you need a quick explanation without hunting through the app.
              </p>
            </div>
            <button
              type="button"
              className="ghost-action text-sm"
              onClick={() => setOpen(false)}
              aria-label="Close help panel"
            >
              Close
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {faqItems.map((item, index) => {
              const expanded = expandedIndex === index;

              return (
                <section key={item.question} className="data-card rounded-[0.95rem] px-3.5 py-3">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => setExpandedIndex(expanded ? null : index)}
                    aria-expanded={expanded}
                  >
                    <span className="text-sm font-semibold leading-6">{item.question}</span>
                    <span className="soft-chip-muted shrink-0">{expanded ? "Hide" : "Open"}</span>
                  </button>
                  {expanded ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.answer}</p>
                  ) : null}
                </section>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <Link className="outline-button tight-button text-center text-sm font-medium" href="/rules">
              Open rules
            </Link>
            <Link className="outline-button tight-button text-center text-sm font-medium" href="/dashboard">
              Open dashboard
            </Link>
          </div>

          <div className="subtle-panel mt-3 rounded-[0.95rem] px-3.5 py-3 text-sm leading-6 text-[var(--ink-soft)]">
            If something looks unsafe or misleading, use the report buttons inside the request, offer, or transaction flow so the issue stays on-platform.
          </div>
        </aside>
      ) : null}

      <button
        type="button"
        className="brand-hero-button help-fab inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={helpLabel}
      >
        <span aria-hidden="true">?</span>
        <span>{helpLabel}</span>
      </button>
    </div>
  );
}
