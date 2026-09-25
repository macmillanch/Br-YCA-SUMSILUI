import { expect, test, type Page } from "@playwright/test";

const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

/** So a search run here cannot be answered by anybody else's rows. */
const RUN = Date.now().toString(36);

const RESIDENTS = 25;
const NEIGHBOURS = 3;
const PER_PAGE = 20;

/** Stable so a run killed halfway through can be swept away by the next one. */
const MARK = "Sweep";
const PHONE = "9900011122";
const FATHER = `Hidden Father ${RUN}`;

const residentNames = Array.from(
  { length: RESIDENTS },
  (_, i) => `${MARK} Resident ${i + 1} ${RUN}`,
);
const neighbourNames = Array.from(
  { length: NEIGHBOURS },
  (_, i) => `${MARK} Neighbour ${i + 1} ${RUN}`,
);
/** The register holds both, and a full stop has to stay a full stop. */
const DOT = `${MARK} F. Chakma ${RUN}`;
const NO_DOT = `${MARK} FA Chakma ${RUN}`;

const residents = `${MARK} Resident ${RUN}`;
const everyone = `${MARK} ${RUN}`;

/**
 * Everything a search for this run's mark turns up: the register is 25 residents,
 * 3 neighbours and the two Chakma names, and the one office-bearer added below is
 * deliberately in a body the public register does not publish.
 */
