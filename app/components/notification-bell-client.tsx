"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { NotificationItem } from "@/lib/types";

type NotificationBellClientProps = {
  initialIsSignedIn: boolean;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
};

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
      <path
        d="M10 3.5a3.75 3.75 0 0 0-3.75 3.75v1.18c0 .92-.27 1.82-.79 2.58l-.96 1.43a1 1 0 0 0 .83 1.56h9.34a1 1 0 0 0 .83-1.56l-.96-1.43a4.5 4.5 0 0 1-.79-2.58V7.25A3.75 3.75 0 0 0 10 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M8.35 15.25a1.9 1.9 0 0 0 3.3 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function NotificationBellClient({
  initialIsSignedIn,
  initialNotifications,
  initialUnreadCount,
}: NotificationBellClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nextPath = useMemo(() => {
    const queryString = searchParams.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);
  const unreadLabel = unreadCount > 99 ? "99+" : unreadCount.toString();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    setSelectedIds((currentIds) => currentIds.filter((id) => notifications.some((notification) => notification.id === id)));
  }, [notifications]);

  async function refreshNotifications() {
    if (!initialIsSignedIn) {
      return;
    }

    setIsRefreshing(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });
      const json = await parseJsonResponse(response);

      if (response.status === 401) {
        router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      if (!response.ok || !json?.notifications) {
        throw new Error(json?.error || "Unable to refresh notifications right now.");
      }

      setNotifications(json.notifications as NotificationItem[]);
      setUnreadCount(typeof json.unreadCount === "number" ? json.unreadCount : 0);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to refresh notifications right now.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function runNotificationMutation(
    request: () => Promise<Response>,
    applyLocalUpdate: () => void,
  ) {
    setErrorMessage("");

    startTransition(async () => {
      try {
        const response = await request();
        const json = await parseJsonResponse(response);

        if (response.status === 401) {
          router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
          return;
        }

        if (!response.ok) {
          throw new Error(json?.error || "Unable to update notifications right now.");
        }

        applyLocalUpdate();
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to update notifications right now.");
      }
    });
  }

  function toggleNotificationSelection(notificationId: string) {
    setSelectedIds((currentIds) =>
      currentIds.includes(notificationId) ? currentIds.filter((id) => id !== notificationId) : [...currentIds, notificationId],
    );
  }

  function handleBellClick() {
    if (!initialIsSignedIn) {
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const nextOpenState = !open;
    setOpen(nextOpenState);

    if (nextOpenState) {
      void refreshNotifications();
    }
  }

  const hasSelection = selectedIds.length > 0;
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleBellClick}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/8 bg-white/85 text-[var(--foreground)]/80 shadow-[0_10px_24px_rgba(12,24,33,0.08)] transition hover:bg-white hover:text-[var(--foreground)]"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--hero)] px-1.5 text-[10px] font-semibold text-white">
            {unreadLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <aside className="section-card absolute right-0 top-[calc(100%+0.85rem)] z-[70] w-[min(26rem,calc(100vw-1.5rem))] rounded-[1.2rem] p-4 shadow-[0_20px_50px_rgba(12,24,33,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500">Notifications</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Recent activity</h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--ink-soft)]">
                Stay on the current page while you read and clear updates.
              </p>
            </div>
            <button
              type="button"
              className="ghost-action text-sm"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="soft-chip-muted">
              {unreadCount} unread / {notifications.length} shown
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="outline-button rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending || unreadNotifications.length === 0}
                onClick={() =>
                  runNotificationMutation(
                    () =>
                      fetch("/api/notifications", {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ markAll: true }),
                      }),
                    () => {
                      setNotifications((currentNotifications) =>
                        currentNotifications.map((notification) => ({
                          ...notification,
                          read: true,
                        })),
                      );
                      setUnreadCount(0);
                    },
                  )
                }
              >
                Mark all read
              </button>
              <button
                type="button"
                className="outline-button rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending || !hasSelection}
                onClick={() =>
                  runNotificationMutation(
                    () =>
                      fetch("/api/notifications", {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ notificationIds: selectedIds }),
                      }),
                    () => {
                      setNotifications((currentNotifications) =>
                        currentNotifications.map((notification) =>
                          selectedIds.includes(notification.id)
                            ? {
                                ...notification,
                                read: true,
                              }
                            : notification,
                        ),
                      );
                      setUnreadCount((currentCount) =>
                        Math.max(
                          0,
                          currentCount -
                            notifications.filter((notification) => selectedIds.includes(notification.id) && !notification.read).length,
                        ),
                      );
                      setSelectedIds([]);
                    },
                  )
                }
              >
                Mark selected read
              </button>
              <button
                type="button"
                className="danger-action px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending || !hasSelection}
                onClick={() =>
                  runNotificationMutation(
                    () =>
                      fetch("/api/notifications", {
                        method: "DELETE",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ notificationIds: selectedIds }),
                      }),
                    () => {
                      setUnreadCount((currentCount) =>
                        Math.max(
                          0,
                          currentCount -
                            notifications.filter((notification) => selectedIds.includes(notification.id) && !notification.read).length,
                        ),
                      );
                      setNotifications((currentNotifications) =>
                        currentNotifications.filter((notification) => !selectedIds.includes(notification.id)),
                      );
                      setSelectedIds([]);
                    },
                  )
                }
              >
                Delete selected
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[1rem] border border-rose-300/70 bg-rose-50 px-3 py-3 text-sm leading-6 text-rose-950">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-4 max-h-[26rem] space-y-2.5 overflow-y-auto pr-1">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <section key={notification.id} className={`data-card rounded-[0.95rem] px-3.5 py-3 ${notification.read ? "opacity-80" : ""}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-stone-300"
                      checked={selectedIds.includes(notification.id)}
                      onChange={() => toggleNotificationSelection(notification.id)}
                      aria-label={`Select ${notification.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold leading-6">{notification.title}</p>
                        <span className={`status-pill ${notification.read ? "status-pill-neutral" : "status-pill-accent"}`}>
                          {notification.read ? "Read" : "New"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--ink-soft)]">{notification.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span>{notification.createdLabel}</span>
                        {notification.href ? (
                          <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href={notification.href} onClick={() => setOpen(false)}>
                            Open
                          </Link>
                        ) : null}
                        {!notification.read ? (
                          <button
                            type="button"
                            className="outline-button rounded-xl px-3 py-1.5 text-xs font-medium"
                            disabled={isPending}
                            onClick={() =>
                              runNotificationMutation(
                                () =>
                                  fetch(`/api/notifications/${encodeURIComponent(notification.id)}`, {
                                    method: "PATCH",
                                  }),
                                () => {
                                  setNotifications((currentNotifications) =>
                                    currentNotifications.map((currentNotification) =>
                                      currentNotification.id === notification.id
                                        ? {
                                            ...currentNotification,
                                            read: true,
                                          }
                                        : currentNotification,
                                    ),
                                  );
                                  setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
                                },
                              )
                            }
                          >
                            Mark read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="danger-action px-3 py-1.5 text-xs font-medium"
                          disabled={isPending}
                          onClick={() =>
                            runNotificationMutation(
                              () =>
                                fetch(`/api/notifications/${encodeURIComponent(notification.id)}`, {
                                  method: "DELETE",
                                }),
                              () => {
                                setUnreadCount((currentCount) => Math.max(0, currentCount - (notification.read ? 0 : 1)));
                                setNotifications((currentNotifications) =>
                                  currentNotifications.filter((currentNotification) => currentNotification.id !== notification.id),
                                );
                                setSelectedIds((currentIds) => currentIds.filter((id) => id !== notification.id));
                              },
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state rounded-[1rem]">
                {isRefreshing ? "Refreshing notifications..." : "No notifications yet. New marketplace updates will appear here."}
              </div>
            )}
          </div>

          <div className="subtle-panel mt-4 rounded-[0.95rem] px-3.5 py-3 text-sm leading-6 text-[var(--ink-soft)]">
            Notification settings stay in account settings under the dashboard.
          </div>
        </aside>
      ) : null}
    </div>
  );
}
