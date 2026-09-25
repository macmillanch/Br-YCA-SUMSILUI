import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoticeDoc } from "@/lib/types";

/**
 * The paging reads are tested against a stand-in for the driver, because what
 * matters here is the question asked of the database — which notices, in which
 * order, from which offset, how many — and a live cluster would answer those
 * correctly while the code still asked for the wrong page.
 */

type Store = { docs: NoticeDoc[]; fail: boolean };
const store = vi.hoisted((): Store => ({ docs: [], fail: false }));

type Call = {
  filter: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
};
const calls = vi.hoisted((): Call[] => []);

function matches(filter: Record<string, unknown>): NoticeDoc[] {
  return store.docs.filter((doc) =>
    Object.entries(filter).every(([key, want]) => (doc as Record<string, unknown>)[key] === want),
  );
}

vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  collection: async () => {
    if (store.fail) throw new Error("MongoServerSelectionError: connection refused");
    return {
      countDocuments: (filter: Record<string, unknown>) => matches(filter).length,
      find: (filter: Record<string, unknown>) => {
        const call: Call = { filter: { ...filter } };
        calls.push(call);
        let rows = matches(filter);
        const cursor = {
          sort(spec: Record<string, 1 | -1>) {
            call.sort = spec;
            const key = Object.keys(spec)[0] as keyof NoticeDoc;
            const direction = spec[key as unknown as string] ?? 1;
            rows = [...rows].sort(
              (a, b) => ((a[key] as Date).getTime() - (b[key] as Date).getTime()) * direction,
            );
            return cursor;
          },
          skip(count: number) {
            call.skip = count;
            rows = rows.slice(count);
            return cursor;
          },
          limit(count: number) {
            call.limit = count;
            rows = rows.slice(0, count);
            return cursor;
          },
          toArray: async () => rows,
        };
        return cursor;
      },
    };
  },
}));

const { countPublishedNotices, listPublishedNoticesWithin } = await import("@/lib/notices");
const { getNoticesPage } = await import("@/lib/content");

function day(iso: string): Date {
  return new Date(`${iso}T06:00:00Z`);
}

function notice(overrides: Partial<NoticeDoc> & { slug: string; publishedAt: Date | null }): NoticeDoc {
  return {
    _id: new ObjectId(),
    kind: "notice",
    status: "published",
    titleEn: `Notice about ${overrides.slug.replace(/-/g, " ")}`,
    bodyEn: "The branch office has something to say about this.",
    attachments: [],
    authorId: null,
    createdAt: day("2026-09-01"),
    updatedAt: day("2026-09-01"),
    ...overrides,
  };
}

/**
 * Seven published notices and one draft. Read newest first, the board is:
 * newest, statement-a, second, statement-b, third, fourth, oldest.
 */
function seed(): void {
  store.docs = [
    notice({ slug: "newest", publishedAt: day("2026-09-20") }),
    notice({ slug: "second", publishedAt: day("2026-09-16") }),
    notice({ slug: "third", publishedAt: day("2026-09-12") }),
    notice({ slug: "fourth", publishedAt: day("2026-09-08") }),
    notice({ slug: "oldest", publishedAt: day("2026-09-04") }),
    notice({ slug: "statement-a", kind: "press_release", publishedAt: day("2026-09-18") }),
    notice({ slug: "statement-b", kind: "press_release", publishedAt: day("2026-09-14") }),
    notice({ slug: "unpublished", status: "draft", publishedAt: null }),
  ];
}

beforeEach(() => {
  calls.length = 0;
  store.fail = false;
  seed();
});

describe("listPublishedNoticesWithin", () => {
  it("reads the whole board newest first", async () => {
    const rows = await listPublishedNoticesWithin(undefined, 0, 3);

    expect(rows.map((row) => row.slug)).toEqual(["newest", "statement-a", "second"]);
    expect(calls[0]).toEqual({
      filter: { status: "published" },
      sort: { publishedAt: -1 },
      skip: 0,
      limit: 3,
    });
  });

  it("starts the page where the caller says, so the offset is the database's work", async () => {
    const rows = await listPublishedNoticesWithin(undefined, 3, 3);

    expect(rows.map((row) => row.slug)).toEqual(["statement-b", "third", "fourth"]);
    expect(calls[0]?.skip).toBe(3);
  });

  it("narrows to one kind without losing the order or the page", async () => {
    const rows = await listPublishedNoticesWithin("press_release", 1, 5);

    expect(rows.map((row) => row.slug)).toEqual(["statement-b"]);
    expect(calls[0]?.filter).toEqual({ status: "published", kind: "press_release" });
  });

  it("never hands a draft to a reader, however far back it looks", async () => {
    const rows = await listPublishedNoticesWithin(undefined, 7, 20);

    expect(rows).toHaveLength(0);
    expect(rows.map((row) => row.slug)).not.toContain("unpublished");
  });
});

describe("countPublishedNotices", () => {
  it("counts the same filter the list reads", async () => {
    expect(await countPublishedNotices()).toBe(7);
    expect(await countPublishedNotices("press_release")).toBe(2);
    expect(await countPublishedNotices("announcement")).toBe(0);
  });
});

describe("getNoticesPage", () => {
  it("says which page of how many the reader is on", async () => {
    const read = await getNoticesPage(undefined, 2, 3);

    expect(read.state).toBe("ready");
    if (read.state !== "ready") return;
    expect(read.items.map((row) => row.slug)).toEqual(["statement-b", "third", "fourth"]);
    expect(read.info).toMatchObject({
      page: 2,
      size: 3,
      total: 7,
      lastPage: 3,
      from: 4,
      to: 6,
      prevPage: 1,
      nextPage: 3,
    });
  });

  it("pulls a stale bookmark back to the last page that still exists", async () => {
    const read = await getNoticesPage(undefined, 99, 3);

    expect(read.state).toBe("ready");
    if (read.state !== "ready") return;
    expect(read.info.page).toBe(3);
    expect(read.items.map((row) => row.slug)).toEqual(["oldest"]);
    expect(calls.at(-1)?.skip).toBe(6);
  });

  it("calls a board with nothing published empty, not unavailable", async () => {
    store.docs = [];
    expect(await getNoticesPage(undefined, 1, 20)).toEqual({ state: "empty" });
    expect(await getNoticesPage(undefined, 4, 20)).toEqual({ state: "empty" });
  });

  it("reports an outage instead of an empty board", async () => {
    store.fail = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await getNoticesPage(undefined, 1, 20)).toEqual({ state: "unavailable" });
    expect(errors).toHaveBeenCalledOnce();

    errors.mockRestore();
  });
});
