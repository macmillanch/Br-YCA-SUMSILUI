/**
 * A stand-in for the MongoDB driver, for tests whose subject is the question a
 * module asks the database — which documents, in which order, from which offset,
 * how many. A live cluster answers any question correctly, including the wrong
 * one, so it cannot show that a page was asked for at the right offset.
 *
 * One store per test file, because each file installs its own mock of `@/lib/db`
 * and points `collection()` at this. `vi.mock` is hoisted above a file's imports,
 * so the store and the call log have to be made by `vi.hoisted()`.
 */

export type StubCall = {
  filter: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
};

export type StubStore = { docs: unknown[]; fail: boolean };

function entries(doc: unknown): Record<string, unknown> {
  return doc as Record<string, unknown>;
}

function regexClause(value: unknown): value is { $regex: string; $options?: string } {
  return typeof value === "object" && value !== null && "$regex" in value;
}

/**
 * Anything the stub has not been written to answer is an error rather than a
 * silent non-match: a test that quietly found nothing because `$exists` was
 * ignored would look exactly like a query that works.
 */
function matches(doc: unknown, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, want]) => {
    if (key === "$and") return (want as Record<string, unknown>[]).every((part) => matches(doc, part));
    if (regexClause(want)) {
      const flags = want.$options?.includes("i") ? "i" : "";
      return new RegExp(want.$regex, flags).test(String(entries(doc)[key] ?? ""));
    }
    if (
      want !== null &&
      typeof want === "object" &&
      !Array.isArray(want) &&
      Object.keys(want).some((field) => field.startsWith("$"))
    ) {
      throw new Error(`the database stub cannot answer ${key}: ${JSON.stringify(want)}`);
    }
    return entries(doc)[key] === want;
  });
}

function compareValues(a: unknown, b: unknown): number {
  // A missing field reads as null, and null sorts before everything else.
  if (a === undefined || a === null) return b === undefined || b === null ? 0 : -1;
  if (b === undefined || b === null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  return 0;
}

function inOrder(spec: Record<string, 1 | -1>, a: unknown, b: unknown): number {
  for (const [key, direction] of Object.entries(spec)) {
    const result = compareValues(entries(a)[key], entries(b)[key]);
    if (result !== 0) return result * direction;
  }
  return 0;
}

function cursor(docs: unknown[], call: StubCall) {
  let rows = docs;
  const self = {
    sort(spec: Record<string, 1 | -1>) {
      call.sort = spec;
      rows = [...rows].sort((a, b) => inOrder(spec, a, b));
      return self;
    },
    skip(count: number) {
      call.skip = count;
      rows = rows.slice(count);
      return self;
    },
    limit(count: number) {
      call.limit = count;
      rows = rows.slice(0, count);
      return self;
    },
    toArray: async () => rows,
  };
  return self;
}

/** What to spread into a `vi.mock("@/lib/db")` factory, beside the real module. */
export function stubDatabase(store: StubStore, calls: StubCall[]) {
  return {
    collection: async () => {
      if (store.fail) throw new Error("MongoServerSelectionError: connection refused");
      const docs = store.docs;
      return {
        countDocuments: (filter: Record<string, unknown>) => docs.filter((d) => matches(d, filter)).length,
        find: (filter: Record<string, unknown>) => {
          const call: StubCall = { filter: { ...filter } };
          calls.push(call);
          return cursor(docs.filter((d) => matches(d, filter)), call);
        },
      };
    },
  };
}
