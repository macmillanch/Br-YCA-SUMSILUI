/**
 * Dates shown to a reader are calendar days in the branch's own time zone.
 * A `Date` is an instant, so a notice published at 11 pm in Delhi is already the
 * next morning in the site's headings if the instant is read back in UTC.
 */

const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `2026-09-24`, as seen from Mizoram at that instant. */
export function istCalendarDate(instant: Date): string {
  return IST_DATE.format(instant);
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `24 Sep 2026` — the short form used on cards and table rows. */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** `24 September 2026` — the form used on a detail page. */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}
