import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/**
 * This is the state the branch ships in: nothing published yet. Every section
 * has to stand on its own emptiness rather than be filled with a stand-in, and
 * no rupee figure may appear until the ledger produces one.
 */
test("an unpublished branch still shows a whole front page, with no invented figures", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");

  await expect(page.getByRole("heading", { name: "Latest notices", level: 2 })).toBeVisible();
  await expect(main).toContainText("No notices have been published yet");

  await expect(page.getByRole("heading", { name: "Ongoing works", level: 2 })).toBeVisible();
  await expect(main).toContainText("No work is under way");

  await expect(
    page.getByRole("heading", { name: "Financial transparency", level: 2 }),
  ).toBeVisible();
  await expect(main).toContainText("No financial year has been published yet");

  await expect(page.getByRole("heading", { name: "From the branch", level: 2 })).toBeVisible();
  await expect(main).toContainText("Photographs from branch events will appear here");

  // Nothing on the page is a stand-in any more, so nothing carries the marker.
  await expect(main.getByText(/demo/i)).toHaveCount(0);
  // A rupee sign anywhere here would be an amount nobody entered.
  await expect(main).not.toContainText("₹");

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
