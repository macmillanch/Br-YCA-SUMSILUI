import type { Role } from "@/lib/types";

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

export type AdminNavItem = {
  href: string;
  label: string;
  roles: readonly Role[];
  /** False until the screen behind the link exists, so the sidebar never offers a 404. */
  ready: boolean;
};

/**
 * The one source of truth for the admin sidebar. `roles: []` means super-admin
 * only, matching the empty-allowlist convention in `canAccess`, so nobody has
 * to remember which file reads an empty list the other way.
 */
export const NAV_ITEMS: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", roles: ["editor", "treasurer"], ready: true },
  {
    href: "/admin/notices",
    label: "Notices & press releases",
    roles: ["editor", "treasurer"],
    ready: true,
  },
  {
    href: "/admin/members",
    label: "Members",
    roles: ["editor", "treasurer"],
    ready: true,
  },
  { href: "/admin/works", label: "Works & progress", roles: ["editor", "treasurer"], ready: true },
  { href: "/admin/gallery", label: "Gallery", roles: ["editor", "treasurer"], ready: false },
  { href: "/admin/finance", label: "Finance", roles: ["treasurer"], ready: false },
  { href: "/admin/donations", label: "Donations", roles: ["treasurer"], ready: false },
  { href: "/admin/settings", label: "Settings", roles: [], ready: true },
  { href: "/admin/users", label: "Users", roles: [], ready: true },
];

export function canSee(role: Role, allowed: readonly Role[]): boolean {
  return role === "super_admin" || allowed.includes(role);
}

export function visibleNav(role: Role): AdminNavItem[] {
  return NAV_ITEMS.filter((item) => item.ready && canSee(role, item.roles));
}
