import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z
    .string()
    .refine((value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"), {
      message: "MONGODB_URI must start with mongodb:// or mongodb+srv://",
    }),
  MONGODB_DB: z.string().min(1).default("yca_sumsilui"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(
    `Invalid environment — ${detail}. Copy .env.example to .env.local and fill it in.`,
  );
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
};
