import { expect, test, type Locator, type Page } from "@playwright/test";
import { removeEveryPicture } from "./gallery-fixtures";
import { bitmapOf, sizeFromUrl } from "./picture-fixtures";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };

/**
 * The store's own address shape, so the two copies the page hands out — the
 * grid's and the viewer's — are the ones the image store was asked for. The
 * width and height the bytes come back at are read out of the file name by the
 * stand-in store installed below, which is what lets the layout be measured.
 *
 * A size is asked for by a segment inserted just after `upload`, so the stand-in
 * answers for everything under that path rather than for the stored address
 * alone — the stored address is where the picture came from, not the one shape
 * the page is allowed to ask for.
 */
const UPLOADS = "https://res.cloudinary.com/yca-sumsilui-test/image/upload";
const STORE = `${UPLOADS}/v1700000000/branch/gallery`;

function pictureAt(size: { width: number; height: number }): Buffer {
  return bitmapOf(size.width, size.height, [46, 125, 90]);
}

/**
 * The picture store is not connected to this branch yet, so a test that wants
 * real pixels has to answer for them. Only the store's own host is intercepted:
 * everything else about the page is the page's own doing.
 */
async function servePicturesFrom(page: Page) {
  await page.route(`${UPLOADS}/**`, (route) => {
    const size = sizeFromUrl(route.request().url());
    if (!size) {
      void route.fulfill({ status: 404, body: "no shape asked for" });
      return;
    }
    void route.fulfill({ contentType: "image/bmp", body: pictureAt(size) });
  });
}

type Picture = {
  album: string;
  caption: string;
  alt: string;
  /** The file name carries the shape the stand-in store will answer with. */
  file: string;
  takenAt?: string;
  order?: number;
};

