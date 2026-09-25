import { describe, expect, it } from "vitest";
import { csvCell, csvRows } from "@/lib/csv";

/**
 * The ledger as a spreadsheet, which is how a treasurer and an auditor actually
 * read it.
 *
 * §6's data is typed by office-bearers the branch trusts, but a description and
 * a party name reach this file from a form, and the person who opens it in Excel
 * should not become the attack surface for whatever those fields contain. A cell
 * that begins with `=`, `+`, `@`, a tab or a carriage return is therefore stored
 * as text, and every field is quoted so a comma inside a description cannot
 * split a row in two.
 */

describe("csvCell", () => {
  it("quotes a field and doubles any quote inside it", () => {
    expect(csvCell("Membership subscription")).toBe('"Membership subscription"');
    expect(csvCell('He said "yes"')).toBe('"He said ""yes"""');
    expect(csvCell("Repast, stage and lights")).toBe('"Repast, stage and lights"');
  });

  it("keeps a line break inside the field rather than breaking the row", () => {
    expect(csvCell("Grant report\nsecond line")).toBe('"Grant report\nsecond line"');
  });

  it("refuses to let a figure become a formula", () => {
    expect(csvCell("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
    expect(csvCell("+SUM(1,1)")).toBe("\"'+SUM(1,1)\"");
    expect(csvCell("@SUM(1+1)*cmd|'/C'!A0")).toBe("\"'@SUM(1+1)*cmd|'/C'!A0\"");
    expect(csvCell("\t1234")).toBe("\"'\t1234\"");
    expect(csvCell("\r1234")).toBe("\"'\r1234\"");
  });

  it("leaves a figure that merely contains one alone", () => {
    expect(csvCell("Grant for 2=2 years, + VAT")).toBe('"Grant for 2=2 years, + VAT"');
    expect(csvCell("R.C. Das & Co, Sumsilui")).toBe('"R.C. Das & Co, Sumsilui"');
  });

  it("writes a number as a number, so the column can be totalled", () => {
    expect(csvCell(12500000)).toBe("12500000");
    expect(csvCell(0)).toBe("0");
  });
});

describe("csvRows", () => {
  it("joins the rows with CRLF and puts a BOM in front for Excel", () => {
    const csv = csvRows([
      ["Date", "Party"],
      ["2026-04-12", "Office-bearers"],
    ]);

    expect(csv).toBe(`\uFEFF"Date","Party"\r\n"2026-04-12","Office-bearers"\r\n`);
  });

  it("ends with a line break so the last row is a row", () => {
    expect(csvRows([["One"]])).toBe("\uFEFF\"One\"\r\n");
  });

  it("writes a header on its own when there is nothing to say", () => {
    expect(csvRows([])).toBe("\uFEFF");
  });
});
