import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberDoc } from "@/lib/types";
import type { StubCall, StubStore } from "./stub-store";

/**
 * Who the register holds, in which order, and how many — the three questions a
 * paged, searchable directory asks the database. Tested against a stand-in for
 * the driver because a live cluster would happily answer a question that leaves
 * a phone number out of the projection, or asks for the wrong twenty names.
 */

const store = vi.hoisted((): StubStore => ({ docs: [], fail: false }));
const calls = vi.hoisted((): StubCall[] => []);

vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  ...(await import("./stub-store")).stubDatabase(store, calls),
}));

const { countMembers, listMembersWithin } = await import("@/lib/members");
const { parseNameSearch } = await import("@/lib/member-search");
const { getMemberDirectoryPage } = await import("@/lib/content");

function member(name: string, overrides: Partial<MemberDoc> = {}): MemberDoc {
  return {
    _id: new ObjectId(),
    name,
    memberType: "community_member",
    order: 0,
    current: true,
    showContactPublicly: false,
    phone: "9000000000",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

/** The register the branch would recognise: two bodies, one order of its own. */
function seed(): void {
  store.docs = [
    member("Zothanliani R", { order: 3 }),
    member("Ashok Kumar Chakma", { order: 1, ward: "Ward 2" }),
    member("F. Ashok Chakma", { order: 2, ward: "Ward 1", position: "Committee Member" }),
    member("Bhuma Chakma", { order: 4 }),
    member("FA Chakma", { order: 5 }),
    member("President Person", { memberType: "office_bearer", order: 0 }),
  ];
}

const community = { memberType: "community_member" } as const;

function searching(q: string) {
  return { ...community, search: parseNameSearch({ q }) };
}

beforeEach(() => {
  calls.length = 0;
  store.fail = false;
  seed();
});

describe("listMembersWithin", () => {
  it("reads the register in the branch's own order, one body at a time", async () => {
    const rows = await listMembersWithin(community, 0, 10);

    expect(rows.map((doc) => doc.name)).toEqual([
      "Ashok Kumar Chakma",
      "F. Ashok Chakma",
      "Zothanliani R",
      "Bhuma Chakma",
      "FA Chakma",
    ]);
    expect(calls[0]).toMatchObject({ sort: { order: 1, name: 1 }, skip: 0, limit: 10 });
  });

  it("starts the page where the caller says", async () => {
    const rows = await listMembersWithin(community, 2, 2);

    expect(rows.map((doc) => doc.name)).toEqual(["Zothanliani R", "Bhuma Chakma"]);
  });

  it("breaks a tie in the branch's order with the alphabet", async () => {
    store.docs = [member("Tlangpuii"), member("Chakma, Ashok"), member("Bhuma")];
    const rows = await listMembersWithin({}, 0, 3);

    expect(rows.map((doc) => doc.name)).toEqual(["Bhuma", "Chakma, Ashok", "Tlangpuii"]);
  });
});

describe("countMembers", () => {
  it("counts the same filter the list reads", async () => {
    expect(await countMembers(community)).toBe(5);
    expect(await countMembers({})).toBe(6);
    expect(await countMembers(searching("chakma"))).toBe(4);
  });
});

describe("a name search", () => {
  it("wants every word typed, in any order", async () => {
    const rows = await listMembersWithin(searching("chakma ashok"), 0, 10);

    expect(rows.map((doc) => doc.name)).toEqual(["Ashok Kumar Chakma", "F. Ashok Chakma"]);
  });

  it("does not care which letters were capitalised", async () => {
    expect(await countMembers(searching("CHAKMA bHUMA"))).toBe(1);
  });

  it("takes a full stop for a full stop, not for any character", async () => {
    // "F." would match "FA Chakma" if the dot reached the database as a pattern.
    const rows = await listMembersWithin(searching("F."), 0, 10);

    expect(rows.map((doc) => doc.name)).toEqual(["F. Ashok Chakma"]);
  });

  it("asks for the whole register when nothing searchable was typed", async () => {
    expect(await countMembers(searching("  .* ? ,  "))).toBe(5);
  });

  it("finds nobody without complaining about it", async () => {
    expect(await listMembersWithin(searching("Chakma"), 0, 10)).toHaveLength(4);
    expect(await listMembersWithin(searching("nothing like a name here"), 0, 10)).toEqual([]);
  });
});

describe("getMemberDirectoryPage", () => {
  beforeEach(() => {
    store.docs = Array.from({ length: 25 }, (_, i) =>
      member(`Resident Number ${i + 1}`, { order: i + 1, ward: `Ward ${(i % 4) + 1}` }),
    );
  });

  it("prints one page of the register and says which one", async () => {
    const read = await getMemberDirectoryPage(parseNameSearch({}), 2, 10);

    expect(read.state).toBe("ready");
    if (read.state !== "ready") return;
    expect(read.items.map((row) => row.name)).toEqual([
      "Resident Number 11",
      "Resident Number 12",
      "Resident Number 13",
      "Resident Number 14",
      "Resident Number 15",
      "Resident Number 16",
      "Resident Number 17",
      "Resident Number 18",
      "Resident Number 19",
      "Resident Number 20",
    ]);
    expect(read.info).toMatchObject({ page: 2, total: 25, lastPage: 3, from: 11, to: 20 });
  });

  it("publishes a name, a ward and an office, and nothing else", async () => {
    const read = await getMemberDirectoryPage(parseNameSearch({ q: "Resident" }), 1, 3);

    expect(read.state).toBe("ready");
    if (read.state !== "ready") return;
    expect(read.items[0]).toEqual({
      name: "Resident Number 1",
      ward: "Ward 1",
      position: null,
    });
  });

  it("counts only what the search leaves", async () => {
    const read = await getMemberDirectoryPage(searching("Number 2").search, 1, 10);

    expect(read.state).toBe("ready");
    if (read.state !== "ready") return;
    expect(read.info.total).toBe(8); // 2, 12 and 20 through 25 all carry a "2"
  });

  it("says a search found nothing rather than that the register is empty", async () => {
    const read = await getMemberDirectoryPage(parseNameSearch({ q: "Nobody Here" }), 1, 20);

    expect(read).toEqual({ state: "empty" });
  });

  it("says an unreadable register is unavailable, not empty", async () => {
    store.fail = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await getMemberDirectoryPage(parseNameSearch({}), 1, 20)).toEqual({
      state: "unavailable",
    });
    expect(errors).toHaveBeenCalledOnce();

    errors.mockRestore();
  });
});
