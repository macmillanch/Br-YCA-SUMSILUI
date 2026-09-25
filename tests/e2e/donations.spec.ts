import { expect, test, type Page } from "@playwright/test";
import {
  RUN,
  SEEDED,
  TREASURER,
  aDayInNoMansYear,
  aDayInside,
  api,
  figureValue,
  openBook,
  removeEveryContribution,
  signIn,
  thisYearLabel,
  voucherRow,
} from "./finance-fixtures";

/**
 * Contributions, which are entered once and read in two places.
 *
 * The point of every test here is the same from different angles: a name cannot
 * appear where no money was booked, and money cannot be booked while a name the
 * donor withheld is printed beside it. So each test looks at the register, the
 * public thank-you list and the year's book, and asks whether the three still
 * agree.
 */

const DONOR = (suffix: string) => `E2E Donor ${RUN}-${suffix}`;
const UNNAMED = "Contribution (name with the Treasurer)";

type Contribution = {
  date: string;
  donor: string;
  amountRupees: string;
  voucherNo: string;
  purpose: string;
  publish: boolean;
};

function contribution(
  label: string,
  suffix: string,
  over: Partial<Contribution> = {},
): Contribution {
  return {
    date: aDayInside(label),
    donor: DONOR(suffix),
    amountRupees: "2500",
    voucherNo: `E2E-${RUN}-DON-${suffix}`,
    purpose: `E2E contribution ${RUN}-${suffix} toward the student class`,
    publish: true,
    ...over,
  };
}

/**
 * The add-form, apart from the register below it.
 *
 * The screen asks for a donor and an amount twice over — once to record, once to
 * correct — and a test that answered the wrong one would be recording a
 * contribution it meant to change.
 */
function contributionForm(page: Page) {
  return page
    .locator("form")
    .filter({ has: page.getByRole("heading", { name: "Record a contribution" }) });
}

function donorRow(page: Page, donor: string) {
  return page.getByRole("row").filter({ hasText: donor }).first();
}

function editingDonorRow(page: Page, donor: string) {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(new RegExp(`Correcting the contribution from ${donor}`)) });
}

function publishedRow(page: Page, donor: string) {
  return page.getByRole("row").filter({ hasText: donor });
}

async function openRegister(page: Page) {
  await page.goto("/admin/donations");
  await expect(page.getByRole("heading", { name: "Contributions" })).toBeVisible();
}

/** Fills "Record a contribution" and waits for the row to reach the register. */
async function recordContribution(page: Page, entry: Contribution) {
  const form = contributionForm(page);
  await form.getByLabel(/day it came in/i).fill(entry.date);
  await form.getByLabel(/who it came from/i).fill(entry.donor);
  await form.getByLabel(/amount in rupees/i).fill(entry.amountRupees);
  await form.getByLabel(/voucher number/i).fill(entry.voucherNo);
  await form.getByLabel(/what it was given for/i).fill(entry.purpose);
  await form.getByRole("checkbox", { name: /thank this donor in public/i }).setChecked(entry.publish);
  await form.getByRole("button", { name: /record this contribution/i }).click();
  await expect(donorRow(page, entry.donor)).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await signIn(page, TREASURER);
  await removeEveryContribution(page);
});

test("recording a contribution puts its figure in the accounts and its name in the thanks", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const entry = contribution(label, "one");

  await openRegister(page);
  await recordContribution(page, entry);
  await expect(page.getByRole("status")).toContainText("Recorded ₹2,500");
  await expect(donorRow(page, entry.donor)).toContainText("Published");

  await page.goto("/donate");
  await expect(publishedRow(page, entry.donor)).toContainText("₹2,500");

  // The same entry, in the year's book, moving the year's figures.
  await openBook(page, label);
  await expect(figureValue(page, "Income")).toHaveText("₹57,500");
  await expect(figureValue(page, "Closing balance")).toHaveText("₹15,300");
  const line = voucherRow(page, entry.voucherNo);
  await expect(line).toContainText(entry.donor);
  await expect(line).toContainText("₹2,500");
  await expect(line).toContainText("Donations");

  // And on the ledger the public reads, so a name and a figure can be checked
  // against each other rather than taken on trust.
  await page.goto(`/finance/${label}`);
  await expect(page.getByRole("row").filter({ hasText: entry.voucherNo })).toContainText("₹2,500");
});

test("a donor who was not asked keeps their name out of sight and their money in the accounts", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const entry = contribution(label, "private", { publish: false });

  await openRegister(page);
  await recordContribution(page, entry);
  await expect(donorRow(page, entry.donor)).toContainText("Kept private");

  // Silence is not consent: nothing on the public page names them.
  await page.goto("/donate");
  await expect(page.getByText(entry.donor)).toHaveCount(0);
  await expect(page.getByText("No names have been listed yet")).toBeVisible();

  // The figure still stands, and the line says where to ask rather than guessing.
  await openBook(page, label);
  await expect(figureValue(page, "Income")).toHaveText("₹57,500");
  const line = voucherRow(page, entry.voucherNo);
  await expect(line).toContainText(UNNAMED);
  await expect(line).not.toContainText(entry.donor);
});

