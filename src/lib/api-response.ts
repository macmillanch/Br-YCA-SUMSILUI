import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(
  status: ApiError["status"],
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
): NextResponse {
  return NextResponse.json({ error: { code, message, fieldErrors } }, { status });
}

/**
 * Every handler funnels through here, so a stack trace or a driver message can
 * never reach a browser — the caller gets a code and a friendly sentence (§9).
 */
export function fromError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.fieldErrors);
  }
  if (error instanceof ZodError) {
    const fieldErrors: FieldErrors = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "form";
      fieldErrors[path] ??= issue.message;
    }
    return fail(400, "validation_failed", "Some fields need attention", fieldErrors);
  }
  console.error(error);
  return fail(500, "server_error", "Something went wrong. Please try again.");
}
