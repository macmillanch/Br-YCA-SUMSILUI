import { expect, test, type Page } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };
const TREASURER = { email: "treasurer@test.yca.local", password: "branch-test-password" };

/** Two runs on the same day must not collide with each other's rows. */
const RUN = Date.now().toString(36);
const PHONE_STEM = Date.now().toString().slice(-8);

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

type Member = {
  name: string;
  listedIn?: "office_bearer" | "executive_member" | "advisory_board" | "community_member";
  position?: string;
  fatherName?: string;
  term?: string;
  order?: number;
  ward?: string;
  phone?: string;
  contactPublic?: boolean;
};

/** Fills the record form and saves it, returning the address of the saved row. */
async function addMember(page: Page, member: Member): Promise<string> {
  await page.goto("/admin/members/new");
  await page.getByLabel(/full name/i).fill(member.name);
  if (member.listedIn) {
    await page.getByLabel(/listed in/i).selectOption(member.listedIn);
  }
  if (member.position !== undefined) {
    await page.getByLabel(/position held/i).fill(member.position);
  }
  if (member.fatherName !== undefined) {
    await page.getByLabel(/father's name/i).fill(member.fatherName);
  }
  if (member.term !== undefined) await page.getByLabel(/term of office/i).fill(member.term);
  if (member.order !== undefined) {
    await page.getByLabel(/order in the list/i).fill(String(member.order));
  }
  if (member.ward !== undefined) await page.getByLabel(/ward or locality/i).fill(member.ward);
  if (member.phone !== undefined) await page.getByLabel(/^phone$/i).fill(member.phone);
  if (member.contactPublic) {
    await page.getByLabel(/show contact publicly/i).check();
  }

  await page.getByRole("button", { name: /add to the list/i }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.waitForURL(/\/admin\/members\/[0-9a-f]{24}$/);
  return new URL(page.url()).pathname;
}

function cardOf(page: Page, name: string) {
  return page.locator("li", { has: page.getByRole("heading", { name, exact: true }) });
}

test("an editor records an office-bearer, and the card shows the office but not the phone", async ({
  page,
}) => {
  const name = `Officer One ${RUN}`;
  const phone = `9${PHONE_STEM}`;

  await signIn(page, EDITOR);
  const editUrl = await addMember(page, {
    name,
    position: "President",
    fatherName: `Test Father ${RUN}`,
    term: "2026-2028",
    order: 1,
    phone,
  });

  // The list says what a visitor will see, not what is stored.
  await page.goto("/admin/members");
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row.getByText("Hidden")).toBeVisible();
  expect(editUrl).toMatch(/\/admin\/members\/[0-9a-f]{24}$/);

  await page.goto("/executive-members");
  const card = cardOf(page, name);
  await expect(card).toBeVisible();
  await expect(card).toContainText("President");
  await expect(card).toContainText("2026-2028");
  // A monogram, not an invented portrait: no photo was supplied.
  await expect(card.locator("img")).toHaveCount(0);
  // The number is the branch's own record until that person agrees otherwise.
  await expect(card).not.toContainText(phone);
  await expect(page.locator("main")).not.toContainText(`Test Father ${RUN}`);
});

test("showing one person's contact publicly does not touch anyone else's", async ({ page }) => {
  const shared = `Officer Two ${RUN}`;
  const other = `Officer Three ${RUN}`;
  const phone = `9${PHONE_STEM}1`;

  await signIn(page, EDITOR);
  await addMember(page, { name: other, position: "Treasurer", order: 4, phone: `9${PHONE_STEM}2` });
  const editUrl = await addMember(page, { name: shared, position: "General Secretary", order: 3, phone });

  await page.getByLabel(/show contact publicly/i).check();
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.goto("/executive-members");
  await expect(cardOf(page, shared).getByRole("link", { name: phone })).toHaveAttribute(
    "href",
    `tel:${phone}`,
  );
  await expect(cardOf(page, other).getByRole("link")).toHaveCount(0);

  // The switch belongs to this one person's record alone.
  await page.goto(editUrl);
  await expect(page.getByLabel(/show contact publicly/i)).toBeChecked();
});

test("the three bodies each keep their own section and their own order", async ({ page }) => {
  const senior = `Second Secretary ${RUN}`;
  const junior = `Third Secretary ${RUN}`;
  const adviser = `Adviser ${RUN}`;

  await signIn(page, EDITOR);
  await addMember(page, { name: junior, position: "Office Secretary", order: 12 });
  await addMember(page, { name: senior, position: "Organising Secretary", order: 6 });
  await addMember(page, { name: adviser, listedIn: "advisory_board", order: 31 });

  await page.goto("/executive-members");
  const officeBearers = page.locator("section", {
    has: page.getByRole("heading", { name: "Office-bearers", exact: true }),
  });
  await expect(officeBearers.getByRole("heading", { name: "Office-bearers" })).toBeVisible();

  const names = await officeBearers.locator("h3").allTextContents();
  expect(names.indexOf(senior)).toBeLessThan(names.indexOf(junior));
  expect(names).toContain(senior);
  expect(names).toContain(junior);

  // The advisory board's people hold no named office, so the order's dash is
  // stored as no position at all — the heading carries the body's name instead.
  const advisers = cardOf(page, adviser);
  await expect(advisers).toBeVisible();
  await expect(advisers).not.toContainText("Office Secretary");
});

test("a community member is in the register with a ward, and not on the committee page", async ({
  page,
}) => {
  const name = `Resident ${RUN}`;
  const phone = `9${PHONE_STEM}3`;

  await signIn(page, TREASURER);
  await addMember(page, { name, listedIn: "community_member", ward: "Ward 3", phone });

  await page.goto("/members");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Ward 3");
  await expect(page.locator("main")).not.toContainText(phone);

  await page.goto("/executive-members");
  await expect(page.locator("main")).not.toContainText(name);
});

test("a member removed from the list disappears from the public page", async ({ page }) => {
  const name = `Leaving Officer ${RUN}`;

  await signIn(page, ADMIN);
  await addMember(page, { name, position: "Cultural Secretary", order: 10 });

  await page.goto("/executive-members");
  await expect(cardOf(page, name)).toBeVisible();

  await page.goto("/admin/members");
  await page.on("dialog", (dialog) => dialog.accept());
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /remove/i }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/executive-members");
  await expect(cardOf(page, name)).toHaveCount(0);
});
