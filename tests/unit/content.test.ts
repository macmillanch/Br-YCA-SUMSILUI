import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type SettingsValues } from "@/lib/settings";
import {
  getFinanceSummary,
  getFinanceYears,
  toAboutContent,
  toBankDetails,
  toContactDetails,
} from "@/lib/content";

function settings(over: Partial<SettingsValues> = {}): SettingsValues {
  return { ...DEFAULT_SETTINGS, ...over };
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

describe("the front page's finance block", () => {
  it("publishes no rupee figure until the ledger produces one", async () => {
    expect(await getFinanceSummary()).toBeNull();
  });

  it("offers no financial year until a treasurer closes one", async () => {
    expect(await getFinanceYears()).toEqual([]);
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
