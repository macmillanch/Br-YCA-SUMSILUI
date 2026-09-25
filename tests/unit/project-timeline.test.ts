import { describe, expect, it } from "vitest";

import { putReportInPlace, type TimelineRow } from "@/lib/project-timeline";

/**
 * The panel holds what it has just been told is saved, and the server's own list
 * replaces it a moment later. The two have to agree where a line sits, or the
 * timeline visibly shuffles under the office-bearer: newest day first, and a
 * report saved after another on the same day above it — the same order the page
 * publishes in.
 */
function row(date: string, id: string): TimelineRow {
  return { id, date };
}

describe("putReportInPlace", () => {
  it("puts a report of a later day above the ones it outranks", () => {
    const before = [row("2026-09-01", "a")];
    expect(putReportInPlace(before, row("2026-09-20", "b")).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("puts a back-dated report below the newer lines it does not outrank", () => {
    const before = [row("2026-09-20", "a")];
    expect(putReportInPlace(before, row("2026-09-01", "b")).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("puts a second report of the same day above the first, being the newer saving", () => {
    const before = [row("2026-09-20", "a")];
    expect(putReportInPlace(before, row("2026-09-20", "b")).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("keeps the list it was given whole", () => {
    const before = [row("2026-09-20", "a"), row("2026-09-01", "b")];
    expect(putReportInPlace(before, row("2026-09-10", "c")).map((r) => r.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(before.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("holds the only line in a timeline that had nothing on it", () => {
    expect(putReportInPlace([], row("2026-09-12", "a")).map((r) => r.id)).toEqual(["a"]);
  });
});
