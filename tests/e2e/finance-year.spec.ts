import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  RUN,
  TREASURER,
  aDayInside,
  api,
  currentYearLabel,
  findYearId,
  figureValue,
  nextYearLabel,
  openBook,
  signIn,
  signOut,
  thisYearLabel,
  yearRow,
} from "./finance-fixtures";

/**
 * Opening a year, closing it, reopening it — the three acts that are not edits,
 * and therefore belong to different hands.
 *
 * The year under test is the one after the year the seed opened, and it is taken
 * out again at the end: a second row in the list would leave every later spec
 * reading a branch that keeps two books.
 */

const NEXT = nextYearLabel(currentYearLabel());
const A_DAY_IN_NEXT = aDayInside(NEXT);
/** A day two years ahead of the one being opened: no branch keeps accounts for it. */
const A_DAY_IN_NO_YEAR = aDayInside(nextYearLabel(NEXT));

async function openNextYear(page: Page) {
  await page.goto("/admin/finance");
  await page.getByLabel(/^year$/i).fill(NEXT);
  await page.getByRole("button", { name: /open the year/i }).click();
  await expect(page.getByRole("status")).toContainText(`The accounts for ${NEXT} are open`);
}

async function closeNextYear(page: Page) {
  await page.goto("/admin/finance");
  // The asking is done by the application, not by the page's HTML, so hearing it
  // is the proof that the click landed on something listening — the table is
  // server-rendered, and a click a moment before the screen wakes up does nothing
  // at all.
  const asked = new Promise<void>((resolve) => {
    page.once("dialog", (dialog) => {
      void dialog.accept().then(() => resolve());
    });
  });
  await yearRow(page, NEXT).getByRole("button", { name: /close this year/i }).click();
  await asked;
  await expect(yearRow(page, NEXT)).toContainText("Closed");
}

test.afterEach(async ({ page }) => {
  await signIn(page, ADMIN);
  const id = await findYearId(page, NEXT);
  if (!id) return;
  // A closed year cannot be deleted, so the closing is undone before the year
  // itself goes — the same order the screens demand of an office-bearer.
  await api(page, "POST", `/api/finance/years/${id}/unlock`, {
    reason: "E2E: putting the test year back so it can be taken out.",
  });
  await api(page, "DELETE", `/api/finance/years/${id}`);
});

test("a year is opened from the year list, and its dates follow its name", async ({ page }) => {
  await signIn(page, TREASURER);
  await openNextYear(page);

  const row = yearRow(page, NEXT);
  await expect(row).toContainText("Open");
  await expect(row).toContainText("Nothing entered yet");
  // An empty balance box is a figure, not a blank: the year begins where the
  // treasurer said it begins.
  await expect(row).toContainText("₹0");

  await openBook(page, NEXT);
  await expect(figureValue(page, "Opening balance")).toHaveText("₹0");
  await expect(figureValue(page, "Closing balance")).toHaveText("₹0");

  // The window is not a thing anybody types. A day outside it has nowhere to go.
  const outside = await api(page, "POST", "/api/finance/transactions", {
    date: A_DAY_IN_NO_YEAR,
    type: "expense",
    category: "event",
    amountPaise: 50_000,
    voucherNo: `E2E-${RUN}-OUTSIDE`,
    party: "E2E party",
    description: `E2E entry in no year at all ${RUN}`,
    projectId: "",
  });
  expect(outside.status).toBe(400);
});

test("a closed year is read, not written into", async ({ page }) => {
  await signIn(page, TREASURER);
  await openNextYear(page);
  await closeNextYear(page);

  await openBook(page, NEXT);
  await expect(page.getByRole("heading", { name: "Enter a voucher" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /enter vouchers/i })).toHaveCount(0);
  // Said twice, in the page's own words and in the panel that replaced the form.
  await expect(page.getByText(/a closed year is not changed/i).first()).toBeVisible();

  // The screen is not the only guard: the API refuses the same entry cold.
  const refused = await api(page, "POST", "/api/finance/transactions", {
    date: A_DAY_IN_NEXT,
    type: "expense",
    category: "event",
    amountPaise: 50_000,
    voucherNo: `E2E-${RUN}-CLOSED`,
    party: "E2E party",
    description: `E2E entry against a closed year ${RUN}`,
    projectId: "",
  });
  expect(refused.status).toBe(409);

  // And a treasurer cannot reopen the year they closed. That is another
  // office-bearer's call, whatever the screens above it say.
  const id = await findYearId(page, NEXT);
  expect(id).not.toBeNull();
  const reopen = await api(page, "POST", `/api/finance/years/${id}/unlock`, {
    reason: `E2E tried to reopen the year ${RUN}`,
  });
  expect(reopen.status).toBe(403);
});

