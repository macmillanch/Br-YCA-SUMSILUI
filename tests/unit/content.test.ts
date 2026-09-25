import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type SettingsValues } from "@/lib/settings";
import type { LedgerRow } from "@/lib/finance-summary";
import type { FinancialYearDoc } from "@/lib/types";
import {
  financeYearToOpen,
  toAboutContent,
  toBankDetails,
  toContactDetails,
  toFinanceContent,
} from "@/lib/content";

function settings(over: Partial<SettingsValues> = {}): SettingsValues {
  return { ...DEFAULT_SETTINGS, ...over };
}

const YEAR_2627 = { label: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31" };
const YEAR_2526 = { label: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" };
const YEAR_2425 = { label: "2024-25", startDate: "2024-04-01", endDate: "2025-03-31" };
const YEAR_2728 = { label: "2027-28", startDate: "2027-04-01", endDate: "2028-03-31" };

function yearDoc(over: Partial<FinancialYearDoc> = {}): FinancialYearDoc {
  return {
    _id: new ObjectId(),
    openingBalancePaise: 0,
    locked: false,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-09-24T00:00:00Z"),
    ...YEAR_2627,
    ...over,
  };
}

describe("the about page's text", () => {
  it("puts the branch's own words in their own sections", () => {
    const about = toAboutContent(
      settings({
        aboutText: "The branch began in 1994 with a study circle of eleven students.",
        missionText: "To keep the young of the community together and to do openly what needs doing.",
        branchFoundedYear: 1994,
        registrationNo: "LAI/SUM/1994/007",
      }),
    );

    expect(about.branchStory).toBe("The branch began in 1994 with a study circle of eleven students.");
    expect(about.mission).toBe(
      "To keep the young of the community together and to do openly what needs doing.",
    );
    expect(about.foundedYear).toBe(1994);
    expect(about.registrationNo).toBe("LAI/SUM/1994/007");
  });

  it("leaves a section empty rather than writing the branch's story for it", () => {
    expect(toAboutContent(settings())).toEqual({
      branchStory: null,
      mission: null,
      foundedYear: null,
      registrationNo: null,
      unavailable: false,
    });
  });

  it("treats a box typed with spaces as left empty", () => {
    const about = toAboutContent(settings({ missionText: "   ", registrationNo: "  " }));
    expect(about.mission).toBeNull();
    expect(about.registrationNo).toBeNull();
  });

  it("says the settings are unreadable instead of showing a page of blanks", () => {
    expect(toAboutContent(null)).toEqual({
      branchStory: null,
      mission: null,
      foundedYear: null,
      registrationNo: null,
      unavailable: true,
    });
  });
});

describe("which year a visitor sees as this year", () => {
  const today = new Date("2026-09-24T10:00:00+05:30");

  it("shows the year that covers the day the page is read", () => {
    const years = [yearDoc(YEAR_2627), yearDoc(YEAR_2526)];
    expect(financeYearToOpen(years, today)?.label).toBe("2026-27");
  });

  it("shows the newest year there is when today's has not been opened", () => {
    const years = [yearDoc(YEAR_2526), yearDoc(YEAR_2425)];
    expect(financeYearToOpen(years, today)?.label).toBe("2025-26");
  });

  it("keeps a year the treasurer opened ahead of today", () => {
    const years = [yearDoc(YEAR_2728)];
    expect(financeYearToOpen(years, today)?.label).toBe("2027-28");
  });

  it("prefers the year today falls in over one opened ahead of it", () => {
    const years = [yearDoc(YEAR_2728), yearDoc(YEAR_2627)];
    expect(financeYearToOpen(years, today)?.label).toBe("2026-27");
  });

  it("says there is no year at all when none has been opened", () => {
    expect(financeYearToOpen([], today)).toBeNull();
  });
});

describe("the three states of the published figures", () => {
  const ledger: LedgerRow[] = [
    { type: "income", category: "donation", amountPaise: 50000000 },
    { type: "expense", category: "event", amountPaise: 12500000 },
  ];

  it("totals the year it was handed, naming it", () => {
    expect(toFinanceContent(yearDoc({ ...YEAR_2627, openingBalancePaise: 2500000 }), ledger, 3)).toEqual({
      snapshot: {
        yearLabel: "2026-27",
        openingPaise: 2500000,
        incomePaise: 50000000,
        expensePaise: 12500000,
        closingPaise: 40000000,
      },
      unavailable: false,
      yearsOpened: 3,
    });
  });

  it("reports an outage rather than a year of zeros", () => {
    expect(toFinanceContent(yearDoc(YEAR_2627), null, 1)).toEqual({
      snapshot: null,
      unavailable: true,
      yearsOpened: 1,
    });
  });

  it("reports that nothing has been published when the read was clean", () => {
    expect(toFinanceContent(null, [], 0)).toEqual({
      snapshot: null,
      unavailable: false,
      yearsOpened: 0,
    });
  });
});

describe("the branch's contact details", () => {
  it("shows the saved address, phone and email", () => {
    const { contact, unavailable } = toContactDetails(
      settings({
        addressLine: "Branch office, Sumsilui",
        district: "Lunglei",
        state: "Mizoram",
        phone: "9436000000",
        email: "office@yca.example",
      }),
    );

    expect(unavailable).toBe(false);
    expect(contact.addressLines).toEqual(["Branch office, Sumsilui", "Lunglei", "Mizoram"]);
    expect(contact.phone).toBe("9436000000");
    expect(contact.email).toBe("office@yca.example");
  });

  it("names the state it cannot read rather than showing the placeholder address", () => {
    const { contact, unavailable } = toContactDetails(null);

    expect(unavailable).toBe(true);
    expect(contact.addressLines).toEqual([]);
    expect(contact.phone).toBeNull();
    expect(contact.email).toBeNull();
  });
});

describe("the account a contribution goes to", () => {
  it("reads every field from the settings the Treasurer entered", () => {
    const { bank, unavailable } = toBankDetails(
      settings({
        branchName: "YCA Sumsilui Branch Fund",
        bankName: "Mizoram Rural Bank",
        bankBranch: "Tlabung",
        accountNumber: "00000000000000",
        ifsc: "MRBL0000000",
      }),
    );

    expect(unavailable).toBe(false);
    expect(bank.accountName).toBe("YCA Sumsilui Branch Fund");
    expect(bank.bankName).toBe("Mizoram Rural Bank");
    expect(bank.accountNumber).toBe("00000000000000");
    expect(bank.ifsc).toBe("MRBL0000000");
    expect(bank.upiId).toBeNull();
  });

  it("says the details could not be read instead of inviting a query for them", () => {
    const { bank, unavailable } = toBankDetails(null);

    expect(unavailable).toBe(true);
    expect(bank).toEqual({
      accountName: null,
      bankName: null,
      bankBranch: null,
      accountNumber: null,
      ifsc: null,
      upiId: null,
    });
  });
});
