import { ObjectId } from "mongodb";
import { ApiError } from "@/lib/api-response";

export function toObjectId(value: unknown): ObjectId | null {
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
  if (value instanceof ObjectId) return value;
  return null;
}

/** A route param the browser controls must be rejected as 400, not crash the driver. */
export function requireObjectId(value: unknown, field = "id"): ObjectId {
  const oid = toObjectId(value);
  if (!oid) throw new ApiError(400, "invalid_id", `${field} is not a valid id`);
  return oid;
}

export function objectIdToString(value: ObjectId | null | undefined): string | null {
  return value ? value.toHexString() : null;
}
