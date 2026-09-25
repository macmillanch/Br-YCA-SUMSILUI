/**
 * Where a list's page number comes from, and what it means.
 *
 * A list on a screen a member opens on a phone in a ward is not a list of one
 * hundred things — it is the twenty that fit without scrolling past what they
 * came for. Paging that list is two separate questions, kept apart here so each
 * can be answered without a database: what the address was asking for, and which
 * slice of the whole that is.
 */

export type PageParams =
  | { [key: string]: string | string[] | undefined }
  | URLSearchParams;

/**
 * The first value a key carries, as text — `""` when the key is absent.
 *
 * A query string can name the same key twice, and the address a reader was given
 * decides which of the two they meant, so the first is taken and the rest ignored.
 */
export function paramText(params: PageParams, key: string): string {
  const value = params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key];
  const text = Array.isArray(value) ? value[0] : value;
  return text ?? "";
}

/**
 * The page a reader asked for, or 1. A URL is a thing somebody types, pastes
 * from a chat, or follows from a link the branch sent two years ago, so anything
 * that cannot be a page — `?page=next`, `?page=0`, `-3`, `2.5`, an empty value —
 * is dropped rather than obeyed or refused. Blaming a reader for somebody else's
 * broken address would be a poor way to run a public notice board.
 */
export function parsePageParam(params: PageParams, key = "page"): number {
  const text = paramText(params, key).trim();
  if (!/^\d+$/.test(text)) return 1;
  const page = Number(text);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export type PageInfo = {
  /** Where the reader actually is, after the clamp below. */
  page: number;
  size: number;
  total: number;
  lastPage: number;
  /** The 1-based ordinal of the first line on this page; 0 when there is nothing. */
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

/**
 * Which slice of a list of `total` the reader's page number is asking for.
 *
 * A page past the end is taken back to the last real page rather than shown as
 * empty: a bookmark set while the list was longer is a stale address, not a claim
 * that the branch published nothing, and the reader is one click from anywhere
 * else they wanted to be.
 */
export function pageInfo(page: number, size: number, total: number): PageInfo {
  const lastPage = Math.max(1, Math.ceil(total / size));
  const at = Math.min(Math.max(1, page), lastPage);
  const from = total === 0 ? 0 : (at - 1) * size + 1;
  const to = Math.min(at * size, total);
  return {
    page: at,
    size,
    total,
    lastPage,
    from,
    to,
    hasPrev: at > 1,
    hasNext: at < lastPage,
    prevPage: at > 1 ? at - 1 : null,
    nextPage: at < lastPage ? at + 1 : null,
  };
}
