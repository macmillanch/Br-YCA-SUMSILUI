import { describe, expect, it } from "vitest";
import { pageInfo, parsePageParam, type PageInfo } from "@/lib/pagination";

/**
 * The page number is a thing a person types, pastes from a chat, or follows from
 * a link the branch sent two years ago, so the parser must not blame them for
 * any of it. Every value that cannot mean what it says is dropped rather than
 * obeyed, in the same spirit `parseLedgerFilter` already uses.
 */
describe("parsePageParam", () => {
  const cases: [string, string | string[] | undefined, number][] = [
    ["no key at all", undefined, 1],
    ["an empty string", "", 1],
    ["whitespace only", "   ", 1],
    ["a real second page", "2", 2],
    ["a padded number", " 7 ", 7],
    ["not a number at all", "next", 1],
    ["zero, which is not a page", "0", 1],
    ["a negative page", "-3", 1],
    ["a fraction", "2.5", 1],
    ["a number beyond any list", "9999", 9999],
    ["a repeated key takes the first", ["4", "9"], 4],
    ["a repeated key whose first is junk", ["next", "9"], 1],
  ];
  for (const [name, raw, want] of cases) {
    it(`${name}: ${JSON.stringify(raw)} → page ${want}`, () => {
      expect(parsePageParam({ page: raw })).toBe(want);
    });
  }
});

describe("pageInfo", () => {
  it("names the first page of three", () => {
    const info: PageInfo = pageInfo(1, 20, 45);
    expect(info).toMatchObject({
      page: 1,
      size: 20,
      total: 45,
      lastPage: 3,
      from: 1,
      to: 20,
      hasPrev: false,
      hasNext: true,
      prevPage: null,
      nextPage: 2,
    });
  });

  it("names a middle page, with both neighbours", () => {
    expect(pageInfo(2, 20, 45)).toMatchObject({
      from: 21,
      to: 40,
      hasPrev: true,
      hasNext: true,
      prevPage: 1,
      nextPage: 3,
    });
  });

  it("names the last page of three, which holds fewer than a full page", () => {
    expect(pageInfo(3, 20, 45)).toMatchObject({
      from: 41,
      to: 45,
      hasPrev: true,
      hasNext: false,
      prevPage: 2,
      nextPage: null,
    });
  });

  it("clamps a page beyond the end down to the last real page", () => {
    const info = pageInfo(99, 20, 45);
    expect(info).toMatchObject({ page: 3, from: 41, to: 45, hasNext: false, nextPage: null });
  });

  it("says so when there is nothing to page through", () => {
    expect(pageInfo(1, 20, 0)).toMatchObject({
      page: 1,
      lastPage: 1,
      from: 0,
      to: 0,
      hasPrev: false,
      hasNext: false,
    });
  });

  it("treats a beyond-the-end page as page one when there is nothing at all", () => {
    expect(pageInfo(7, 20, 0)).toMatchObject({ page: 1, from: 0, to: 0, lastPage: 1 });
  });

  it("shows the single page on its own with no links in either direction", () => {
    expect(pageInfo(1, 20, 7)).toMatchObject({ lastPage: 1, from: 1, to: 7, prevPage: null, nextPage: null });
  });
});
