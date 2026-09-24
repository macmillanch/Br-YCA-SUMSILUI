export type NavItem = { href: string; label: string };

export const PUBLIC_NAV: readonly NavItem[] = [
  { href: "/about", label: "About" },
  { href: "/executive-members", label: "Members" },
  { href: "/notices", label: "Notices" },
  { href: "/works", label: "Works" },
  { href: "/gallery", label: "Gallery" },
  { href: "/finance", label: "Finance" },
  { href: "/contact", label: "Contact" },
];

export const DONATE_NAV: NavItem = { href: "/donate", label: "Donate" };

/**
 * Marks the nav entry for the page currently being rendered. `usePathname`
 * would need a client component, so the layout passes the segment down as a
 * prop instead and the header stays server-rendered.
 */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
