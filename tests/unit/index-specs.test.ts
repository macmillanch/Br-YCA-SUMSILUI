import { describe, expect, it } from "vitest";
import { COLLECTIONS, INDEX_SPECS } from "@/lib/index-specs";

const names = Object.values(COLLECTIONS);

describe("index specs", () => {
  it("covers every collection the app writes to", () => {
    expect(Object.keys(INDEX_SPECS).sort()).toEqual([...names].sort());
  });

  it("uniquely constrains email and session token", () => {
    expect(INDEX_SPECS.users).toContainEqual({ key: { email: 1 }, unique: true });
    expect(INDEX_SPECS.sessions).toContainEqual({ key: { tokenHash: 1 }, unique: true });
  });

  it("indexes every foreign key used in a lookup", () => {
    expect(INDEX_SPECS.sessions).toContainEqual({ key: { userId: 1 } });
    expect(INDEX_SPECS.transactions).toContainEqual({ key: { yearId: 1, date: -1 } });
    expect(INDEX_SPECS.projectUpdates).toContainEqual({ key: { projectId: 1, date: -1 } });
  });

  it("indexes the fields public listings sort on", () => {
    expect(INDEX_SPECS.notices).toContainEqual({ key: { status: 1, publishedAt: -1 } });
    expect(INDEX_SPECS.members).toContainEqual({
      key: { memberType: 1, current: 1, order: 1 },
    });
  });

  it("gives slugs a unique index, because a URL must resolve to one page", () => {
    expect(INDEX_SPECS.notices).toContainEqual({ key: { slug: 1 }, unique: true });
    expect(INDEX_SPECS.projects).toContainEqual({ key: { slug: 1 }, unique: true });
    expect(INDEX_SPECS.financialYears).toContainEqual({ key: { label: 1 }, unique: true });
  });

  it("keeps one voucher to one donation", () => {
    expect(INDEX_SPECS.donations).toContainEqual({
      key: { transactionId: 1 },
      unique: true,
    });
  });

  it("lets the database sweep expired sessions and lockouts on its own", () => {
    expect(INDEX_SPECS.sessions).toContainEqual({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
    expect(INDEX_SPECS.loginAttempts).toContainEqual({
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    });
  });

  it("never declares a non-unique index on a field that must be unique", () => {
    for (const [collection, specs] of Object.entries(INDEX_SPECS)) {
      const plain = specs.filter((spec) => !spec.unique).map((spec) => JSON.stringify(spec.key));
      for (const spec of specs.filter((entry) => entry.unique)) {
        expect(plain, `${collection} duplicates a unique key as non-unique`).not.toContain(
          JSON.stringify(spec.key),
        );
      }
    }
  });
});
