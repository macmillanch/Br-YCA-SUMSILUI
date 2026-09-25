import type { Locator, Page } from "@playwright/test";

/**
 * Every spec writes into one shared test database, so a picture left standing is
 * a picture the next spec finds already published — and the front page stops
 * being the empty branch it means to show.
 *
 * The removals go the office-bearer's way, through the admin screen, but the
 * proof is the server's own answer rather than the line the screen prints: that
 * line is client state, which the refresh after it can repaint away, and a
 * picture counted from a fresh page read is the record that actually matters.
 */
export async function removeEveryPicture(page: Page) {
  // A spec that registered its own handler already answered some of these, and a
  // dialog only answers once.
  page.on("dialog", (dialog) => dialog.accept().catch(() => undefined));
  await page.goto("/admin/gallery");
  const remove = page.getByRole("button", { name: /from the gallery$/ });
  for (;;) {
    const before = await remove.count();
    if (before === 0) return;
    await removeOnePicture(page, remove);
    await page.goto("/admin/gallery");
    const after = await remove.count();
    if (after >= before) {
      throw new Error(`the gallery still lists ${after} pictures after removing one`);
    }
  }
}

async function removeOnePicture(page: Page, remove: Locator) {
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" && response.url().includes("/api/gallery/"),
    { timeout: 30_000 },
  );
  await remove.first().click();
  const response = await answered.catch(() => null);
  if (!response) {
    throw new Error("the remove button never asked the server to take a picture away");
  }
  if (!response.ok()) {
    throw new Error(`the gallery refused to remove a picture: ${response.status()}`);
  }
}
