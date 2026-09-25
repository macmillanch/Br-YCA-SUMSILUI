import type { Document } from "mongodb";

export const COLLECTIONS = {
  users: "users",
  sessions: "sessions",
  members: "members",
  notices: "notices",
  financialYears: "financialYears",
  transactions: "transactions",
  donations: "donations",
  projects: "projects",
  projectUpdates: "projectUpdates",
  galleryItems: "galleryItems",
  settings: "settings",
  loginAttempts: "loginAttempts",
} as const;

export type CollectionName = keyof typeof COLLECTIONS;

export type IndexSpec = {
  key: Document;
  unique?: boolean;
  /** With 0, MongoDB deletes each row once the indexed date has passed. */
  expireAfterSeconds?: number;
};

/**
 * The one definition of what is indexed. The seed script and the running app
 * both read this, so they cannot drift apart.
 */
export const INDEX_SPECS: Record<CollectionName, IndexSpec[]> = {
  users: [{ key: { email: 1 }, unique: true }],
  sessions: [
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1 } },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  members: [{ key: { memberType: 1, current: 1, order: 1 } }, { key: { name: 1 } }],
  notices: [
    { key: { slug: 1 }, unique: true },
    { key: { status: 1, publishedAt: -1 } },
    { key: { kind: 1, status: 1, publishedAt: -1 } },
  ],
  financialYears: [{ key: { label: 1 }, unique: true }],
  transactions: [
    { key: { yearId: 1, date: -1 } },
    { key: { yearId: 1, type: 1, category: 1 } },
    { key: { projectId: 1 } },
    { key: { voucherNo: 1 } },
  ],
  donations: [
    { key: { date: -1 } },
    { key: { acknowledgePublicly: 1, date: -1 } },
    // One voucher to one donation, both ways: the acknowledgement list and the
    // accounts are the same entry seen twice.
    { key: { transactionId: 1 }, unique: true },
  ],
  projects: [{ key: { slug: 1 }, unique: true }, { key: { status: 1, order: 1 } }],
  projectUpdates: [{ key: { projectId: 1, date: -1 } }],
  galleryItems: [{ key: { album: 1, order: 1 } }, { key: { eventId: 1 } }],
  settings: [{ key: { key: 1 }, unique: true }],
  loginAttempts: [
    { key: { key: 1 }, unique: true },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
};
