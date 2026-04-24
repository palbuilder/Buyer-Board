import type { Metadata } from "next";
import Link from "next/link";
import { HelpDrawer } from "@/app/components/help-drawer";
import { NotificationBell } from "@/app/components/notification-bell";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "BuyerBoard | Demand-first marketplace MVP",
  description:
    "A reverse marketplace where buyers post what they need and sellers respond with inventory, pricing, and shipping options.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${monoFont.variable}`}>
      <body>
        <header className="sticky top-0 z-50 border-b border-black/6 bg-white/66 backdrop-blur-xl">
          <div className="page-shell flex items-center justify-between py-3">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-2xl border border-black/8 bg-white/80 px-4 py-2 text-sm font-medium shadow-[0_10px_24px_rgba(12,24,33,0.08)]"
            >
              <span aria-hidden="true" className="text-base">
                {"\u{1F642}"}
              </span>
              <span>BuyerBoard</span>
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <nav className="flex flex-wrap items-center gap-2">
                <Link
                  className="rounded-2xl px-4 py-2 text-[var(--foreground)]/78 transition hover:bg-white/70 hover:text-[var(--foreground)]"
                  href="/requests"
                >
                  Board
                </Link>
                <Link
                  className="rounded-2xl px-4 py-2 text-[var(--foreground)]/78 transition hover:bg-white/70 hover:text-[var(--foreground)]"
                  href="/dashboard"
                >
                  Dashboard
                </Link>
                <Link
                  className="rounded-2xl px-4 py-2 text-[var(--foreground)]/78 transition hover:bg-white/70 hover:text-[var(--foreground)]"
                  href="/messages"
                >
                  Messages
                </Link>
                <Link
                  className="rounded-2xl px-4 py-2 text-[var(--foreground)]/78 transition hover:bg-white/70 hover:text-[var(--foreground)]"
                  href="/rules"
                >
                  Rules
                </Link>
              </nav>
              <NotificationBell />
              <Link className="brand-hero-button tight-button text-sm font-medium" href="/requests/new">
                Post request
              </Link>
            </div>
          </div>
        </header>
        <div className="pb-10 pt-4">{children}</div>
        <HelpDrawer />
        <footer className="page-shell pb-8 pt-2 text-sm text-[var(--ink-soft)]">
          <div className="glass-panel flex flex-col gap-3 rounded-[1.25rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p>BuyerBoard is built to keep negotiation, funding, and trust review on-platform.</p>
            <div className="flex flex-wrap gap-3">
              <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/rules">
                Marketplace rules
              </Link>
              <Link className="font-medium text-[var(--accent-strong)] hover:text-[var(--hero)]" href="/dashboard">
                Dashboard
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
