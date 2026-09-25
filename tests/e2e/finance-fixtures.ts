import { expect, type Locator, type Page } from "@playwright/test";

export const PASSWORD = "branch-test-password";
export const ADMIN = { email: "admin@test.yca.local", password: PASSWORD };
export const EDITOR = { email: "editor@test.yca.local", password: PASSWORD };
export const TREASURER = { email: "treasurer@test.yca.local", password: PASSWORD };

/**
 * The figures `npm run seed:test` puts in the book, as a member reads them.
 *
 * A spec asserts these rather than any figure it typed itself, because the whole
 * point of the finance screens is that what they print is what the vouchers add
 * up to — and because every finance spec gives back what it took, so the next one
 * finds the same six lines and the same totals.
 */
export const SEEDED = {
  vouchers: 6,
  incomeVouchers: 2,
  expenseVouchers: 4,
  income: "₹55,000",
  expense: "₹42,200",
  closing: "₹12,800",
} as const;

/** Two runs on the same day must not collide with each other's rows. */
export const RUN = Date.now().toString(36);

/**
 * Signs in, putting down whatever session the last screen left behind.
 *
 * A test's own browser context starts empty, but a hook that runs after it is
 * still holding the cookies the test earned — and the middleware sends a signed-in
 * visitor away from `/login`, so signing in twice in a row has to end the first
 * session rather than wait for a form that will never be shown.
 */
export async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  if (!(await page.getByLabel(/email/i).isVisible().catch(() => false))) await signOut(page);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/**
 * Ends the session, so the next `signIn` is a different pair of eyes.
 *
 * The screens that differ by role — closing a year, reopening one — cannot be
 * told apart in one browser session unless the test can put one down and pick up
 * another.
 */
export async function signOut(page: Page) {
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
  await page.goto("/login");
}

export function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Admin" }).getByRole("list");
}

/**
 * The year the seed opens: whichever one today falls in, worked out the same way
 * `src/lib/fiscal-year.ts` works it out.
 */
