import { formatPaise } from "@/lib/money";

/**
 * The words a page prints about what a work has cost.
 *
 * Three screens show one work — the card on the list, its own page, and the
 * office screen that edits it — and all three take their money sentences from
 * here, so the site cannot tell a reader three different things about one set of
 * accounts. Nothing is imported from `projects.ts`, which reaches MongoDB: these
 * are the parts a component may need without pulling the driver along.
 */

/** Said when the ledger could not be read. `₹0` would be a claim nobody checked. */
export const SPEND_UNREADABLE = "The figures could not be read just now";

export function spendLine(spentPaise: number | null, sanctionedPaise: number): string {
  if (spentPaise === null) return SPEND_UNREADABLE;
  const spent = formatPaise(spentPaise);
  if (sanctionedPaise <= 0) return spent;
  return `${spent} of ${formatPaise(sanctionedPaise)}`;
}

/**
 * Whether the work has cost more than the branch sanctioned for it. Every screen
 * that prints money colours that case differently from the rest, so the rule is
 * written once — three places that decide it separately are three places that can
 * disagree about the same voucher.
 */
export function isOverspent(budgetSharePct: number | null): boolean {
  return budgetSharePct !== null && budgetSharePct > 100;
}

/**
 * The bar's width in percent. It stops at the edge of the sanctioned amount even
 * when the branch went past it, because a bar cannot be drawn longer than its
 * own track — the caption prints the real figure.
 */
export function shareBarWidth(budgetSharePct: number | null): number | null {
  if (budgetSharePct === null) return null;
  return Math.min(100, budgetSharePct);
}

export function shareCaption(budgetSharePct: number | null): string | null {
  if (budgetSharePct === null) return null;
  const said = `${Math.round(budgetSharePct)}% of the sanctioned amount`;
  return isOverspent(budgetSharePct)
    ? `${said} — the branch has spent more than it sanctioned`
    : said;
}
