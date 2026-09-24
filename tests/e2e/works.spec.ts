import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };
const TREASURER = { email: "treasurer@test.yca.local", password: "branch-test-password" };

/** Two runs on the same day must not collide with each other's rows. */
const RUN = Date.now().toString(36);

type Work = {
  title: string;
  description?: string;
  status?: "proposed" | "ongoing" | "completed" | "deferred";
  rupees?: string;
  beneficiaries?: number;
  location?: string;
  order?: number;
};

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/** Fills the work form and saves it, returning the address of the saved record. */
async function addWork(page: Page, work: Work): Promise<string> {
  await page.goto("/admin/works/new");
  await page.getByLabel(/name of the work/i).fill(work.title);
  // A work is not publishable without a sentence on what it is for, so every
  // record here carries one even when the test is about something else.
  await page
    .getByLabel(/what the work is for/i)
    .fill(work.description ?? "Recorded by the works test to check the screens.");
  if (work.status) {
    // The status select sits inside its label, so the label's text also carries
    // every option name; the accessible name alone is the word "Status".
    await page.getByRole("combobox", { name: "Status" }).selectOption(work.status);
  }
  if (work.rupees !== undefined) await page.getByLabel(/sanctioned amount/i).fill(work.rupees);
  if (work.beneficiaries !== undefined) {
    await page.getByLabel(/beneficiar/i).fill(String(work.beneficiaries));
  }
  if (work.location !== undefined) await page.getByLabel(/^location$/i).fill(work.location);
  if (work.order !== undefined) await page.getByLabel(/order in the list/i).fill(String(work.order));

  await page.getByRole("button", { name: /add the work/i }).click();
  // A new work has no address of its own until the save lands, and the save
  // takes the writer to that address — so the move is the proof. The "Saved."
  // message only survives a save that stays put, i.e. an edit.
  await page.waitForURL(/\/admin\/works\/[0-9a-f]{24}$/);
  await expect(page.getByRole("heading", { name: "Edit work" })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function addReport(
  page: Page,
  report: { date: string; percent: number; text: string },
): Promise<void> {
  await page.getByLabel(/date of the report/i).fill(report.date);
  await page.getByLabel(/percentage complete/i).fill(String(report.percent));
  await page.getByLabel(/what has been done/i).fill(report.text);
  await page.getByRole("button", { name: /add to the timeline/i }).click();
  // The panel's own list is the proof the report landed — a bare "Saved" would
  // also match the message the work form is still showing.
  await expect(reportRow(page, report.text)).toBeVisible();
}

function reportRow(page: Page, text: string) {
  return page.getByRole("listitem").filter({ hasText: text });
}

function cardOf(page: Page, title: string) {
  return page.locator("li", { has: page.getByRole("heading", { name: title, exact: true }) });
}

test("an editor records a work and two dated reports, and the page tells them apart", async ({
  page,
}) => {
  const title = `Road repair ${RUN}`;
  const slug = `road-repair-${RUN}`;

  await signIn(page, EDITOR);
  const editUrl = await addWork(page, {
    title,
    description: "The washed-out stretch below the bazaar rebuilt with a new culvert.",
    status: "ongoing",
    rupees: "250000",
    beneficiaries: 120,
    location: "Sumsilui, below the bazaar",
    order: 3,
  });

  await addReport(page, {
    date: "2026-08-10",
    percent: 25,
    text: "The old culvert has been removed and the bank levelled.",
  });
  await addReport(page, {
    date: "2026-09-15",
    percent: 60,
    text: "New slabs are cast and two lengths are laid.",
  });

  await page.goto(`/works/${slug}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

  // The bar follows the latest dated report, not the earlier one.
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");

  const timeline = page.getByRole("list", { name: /progress report/i });
  await expect(timeline.locator("li")).toHaveCount(2);
  await expect(timeline.locator("li").first()).toContainText("15 September 2026");
  await expect(timeline.locator("li").first()).toContainText("60%");
  await expect(timeline.locator("li").nth(1)).toContainText("10 August 2026");

  // What was sanctioned is the branch's own figure; what has been spent is the
  // ledger's, and Plan 3 has not filled it in yet.
  await expect(page.getByRole("table", { name: /money involved/i })).toContainText("₹2,50,000");
  await expect(page.getByRole("table", { name: /money involved/i })).toContainText(
    "Published with the accounts",
  );

  expect(editUrl).toMatch(/\/admin\/works\/[0-9a-f]{24}$/);
});

test("a work nobody has reported on yet says so, instead of claiming zero", async ({ page }) => {
  const title = `Reading room ${RUN}`;

  await signIn(page, TREASURER);
  await addWork(page, {
    title,
    description: "A quiet room with seating for students at the branch office.",
    status: "proposed",
    rupees: "80000",
    order: 7,
  });

  await page.goto("/works");
  const card = cardOf(page, title);
  await expect(card).toBeVisible();
  await expect(card).toContainText("No progress report yet");
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  await expect(card).not.toContainText("0%");

  // And on its own page the same: no bar, and a sentence saying why.
  await card.getByRole("link", { name: title }).click();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("No progress report has been published yet");
});

test("removing a work takes its progress reports with it", async ({ page }) => {
  const title = `Drain repair ${RUN}`;
  const slug = `drain-repair-${RUN}`;

  await signIn(page, ADMIN);
  const editUrl = await addWork(page, { title, status: "ongoing", rupees: "45000", order: 9 });
  const projectId = editUrl.split("/").pop();

  await addReport(page, { date: "2026-09-01", percent: 40, text: "The collapsed length is cleared." });
  await addReport(page, { date: "2026-09-20", percent: 70, text: "New slabs laid on both lengths." });

  // The handler reports how many reports it took with the work, so an orphaned
  // dated claim cannot survive the record it belongs to.
  const removed = await page.evaluate(async (id) => {
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    return response.json();
  }, projectId);
  expect(removed.data).toMatchObject({ removed: true, updatesRemoved: 2 });

  await page.goto("/works");
  await expect(page.locator("main")).not.toContainText(title);

  // In development a missing page answers 200 with the not-found body, so the
  // body is what proves the address no longer serves the work.
  await page.goto(`/works/${slug}`);
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
});

test("a wrong report can be taken off the timeline", async ({ page }) => {
  const title = `Borrow pit ${RUN}`;
  const slug = `borrow-pit-${RUN}`;
  const text = `A figure typed in the wrong box ${RUN}`;

  await signIn(page, EDITOR);
  await addWork(page, { title, order: 13 });
  await addReport(page, { date: "2026-09-18", percent: 90, text });

  await page.on("dialog", (dialog) => dialog.accept());
  await reportRow(page, text).getByRole("button", { name: /remove/i }).click();
  await expect(reportRow(page, text)).toHaveCount(0);

  // With its only report gone the work reports nothing, rather than a stale 90%.
  await page.goto(`/works/${slug}`);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("No progress report has been published yet");
});

test("a second work cannot take an address that is already in use", async ({ page }) => {
  const title = `Water point ${RUN}`;

  await signIn(page, EDITOR);
  await addWork(page, { title, order: 11 });

  await page.goto("/admin/works/new");
  await page.getByLabel(/name of the work/i).fill(`Different name ${RUN}`);
  // Everything else the form demands has to be filled for the request to reach
  // the address check at all — validation is refused before the clash is seen.
  await page
    .getByLabel(/what the work is for/i)
    .fill("A second hand pump on the same address as the work above.");
  await page.getByLabel(/web address/i).fill(`water-point-${RUN}`);
  await page.getByRole("button", { name: /add the work/i }).click();

  await expect(page.getByRole("alert").filter({ hasText: /web address/i })).toContainText(
    "already used",
  );

  // The first record is untouched by the refusal.
  await page.goto("/admin/works");
  await expect(page.getByRole("row").filter({ hasText: title })).toBeVisible();
});
