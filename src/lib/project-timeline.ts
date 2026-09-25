/**
 * Where a line the panel has just been told is saved sits among the lines it is
 * already holding.
 *
 * The published timeline runs newest day first, and two reports of one day in
 * the order they were saved — a figure corrected the same evening is not a
 * second, competing claim about that day. The panel has to use the same rule, or
 * the list visibly shuffles when the server's own copy arrives a moment later.
 */
export type TimelineRow = { id: string; date: string };

export function putReportInPlace<Row extends TimelineRow>(
  rows: readonly Row[],
  added: Row,
): Row[] {
  const withoutIt = rows.filter((row) => row.id !== added.id);
  const at = withoutIt.findIndex((row) => row.date <= added.date);
  if (at === -1) return [...withoutIt, added];
  return [...withoutIt.slice(0, at), added, ...withoutIt.slice(at)];
}
