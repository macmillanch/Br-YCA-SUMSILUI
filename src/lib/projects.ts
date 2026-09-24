import { ObjectId, type Filter } from "mongodb";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import type { PublicProject, PublicProjectUpdate } from "@/lib/content";
import type { ProjectDoc, ProjectStatus, ProjectUpdateDoc, Role } from "@/lib/types";
import {
  PROJECT_SCHEMA,
  effectiveProjectSlug,
  type ProjectInput,
  type ProjectUpdateInput,
} from "@/lib/validation/projects";

/**
 * Works and their progress timeline.
 *
 * Two numbers describe a work and they come from different places. The sanctioned
 * amount is typed here, because it is the branch's own decision. What has been
 * spent is not — it is summed from the ledger in Plan 3 — so nothing in this
 * module carries a spend figure, and a progress bar on a public page is allowed
 * to show only the percentage the branch reported on a dated line. That is what
 * keeps a bar and an account from ever telling two different stories.
 */

export type WriteResult = "written" | "duplicate_slug" | "not_found";

export type ProjectFilter = { status?: ProjectStatus };

/**
 * Both the office-bearers who speak for the branch and the Treasurer who holds
 * the money have a reason to record a work. The admin pages and the API check
 * this one list, so neither can be shown a form the other end refuses.
 */
export const MANAGE_WORKS: readonly Role[] = ["editor", "treasurer"];

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

function describeWriteError(error: unknown): WriteResult {
  return isDuplicateKey(error) ? "duplicate_slug" : "not_found";
}

/** The driver stores an explicit `undefined` as `null`, so absent keys are dropped. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function blankToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

export function buildProjectDoc(input: ProjectInput, existing?: ProjectDoc): ProjectDoc {
  const now = new Date();
  return compact<ProjectDoc>({
    _id: existing?._id ?? new ObjectId(),
    slug: effectiveProjectSlug(input),
    title: input.title,
    description: input.description,
    status: input.status,
    startDate: blankToUndefined(input.startDate),
    targetDate: blankToUndefined(input.targetDate),
    completedDate: blankToUndefined(input.completedDate),
    sanctionedAmountPaise: input.sanctionedAmountPaise,
    beneficiaries: input.beneficiaries,
    location: blankToUndefined(input.location),
    coverImageUrl: blankToUndefined(input.coverImageUrl),
    order: input.order,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/**
 * `percentComplete` is the branch's own claim about the work on that date, and
 * `photos` arrives through the upload screen later — the form cannot accept a
 * file the Cloudinary task has not wired up yet.
 */
export function buildProjectUpdateDoc(
  input: ProjectUpdateInput,
  projectId: ObjectId,
): ProjectUpdateDoc {
  return {
    _id: new ObjectId(),
    projectId,
    date: input.date,
    text: input.text,
    photos: input.photos,
    percentComplete: input.percentComplete,
    createdAt: new Date(),
  };
}

export async function insertProject(doc: ProjectDoc): Promise<WriteResult> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  try {
    await projects.insertOne(doc);
    return "written";
  } catch (error) {
    return describeWriteError(error);
  }
}

export async function replaceProject(doc: ProjectDoc): Promise<WriteResult> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  try {
    const result = await projects.replaceOne({ _id: doc._id }, doc);
    return result.matchedCount === 0 ? "not_found" : "written";
  } catch (error) {
    return describeWriteError(error);
  }
}

export async function getProject(id: ObjectId): Promise<ProjectDoc | null> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  return projects.findOne({ _id: id });
}

export async function listProjects(filter: ProjectFilter = {}): Promise<ProjectDoc[]> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  const query: Filter<ProjectDoc> = filter.status ? { status: filter.status } : {};
  return projects.find(query).sort({ updatedAt: -1 }).limit(200).toArray();
}

export async function insertProjectUpdate(doc: ProjectUpdateDoc): Promise<void> {
  const updates = await collection<ProjectUpdateDoc>(COLLECTIONS.projectUpdates);
  await updates.insertOne(doc);
}

export async function listProjectUpdates(projectId: ObjectId): Promise<ProjectUpdateDoc[]> {
  const updates = await collection<ProjectUpdateDoc>(COLLECTIONS.projectUpdates);
  return updates.find({ projectId }).sort({ date: -1, createdAt: -1 }).limit(200).toArray();
}

export async function getProjectUpdate(
  projectId: ObjectId,
  updateId: ObjectId,
): Promise<ProjectUpdateDoc | null> {
  const updates = await collection<ProjectUpdateDoc>(COLLECTIONS.projectUpdates);
  return updates.findOne({ _id: updateId, projectId });
}

export async function deleteProjectUpdate(
  projectId: ObjectId,
  updateId: ObjectId,
): Promise<boolean> {
  const updates = await collection<ProjectUpdateDoc>(COLLECTIONS.projectUpdates);
  return (await updates.deleteOne({ _id: updateId, projectId })).deletedCount > 0;
}

/**
 * A work has no meaning without the reports hanging off it, so they go with it —
 * an orphaned progress line would be a dated claim about a work nobody can find,
 * and it would still be counted by any later query for that project id.
 */
export async function removeProjectWithUpdates(
  id: ObjectId,
): Promise<{ removed: boolean; updatesRemoved: number; slug: string | null }> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  const existing = await projects.findOne({ _id: id });
  if (!existing) return { removed: false, updatesRemoved: 0, slug: null };

  const updates = await collection<ProjectUpdateDoc>(COLLECTIONS.projectUpdates);
  const { deletedCount } = await updates.deleteMany({ projectId: id });
  await projects.deleteOne({ _id: id });
  return { removed: true, updatesRemoved: deletedCount ?? 0, slug: existing.slug };
}