/**
 * The year list used to take its state from a render and its answer from a
 * second one.
 *
 * A closing the server has accepted is already a fact, but the row kept saying
 * `Open` until another render of the page happened to arrive — on a loaded dev
 * server that wait outlasted the treasurer's patience and this spec's clock
 * alike. The response carries the year as the database now keeps it, so the row
 * says what it was told; the figures still come from the render, because a
 * closing moves no voucher.
 */
test("a closed year says Closed at once, even with the screen's next render held back", async ({
  page,
}) => {
  await signIn(page, TREASURER);
  await openNextYear(page);
  await page.goto("/admin/finance");

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/admin\/finance\?.*_rsc/, async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });

  const asked = new Promise<void>((resolve) => {
    page.once("dialog", (dialog) => {
      void dialog.accept().then(() => resolve());
    });
  });
  await yearRow(page, NEXT).getByRole("button", { name: /close this year/i }).click();
  await asked;

  // No render of this screen has been allowed to finish, so the word below can
  // only have come from the answer to the click itself.
  await expect(yearRow(page, NEXT)).toContainText("Closed");

  // And the row is not covering anything up: let the renders through and read
  // the year's own screen, which is a fresh one.
  release();
  await page.unroute(/\/admin\/finance\?.*_rsc/);
  await openBook(page, NEXT);
  await expect(page.getByText(/a closed year is not changed/i).first()).toBeVisible();
});

/**
 * Two writes to one row, before the screen has been allowed to render again.
 *
 * A super admin who closes a year and takes it back into account on the spot has
 * asked the same row twice, and the second answer is no less a fact than the
 * first. So the row has to keep up with both, which means the second write has to
 * recognise the row it is covering as the one the *server* sent — not as the one
 * the first write left on the screen, which is a newer thing than either.
 */
test("a year closed and reopened in one breath says both, with no render in between", async ({
  page,
}) => {
  await signIn(page, ADMIN);
  await openNextYear(page);
  await page.goto("/admin/finance");

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const row = yearRow(page, NEXT);
  const reason = `E2E ${RUN}: the year's last bill arrived after it was closed.`;
  try {
    await page.route(/\/admin\/finance\?.*_rsc/, async (route) => {
      await held;
      await route.continue().catch(() => undefined);
    });

    const asked = new Promise<void>((resolve) => {
      page.once("dialog", (dialog) => {
        void dialog.accept().then(() => resolve());
      });
    });
    await row.getByRole("button", { name: /close this year/i }).click();
    await asked;
    await expect(row.getByText("Closed", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: /reopen this year/i }).click();
    await row.getByLabel(/why is it being reopened/i).fill(reason);
    const unlocking = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/unlock"),
    );
    await row.getByRole("button", { name: new RegExp(`^Reopen ${NEXT}$`) }).click();
    await unlocking;

    // No render of this screen has been allowed to finish, so both of the words
    // below can only have come from the answers to the two clicks — the second
    // write covering the first, rather than the row falling back to the render
    // that was on screen before either of them.
    await expect(row.getByText(/^Reopened: /)).toContainText(reason);
    await expect(row.getByText("Open", { exact: true })).toBeVisible();
  } finally {
    release();
    await page.unroute(/\/admin\/finance\?.*_rsc/);
  }

  // And the row was not making the year say something the database disagrees
  // with: a fresh screen reads the same reopening.
  await page.goto("/admin/finance");
  await expect(yearRow(page, NEXT).getByText(/^Reopened: /)).toContainText(reason);
});

test("only the super admin reopens a closed year, and only with a reason", async ({ page }) => {
  await signIn(page, TREASURER);
  await openNextYear(page);
  await closeNextYear(page);

  await signOut(page);
  await signIn(page, ADMIN);
  await page.goto("/admin/finance");

  const row = yearRow(page, NEXT);
  await row.getByRole("button", { name: /reopen this year/i }).click();
  const reopen = row.getByRole("button", { name: new RegExp(`^Reopen ${NEXT}$`) });
  // Asking for the year back is a written act: the button waits for the sentence.
  await expect(reopen).toBeDisabled();

  const reason = `E2E ${RUN}: the year was closed a day before its last bill arrived.`;
  await row.getByLabel(/why is it being reopened/i).fill(reason);
  await reopen.click();
  await expect(row).toContainText("Reopened:");
  await expect(row).toContainText(reason);

  // The book takes entries again, which is what reopening was for.
  await openBook(page, NEXT);
  await expect(page.getByRole("heading", { name: "Enter a voucher" })).toBeVisible();
});

test("a year the public has figures for cannot be erased, only closed", async ({ page }) => {
  await signIn(page, TREASURER);
  const label = await thisYearLabel(page);
  const id = await findYearId(page, label);
  expect(id).not.toBeNull();

  const answer = await api(page, "DELETE", `/api/finance/years/${id}`);
  expect(answer.status).toBe(409);
  expect(answer.json.error?.code).toBe("year_has_entries");

  await page.goto("/admin/finance");
  await expect(yearRow(page, label)).toContainText("6 vouchers");
});
