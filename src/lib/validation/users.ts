import { z } from "zod";
import type { Role } from "@/lib/types";
import { PASSWORD_SCHEMA } from "./auth";

/**
 * Spelled out rather than `z.enum(ROLES)`: zod wants a mutable tuple and `ROLES`
 * in src/lib/types.ts is `as const`, so passing it is a type error. The check
 * below is what keeps the two lists from drifting apart silently.
 */
export const ROLE_SCHEMA = z.enum(["super_admin", "editor", "treasurer"]);

type RoleDrift = Role extends z.infer<typeof ROLE_SCHEMA> ? true : false;
const rolesAgree: RoleDrift = true;
void rolesAgree;

export const INVITE_SCHEMA = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  name: z.string().trim().min(2, "Enter the full name").max(80),
  role: ROLE_SCHEMA,
  phone: z.string().trim().max(20).optional(),
  password: PASSWORD_SCHEMA.optional(),
});

export const USER_PATCH_SCHEMA = z
  .object({
    active: z.boolean().optional(),
    role: ROLE_SCHEMA.optional(),
  })
  .refine((value) => value.active !== undefined || value.role !== undefined, {
    message: "Nothing to change",
  });