const PUBLISHED = RESIDENTS + NEIGHBOURS + 2;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EDITOR.email);
  await page.getByLabel(/password/i).fill(EDITOR.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

function memberData(name: string, over: Record<string, unknown> = {}) {
  return {
    name,
    memberType: "community_member",
    position: "",
    fatherName: FATHER,
    term: "",
    order: 0,
    current: true,
    showContactPublicly: false,
    phone: PHONE,
    email: "",
    address: "",
    ward: "Ward 3",
    photoUrl: "",
    ...over,
  };
}

async function addMember(page: Page, name: string, over: Record<string, unknown> = {}) {
  const response = await page.request.post("/api/members", { data: memberData(name, over) });
  expect(response.status()).toBe(200);
  return (await response.json()).data?.member?.id as string;
}

async function search(page: Page, term: string, query = "") {
  await page.goto(`/members?q=${encodeURIComponent(term)}${query}`);
}

/** The names on this page of the register, in the order it printed them. */
async function listedNames(page: Page): Promise<string[]> {
  return page.locator("main ul li").filter({ hasText: RUN }).locator("span:first-child").allInnerTexts();
}

async function remove(page: Page, ids: string[]) {
  for (const id of ids) {
    expect((await page.request.delete(`/api/members/${id}`)).status()).toBe(200);
  }
}

/**
 * A member looking for a neighbour in the register types the name the way they
 * say it, and the register is too long to read in one screen. Both are the same
 * rows read from the database, so what is proved here is that the screen asks for
 * them the way the reader asked — and that a search of the register still shows
 * only what the register is allowed to publish.
 */
test("the register can be searched by name and turned over a page at a time", async ({ page }) => {
  await signIn(page);

  // Anything an earlier killed run left behind would be found by these searches.
  const register = await page.request.get("/api/members");
  expect(register.status()).toBe(200);
  const strays = ((await register.json()).data?.members ?? []) as { id: string; name: string }[];
  await remove(
    page,
    strays.filter((row) => row.name.startsWith(`${MARK} `)).map((row) => row.id),
  );

  const ids: string[] = [];
  try {
    for (const name of residentNames) ids.push(await addMember(page, name));
    for (const name of neighbourNames) ids.push(await addMember(page, name));
    ids.push(await addMember(page, DOT));
    ids.push(await addMember(page, NO_DOT));
    // A matching name in a body the register does not publish stays unpublished.
    ids.push(
      await addMember(page, `${MARK} Resident Official ${RUN}`, { memberType: "office_bearer" }),
    );

    const nav = page.getByRole("navigation", { name: "Member directory pages" });
    const total = PUBLISHED;
    const lastPage = Math.ceil(total / PER_PAGE);

    /* ---------------------------------------------------------- searching */

    await search(page, everyone);
    await expect(nav).toContainText(`Page 1 of ${lastPage}`);
    await expect(nav).toContainText(`showing 1–${PER_PAGE} of ${total}`);
    await expect(page.getByText(`${total} members match`)).toBeVisible();
    await expect(page.getByText(`${total} members are listed`)).toHaveCount(0);

    // Every word typed, in any order: the branch files a name one way and a
    // neighbour says it another.
    await search(page, residents);
    const forward = await listedNames(page);
    expect(forward).toHaveLength(PER_PAGE);
    await search(page, `Resident ${RUN} ${MARK}`);
    expect(await listedNames(page)).toEqual(forward);

    // Three words narrow to the one person they can only mean.
    await search(page, `${RUN} 13`);
    expect(await listedNames(page)).toEqual([`${MARK} Resident 13 ${RUN}`]);

    // A full stop is a full stop, not "any character": the second of these two
    // names would be caught by a dot that reached the database as a pattern.
    await search(page, `${MARK} F. ${RUN}`);
    expect(await listedNames(page)).toEqual([DOT]);

    // What a search finds is still only the register, and only its public half.
    await search(page, `${MARK} Resident Official ${RUN}`);
    await expect(page.getByText("No member in the register matches that name")).toBeVisible();
    // One way back to the whole register (the form), and one to the body the
    // register does not publish — the reader's name may simply be in the other list.
    await expect(page.getByRole("link", { name: "Show the whole register" })).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "See the office-bearers instead" }),
    ).toHaveAttribute("href", "/executive-members");

    await search(page, residents);
    const printed = await page.locator("main").innerText();
    expect(printed).not.toContain(PHONE);
    expect(printed).not.toContain(FATHER);
    expect(printed).toContain("Ward 3");

    /* ------------------------------------------------------------ paging */

    const next = nav.getByRole("link", { name: "Next page" });
    const nextHref = (await next.getAttribute("href")) ?? "";
    expect(nextHref).toContain("q=");
    expect(nextHref).toContain("page=2");

    await next.click();
    await expect(nav).toContainText(`Page 2 of ${lastPage}`);
    const second = await listedNames(page);
    expect(second).toHaveLength(RESIDENTS - PER_PAGE);
    // The pages tile the search: nobody on two pages, and nobody left out.
    expect(new Set([...forward, ...second]).size).toBe(RESIDENTS);

    const back = nav.getByRole("link", { name: "Previous page" });
    const backHref = (await back.getAttribute("href")) ?? "";
    expect(backHref).toContain("q=");
    expect(backHref).not.toContain("page=");

    // A bookmark from a longer list is not a claim that the register is empty.
    await search(page, residents, "&page=99999");
    await expect(nav).toContainText("Page 2 of 2");
    expect(await listedNames(page)).toHaveLength(RESIDENTS - PER_PAGE);

    // And a page number that cannot be one is dropped rather than obeyed.
    await search(page, residents, "&page=later");
    await expect(nav).toContainText("Page 1 of 2");

    /* -------------------------------------------------------- the long way */

    // The box is a plain GET form, so a search needs no script to make, and what
    // was typed stays in the box when the answer comes back.
    await page.goto("/members");
    await page.getByLabel(/search by name/i).fill(`${MARK} Neighbour ${RUN}`);
    await page.getByRole("button", { name: /^search$/i }).click();
    await expect(page).toHaveURL(/\/members\?q=/);
    await expect(page.getByLabel(/search by name/i)).toHaveValue(`${MARK} Neighbour ${RUN}`);
    expect(await listedNames(page)).toHaveLength(NEIGHBOURS);
  } finally {
    await remove(page, ids);
  }
});
