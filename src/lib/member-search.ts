import { paramText, type PageParams } from "@/lib/pagination";

/**
 * What a reader typed into the register's search box, turned into something the
 * database can be asked for.
 *
 * A member looking for a name types it the way they say it, not the way the
 * branch's clerk filed it: "ashok chakma" for "Chakma, Ashok", with two spaces
 * after a paste and a full stop left in from "F. Ashok". So the search is not a
 * phrase but a set of requirements — every word has to be somewhere in the name,
 * in any order — which is both kinder to the reader and smaller than the whole
 * register.
 */

/** Long enough for a name, short enough to show back to the reader. */
export const SEARCH_MAX_LENGTH = 80;
/** Six requirements is more than a name has parts. */
export const SEARCH_MAX_WORDS = 6;

export type NameSearch = {
  /** What to put back in the box, trimmed and cut to the cap. */
  term: string;
  /** The distinct words that have to be found, as typed. */
  words: string[];
};

/**
 * A word with no letter or number in it is not a requirement — a stray comma
 * from "Chakma, Ashok" would otherwise ask for a name containing a comma and
 * find nothing.
 */
const WORD = /[\p{L}\p{N}]/u;

export function parseNameSearch(params: PageParams, key = "q"): NameSearch {
  const term = paramText(params, key).trim().slice(0, SEARCH_MAX_LENGTH);
  const seen = new Set<string>();
  const words: string[] = [];

  for (const word of term.split(/\s+/)) {
    if (!WORD.test(word)) continue;
    const folded = word.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    words.push(word);
    if (words.length >= SEARCH_MAX_WORDS) break;
  }

  return { term, words };
}

/**
 * One requirement, in the shape MongoDB reads. `$options: "i"` rather than a
 * lowercased pattern because the register holds names in whatever script the
 * branch was given them, and a case-fold outside the database would change them.
 */
export type NameClause = { name: { $regex: string; $options: "i" } };

/** Everything between `.` and `\` is a pattern, and a pattern is code here. */
function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nameClauses(search: NameSearch): NameClause[] {
  return search.words.map((word) => ({
    name: { $regex: escapePattern(word), $options: "i" },
  }));
}
