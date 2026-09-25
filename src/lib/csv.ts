/**
 * The ledger as a spreadsheet.
 *
 * §6's figures are entered by office-bearers the branch trusts, but a
 * description and a party name reach this file from a form, and the person who
 * double-clicks the result in Excel should not become the attack surface for
 * whatever those two fields contain. A cell that begins with `=`, `+`, `@`, a
 * tab or a carriage return is stored as text rather than let through as a
 * formula, every field is quoted so a comma inside a description cannot split a
 * row in two, and the file opens with a UTF-8 BOM so the rupee sign survives
 * rather than arriving as mojibake.
 */

/** The characters a spreadsheet would treat as the start of something to run. */
const FORMULA_LEAD = /^[=+@\t\r]/;

/** U+FEFF, spelled as an escape so the byte is not invisible in the source. */
const BOM = "\uFEFF";

const QUOTE = /"/g;

/**
 * A number goes out as a number, because the treasurer's first question about a
 * downloaded ledger is whether the column adds up. Anything typed is quoted, and
 * a quote inside it is doubled, as RFC 4180 asks.
 */
export function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);

  const text = FORMULA_LEAD.test(value) ? `'${value}` : value;
  return `"${text.replace(QUOTE, '""')}"`;
}

export function csvRows(rows: readonly (readonly (string | number)[])[]): string {
  const lines = rows.map((row) => `${row.map(csvCell).join(",")}\r\n`);
  return `${BOM}${lines.join("")}`;
}
