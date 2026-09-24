/**
 * Vercel rewrites X-Forwarded-For at the edge before the function sees it, so
 * its first entry is the real client address. On a local run there is no
 * proxy, and everything that is not attributable collapses onto one throttle
 * key — which is the safe direction for a mistake.
 */
export function ipOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
