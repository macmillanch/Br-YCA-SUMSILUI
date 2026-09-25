import type { TransactionCategory, TransactionType } from "@/lib/types";

/**
 * The heads money comes in under and goes out under.
 *
 * The list is fixed rather than free text so that this year's breakdown means
 * the same as last year's. A treasurer allowed to invent a head would produce a
 * chart nobody can compare, which is the one thing a published account has to
 * survive. `other_income` and `other_expense` exist so an unusual entry still
 * has somewhere to go without a new category being coined for it.
 */

export const INCOME_CATEGORIES = [
  "subscription",
  "donation",
  "event_collection",
  "grant",
  "interest",
  "other_income",
] as const satisfies readonly TransactionCategory[];

export const EXPENSE_CATEGORIES = [
  "event",
  "community_welfare",
  "education",
  "youth",
  "administration",
  "maintenance",
  "relief",
  "other_expense",
] as const satisfies readonly TransactionCategory[];

const LABEL: Record<TransactionCategory, string> = {
  subscription: "Membership subscription",
  donation: "Donations",
  event_collection: "Event collections",
  grant: "Grants",
  interest: "Interest",
  other_income: "Other income",
  event: "Events",
  community_welfare: "Community welfare",
  education: "Education",
  youth: "Youth activities",
  administration: "Administration",
  maintenance: "Maintenance",
  relief: "Relief",
  other_expense: "Other expenses",
};

export function categoriesOf(type: TransactionType): readonly TransactionCategory[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isValidCategory(
  type: TransactionType,
  category: TransactionCategory,
): boolean {
  return categoriesOf(type).includes(category);
}

/** The words a member reads beside a figure. */
export function categoryLabel(category: TransactionCategory): string {
  return LABEL[category];
}