async function publish(page: Page, picture: Picture) {
  const response = await page.request.post("/api/gallery", {
    data: {
      album: picture.album,
      caption: picture.caption,
      alt: picture.alt,
      imageUrl: `${STORE}/${picture.file}`,
      takenAt: picture.takenAt ?? "",
      order: picture.order ?? 0,
    },
  });
  expect(response.status()).toBe(200);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

function gridLinks(page: Page) {
  return page.locator("main a[data-photo]");
}

function viewer(page: Page) {
  return page.getByRole("dialog", { name: "Photograph viewer" });
}

/**
 * A picture's own shape, as the browser drew it: height over width.
 *
 * The natural size is waited for rather than read straight away, because a
 * thumbnail that has not arrived yet draws at no shape at all, and a measurement
 * taken then would say nothing about the layout.
 */
async function drawnRatio(locator: Locator): Promise<number> {
  await locator.scrollIntoViewIfNeeded();
  await expect
    .poll(() => locator.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const box = await locator.boundingBox();
  if (!box) throw new Error("the picture was not drawn at all");
  return box.height / box.width;
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await servePicturesFrom(page);
});

test.afterEach(async ({ page }) => {
  await removeEveryPicture(page);
});

const CAMP = "Youth camp 2026";
/** How the site writes a day the branch knows, and any day at all. */
const KNOWN_DAY = "18 Apr 2026";
const ANY_DAY = /\d{1,2}\s+\w{3,}\s+\d{4}/;
const PORTRAIT = {
  album: CAMP,
  caption: "The evening session on the lawn",
  alt: "People sitting in a semicircle on the grass at dusk",
  file: "lawn-300x600.jpg",
  takenAt: "2026-04-18",
  order: 1,
};
const LANDSCAPE = {
  album: CAMP,
  caption: "The camp choir",
  alt: "A group of singers standing in front of a tin roof",
  file: "choir-600x300.jpg",
  order: 2,
};

test("a picture keeps its own shape in the grid rather than being cropped to a box", async ({
  page,
}) => {
  await publish(page, PORTRAIT);
  await publish(page, LANDSCAPE);

  await page.goto("/gallery");
  const tall = page.locator(`main img[alt="${PORTRAIT.alt}"]`).first();
  const wide = page.locator(`main img[alt="${LANDSCAPE.alt}"]`).first();

  // The claim being checked is a proportion, not a pixel count: what the browser
  // drew has to be the shape the bytes are, because a grid that filled every
  // frame to four-by-three would cut the heads off a portrait.
  expect(await drawnRatio(tall)).toBeCloseTo(2, 1);
  expect(await drawnRatio(wide)).toBeCloseTo(0.5, 1);
});

test("the grid offers the display copy and links to the large one", async ({ page }) => {
  await publish(page, PORTRAIT);

  await page.goto("/gallery");
  const link = gridLinks(page).first();
  const image = link.locator("img");

  await expect(link).toHaveAttribute("href", /\/upload\/w_1200,c_limit,f_auto,q_auto\/.*lawn-300x600\.jpg$/);
  await expect(image).toHaveAttribute("src", /\/upload\/w_600,c_limit,f_auto,q_auto\/.*lawn-300x600\.jpg$/);
});

test("clicking a picture opens the large copy with its description and its own words", async ({
  page,
}) => {
  await publish(page, PORTRAIT);
  await publish(page, LANDSCAPE);

  await page.goto("/gallery");
  await gridLinks(page).nth(1).click();

  const open = viewer(page);
  await expect(open).toBeVisible();
  await expect(open.locator("img")).toHaveAttribute("src", /w_1200,c_limit/);
  await expect(open.locator("img")).toHaveAttribute("alt", LANDSCAPE.alt);
  await expect(open.getByText(LANDSCAPE.caption)).toBeVisible();
  await expect(open.getByText("2 of 2", { exact: true })).toBeVisible();
});

test("the viewer turns over the pictures and stops at both ends", async ({ page }) => {
  await publish(page, PORTRAIT);
  await publish(page, LANDSCAPE);

  await page.goto("/gallery");
  await gridLinks(page).first().click();

  const open = viewer(page);
  await expect(open.getByText("1 of 2", { exact: true })).toBeVisible();
  await expect(open.getByRole("button", { name: /previous picture/i })).toBeDisabled();

  await open.getByRole("button", { name: /next picture/i }).click();
  await expect(open.getByText("2 of 2", { exact: true })).toBeVisible();
  await expect(open.locator("img")).toHaveAttribute("alt", LANDSCAPE.alt);
  await expect(open.getByRole("button", { name: /next picture/i })).toBeDisabled();

  await open.getByRole("button", { name: /previous picture/i }).click();
  await expect(open.getByText("1 of 2", { exact: true })).toBeVisible();
});

test("the arrow keys turn the pictures too", async ({ page }) => {
  await publish(page, PORTRAIT);
  await publish(page, LANDSCAPE);

  await page.goto("/gallery");
  await gridLinks(page).first().click();
  await expect(viewer(page)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(viewer(page).getByText("2 of 2", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(viewer(page).getByText("1 of 2", { exact: true })).toBeVisible();
});

test("escape closes the viewer and puts the reader back on the picture they opened", async ({
  page,
}) => {
  await publish(page, PORTRAIT);
  await publish(page, LANDSCAPE);

  await page.goto("/gallery");
  const second = gridLinks(page).nth(1);
  await second.click();
  await expect(viewer(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0);
  // Back to the picture they chose, not to the top of a long page of thumbnails.
  await expect(second).toBeFocused();
});

test("the close button leaves the page where the picture was", async ({ page }) => {
  await publish(page, PORTRAIT);

  await page.goto("/gallery");
  const first = gridLinks(page).first();
  await first.click();
  await viewer(page).getByRole("button", { name: /^close$/i }).click();
  await expect(viewer(page)).toHaveCount(0);
  await expect(first).toBeFocused();
});

test("a picture taken on a known day says when, in the grid and in the viewer", async ({
  page,
}) => {
  await publish(page, PORTRAIT);

  await page.goto("/gallery");
  await expect(page.locator("main figure").first()).toContainText(KNOWN_DAY);

  await gridLinks(page).first().click();
  await expect(viewer(page)).toContainText(KNOWN_DAY);
});

test("a picture whose day is not known says nothing about one", async ({ page }) => {
  await publish(page, { ...PORTRAIT, takenAt: "" });

  await page.goto("/gallery");
  await expect(page.locator("main figure")).not.toContainText(ANY_DAY);

  await gridLinks(page).first().click();
  await expect(viewer(page)).not.toContainText(ANY_DAY);
});

test("the viewer carries on into the next album rather than stopping at its border", async ({
  page,
}) => {
  const queue = {
    album: "Medical camp",
    caption: "The queue outside the tent",
    alt: "People standing in a line beside a white tent",
    file: "queue-400x400.jpg",
    order: 1,
  };
  await publish(page, PORTRAIT);
  await publish(page, queue);

  await page.goto("/gallery");
  // Which album comes first is the branch's ordering, not this test's, so the two
  // descriptions are read back off the grid rather than assumed. What matters is
  // that turning over leaves one album's border behind.
  const alts = await gridLinks(page).evaluateAll((links) =>
    links.map((link) => link.querySelector("img")?.alt ?? ""),
  );
  expect(alts).toEqual([expect.any(String), expect.any(String)]);
  expect(alts[0]).not.toBe(alts[1]);

  await gridLinks(page).last().click();
  const open = viewer(page);
  await expect(open.getByText("2 of 2", { exact: true })).toBeVisible();
  await expect(open.locator("img")).toHaveAttribute("alt", alts[1] as string);

  await open.getByRole("button", { name: /previous picture/i }).click();
  await expect(open.getByText("1 of 2", { exact: true })).toBeVisible();
  await expect(open.locator("img")).toHaveAttribute("alt", alts[0] as string);
});
