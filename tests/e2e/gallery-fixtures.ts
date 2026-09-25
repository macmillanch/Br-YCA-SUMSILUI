import { expect, type Page } from "@playwright/test";

/**
 * Every spec writes into one shared test database, so a picture left standing is
 * a picture the next spec finds already published — and the front page stops
 * being the empty branch it means to show. Removing through the admin screen is
 * the office-bearer's own way back, so it doubles as a check of it.
 */
export async function removeEveryPicture(page: Page) {
  // A spec that registered its own handler already answered some of these, and a
  // dialog only answers once.
  page.on("dialog", (dialog) => dialog.accept().catch(() => undefined));
  await page.goto("/admin/gallery");
  const remove = page.getByRole("button", { name: /from the gallery$/ });
  for (;;) {
    const left = await remove.count();
    if (left === 0) return;
    await remove.first().click();
    await expect(remove).toHaveCount(left - 1);
  }
}
