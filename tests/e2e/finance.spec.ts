import { expect, test } from "@playwright/test";
import {
  EDITOR,
  SEEDED,
  TREASURER,
  RUN,
  aDayInNoMansYear,
  aDayInside,
  bookRegion,
  editingRow,
  enterVoucher,
  figureValue,
  openBook,
  removeVoucher,
  signIn,
  thisYearLabel,
  voucherRow,
  yearRow,
  type VoucherEntry,
} from "./finance-fixtures";

/**
 * The treasurer's book: what a line does to the figures, and what a closed year
 * refuses.
 *
 * Every test here gives back what it took. The year list, the front page and the
 * public accounts are all asserted against the six vouchers `npm run seed:test`
 * puts in, so a line left standing would be a figure a later spec then reads as
 * its own.
 */

function e2eVoucher(label: string, suffix: string, over: Partial<VoucherEntry> = {}): VoucherEntry {
  return {
    date: aDayInside(label),
    type: "expense",
    head: "Events",
    amountRupees: "500",
    voucherNo: `E2E-${RUN}-${suffix}`,
    party: "E2E party",
    description: `E2E entry ${RUN}-${suffix} entered by the finance spec`,
    ...over,
  };
}

test("the year list, the book and the public page total the same six vouchers", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);

  await page.goto("/admin/finance");
  const row = yearRow(page, label);
  await expect(row).toContainText(`${SEEDED.vouchers} vouchers`);
  await expect(row).toContainText("Open");
  await expect(row).toContainText(SEEDED.income);
  await expect(row).toContainText(SEEDED.expense);
  await expect(row).toContainText(SEEDED.closing);

  await openBook(page, label);
  await expect(figureValue(page, "Opening balance")).toHaveText("₹0");
  await expect(figureValue(page, "Income")).toHaveText(SEEDED.income);
  await expect(figureValue(page, "Paid out")).toHaveText(SEEDED.expense);
  await expect(figureValue(page, "Closing balance")).toHaveText(SEEDED.closing);

  // The head-by-head breakdown is the same money cut the other way, so the two
  // sides have to add to the two figures above them.
  const income = page.getByText("Income, head by head").locator("xpath=ancestor::div[1]");
  await expect(income).toContainText("₹40,000");
  await expect(income).toContainText("₹15,000");
  const expense = page.getByText("Paid out, head by head").locator("xpath=ancestor::div[1]");
  await expect(expense).toContainText("₹22,500");
  await expect(expense).toContainText("₹3,200");

  // A figure that was corrected keeps the figure it replaced, and the sentence
  // that says why, where the treasurer can find them.
  const corrected = voucherRow(page, "TEST-005");
  await corrected.getByText("1 correction").click();
  await expect(corrected).toContainText("Amount");
  await expect(corrected).toContainText("₹3,500");
  await expect(corrected).toContainText("₹3,200");
  await expect(corrected).toContainText("thirty-two hundred rupees");

  // And the public reads the same totals from the same lines.
  await page.goto(`/finance/${label}`);
  await expect(page.getByRole("table", { name: /summary for/i })).toContainText(SEEDED.income);
  await expect(page.getByRole("table", { name: /summary for/i })).toContainText(SEEDED.closing);
  await expect(page.getByRole("row").filter({ hasText: "TEST-003" })).toContainText("₹22,500");
});

test("a voucher the treasurer enters moves every figure that reads it", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  await openBook(page, label);
  const voucher = e2eVoucher(label, "1");

  await enterVoucher(page, voucher);
  await expect(page.getByRole("status")).toContainText("Entered ₹500");
  await expect(figureValue(page, "Paid out")).toHaveText("₹42,700");
  await expect(figureValue(page, "Closing balance")).toHaveText("₹12,300");

  // The line reaches the published ledger too — the screen is not a parallel set
  // of books kept for the office alone.
  await page.goto(`/finance/${label}`);
  const published = page.getByRole("row").filter({ hasText: voucher.voucherNo });
  await expect(published).toContainText("₹500");
  await expect(published).toContainText("Events");

  // And out of the book again, where the line was entered: the figures the next
  // spec reads are this year's, not this spec's.
  await openBook(page, label);
  await removeVoucher(page, voucher.voucherNo);
});

test("taking a line back out puts the figures where they were", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  await openBook(page, label);
  const voucher = e2eVoucher(label, "2", {
    type: "income",
    head: "Other income",
    amountRupees: "1000",
  });

  await enterVoucher(page, voucher);
  await expect(figureValue(page, "Income")).toHaveText("₹56,000");
  await expect(figureValue(page, "Closing balance")).toHaveText("₹13,800");

  await removeVoucher(page, voucher.voucherNo);
  await expect(figureValue(page, "Income")).toHaveText(SEEDED.income);
  await expect(figureValue(page, "Closing balance")).toHaveText(SEEDED.closing);
});

