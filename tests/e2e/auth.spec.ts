import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
}

test("a correct password reaches the dashboard and a wrong one does not", async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/login");

  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill("definitely-not-the-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toContainText("Email or password is incorrect");
  await expect(page).toHaveURL(/\/login$/);
});

test("an unauthenticated visitor is pushed to the login page", async ({ page }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/login$/);
});

test("the login endpoint refuses a wrong role without leaking the reason", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { email: "nobody@test.yca.local", password: "branch-test-password" },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe("invalid_credentials");
});

test("an editor cannot write to the settings endpoint", async ({ page, request }) => {
  await signIn(page, EDITOR);
  const sessionCookie = (await page.context().cookies()).find(
    (entry) => entry.name === "yca_session",
  );
  expect(sessionCookie?.value).toBeTruthy();

  const response = await request.patch("/api/settings", {
    headers: { cookie: `yca_session=${sessionCookie?.value ?? ""}` },
    data: { branchName: "Hijacked" },
  });
  expect(response.status()).toBe(403);
});