export function currentYearLabel(): string {
  const now = new Date();
  const start = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * The year the branch is currently keeping, read back from the published summary.
 *
 * Not a constant: `seed-test-db.ts` opens whichever year today falls in, so a
 * hard-coded label would go stale on 1 April and take the suite with it.
 */
export async function thisYearLabel(page: Page): Promise<string> {
  const response = await page.request.get("/api/finance/summary");
  const body = (await response.json()) as { data?: { snapshot?: { yearLabel?: string } } };
  const label = body.data?.snapshot?.yearLabel;
  if (!label) throw new Error("the published summary named no year to test against");
  return label;
}

/** The year after a label — the one a spec may open, close and take back out. */
export function nextYearLabel(label: string): string {
  const start = Number(label.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** A day inside a year, in a month any year the branch keeps covers. */
export function aDayInside(label: string): string {
  return `${label.slice(0, 4)}-11-05`;
}

/** A day in a year no branch has kept accounts for: the one before the label. */
export function aDayInNoMansYear(label: string): string {
  return `${Number(label.slice(0, 4)) - 1}-11-05`;
}

export function yearRow(page: Page, label: string) {
  return page.getByRole("row").filter({ has: page.getByRole("link", { name: label, exact: true }) });
}

/**
 * One line of the treasurer's book, found by the number on the voucher.
 *
 * `first()` because a line being corrected prints its own number twice — once in
 * the row, once in the panel beneath it that asks for the new figure.
 */
export function voucherRow(page: Page, voucherNo: string) {
  return page.getByRole("row").filter({ hasText: voucherNo }).first();
}

/** The panel a row opens when its Edit is clicked. */
export function editingRow(page: Page, voucherNo: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(new RegExp(`Correcting ${voucherNo}`)) });
}

export type VoucherEntry = {
  date: string;
  type: "income" | "expense";
  head: string;
  amountRupees: string;
  voucherNo: string;
  party: string;
  description: string;
};

/**
 * The two forms on the book screen, told apart by the words they are under.
 *
 * Both ask for a "Direction" and a "Head", so an unscoped `getByLabel` would
 * match two controls and Playwright would refuse the action — correctly, since
 * the test itself would not know which one it had answered.
 */
export function voucherForm(page: Page) {
  return page.locator("form").filter({ has: page.getByRole("heading", { name: "Enter a voucher" }) });
}

/** The year's table, its filters and its count, as one landmark. */
export function bookRegion(page: Page) {
  return page.getByRole("region", { name: "The book" });
}

/** Fills "Enter a voucher" and waits for the line to reach the book. */
export async function enterVoucher(page: Page, entry: VoucherEntry) {
  const form = voucherForm(page);
  await form.getByRole("heading", { name: "Enter a voucher" }).scrollIntoViewIfNeeded();
  await form.getByLabel(/day the money moved/i).fill(entry.date);
  await form.getByRole("combobox", { name: /^direction/i }).selectOption(entry.type);
  await form.getByRole("combobox", { name: /^head/i }).selectOption({ label: entry.head });
  await form.getByLabel(/amount in rupees/i).fill(entry.amountRupees);
  await form.getByLabel(/voucher number/i).fill(entry.voucherNo);
  await form.getByLabel(/received from, or paid to/i).fill(entry.party);
  await form.getByLabel(/what it was for/i).fill(entry.description);
  await form.getByRole("button", { name: /enter this voucher/i }).click();
  await expect(voucherRow(page, entry.voucherNo)).toBeVisible();
}

/**
 * Takes a voucher back out of the book through the treasurer's own button.
 *
 * Every finance spec ends with this: the seeded totals are what the next spec in
 * the file — and the front-page spec that runs after it — asserts against, so a
 * line left standing would be a figure somebody else's test then reads as its own.
 */
export async function removeVoucher(page: Page, voucherNo: string) {
  page.on("dialog", (dialog) => dialog.accept().catch(() => undefined));
  const rows = page.getByRole("row").filter({ hasText: voucherNo });
  await voucherRow(page, voucherNo).getByRole("button", { name: /^Remove$/ }).click();
  await expect(rows).toHaveCount(0);
}

/** The year's book, at the address the year list links to. */
export async function openBook(page: Page, label: string) {
  await page.goto(`/admin/finance/${label}`);
  await expect(page.getByRole("heading", { name: `Vouchers for ${label}` })).toBeVisible();
}

/** A year's own id, as the API names it — the screens never print one. */
export async function findYearId(page: Page, label: string): Promise<string | null> {
  const response = await page.request.get("/api/finance/years");
  const body = (await response.json()) as {
    data?: { years?: { id: string; label: string }[] };
  };
  return body.data?.years?.find((year) => year.label === label)?.id ?? null;
}

/**
 * Takes a year back out if a failed test left it standing.
 *
 * A spec that opened a year owns it: the list of years is asserted elsewhere, and
 * a second one in the table would be read as the branch keeping two books.
 */
export async function removeYearIfKept(page: Page, label: string): Promise<void> {
  const id = await findYearId(page, label);
  if (id) await api(page, "DELETE", `/api/finance/years/${id}`);
}

/** The answer the API gives to a request the screens would not have made. */
export async function api(
  page: Page,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: { data?: Record<string, unknown>; error?: { code?: string; message?: string } } }> {
  return await page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? null : JSON.stringify(body),
      });
      return {
        status: response.status,
        json: (await response.json().catch(() => ({}))) as {
          data?: Record<string, unknown>;
          error?: { code?: string; message?: string };
        },
      };
    },
    { method, path, body },
  );
}

/**
 * The figure printed under one of the four labels above the book.
 *
 * The label and its amount are the two `<p>`s of one card, so the amount is the
 * sibling rather than something a locator has to guess at among the head-by-head
 * breakdowns below, which use the same words in longer sentences.
 */
export function figureValue(scope: Page | Locator, name: string) {
  return scope.getByText(name, { exact: true }).locator("xpath=following-sibling::p[1]");
}

/**
 * Removes every contribution still on the register, from the contributions
 * screen itself.
 *
 * A contribution is half a ledger line, so leaving one behind would leave the
 * year's published totals a different figure from the one the next spec asserts.
 * Going through the Remove button rather than the API doubles as the check that
 * the office's own way back works.
 */
export async function removeEveryContribution(page: Page) {
  page.on("dialog", (dialog) => dialog.accept().catch(() => undefined));
  await page.goto("/admin/donations");
  const remove = page.getByRole("button", { name: /^Remove$/ });
  for (;;) {
    const left = await remove.count();
    if (left === 0) return;
    await remove.first().click();
    await expect(remove).toHaveCount(left - 1);
  }
}