test("correcting a line asks why, and keeps the figure it replaces", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  await openBook(page, label);
  const voucher = e2eVoucher(label, "3");

  await enterVoucher(page, voucher);
  const row = voucherRow(page, voucher.voucherNo);
  await row.getByRole("button", { name: /^Edit$/ }).click();
  const panel = editingRow(page, voucher.voucherNo);

  // The save stays out of reach until the reason is worth reading: a figure the
  // public may already have seen cannot change on a shrug.
  await expect(panel.getByRole("button", { name: /save the change/i })).toBeDisabled();
  await panel.getByLabel(/why is this line being changed/i).fill("too short");
  await expect(panel.getByRole("button", { name: /save the change/i })).toBeDisabled();

  await panel.getByLabel(/amount in rupees/i).fill("600");
  await panel
    .getByLabel(/why is this line being changed/i)
    .fill("E2E: the bill was for six hundred rupees, not five.");
  await panel.getByRole("button", { name: /save the change/i }).click();
  await expect(row).toContainText("1 correction");
  await expect(figureValue(page, "Paid out")).toHaveText("₹42,800");

  // The trail says what stood before, what stands now, and who said so.
  await row.getByText("1 correction").click();
  await expect(row).toContainText("₹500");
  await expect(row).toContainText("₹600");
  await expect(row).toContainText("six hundred rupees");
  await expect(row).toContainText("Test Treasurer");

  await removeVoucher(page, voucher.voucherNo);
  await expect(figureValue(page, "Paid out")).toHaveText(SEEDED.expense);
});

test("the download carries the filter the screen is showing", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  await openBook(page, label);

  const book = bookRegion(page);
  await book.getByLabel(/direction/i).selectOption("expense");
  await book.getByRole("button", { name: /^Apply$/ }).click();
  await expect(page.getByText(`Showing ${SEEDED.expenseVouchers} of ${SEEDED.vouchers} lines`)).toBeVisible();
  await expect(voucherRow(page, "TEST-003")).toBeVisible();
  await expect(voucherRow(page, "TEST-001")).toHaveCount(0);

  // The download is offered for the year as filtered on screen, not for the whole
  // book whatever the screen says.
  const download = page.getByRole("link", { name: /download as a spreadsheet/i });
  await expect(download).toHaveAttribute("href", /type=expense/);
  const csv = await page.request.get(`/finance/${label}/export?type=expense`);
  expect(csv.ok()).toBe(true);
  const text = await csv.text();
  expect(text).toContain("TEST-003");
  expect(text).not.toContain("TEST-001");

  await book.getByLabel(/voucher number, party or description/i).fill("TEST-004");
  await book.getByRole("button", { name: /^Apply$/ }).click();
  await expect(page.getByText("Showing 1 of 6 lines")).toBeVisible();
  await expect(voucherRow(page, "TEST-004")).toBeVisible();
  await expect(voucherRow(page, "TEST-003")).toHaveCount(0);
});

test("a day outside the year is the one thing the form cannot be talked into", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const outside = aDayInNoMansYear(label);

  const answer = await page.evaluate(
    async (body) => {
      const response = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, json: (await response.json()) as { error?: { code?: string } } };
    },
    {
      date: outside,
      type: "expense",
      category: "event",
      amountPaise: 50_000,
      voucherNo: `E2E-${RUN}-OUT`,
      party: "E2E party",
      description: `E2E entry outside the year ${RUN}`,
      projectId: "",
    },
  );

  expect(answer.status).toBe(400);
  expect(answer.json.error?.code).toBe("no_year_for_date");
  // Nothing was left behind to be mistaken for a voucher of this year.
  await openBook(page, label);
  await expect(page.getByText(`E2E entry outside the year ${RUN}`)).toHaveCount(0);
});

test("an editor is turned away from the book but not from the figures", async ({ page }) => {
  await signIn(page, EDITOR);
  const label = await thisYearLabel(page);

  await page.goto(`/finance/${label}`);
  await expect(page.getByRole("table", { name: /summary for/i })).toContainText(SEEDED.income);

  await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
  await expect(page.getByText(/kept by the Treasurer/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /enter vouchers/i })).toHaveCount(0);

  await page.goto(`/admin/finance/${label}`);
  await expect(page.getByRole("heading", { name: "Vouchers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enter a voucher" })).toHaveCount(0);
});
