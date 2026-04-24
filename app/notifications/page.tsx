import Link from "next/link";
import { hasEmailDeliveryEnv } from "@/lib/email/config";
import { getCurrentNotifications } from "@/lib/notifications";
import { requireCurrentUser } from "@/lib/auth";
import { deleteOneNotification, deleteSelectedNotifications, markEveryNotificationRead, markOneNotificationRead, markSelectedNotificationsRead } from "./actions";

type NotificationsPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  await requireCurrentUser("/notifications");
  const { notice, error } = await searchParams;
  const notifications = await getCurrentNotifications();
  const emailReady = hasEmailDeliveryEnv();

  return (
    <main className="page-shell min-h-screen py-6">
      <div className="section-card rounded-[1.35rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">Notification history</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Fallback history and deeper cleanup.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
              Day-to-day notification cleanup now lives in the top-right bell tray. Keep this page for fallback review, larger cleanup sessions, or direct links.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action={markEveryNotificationRead}>
              <input type="hidden" name="returnTo" value="/notifications" />
              <button className="outline-button tight-button text-sm font-medium">
                Mark all read
              </button>
            </form>
            <Link className="outline-button tight-button text-sm font-medium" href="/dashboard?tab=buyer#notification-settings">
              Open settings
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
          <div className="data-card rounded-[1.1rem] p-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Bell-first workflow</p>
              <h2 className="mt-2 text-2xl font-semibold">The bell tray is the normal inbox experience now</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Use the top-right bell to read, delete, and bulk-clear notifications while staying on the page you are already using. Dashboard account settings still control which alerts show up at all.
              </p>
              <p className="mt-2 text-xs leading-6 text-stone-500">
                Email delivery status: {emailReady ? "Ready once you opt in from dashboard settings." : "Email alerts are not connected yet."}
              </p>
            </div>
            <div className="mt-4">
              <Link className="brand-button tight-button text-sm font-medium" href="/dashboard?tab=buyer#notification-settings">
                Open dashboard notification settings
              </Link>
            </div>
          </div>

          {notifications.length > 0 ? (
            <>
              <form id="notification-bulk-form" className="data-card rounded-[1.1rem] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Bulk actions</p>
                    <h2 className="mt-2 text-2xl font-semibold">Select several notifications at once</h2>
                  </div>
                  <input type="hidden" name="returnTo" value="/notifications" />
                  <div className="flex flex-wrap gap-3">
                    <button formAction={markSelectedNotificationsRead} className="outline-button tight-button text-sm font-medium">
                      Mark selected read
                    </button>
                    <button formAction={deleteSelectedNotifications} className="danger-action px-4 py-2 text-sm font-medium">
                      Delete selected
                    </button>
                  </div>
                </div>
              </form>

              {notifications.map((notification) => (
                <div key={notification.id} className={`data-card rounded-[1.1rem] p-5 ${notification.read ? "opacity-80" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        form="notification-bulk-form"
                        type="checkbox"
                        name="notificationId"
                        value={notification.id}
                        className="mt-1 h-4 w-4 rounded border-stone-300"
                        aria-label={`Select ${notification.title}`}
                      />
                      <div>
                        <p className="text-lg font-semibold">{notification.title}</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{notification.body}</p>
                      </div>
                    </div>
                    <span className={`status-pill ${notification.read ? "status-pill-neutral" : "status-pill-accent"}`}>
                      {notification.read ? "Read" : "New"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-stone-500">{notification.createdLabel}</span>
                    {notification.href ? (
                      <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={notification.href}>
                        Open related page
                      </Link>
                    ) : null}
                    {!notification.read ? (
                      <form action={markOneNotificationRead}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <input type="hidden" name="returnTo" value="/notifications" />
                        <button className="outline-button rounded-xl px-4 py-2 text-sm font-medium">
                          Mark read
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteOneNotification}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <input type="hidden" name="returnTo" value="/notifications" />
                      <button className="danger-action px-4 py-2 text-sm font-medium">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="empty-state rounded-[1rem]">
              No notifications yet. New activity will show up here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
