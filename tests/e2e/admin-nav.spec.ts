import { expect, test, type Page } from "@playwright/test";
import { removeEveryPicture } from "./gallery-fixtures";
import { SEEDED } from "./finance-fixtures";

const PASSWORD = "branch-test-password";
const EDITOR = { email: "editor@test.yca.local", password: PASSWORD };
const TREASURER = { email: "treasurer@test.yca.local", password: PASSWORD };

const PICTURE = {
  album: "Executive committee meeting",
  caption: "The first sitting of the year",
  alt: "Five people around a table with papers on it",
  url: "https://res.cloudinary.com/yca-sumsilui-test/image/upload/v1700000000/branch/gallery/sitting.jpg",
};

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(account.email);
  await page.getByLabel(/password/i).fill(account.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
  // The admin shell resolves the session on the server, so the URL moves before
  // the sidebar is on the page at all.
  await expect(sidebar(page).getByRole("link", { name: "Dashboard" })).toBeVisible();
}

function sidebar(page: Page) {
  // The nav also carries a "View public site" link below the list, and that is
  // not one of the screens under test.
  return page.getByRole("navigation", { name: "Admin" }).getByRole("list");
}

async function addPicture(page: Page) {
  await page.goto("/admin/gallery");
  await sidebar(page).getByRole("link", { name: "Gallery" }).waitFor();
  await page.getByLabel(/^album/i).fill(PICTURE.album);
  await page.getByLabel(/caption/i).fill(PICTURE.caption);
  await page.getByLabel(/description for a screen reader/i).fill(PICTURE.alt);
  await page.getByLabel(/picture web address/i).fill(PICTURE.url);
  await page.getByRole("button", { name: /add the picture/i }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
}

// The dashboard card counts every published picture, and the front-page specs
// expect a branch that has published none, so this file's own has to go.
test.afterEach(async ({ page }) => {
  await removeEveryPicture(page);
});

/**
 * Every screen the sidebar offers, opened in turn.
 *
 * A link that goes to a 404 is worse than no link: an office-bearer told the
 * accounts are behind it should find the accounts there.
 */
async function everyOfferedScreenOpens(page: Page) {
  const hrefs = await sidebar(page)
    .getByRole("link")
    .evaluateAll((anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href): href is string => Boolean(href) && href !== "/admin"),
    );
  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs) {
    await page.goto(href);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).not.toContainText(/404|not found|could not be found/i);
    // Still the admin shell: a screen that bounced them out would have no
    // sidebar left on it.
    await expect(sidebar(page).getByRole("link", { name: "Dashboard" })).toBeVisible();
  }
}

/** One of the three figures on the dashboard's account card. */
function dashboardFigure(page: Page, term: string) {
  return page.getByText(term, { exact: true }).locator("xpath=following-sibling::dd[1]");
}

test("an editor is offered the content screens, and not the accounts or settings", async ({
  page,
}) => {
  await signIn(page, EDITOR);
  const links = sidebar(page).getByRole("link");
  await expect(links).toHaveText([
    "Dashboard",
    "Notices & press releases",
    "Members",
    "Works & progress",
    "Gallery",
  ]);
});

test("every screen the sidebar offers an editor really opens", async ({ page }) => {
  await signIn(page, EDITOR);
  await everyOfferedScreenOpens(page);
});

test("a treasurer is offered the accounts and the contributions as well", async ({ page }) => {
  await signIn(page, TREASURER);
  await expect(sidebar(page).getByRole("link")).toHaveText([
    "Dashboard",
    "Notices & press releases",
    "Members",
    "Works & progress",
    "Gallery",
    "Finance",
    "Donations",
  ]);
});

test("every screen the sidebar offers a treasurer really opens", async ({ page }) => {
  await signIn(page, TREASURER);
  await everyOfferedScreenOpens(page);
});

test("the dashboard prints the year's figures, and the way to change them", async ({ page }) => {
  await signIn(page, TREASURER);
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: /as the book stands/i })).toBeVisible();
  await expect(dashboardFigure(page, "Money received")).toHaveText(SEEDED.income);
  await expect(dashboardFigure(page, "Paid out")).toHaveText(SEEDED.expense);
  await expect(dashboardFigure(page, "Balance")).toHaveText(SEEDED.closing);
  // The card offers the book to the hands that keep it.
  await expect(page.getByRole("link", { name: /enter a voucher/i })).toBeVisible();
});

test("an editor's dashboard points at what the public reads, not at the book", async ({
  page,
}) => {
  await signIn(page, EDITOR);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /what the public reads/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /enter a voucher/i })).toHaveCount(0);
});

test("the dashboard counts what the branch has actually published", async ({ page }) => {
  await signIn(page, TREASURER);
  await addPicture(page);

  await page.goto("/admin");
  const pictures = page.getByText("Pictures published", { exact: true }).locator("..");
  await expect(pictures).toContainText("1");
  await expect(page.getByText("Works under way", { exact: true }).locator("..")).toContainText("0");
});
