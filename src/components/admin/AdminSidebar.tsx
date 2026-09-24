"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleNav } from "@/lib/nav";
import type { Role } from "@/lib/types";

export function AdminSidebar({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const items = visibleNav(role);

  return (
    <nav aria-label="Admin" className="md:sticky md:top-24">
      <p className="mb-1 font-display text-sm font-semibold text-green-900">Br. YCA Sumsilui</p>
      <p className="mb-4 text-xs text-ink-muted">Signed in as {name}</p>

      <ul className="space-y-1 text-sm">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-[4px] px-2 py-1.5 ${
                  active
                    ? "bg-green-700 font-medium text-white"
                    : "text-ink hover:bg-green-100 hover:text-green-900"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 border-t border-line pt-3 text-xs">
        <Link href="/" className="text-green-700 hover:underline">
          View public site
        </Link>
      </p>
    </nav>
  );
}
