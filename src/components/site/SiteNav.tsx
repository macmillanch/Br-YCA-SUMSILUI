"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isActive, type NavItem } from "@/lib/nav";

const FOCUSABLE = "a[href], button:not([disabled])";

export function SiteNav({ links, donate }: { links: readonly NavItem[]; donate: NavItem }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.position = "";
      document.body.style.top = "";
      window.scrollTo(0, scrollY);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="ml-auto hidden md:block">
        <ul className="flex items-center gap-6">
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item, pathname) ? "page" : undefined}
                className={`text-sm font-medium hover:underline md:py-2 ${
                  isActive(item, pathname)
                    ? "text-green-500 underline decoration-2 underline-offset-4"
                    : "text-green-900 hover:text-green-500"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={donate.href}
              aria-current={isActive(donate, pathname) ? "page" : undefined}
              className="rounded-[4px] bg-red-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700/90"
            >
              {donate.label}
            </Link>
          </li>
        </ul>
      </nav>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-navigation"
        onClick={() => setOpen((value) => !value)}
        className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] border border-line text-green-900 md:hidden"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg aria-hidden focusable="false" width="22" height="22" viewBox="0 0 22 22">
          {open ? (
            <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="2" fill="none" />
          ) : (
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" fill="none" />
          )}
        </svg>
      </button>

      <div
        id="site-navigation"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        hidden={!open}
        className="fixed inset-0 z-40 flex flex-col bg-paper md:hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-display text-base font-semibold text-green-900">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] border border-line text-green-900"
          >
            <span className="sr-only">Close menu</span>
            <svg aria-hidden focusable="false" width="20" height="20" viewBox="0 0 22 22">
              <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-2">
          <ul className="divide-y divide-line">
            {[...links, donate].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item, pathname) ? "page" : undefined}
                  className={`block py-4 text-base ${
                    isActive(item, pathname)
                      ? "border-l-2 border-green-500 pl-3 font-semibold text-green-500"
                      : "font-medium text-green-900"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/admin" className="block py-4 text-sm text-ink-muted">
                Office-bearer sign in
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
