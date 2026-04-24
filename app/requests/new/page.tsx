import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/requests";
import { submitWantedRequest } from "./actions";
import { RequestForm } from "./request-form";

type NewRequestPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewRequestPage({ searchParams }: NewRequestPageProps) {
  await requireCurrentUser("/requests/new");
  const { error } = await searchParams;
  const demoMode = isDemoMode();

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">New request</p>
            <h1 className="mt-2 text-3xl font-semibold">Post a wanted item</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
              Describe what you want, what you want to pay, and anything the seller should know before making an offer.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
              <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/dashboard">
                Open dashboard
              </Link>
              <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/requests">
                Back to request board
              </Link>
            </div>
        </div>

        {demoMode ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
            Demo mode is active, so this form is not saving live requests yet.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-[1.5rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
            {error}
          </div>
        ) : null}

        <RequestForm action={submitWantedRequest} />
      </div>
    </main>
  );
}
