import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };
const TREASURER = { email: "treasurer@test.yca.local", password: "branch-test-password" };

/** Keeps re-running the suite against an unseeded database from hitting 409. */
const RUN = Date.now().toString(36);

const TITLE = `Monsoon road repair notice ${RUN}`;
// What the server derives from that title; the test has to name the address too.
const SLUG = `monsoon-road-repair-notice-${RUN}`;

const DUP_TITLE = `Duplicate address test ${RUN}`;

const HELD_TITLE = `Publish repaint test ${RUN}`;
const HELD_SLUG = `publish-repaint-test-${RUN}`;

/**
 * Stands in for a translation the branch would supply — only its being non-empty
 * matters here, since the toggle must offer the languages a notice was written
 * in and no others. Spelled as escapes so no stray byte can alter the script.
 */
const CHAKMA_TITLE = "\u{11103}\u{11115}\u{11122} \u{11105}\u{11122}\u{11113}";
const CHAKMA_BODY =
  "\u{11103}\u{11121}\u{11105}\u{11122}\u{11113}\u{1112C} \u{11113}\u{11122}\u{11104} " +
  "\u{11107}\u{11122}\u{11106}\u{11121}\u{11109}\u{11122}";

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/** The English panel, which every notice must have. */
async function writeEnglish(page: Page, title: string, body: string) {
  await page.getByLabel(/title in english/i).fill(title);
  await page.getByLabel(/text of the notice in english/i).fill(body);
}

async function addChakma(page: Page) {
  await page.getByRole("tab", { name: /Chakma/i }).click();
  await page.getByLabel(/title in chakma/i).fill(CHAKMA_TITLE);
  await page.getByLabel(/text in chakma/i).fill(CHAKMA_BODY);
}

test("a notice stays a draft until an editor publishes it", async ({ page }) => {
  await signIn(page, EDITOR);
  await page.goto("/admin/notices/new");

  await page.getByRole("combobox", { name: /type of notice/i }).selectOption("notice");
  await writeEnglish(
    page,
    TITLE,
    "The approach road below the church has to be repaired before the next rain.\n\nMembers who can spare a day for the work should meet the Secretary at the branch office.",
  );
  await page.getByLabel(/date of the event/i).fill("2026-10-02");
  await page.getByLabel(/venue/i).fill("Branch office, Sumsilui");
  await addChakma(page);

  // The asking is the application's, not the page's, so hearing the request is the
  // proof that the click landed on something listening — the form is server-rendered,
  // and a click a moment before the screen wakes up does nothing at all.
  const saving = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/api/notices"),
  );
  await page.getByRole("button", { name: /save as draft/i }).click();
  await saving;
  // Then the navigation the save itself makes is the proof that it landed: the
  // editor is on the edit screen of the id the server just made, showing what was
  // written there. The "Saved" line passed through on the way is gone by the time
  // the next screen is up, and asserting it would be racing a moment no reader is
  // meant to see.
  await page.waitForURL(/\/admin\/notices\/[0-9a-f]{24}$/);
  await expect(page.getByRole("heading", { name: "Edit notice" })).toBeVisible();
  await expect(page.getByLabel(/title in english/i)).toHaveValue(TITLE);

  await page.goto("/admin/notices");
  const draftRow = page.getByRole("row", { name: new RegExp(TITLE) });
  await expect(draftRow.getByText("Draft")).toBeVisible();
  await expect(draftRow.getByText("not yet")).toBeVisible();

  // Absent from the public list, and unreadable by guessing its address. `notFound()`
  // answers 200 in dev because the layout shell is flushed first, so the page's
  // own text is the signal here, not the status code.
  await page.goto("/notices");
  await expect(page.getByText(TITLE)).toHaveCount(0);
  await page.goto(`/notices/${SLUG}`);
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();

  await page.goto("/admin/notices");
  const publishing = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" && request.url().includes("/api/notices/"),
  );
  await page
    .getByRole("row", { name: new RegExp(TITLE) })
    .getByRole("button", { name: /^publish$/i })
    .click();
  await publishing;
  await expect(
    page.getByRole("row", { name: new RegExp(TITLE) }).getByText("Published"),
  ).toBeVisible();

  await page.goto("/notices");
  await expect(page.getByRole("link", { name: TITLE })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: TITLE })).toBeVisible();

  await page.goto(`/notices/${SLUG}`);
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  await expect(page.getByText("Date of the event")).toBeVisible();
  await expect(page.getByText("2 October 2026")).toBeVisible();
  await expect(page.getByText("Branch office, Sumsilui")).toBeVisible();

  // Exactly the two languages that were written — no empty Bangla panel.
  const languages = page.getByRole("group", { name: /language of this notice/i });
  await expect(languages.getByRole("button")).toHaveCount(2);
  await expect(languages.getByRole("button", { name: /^Bangla$/i })).toHaveCount(0);

  await expect(page.getByText(/approach road below the church/)).toBeVisible();
  await languages.getByRole("button", { name: /^Chakma$/i }).click();
  await expect(page.getByText(CHAKMA_TITLE, { exact: true })).toBeVisible();
  await expect(page.getByText(CHAKMA_BODY)).toBeVisible();
  await expect(page.getByText(/approach road below the church/)).toHaveCount(0);
});

