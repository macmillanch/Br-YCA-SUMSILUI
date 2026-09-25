import { describe, expect, it } from "vitest";
import { nameClauses, parseNameSearch } from "@/lib/member-search";

/**
 * A reader looking for a name in the register types it the way they say it:
 * "ashok chakma", "Chakma, Ashok", two spaces by accident. Every word they type
 * has to be in the name, and in no particular order, because the branch's own
 * record is not consistent about which part comes first.
 */
describe("parseNameSearch", () => {
  const cases: readonly [string, { q?: string | string[] }, readonly string[]][] = [
    ["no query asks for nothing", {}, []],
    ["an empty query asks for nothing", { q: "" }, []],
    ["spaces alone are not a search term", { q: "   " }, []],
    ["one word is one requirement", { q: "Chakma" }, ["Chakma"]],
    ["the term is trimmed", { q: "  Bhuma  " }, ["Bhuma"]],
    ["extra spaces between words are ignored", { q: "ashok   chakma" }, ["ashok", "chakma"]],
    ["a repeated word is not a second requirement", { q: "chakma Chakma" }, ["chakma"]],
    ["punctuation typed on its own is dropped", { q: "chakma , , ltd" }, ["chakma", "ltd"]],
    ["punctuation joined to a name is kept", { q: "F. Chakma" }, ["F.", "Chakma"]],
    ["the first value wins when a query is repeated", { q: ["Bhuma", "Chakma"] }, ["Bhuma"]],
  ] as const;

  for (const [title, params, words] of cases) {
    it(title, () => {
      expect(parseNameSearch(params).words).toEqual(words);
    });
  }

  it("stops counting words after the sixth, so a pasted paragraph cannot become a query", () => {
    expect(parseNameSearch({ q: "one two three four five six seven eight" }).words).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
    ]);
  });

  it("keeps the term short enough to show back to the reader", () => {
    const search = parseNameSearch({ q: "n".repeat(300) });
    expect(search.term).toHaveLength(80);
    expect(search.words).toEqual(["n".repeat(80)]);
  });
});

/**
 * The words go to MongoDB as a pattern, and a pattern is code as far as the
 * database is concerned: an unescaped `.` or `*` would search for something the
 * reader never typed, and a stray `(` would make the query fail outright.
 */
describe("nameClauses", () => {
  it("asks for every word, case-insensitively and in any order", () => {
    expect(nameClauses(parseNameSearch({ q: "ashok chakma" }))).toEqual([
      { name: { $regex: "ashok", $options: "i" } },
      { name: { $regex: "chakma", $options: "i" } },
    ]);
  });

  it("asks for nothing when nothing searchable was typed", () => {
    expect(nameClauses(parseNameSearch({}))).toEqual([]);
    expect(nameClauses(parseNameSearch({ q: "  .* ? ^ $ | [] ( ) \\" }))).toEqual([]);
  });

  it("treats punctuation as the character it is", () => {
    const clauses = nameClauses(parseNameSearch({ q: "F. Ashok (Bhuma)+ x.*y a|b c+d" }));
    expect(clauses.map((clause) => clause.name.$regex)).toEqual([
      "F\\.",
      "Ashok",
      "\\(Bhuma\\)\\+",
      "x\\.\\*y",
      "a\\|b",
      "c\\+d",
    ]);
  });

  it("hands the database a pattern that compiles, whatever was typed", () => {
    const clauses = nameClauses(parseNameSearch({ q: "( [ { * + ? ^ $ \\ 1. chakma" }));
    expect(clauses.map((clause) => clause.name.$regex)).toEqual([
      "1\\.",
      "chakma",
    ]);
    for (const clause of clauses) {
      expect(() => new RegExp(clause.name.$regex, "i")).not.toThrow();
    }
  });
});
