import Link from "next/link";
import { trustPolicy } from "@/lib/trust-policy";

const memberRules = [
  "Keep payment, pricing, and shipping negotiation on BuyerBoard.",
  "Do not list illegal items. Firearms are not allowed on the platform.",
  "Do not harass, threaten, or mislead other members.",
  "If a listing, offer, or message feels unsafe, report it instead of arguing in private messages.",
];

export default function RulesPage() {
  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Marketplace rules</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Safety rules and member standards.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              These are the basic standards BuyerBoard expects from buyers and sellers.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="outline-button tight-button text-sm font-medium" href="/requests">
              Browse board
            </Link>
            <Link className="brand-hero-button tight-button text-sm font-medium" href="/requests/new">
              Post a request
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Basic member rules</p>
            <h2 className="mt-2 text-2xl font-semibold">What every member is expected to do</h2>
            <div className="mt-4 grid gap-3">
              {memberRules.map((rule) => (
                <div key={rule} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {rule}
                </div>
              ))}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Warning or probation</p>
            <h2 className="mt-2 text-2xl font-semibold">Behavior that can trigger account review</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.warningTriggers.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Suspension</p>
            <h2 className="mt-2 text-2xl font-semibold">What can lead to stronger action</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.suspensionTriggers.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Appeals</p>
            <h2 className="mt-2 text-2xl font-semibold">How reinstatement works</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.reinstatementGuidelines.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              If an account is flagged or suspended, the member can send an appeal from the dashboard for review.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
