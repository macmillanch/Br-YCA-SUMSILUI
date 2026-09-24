import { z } from "zod";
import { MEMBER_TYPES } from "@/lib/types";

/**
 * The committee list is the one record where a wrong name is a public wrong, so
 * the form is deliberately strict about what it accepts and deliberately quiet
 * about what it publishes: a phone number is stored, but it reaches the public
 * payload only when `showContactPublicly` is on for that person.
 */

const text = (max: number) => z.string().trim().max(max);

export const MEMBER_TYPE_SCHEMA = z.enum(MEMBER_TYPES);

export const MEMBER_SCHEMA = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Write the member's name")
    .max(80, "Keep the name under 80 characters"),
  memberType: MEMBER_TYPE_SCHEMA,
  /** Free text — President, General Secretary, Executive Member… */
  position: text(60),
  /** The order's F./NAMES column — the branch's record, not the public page. */
  fatherName: text(80),
  term: z.union([
    z.literal(""),
    z.string().trim().regex(/^\d{4}-\d{4}$/, "Use two years, like 2026-2028"),
  ]),
  order: z.coerce.number().int("Use a whole number").min(0).max(9999),
  current: z.boolean(),
  showContactPublicly: z.boolean(),
  phone: text(20),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address")]),
  address: text(160),
  ward: text(60),
  photoUrl: z.union([z.literal(""), z.string().trim().url("Add the photo through the upload screen")]),
});

export type MemberInput = z.infer<typeof MEMBER_SCHEMA>;

/** A `?memberType=` that is absent or unrecognised reads as "every body". */
export const MEMBER_TYPE_QUERY_SCHEMA = z.union([MEMBER_TYPE_SCHEMA, z.null()]);
