import type { ObjectId } from "mongodb";

/**
 * Document shapes are type aliases, never interfaces. The driver constrains its
 * schema generic to `Document`, an index-signature type, and TypeScript only
 * gives an implicit index signature to object-literal types — an interface
 * fails that constraint and forces a cast at every call site.
 */

export const ROLES = ["super_admin", "editor", "treasurer"] as const;
export type Role = (typeof ROLES)[number];

export type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: Role;
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
};

export type SessionDoc = {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
};

export type LoginAttemptDoc = {
  _id: ObjectId;
  key: string;
  count: number;
  firstAt: Date;
  expiresAt: Date;
};

export type SettingsDoc = {
  _id: ObjectId;
  key: "site";
  branchName: string;
  registrationNo: string;
  branchFoundedYear: number | null;
  addressLine: string;
  district: string;
  state: string;
  phone: string;
  email: string;
  facebookUrl: string;
  whatsappNumber: string;
  aboutText: string;
  missionText: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  footerNote: string;
  updatedAt: Date;
  updatedById: ObjectId | null;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
};

export type AuthContext = {
  user: UserDoc;
  sessionId: ObjectId;
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  editor: "Editor",
  treasurer: "Treasurer",
};
