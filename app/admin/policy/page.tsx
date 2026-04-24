import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { trustPolicy } from "@/lib/trust-policy";

export default async function AdminPolicyPage() {
  await requireAdminUser("/admin/policy");

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Admin policy</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Suspension and reinstatement playbook.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              This is the simple rulebook for warnings, suspensions, and appeals. The goal is to make admin decisions consistent and easier to defend.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="outline-button tight-button text-sm font-medium" href="/admin/trust">
              Trust queue
            </Link>
            <Link className="brand-hero-button tight-button text-sm font-medium" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Use warning / probation when</p>
            <h2 className="mt-2 text-2xl font-semibold">Behavior looks risky but still correctable</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.warningTriggers.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Use suspension when</p>
            <h2 className="mt-2 text-2xl font-semibold">Marketplace safety is no longer acceptable</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.suspensionTriggers.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Approve reinstatement when</p>
            <h2 className="mt-2 text-2xl font-semibold">The appeal meaningfully lowers trust risk</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.reinstatementGuidelines.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="data-card rounded-[1.15rem] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Admin checklist</p>
            <h2 className="mt-2 text-2xl font-semibold">Keep decisions consistent</h2>
            <div className="mt-4 grid gap-3">
              {trustPolicy.adminChecklist.map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