/**
 * The row has to say what the click did.
 *
 * A render of the list may take a moment, or in a busy moment several, and an
 * editor looking at "Draft" under a notice they have just published has no way to
 * tell whether to click again. So the answer to the click carries the notice's new
 * state, and this test holds every render of the screen away to make sure the row
 * is reading the one it asked for.
 */
test("a published notice says Published at once, even with the screen's next render held back", async ({ page }) => {
  await signIn(page, EDITOR);
  const created = await page.request.post("/api/notices", {
    data: {
      kind: "notice",
      status: "draft",
      titleEn: HELD_TITLE,
      bodyEn: "The row has to say what this click did, not what the last render showed.",
      slug: HELD_SLUG,
      eventDate: "",
      venue: "",
      titleBn: "",
      bodyBn: "",
      titleCdp: "",
      bodyCdp: "",
    },
  });
  expect(created.status()).toBe(200);
  const id = (await created.json()).data?.notice?.id as string;
  expect(id).toBeTruthy();

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    await page.goto("/admin/notices");
    const row = page.getByRole("row", { name: new RegExp(HELD_TITLE) });
    await expect(row.getByText("Draft")).toBeVisible();

    // Every render of this screen is held, including the one the framework may be
    // making in the background, so nothing below can have come from a page load.
    await page.route(/\/admin\/notices\?.*_rsc/, async (route) => {
      await held;
      await route.continue().catch(() => undefined);
    });

    const publishing = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" && request.url().includes("/api/notices/"),
    );
    await row.getByRole("button", { name: /^publish$/i }).click();
    await publishing;

    await expect(row).toContainText("Published");
    await expect(row.getByText("Draft")).toHaveCount(0);

    await page.unroute(/\/admin\/notices\?.*_rsc/);

    // And the row is not covering anything up: the public list, a fresh page read
    // straight from the database, says the same.
    await page.goto("/notices");
    await expect(page.getByRole("link", { name: HELD_TITLE })).toBeVisible();
  } finally {
    // Whatever the row managed to say, the held render has to be let go before the
    // browser closes or the run sits waiting on it.
    release();
    await page.request.delete(`/api/notices/${id}`);
  }
});

test("a duplicate web address is refused with a field error", async ({ page }) => {
  await signIn(page, EDITOR);
  const first = await page.request.post("/api/notices", {
    data: {
      kind: "notice",
      status: "published",
      titleEn: DUP_TITLE,
      bodyEn: "The first notice to claim this address.",
      slug: "",
      eventDate: "",
      venue: "",
      titleBn: "",
      bodyBn: "",
      titleCdp: "",
      bodyCdp: "",
    },
  });
  expect(first.status()).toBe(200);

  await page.goto("/admin/notices/new");
  await writeEnglish(page, DUP_TITLE, "A second notice with the same title, so the same address.");
  await page.getByRole("button", { name: /save as draft/i }).click();

  await expect(page.getByText("That web address is already used").first()).toBeVisible();
  await expect(page.getByText(/please check these fields/i)).toBeVisible();
});

test("a half-written translation is refused, and stays visible on another tab", async ({
  page,
}) => {
  await signIn(page, EDITOR);
  await page.goto("/admin/notices/new");
  await writeEnglish(
    page,
    `Chakma title only ${RUN}`,
    "English text with a title in another language and no text to go with it.",
  );
  await page.getByRole("tab", { name: /Chakma/i }).click();
  await page.getByLabel(/title in chakma/i).fill(CHAKMA_TITLE);
  await page.getByRole("button", { name: /save as draft/i }).click();

  await expect(page.getByText(/Add the Chakma text as well/).first()).toBeVisible();

  // The mistake is in a panel the editor may close again, so the summary above
  // the tabs keeps naming it whichever tab is showing.
  const summary = page.getByRole("alert").filter({ hasText: /please check these fields/i });
  const missingHalf = summary.getByRole("listitem").filter({ hasText: /Add the Chakma text/ });
  await expect(missingHalf).toBeVisible();
  await page.getByRole("tab", { name: /English/i }).click();
  await expect(missingHalf).toBeVisible();
});

test("a treasurer is refused the notice list and the API", async ({ page }) => {
  await signIn(page, TREASURER);

  expect((await page.request.get("/api/notices")).status()).toBe(403);
  expect((await page.request.post("/api/notices", { data: {} })).status()).toBe(403);

  await page.goto("/admin/notices");
  await expect(page.getByText(/written by an editor/i)).toBeVisible();

  await page.goto("/admin/notices/new");
  await expect(page.getByText(/Only an editor writes notices/i)).toBeVisible();
});

test("a super-admin reaches the notice list without holding the editor role", async ({
  page,
}) => {
  await signIn(page, ADMIN);
  await page.goto("/admin/notices");
  await expect(page.getByRole("heading", { name: /notices and press releases/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /write a notice/i })).toBeVisible();
});
