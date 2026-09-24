import { expect, test, type Browser, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

/** Keeps re-running the suite against an unseeded database from hitting 409. */
const RUN = Date.now().toString(36);

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/**
 * A separate context has its own cookie jar, so an account signed in here stays
 * independent of the session the `request` fixture shares with `page`.
 */
async function signInInNewContext(browser: Browser, user: { email: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user);
  return { context, page };
}

test("an invited office-bearer can sign in with the generated password", async ({
  page,
  browser,
}) => {
  await signIn(page, ADMIN);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: /^users$/i })).toBeVisible();

  await page.getByLabel(/full name/i).fill(`Invite ${RUN}`);
  await page.getByLabel(/^email$/i).fill(`invite-${RUN}@test.yca.local`);
  // getByLabel reads a wrapping label's whole text content, which for a <select>
  // includes its option text — so the ARIA name is matched through getByRole.
  await page.getByRole("combobox", { name: /^Role$/i }).selectOption("editor");
  await page.getByRole("button", { name: /create account/i }).click();

  const password = page.getByTestId("temporary-password");
  await expect(password).toBeVisible();
  const temporaryPassword = (await password.textContent()) ?? "";
  expect(temporaryPassword).toHaveLength(16);

  await expect(page.getByRole("cell", { name: `Invite ${RUN}`, exact: true })).toBeVisible();

  const { context } = await signInInNewContext(browser, {
    email: `invite-${RUN}@test.yca.local`,
    password: temporaryPassword,
  });
  await context.close();
});

test("an editor is refused the user list", async ({ page }) => {
  await signIn(page, EDITOR);

  const response = await page.request.get("/api/users");
  expect(response.status()).toBe(403);

  await page.goto("/admin/users");
  await expect(page.getByText(/only a super-admin/i)).toBeVisible();
});

test("deactivating an account ends its session at once", async ({ page, browser }) => {
  await signIn(page, ADMIN);

  // page.request carries the admin session the browser just established.
  const created = await page.request.post("/api/users", {
    data: {
      email: `leaver-${RUN}@test.yca.local`,
      name: `Leaver ${RUN}`,
      role: "editor",
      password: "temporary-test-password",
    },
  });
  expect(created.status()).toBe(200);

  const { context: leaverContext, page: leaverPage } = await signInInNewContext(browser, {
    email: `leaver-${RUN}@test.yca.local`,
    password: "temporary-test-password",
  });
  await expect(leaverPage.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  expect((await leaverContext.request.get("/api/auth/me")).status()).toBe(200);

  await page.goto("/admin/users");
  const row = page.getByRole("row", { name: new RegExp(`Leaver ${RUN}`) });
  await row.getByRole("button", { name: /deactivate/i }).click();
  await expect(row.getByText("Deactivated")).toBeVisible();

  expect((await leaverContext.request.get("/api/auth/me")).status()).toBe(401);

  // Middleware only sees a cookie, so the shell still loads — but the session
  // row is gone, so it says so instead of rendering the dashboard.
  await leaverPage.goto("/admin");
  await expect(leaverPage.getByText(/session has ended/i)).toBeVisible();

  await leaverContext.close();
});
