import { ObjectId } from "mongodb";
import { z } from "zod";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import type { SettingsDoc } from "@/lib/types";

const trimmed = (max: number) => z.string().trim().max(max);

export const SETTINGS_SCHEMA = z.object({
  branchName: z.string().trim().min(1, "Branch name is required").max(120),
  registrationNo: trimmed(60),
  branchFoundedYear: z.number().int().min(1900).max(2100).nullable(),
  addressLine: trimmed(200),
  district: trimmed(60),
  state: trimmed(60),
  phone: trimmed(20),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address")]),
  facebookUrl: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .url("Enter a full URL")
      .refine((value) => /^https:\/\/([\w.-]+\.)?facebook\.com\//.test(value), {
        message: "Use an https://facebook.com link",
      }),
  ]),
  whatsappNumber: trimmed(20),
  aboutText: trimmed(4000),
  missionText: trimmed(2000),
  bankName: trimmed(80),
  bankBranch: trimmed(80),
  accountNumber: trimmed(30),
  ifsc: trimmed(15),
  upiId: z.union([
    z.literal(""),
    z.string().trim().regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, "Use the name@bank UPI form"),
  ]),
  footerNote: trimmed(300),
});

export type SettingsValues = z.infer<typeof SETTINGS_SCHEMA>;

/**
 * Every contact, bank and UPI field starts blank on purpose. A branch that has
 * not given a phone number must show "not published yet" on the site, not a
 * plausible-looking invention.
 */
export const DEFAULT_SETTINGS: SettingsValues = {
  branchName: "Young Chakma Association, Sumsilui Branch",
  registrationNo: "",
  branchFoundedYear: null,
  addressLine: "",
  district: "Lawngtlai",
  state: "Mizoram",
  phone: "",
  email: "",
  facebookUrl: "",
  whatsappNumber: "",
  aboutText: "",
  missionText: "",
  bankName: "",
  bankBranch: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  footerNote: "",
};

export async function getSettings(): Promise<SettingsValues> {
  const settings = await collection<SettingsDoc>(COLLECTIONS.settings);
  const doc = await settings.findOne({ key: "site" });
  if (!doc) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...pickValues(doc) };
}

export async function hasSettingsDocument(): Promise<boolean> {
  const settings = await collection<SettingsDoc>(COLLECTIONS.settings);
  return (await settings.countDocuments({ key: "site" })) > 0;
}

export async function upsertSettings(
  values: SettingsValues,
  byId: ObjectId | null = null,
): Promise<SettingsValues> {
  const parsed = SETTINGS_SCHEMA.parse(values);
  const settings = await collection<SettingsDoc>(COLLECTIONS.settings);
  await settings.updateOne(
    { key: "site" },
    { $set: { ...parsed, key: "site", updatedAt: new Date(), updatedById: byId } },
    { upsert: true },
  );
  return parsed;
}

function pickValues(doc: SettingsDoc): SettingsValues {
  const { _id, key, updatedAt, updatedById, ...rest } = doc;
  void _id;
  void key;
  void updatedAt;
  void updatedById;
  return rest as SettingsValues;
}