/**
 * Newest report first, which is the order a reader wants the timeline in. Two
 * reports on the same day are separated by when they were saved: a figure
 * corrected the same evening is not a second, competing claim about that day.
 */
export function sortUpdatesNewestFirst(updates: readonly ProjectUpdateDoc[]): ProjectUpdateDoc[] {
  return [...updates].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function latestUpdateOf(
  updates: readonly ProjectUpdateDoc[],
): ProjectUpdateDoc | null {
  return sortUpdatesNewestFirst(updates)[0] ?? null;
}

/**
 * The latest report for every one of these works, in one read. The caller asks
 * for at most a page of works, so the accompanying reports stay small enough to
 * group in memory rather than needing an aggregation.
 */
async function latestUpdatesFor(
  projectIds: readonly ObjectId[],
): Promise<Map<string, ProjectUpdateDoc>> {
  const latest = new Map<string, ProjectUpdateDoc>();
  if (projectIds.length === 0) return latest;

  const updates = await collection<ProjectUpdateDoc>(COLLECTIONS.projectUpdates);
  const rows = await updates
    .find({ projectId: { $in: [...projectIds] } })
    .sort({ date: -1, createdAt: -1 })
    .limit(2000)
    .toArray();

  for (const row of rows) {
    const key = row.projectId.toHexString();
    if (!latest.has(key)) latest.set(key, row);
  }
  return latest;
}

export function toPublicProject(
  doc: ProjectDoc,
  latest: ProjectUpdateDoc | null,
): PublicProject {
  return {
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    location: doc.location ?? null,
    status: doc.status,
    sanctionedPaise: doc.sanctionedAmountPaise,
    beneficiaries: doc.beneficiaries,
    startDate: doc.startDate ?? null,
    targetDate: doc.targetDate ?? null,
    completedDate: doc.completedDate ?? null,
    percentComplete:
      doc.status === "completed" ? 100 : (latest?.percentComplete ?? null),
    reportedOn: latest?.date ?? null,
  };
}

export function toAdminProject(
  doc: ProjectDoc,
  latest: ProjectUpdateDoc | null,
): AdminProject {
  return {
    id: doc._id.toHexString(),
    slug: doc.slug,
    title: doc.title,
    status: doc.status,
    order: doc.order,
    sanctionedPaise: doc.sanctionedAmountPaise,
    beneficiaries: doc.beneficiaries,
    location: doc.location ?? null,
    percentComplete: latest?.percentComplete ?? null,
    reportedOn: latest?.date ?? null,
  };
}

export type AdminProject = {
  id: string;
  slug: string;
  title: string;
  status: ProjectStatus;
  order: number;
  sanctionedPaise: number;
  beneficiaries: number;
  location: string | null;
  percentComplete: number | null;
  reportedOn: string | null;
};

export type AdminProjectUpdate = {
  id: string;
  date: string;
  text: string;
  percentComplete: number;
  photos: string[];
};

export function toAdminProjectUpdate(doc: ProjectUpdateDoc): AdminProjectUpdate {
  return {
    id: doc._id.toHexString(),
    date: doc.date,
    text: doc.text,
    percentComplete: doc.percentComplete,
    photos: doc.photos,
  };
}

/** The saved document back into the form's own shape, blank where unset. */
export function toProjectFormValues(doc: ProjectDoc): ProjectInput {
  return PROJECT_SCHEMA.parse({
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    status: doc.status,
    startDate: doc.startDate ?? "",
    targetDate: doc.targetDate ?? "",
    completedDate: doc.completedDate ?? "",
    sanctionedAmountPaise: doc.sanctionedAmountPaise,
    beneficiaries: doc.beneficiaries,
    location: doc.location ?? "",
    coverImageUrl: doc.coverImageUrl ?? "",
    order: doc.order,
  });
}

/* ------------------------------------------------------------ admin reads */

/**
 * The office list, newest touched first, each row carrying the percentage from
 * its latest report so the table shows what a visitor would see on the card.
 */
export async function adminProjectRows(): Promise<AdminProject[]> {
  const docs = await listProjects();
  const latest = await latestUpdatesFor(docs.map((doc) => doc._id));
  return docs.map((doc) => toAdminProject(doc, latest.get(doc._id.toHexString()) ?? null));
}

/* ------------------------------------------------------------ public reads */

/**
 * The works list a visitor sees, in the branch's own order. The latest progress
 * report travels with each one so a card can say how far the work has got — or
 * say nothing, when the branch has not reported it yet.
 */
export async function publicProjects(
  status?: ProjectStatus,
  limit = 100,
): Promise<PublicProject[]> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  const query: Filter<ProjectDoc> = status ? { status } : {};
  const docs = await projects.find(query).sort({ order: 1, createdAt: -1 }).limit(limit).toArray();

  const latest = await latestUpdatesFor(docs.map((doc) => doc._id));
  return docs.map((doc) => toPublicProject(doc, latest.get(doc._id.toHexString()) ?? null));
}

export async function publicProjectBySlug(
  slug: string,
): Promise<{ project: PublicProject; updates: PublicProjectUpdate[] } | null> {
  const projects = await collection<ProjectDoc>(COLLECTIONS.projects);
  const doc = await projects.findOne({ slug });
  if (!doc) return null;

  const updates = await listProjectUpdates(doc._id);
  return {
    project: toPublicProject(doc, latestUpdateOf(updates)),
    updates: updates.map(toPublicProjectUpdate),
  };
}

export function toPublicProjectUpdate(doc: ProjectUpdateDoc): PublicProjectUpdate {
  return {
    date: doc.date,
    text: doc.text,
    percentComplete: doc.percentComplete,
    photos: doc.photos,
  };
}
