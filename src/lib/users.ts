import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/index-specs";
import { collection } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { PublicUser, Role, UserDoc } from "@/lib/types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strips `passwordHash` — nothing outside this module should ever hold it. */
export function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    active: doc.active,
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
  };
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  return users.findOne({ email: normalizeEmail(email) });
}

export async function findUserById(id: ObjectId): Promise<UserDoc | null> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  return users.findOne({ _id: id });
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  const docs = await users.find({}).sort({ createdAt: 1 }).toArray();
  return docs.map(toPublicUser);
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
  phone?: string;
}): Promise<UserDoc> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    role: input.role,
    active: true,
    createdAt: new Date(),
  };
  await users.insertOne(doc);
  return doc;
}

export async function setUserActive(id: ObjectId, active: boolean): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { active } });
}

export async function setUserRole(id: ObjectId, role: Role): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { role } });
}

export async function setPassword(id: ObjectId, password: string): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password) } });
}

export async function touchLastLogin(id: ObjectId): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } });
}
