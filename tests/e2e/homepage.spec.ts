import { expect, test, type Page } from "@playwright/test";
import { SEEDED, figureValue } from "./finance-fixtures";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/**
 * The front page in the state the seed leaves it: every section standing on its
 * own emptiness rather than filled with a stand-in, and the only money shown on
 * it the money the ledger actually holds.
 *
 * The three figures are the six test vouchers seen from the public side. A page
 * that printed a figure the book did not add up to would be the one failure the
 * finance screens exist to prevent, so this is the check that closes the year's
 * specs from outside the office.
 */
test("the front page shows each section as it is, and the ledger's own figures", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");

  await expect(page.getByRole("heading", { name: "Latest notices", level: 2 })).toBeVisible();
  await expect(main).toContainText("No notices have been published yet");

  await expect(page.getByRole("heading", { name: "Ongoing works", level: 2 })).toBeVisible();
  await expect(main).toContainText("No work is under way");

  const finances = page.locator("section[aria-labelledby='finance-heading']");
  await expect(page.getByRole("heading", { name: "Financial transparency", level: 2 })).toBeVisible();
  await expect(figureValue(finances, "Income this year")).toHaveText(SEEDED.income);
  await expect(figureValue(finances, "Expenses this year")).toHaveText(SEEDED.expense);
  await expect(figureValue(finances, "Balance on hand")).toHaveText(SEEDED.closing);

  await expect(page.getByRole("heading", { name: "From the branch", level: 2 })).toBeVisible();
  await expect(main).toContainText("Photographs from branch events will appear here");

  // Nothing on the page is a stand-in any more, so nothing carries the marker.
  await expect(main.getByText(/demo/i)).toHaveCount(0);

  await page.goto("/about");
  await expect(page.getByRole("main")).toContainText("established in 1978");
  await expect(page.getByRole("main")).toContainText("has not entered its mission");
});

test("the branch's own words reach the front page and the about page as written", async ({
  page,
}) => {
  const mission =
    "To keep the young of the community together, and to do openly whatever the locality needs.";

  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel(/mission and objectives/i).fill(mission);
  await page
    .getByLabel("About", { exact: true })
    .fill("The branch grew out of a study circle of eleven students.");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Word for word: the site adds nothing to what the office-bearers typed, and
  // takes nothing away.
  await page.goto("/about");
  await expect(page.getByRole("main")).toContainText(mission);
  await expect(page.getByRole("main")).toContainText(
    "The branch grew out of a study circle of eleven students.",
  );

  await page.goto("/");
  await expect(page.getByRole("main")).toContainText(mission);
});
