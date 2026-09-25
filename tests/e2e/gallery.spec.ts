import { expect, test, type Page } from "@playwright/test";
import { removeEveryPicture } from "./gallery-fixtures";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

/** Cloudinary hands back an address like this; the gallery stores it as given. */
const CLOUDINARY_URL =
  "https://res.cloudinary.com/yca-sumsilui-test/image/upload/v1700000000/branch/gallery/agm.jpg";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

async function signInAs(page: Page, user: { email: string; password: string } = ADMIN) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

async function signInAsAdmin(page: Page) {
  await signInAs(page, ADMIN);
}

/** The words the branch has to supply for any picture, however it arrives. */
type Picture = {
  album: string;
  caption: string;
  alt: string;
  url?: string;
  file?: { name: string; mimeType: string; buffer: Buffer };
};

async function addPicture(page: Page, picture: Picture) {
  await page.goto("/admin/gallery");
  await page.getByLabel(/^album/i).fill(picture.album);
  await page.getByLabel(/caption/i).fill(picture.caption);
  await page.getByLabel(/description for a screen reader/i).fill(picture.alt);
  if (picture.file) {
    await page.getByLabel(/picture file/i).setInputFiles(picture.file);
  } else {
    await page.getByLabel(/picture web address/i).fill(picture.url ?? CLOUDINARY_URL);
  }
  await page.getByRole("button", { name: /add the picture/i }).click();
}

async function expectRefused(page: Page, message: RegExp) {
  await expect(page.getByRole("alert").filter({ hasText: message }).first()).toBeVisible();
  await expect(page.getByText("Saved.")).toHaveCount(0);
}

test.afterEach(async ({ page }) => {
  await removeEveryPicture(page);
});

test("an editor adds a picture with its written description and it appears under its own album", async ({
  page,
}) => {
  await signInAs(page, EDITOR);
  await addPicture(page, {
    album: "Annual general meeting 2026",
    caption: "Office-bearers elected for the two-year term",
    alt: "Nine people seated at a long table under a banner",
  });
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/gallery");
  await expect(
    page.getByRole("heading", { name: "Annual general meeting 2026" }),
  ).toBeVisible();
  await expect(page.getByText("Office-bearers elected for the two-year term")).toBeVisible();
  await expect(
    page
      .locator('img[alt="Nine people seated at a long table under a banner"]')
      .first(),
  ).toBeVisible();
});

test("two albums keep their pictures apart, in the order the branch numbered them", async ({
  page,
}) => {
  await signInAsAdmin(page);
  const second = {
    album: "Easter meeting",
    caption: "The choir after the service",
    alt: "A group of singers standing on a low stage",
  };
  const first = {
    album: "Annual general meeting 2026",
    caption: "The reading of the report",
    alt: "A man standing at a lectern reading from a paper",
  };
  await addPicture(page, second);
  await expect(page.getByText("Saved.")).toBeVisible();
  await addPicture(page, first);
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/gallery");
  const albums = page.getByRole("heading", { level: 2 });
  await expect(albums.filter({ hasText: "Easter meeting" })).toBeVisible();
  // Only these two are compared, and in the order they appear: an earlier test's
  // album may still be on the page, and that says nothing about this one.
  const titles = (await albums.allTextContents()).filter(
    (title) => title === "Annual general meeting 2026" || title === "Easter meeting",
  );
  expect(titles).toEqual(["Annual general meeting 2026", "Easter meeting"]);
});

test("bytes that are not a picture are refused whatever the file is called", async ({ page }) => {
  await signInAsAdmin(page);
  await addPicture(page, {
    album: "Annual general meeting 2026",
    caption: "A file pretending to be a picture",
    alt: "Nothing, because nothing was uploaded",
    file: {
      name: "evidence.png",
      mimeType: "image/png",
      buffer: Buffer.from("This is a text file with a picture's name, and nothing else."),
    },
  });
  await expectRefused(page, /not a (real )?(JPEG|PNG|WebP|picture)/i);

  await page.goto("/gallery");
  await expect(page.getByText("A file pretending to be a picture")).toHaveCount(0);
});

test("a body over eight megabytes is refused before anything leaves the server", async ({
  page,
}) => {
  await signInAsAdmin(page);
  await addPicture(page, {
    album: "Annual general meeting 2026",
    caption: "A scan far larger than the branch needs",
    alt: "Nothing, because nothing was uploaded",
    file: {
      name: "scan.png",
      mimeType: "image/png",
      buffer: Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]),
    },
  });
  await expectRefused(page, /8 ?MB/i);
});

test("when the branch has not connected its photo store the screen says so", async ({ page }) => {
  await signInAsAdmin(page);
  await addPicture(page, {
    album: "Annual general meeting 2026",
    caption: "The dais before the meeting",
    alt: "A table with a cloth on it and two microphones",
    file: { name: "dais.png", mimeType: "image/png", buffer: PNG },
  });
  await expectRefused(page, /photo store|image store|not configured/i);

  // The words typed for a picture that could not travel are not thrown away with it.
  await expect(page.getByLabel(/caption/i)).toHaveValue("The dais before the meeting");
});

test("a published picture reaches the front-page strip too", async ({ page }) => {
  await signInAsAdmin(page);
  await addPicture(page, {
    album: "Youth camp",
    caption: "The evening session on the lawn",
    alt: "People sitting in a semicircle on the grass at dusk",
  });
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/");
  await expect(
    page
      .locator('img[alt="People sitting in a semicircle on the grass at dusk"]')
      .first(),
  ).toBeVisible();
  await expect(page.getByText("The evening session on the lawn")).toBeVisible();
});

test("an office-bearer who removes a picture takes it off the public page", async ({ page }) => {
  await signInAsAdmin(page);
  await addPicture(page, {
    album: "Water scheme",
    caption: "The stand-pipe on the upper line",
    alt: "A pipe rising out of a concrete base beside a hill path",
  });
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/gallery");
  await expect(page.getByText("The stand-pipe on the upper line")).toBeVisible();

  // Still the same signed-in session: /login sends an office-bearer straight to
  // the dashboard, so there is nothing to sign in to again here.
  await page.goto("/admin/gallery");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /remove the stand-pipe/i }).click();
  await expect(page.getByText("Removed.")).toBeVisible();

  await page.goto("/gallery");
  await expect(page.getByText("The stand-pipe on the upper line")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Water scheme" })).toHaveCount(0);
});
