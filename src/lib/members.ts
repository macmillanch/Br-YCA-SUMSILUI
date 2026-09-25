import { ObjectId, type Filter } from "mongodb";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import { nameClauses, type NameSearch } from "@/lib/member-search";
import type { DirectoryRow, PublicMember } from "@/lib/content";
import type { MemberDoc, MemberType, Role } from "@/lib/types";
import type { MemberInput } from "@/lib/validation/members";

/**
 * The committee list and the community register live in one collection because
 * they are one thing — people the branch has records for — and differ only in
 * what the site is allowed to show. Which fields reach a browser is decided
 * here, in `toPublicMember`, and not in the page: a page edited next month
 * cannot accidentally publish a number someone typed for the office.
 */

export type MemberFilter = { memberType?: MemberType; current?: boolean; search?: NameSearch };

/**
 * The filter as MongoDB reads it.
 *
 * A name search is several requirements on one field, and a document cannot
 * carry two `name` keys, so the words go in as `$and` clauses. The body and
 * status filters stay outside, where the register's index can still do the work.
 */
function memberQuery(filter: MemberFilter): Filter<MemberDoc> {
  const query: Filter<MemberDoc> = {};
  if (filter.memberType) query.memberType = filter.memberType;
  if (filter.current !== undefined) query.current = filter.current;

  const clauses = filter.search ? nameClauses(filter.search) : [];
  return clauses.length > 0 ? { $and: [query, ...clauses] } : query;
}

/**
 * The role matrix lets an editor and a treasurer keep the member list — both
 * are named in the branch's own order, and neither is holding anything from the
 * other. A community member has no account at all. The admin pages and the API
 * check this one list: a page that admitted someone the API then refused would
 * be a broken promise, and the other way round would be a hole.
 */
export const MANAGE_MEMBERS: readonly Role[] = ["editor", "treasurer"];

/** The driver stores an explicit `undefined` as `null`, so absent keys are dropped. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function blankToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

export function buildMemberDoc(input: MemberInput, existing?: MemberDoc): MemberDoc {
  const now = new Date();
  return compact<MemberDoc>({
    _id: existing?._id ?? new ObjectId(),
    name: input.name,
    memberType: input.memberType,
    position: blankToUndefined(input.position),
    fatherName: blankToUndefined(input.fatherName),
    term: blankToUndefined(input.term),
    photoUrl: blankToUndefined(input.photoUrl),
    phone: blankToUndefined(input.phone),
    email: blankToUndefined(input.email),
    address: blankToUndefined(input.address),
    ward: blankToUndefined(input.ward),
    order: input.order,
    current: input.current,
    showContactPublicly: input.showContactPublicly,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function insertMember(doc: MemberDoc): Promise<void> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  await members.insertOne(doc);
}

export async function replaceMember(doc: MemberDoc): Promise<boolean> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  return (await members.replaceOne({ _id: doc._id }, doc)).matchedCount > 0;
}

export async function getMember(id: ObjectId): Promise<MemberDoc | null> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  return members.findOne({ _id: id });
}

/** The branch's own order first, then the alphabet for whoever has no number. */
const REGISTER_ORDER = { order: 1, name: 1 } as const;

export async function listMembers(filter: MemberFilter = {}): Promise<MemberDoc[]> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  return members.find(memberQuery(filter)).sort(REGISTER_ORDER).limit(500).toArray();
}

/**
 * How many members a filter holds, so a page of twenty can say what "of 312"
 * means and a search can tell "nobody by that name" from "no register yet".
 */
export async function countMembers(filter: MemberFilter = {}): Promise<number> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  return members.countDocuments(memberQuery(filter));
}

/**
 * One page of the register, in the branch's own order. The offset is asked of
 * the database rather than taken out of every name the branch holds, so a
 * directory of a thousand members costs the same twenty rows as one of thirty.
 */
export async function listMembersWithin(
  filter: MemberFilter,
  skip: number,
  limit: number,
): Promise<MemberDoc[]> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  return members.find(memberQuery(filter)).sort(REGISTER_ORDER).skip(skip).limit(limit).toArray();
}

export async function deleteMember(id: ObjectId): Promise<boolean> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  return (await members.deleteOne({ _id: id })).deletedCount > 0;
}

/**
 * Whether this person is already on the list for this term. The committee
 * importer asks it row by row so a repeated run cannot record the same office-
 * bearer twice — and it asks the database rather than a page of results, so it
 * stays true however long the register grows.
 */
export async function memberExists(name: string, term: string): Promise<boolean> {
  const members = await collection<MemberDoc>(COLLECTIONS.members);
  // A blank term is stored as an absent key, so "no term" has to be asked for as one.
  const query: Filter<MemberDoc> = term === "" ? { name, term: { $exists: false } } : { name, term };
  return (await members.countDocuments(query)) > 0;
}

/** What the admin table shows — everything, including the office-only contact. */
export type AdminMember = {
  id: string;
  name: string;
  memberType: MemberType;
  position: string | null;
  term: string | null;
  order: number;
  current: boolean;
  showContactPublicly: boolean;
  phone: string | null;
  hasPhoto: boolean;
};

export function toAdminMember(doc: MemberDoc): AdminMember {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    memberType: doc.memberType,
    position: doc.position ?? null,
    term: doc.term ?? null,
    order: doc.order,
    current: doc.current,
    showContactPublicly: doc.showContactPublicly,
    phone: doc.phone ?? null,
    hasPhoto: Boolean(doc.photoUrl),
  };
}

/** The saved document back into the form's own shape, blank where unset. */
export function toFormValues(doc: MemberDoc): MemberInput {
  return {
    name: doc.name,
    memberType: doc.memberType,
    position: doc.position ?? "",
    fatherName: doc.fatherName ?? "",
    term: doc.term ?? "",
    order: doc.order,
    current: doc.current,
    showContactPublicly: doc.showContactPublicly,
    phone: doc.phone ?? "",
    email: doc.email ?? "",
    address: doc.address ?? "",
    ward: doc.ward ?? "",
    photoUrl: doc.photoUrl ?? "",
  };
}

/**
 * The committee card. `showContactPublicly` off means the phone and email are
 * not merely hidden by the page — they are not in the payload at all.
 */
export function toPublicMember(doc: MemberDoc): PublicMember {
  const shared = doc.showContactPublicly;
  return {
    name: doc.name,
    position: doc.position ?? null,
    term: doc.term ?? null,
    photoUrl: doc.photoUrl ?? null,
    phone: shared ? (doc.phone ?? null) : null,
    email: shared ? (doc.email ?? null) : null,
  };
}

/** The register row: a name, a ward, and any office held. Nothing else. */
export function toDirectoryRow(doc: MemberDoc): DirectoryRow {
  return {
    name: doc.name,
    ward: doc.ward ?? null,
    position: doc.position ?? null,
  };
}

/**
 * A card without a photograph still needs a face. Two initials, taken from the
 * first and last words that begin with a letter, so "F. Ashok Chakma" reads as
 * "AC" and a parenthesised epithet does not intrude.
 */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((word) => !word.startsWith("("))
    .map((word) => word.replace(/[^\p{L}]/gu, ""))
    .filter((word) => word.length > 1);
  const first = words[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1] ?? "") : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
