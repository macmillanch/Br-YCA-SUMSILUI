import { expect, test, type Page } from "@playwright/test";

const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

/** Keeps re-running the suite against an unseeded database from hitting 409. */
const RUN = Date.now().toString(36);

/** What the two pages hold at a time, and what this board asks them to divide. */
const PER_PAGE = 20;
const NOTICES = 25;
const PRESS_RELEASES = 21;

/** Stable so a run killed halfway through can be swept away by the next one. */
const MARKER = "paging-sweep-notice";

const noticeSlugs = Array.from({ length: NOTICES }, (_, i) => `${MARKER}-${i + 1}-${RUN}`);
const pressSlugs = Array.from(
  { length: PRESS_RELEASES },
  (_, i) => `${MARKER}-pr-${i + 1}-${RUN}`,
);
/** Deliberately the last thing published, and still a press release. */
const FRESHEST = `${MARKER}-pr-last-${RUN}`;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EDITOR.email);
  await page.getByLabel(/password/i).fill(EDITOR.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

/**
 * `publishedAt` is stamped to the millisecond when the notice reaches the server,
 * and the board sorts by it — so two notices stamped in the same millisecond have
 * no order between them and the database may return them either way round. The
 * fixture spaces its own publications rather than leaving the test to chance.
 */
async function publish(page: Page, slug: string, kind: "notice" | "press_release") {
  await page.waitForTimeout(5);
  const response = await page.request.post("/api/notices", {
    data: {
      kind,
      status: "published",
      titleEn: slug.replace(/-/g, " "),
      bodyEn: "A notice on the paging board, written by the automated test and nobody else.",
      slug,
      eventDate: "",
      venue: "",
      titleBn: "",
      bodyBn: "",
      titleCdp: "",
      bodyCdp: "",
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data?.notice?.id as string;
}

/** The addresses the screen printed, in the order it printed them. */
async function cardSlugs(page: Page): Promise<string[]> {
  return page
    .locator("article h3 a")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")?.replace("/notices/", "") ?? ""),
    );
}

async function remove(page: Page, ids: string[]) {
  for (const id of ids) {
    expect((await page.request.delete(`/api/notices/${id}`)).status()).toBe(200);
  }
}

/**
 * Twenty-five notices and twenty-two press releases: the smallest board that
 * leaves both pages with a part-filled last page of their own.
 *
 * Which notice is newest, and where an offset lands, is the database's answer and
 * is pinned in `tests/unit/notice-paging.test.ts`. What is proved here is the
 * screen's half of it: that it prints one page and says which one, that the pages
 * tile the board without gaps or repeats, and that an address a reader types or a
 * bookmark leaves behind cannot ask for a page that is not there.
 */
test("the notice board turns over a page at a time", async ({ page }) => {
  await signIn(page);

  // Anything an earlier killed run left behind would change every total below.
  const board = await page.request.get("/api/notices");
  expect(board.status()).toBe(200);
  const strays = ((await board.json()).data?.notices ?? []) as { id: string; slug: string }[];
  await remove(
    page,
    strays.filter((row) => row.slug.startsWith(MARKER)).map((row) => row.id),
  );

  const ids: string[] = [];
  try {
    for (const slug of noticeSlugs) ids.push(await publish(page, slug, "notice"));
    for (const slug of pressSlugs) ids.push(await publish(page, slug, "press_release"));
    ids.push(await publish(page, FRESHEST, "press_release"));

    const all = [...noticeSlugs, ...pressSlugs, FRESHEST];
    const total = all.length;
    const lastPage = Math.ceil(total / PER_PAGE);
    const onLastPage = total - (lastPage - 1) * PER_PAGE;

    /* ----------------------------------------------------------- page one */

    await page.goto("/notices");
    const nav = page.getByRole("navigation", { name: "Notice pages" });
    await expect(nav).toContainText(`Page 1 of ${lastPage}`);
    await expect(nav).toContainText(`showing 1–${PER_PAGE} of ${total}`);
    expect(await cardSlugs(page)).toHaveLength(PER_PAGE);
    await expect(nav.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/notices?page=2",
    );
    await expect(nav.getByRole("link", { name: "Previous page" })).toHaveCount(0);
    // Newest first: the last thing the branch put out is on the first screen.
    expect(await cardSlugs(page)).toContain(FRESHEST);

    /* ------------------------------------------------------ the whole board */

    const seen: string[] = [];
    for (let number = 1; number <= lastPage; number += 1) {
      await page.goto(`/notices?page=${number}`);
      const rows = await cardSlugs(page);
      expect(rows).toHaveLength(number === lastPage ? onLastPage : PER_PAGE);
      await expect(nav).toContainText(`Page ${number} of ${lastPage}`);
      seen.push(...rows);
    }
    expect(new Set(seen).size).toBe(total);
    expect(seen.sort()).toEqual(all.sort());

    await page.goto(`/notices?page=${lastPage}`);
    await expect(nav.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      `/notices?page=${lastPage - 1}`,
    );
    await expect(nav.getByRole("link", { name: "Next page" })).toHaveCount(0);

    /* ---------------------------------------------------- typed addresses */

    // A bookmark set when the board was longer is not a claim that the branch
    // published nothing: it lands on the last page that still exists.
    await page.goto("/notices?page=99999");
    await expect(nav).toContainText(`Page ${lastPage} of ${lastPage}`);
    expect(await cardSlugs(page)).toHaveLength(onLastPage);

    for (const junk of ["abc", "0", "-3", "2.5", "next"]) {
      await page.goto(`/notices?page=${junk}`);
      await expect(nav).toContainText("Page 1 of");
      expect(await cardSlugs(page)).toHaveLength(PER_PAGE);
    }

    /* -------------------------------------------------- filters and pages */

    // A filter is a different question, so it starts again from the top: the
    // links offer page one and carry no page number of their own.
    await page.goto("/notices?page=2");
    const filter = page.getByRole("navigation", { name: "Filter notices by type" });
    await expect(filter.getByRole("link", { name: "Notice", exact: true })).toHaveAttribute(
      "href",
      "/notices?kind=notice",
    );
    await expect(filter.getByRole("link", { name: "All" })).toHaveAttribute("href", "/notices");

    await page.goto("/notices?kind=notice");
    await expect(nav).toContainText(`showing 1–${PER_PAGE} of ${NOTICES}`);
    await page.goto(`/notices?kind=notice&page=${Math.ceil(NOTICES / PER_PAGE)}`);
    const secondKindPage = await cardSlugs(page);
    expect(secondKindPage).toHaveLength(NOTICES - PER_PAGE);
    for (const slug of secondKindPage) {
      expect(slug.startsWith(MARKER)).toBe(true);
      expect(slug).not.toContain("-pr-");
    }

    // A filter with nothing under it says so, and a page number cannot change that.
    await page.goto("/notices?kind=announcement&page=2");
    await expect(page.getByText("Nothing published under this filter yet")).toBeVisible();
    await expect(nav).toHaveCount(0);

    /* ----------------------------------------------------- press releases */

    const pressTotal = PRESS_RELEASES + 1;
    await page.goto("/press-releases");
    const pressNav = page.getByRole("navigation", { name: "Press release pages" });
    await expect(pressNav).toContainText(`Page 1 of ${Math.ceil(pressTotal / PER_PAGE)}`);
    for (const slug of await cardSlugs(page)) expect(slug).toContain("-pr-");

    await pressNav.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/\/press-releases\?page=2$/);
    await expect(pressNav).toContainText(
      `showing ${PER_PAGE + 1}–${pressTotal} of ${pressTotal}`,
    );
    expect(await cardSlugs(page)).toHaveLength(pressTotal - PER_PAGE);
  } finally {
    await remove(page, ids);
  }
});