test("correcting a contribution moves the figure in the book, and keeps the one it replaced", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const entry = contribution(label, "corrected");

  await openRegister(page);
  await recordContribution(page, entry);

  await donorRow(page, entry.donor).getByRole("button", { name: /^Edit$/ }).click();
  const panel = editingDonorRow(page, entry.donor);

  // The reason is asked for here exactly as it is on the ledger screen, because
  // this is the same change seen from the donor's side.
  await expect(panel.getByRole("button", { name: /save the change/i })).toBeDisabled();
  await panel.getByLabel(/why is this contribution being changed/i).fill("too short");
  await expect(panel.getByRole("button", { name: /save the change/i })).toBeDisabled();

  await panel.getByLabel(/amount in rupees/i).fill("3000");
  await panel
    .getByLabel(/why is this contribution being changed/i)
    .fill("E2E: the receipt read three thousand rupees, not two and a half.");
  await panel.getByRole("button", { name: /save the change/i }).click();
  await expect(donorRow(page, entry.donor)).toContainText("₹3,000");

  // The year's figures follow, and the book shows what stood before.
  await openBook(page, label);
  await expect(figureValue(page, "Income")).toHaveText("₹58,000");
  const line = voucherRow(page, entry.voucherNo);
  await expect(line).toContainText("1 correction");
  await line.getByText("1 correction").click();
  await expect(line).toContainText("₹2,500");
  await expect(line).toContainText("₹3,000");
  await expect(line).toContainText("three thousand rupees");
});

test("taking a name back down leaves the money where it was", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const entry = contribution(label, "withdrawn");

  await openRegister(page);
  await recordContribution(page, entry);
  await page.goto("/donate");
  await expect(publishedRow(page, entry.donor)).toContainText("₹2,500");

  await openRegister(page);
  await donorRow(page, entry.donor).getByRole("button", { name: /^Edit$/ }).click();
  const panel = editingDonorRow(page, entry.donor);
  await panel.getByRole("checkbox", { name: /thank this donor in public/i }).uncheck();
  await panel
    .getByLabel(/why is this contribution being changed/i)
    .fill("E2E: the donor asked not to be named in public.");
  await panel.getByRole("button", { name: /save the change/i }).click();
  await expect(donorRow(page, entry.donor)).toContainText("Kept private");

  await page.goto("/donate");
  await expect(page.getByText(entry.donor)).toHaveCount(0);

  // Consent changed; the accounts did not — ₹55,000 seeded plus the ₹2,500 still
  // standing.
  await openBook(page, label);
  await expect(figureValue(page, "Income")).toHaveText("₹57,500");
  const line = voucherRow(page, entry.voucherNo);
  await expect(line).toContainText("₹2,500");
  await line.getByText("1 correction").click();
  await expect(line).toContainText("Party");
  await expect(line).toContainText(UNNAMED);
});

test("removing a contribution takes both halves back at once", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const entry = contribution(label, "removed");

  await openRegister(page);
  await recordContribution(page, entry);
  await openBook(page, label);
  await expect(figureValue(page, "Income")).toHaveText("₹57,500");

  page.on("dialog", (dialog) => dialog.accept().catch(() => undefined));
  await openRegister(page);
  await donorRow(page, entry.donor).getByRole("button", { name: /^Remove$/ }).click();
  await expect(page.getByRole("row").filter({ hasText: entry.donor })).toHaveCount(0);

  // Neither half is left standing: no name on the public page, no line in the year.
  await page.goto("/donate");
  await expect(page.getByText(entry.donor)).toHaveCount(0);
  await openBook(page, label);
  await expect(figureValue(page, "Income")).toHaveText(SEEDED.income);
  await expect(figureValue(page, "Closing balance")).toHaveText(SEEDED.closing);
  await expect(page.getByRole("row").filter({ hasText: entry.voucherNo })).toHaveCount(0);
});

test("a contribution dated in a year nobody keeps is refused, and nothing is written", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const voucherNo = `E2E-${RUN}-DON-OUT`;

  const answer = await api(page, "POST", "/api/donations", {
    date: aDayInNoMansYear(label),
    donorName: DONOR("out"),
    purpose: `E2E contribution outside every year ${RUN}`,
    amountPaise: 250_000,
    voucherNo,
    acknowledgePublicly: true,
  });

  expect(answer.status).toBe(400);
  expect(answer.json.error?.code).toBe("no_year_for_date");

  // A refused pair is no pair at all — the register holds nothing to undo.
  await openRegister(page);
  await expect(page.getByRole("row").filter({ hasText: voucherNo })).toHaveCount(0);
  await expect(page.getByText("Nothing has been recorded here yet.")).toBeVisible();
});
