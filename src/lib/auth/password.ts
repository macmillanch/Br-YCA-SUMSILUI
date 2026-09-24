import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

export const PASSWORD_MIN_LENGTH = 10;

/** Omits the glyphs most often misread when a password is read aloud or retyped. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Compared against when no user matches the submitted email, so a failed login
 * costs the same whether or not the account exists.
 */
export const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpDLhIuYWkZBqLxGZDk9cQDkPvqJ2";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTemporaryPassword(): string {
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
