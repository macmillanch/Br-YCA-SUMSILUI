import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };

async function signInAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

test("a saved phone number appears in the public footer", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel(/office phone/i).fill("9138765432");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/");
  await expect(page.locator("footer")).toContainText("9138765432");
});

test("an invalid email is refused with a field message", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel(/^email$/i).fill("nope");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
});

test("a saved Facebook link is a real anchor, not inert text", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await page
    .getByLabel(/facebook page/i)
    .fill("https://facebook.com/yca.sumsilui");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/contact");
  await expect(page.locator('footer a[href="https://facebook.com/yca.sumsilui"]')).toBeVisible();
});
