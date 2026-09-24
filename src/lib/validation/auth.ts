import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export const LOGIN_SCHEMA = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(200, "Password is too long"),
});

export const PASSWORD_SCHEMA = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, "Password is too long");
