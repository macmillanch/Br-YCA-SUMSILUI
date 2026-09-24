import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { buildMemberDoc, initialsOf, toDirectoryRow, toPublicMember } from "@/lib/members";
import { MEMBER_SCHEMA, type MemberInput } from "@/lib/validation/members";
import type { MemberDoc } from "@/lib/types";

const PHONE = "8731718141";
const FATHER = "Manu Ranjan";

const base: MemberInput = {
  name: "Shyamlal Kanti Chakma",
  memberType: "office_bearer",
  position: "President",
  fatherName: FATHER,
  term: "2026-2028",
  order: 1,
  current: true,
  showContactPublicly: false,
  phone: PHONE,
  email: "president@zca.local",
  address: "",
  ward: "",
  photoUrl: "",
};

function input(overrides: Partial<MemberInput> = {}): MemberInput {
  return MEMBER_SCHEMA.parse({ ...base, ...overrides });
}

function doc(overrides: Partial<MemberDoc> = {}): MemberDoc {
  return {
    _id: new ObjectId(),
    name: base.name,
    memberType: "office_bearer",
    position: "President",
    fatherName: FATHER,
    term: "2026-2028",
    order: 1,
    current: true,
    showContactPublicly: false,
    phone: PHONE,
    email: "president@zca.local",
    createdAt: new Date("2026-09-07T10:00:00Z"),
    updatedAt: new Date("2026-09-07T10:00:00Z"),
    ...overrides,
  };
}

describe("MEMBER_SCHEMA", () => {
  it("accepts a term written as two years, and no term at all", () => {
    expect(input({ term: "2026-2028" }).term).toBe("2026-2028");
    expect(input({ term: "" }).term).toBe("");
  });

  it("refuses a term that is not a span of two years", () => {
    expect(MEMBER_SCHEMA.safeParse({ ...base, term: "2026" }).success).toBe(false);
    expect(MEMBER_SCHEMA.safeParse({ ...base, term: "26-28" }).success).toBe(false);
  });

  it("refuses a member type the site has no section for", () => {
    expect(MEMBER_SCHEMA.safeParse({ ...base, memberType: "volunteer" }).success).toBe(false);
  });
});

describe("buildMemberDoc", () => {
  it("leaves a field out rather than storing it empty", () => {
    const saved = buildMemberDoc(input({ ward: "", address: "", photoUrl: "", fatherName: "" }));
    // The driver writes an explicit `undefined` as `null`, so a stored empty
    // string would come back as a field the pages then have to re-check.
    expect(saved).not.toHaveProperty("ward");
    expect(saved).not.toHaveProperty("photoUrl");
  });

  it("keeps the identity and the original date when editing", () => {
    const existing = doc();
    const saved = buildMemberDoc(input(), existing);
    expect(saved._id).toEqual(existing._id);
    expect(saved.createdAt).toEqual(existing.createdAt);
    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(existing.updatedAt.getTime());
  });
});

describe("toPublicMember", () => {
  it("keeps a phone number out of the payload unless that person has agreed", () => {
    const card = toPublicMember(doc());
    expect(card.phone).toBeNull();
    expect(card.email).toBeNull();
    // Hiding it in the page would still ship it to the browser, so the check is
    // on what the payload actually serialises to.
    expect(JSON.stringify(card)).not.toContain(PHONE);
    expect(JSON.stringify(card)).not.toContain("president@zca.local");
    // The order's F./NAMES column is a fact about someone who is not a member
    // of this site, so it is not in the committee payload at all.
    expect(JSON.stringify(card)).not.toContain(FATHER);
  });

  it("carries the contact once the agreement is recorded", () => {
    const card = toPublicMember(doc({ showContactPublicly: true }));
    expect(card.phone).toBe(PHONE);
    expect(card.email).toBe("president@zca.local");
  });

  it("publishes a photo and a term, which the register does not", () => {
    const card = toPublicMember(doc({ photoUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg" }));
    expect(card.photoUrl).toBe("https://res.cloudinary.com/demo/image/upload/a.jpg");
    expect(card.term).toBe("2026-2028");
  });
});

describe("toDirectoryRow", () => {
  it("shows a name, a ward and an office, and nothing else", () => {
    const row = toDirectoryRow(doc({ ward: "Ward 3", showContactPublicly: true }));
    expect(row).toEqual({ name: base.name, ward: "Ward 3", position: "President" });
    expect(JSON.stringify(row)).not.toContain(PHONE);
  });
});

describe("initialsOf", () => {
  it("spells a card monogram from the name itself", () => {
    expect(initialsOf("Shyamlal Kanti Chakma")).toBe("SC");
    expect(initialsOf("Anitamoy Chakma")).toBe("AC");
    expect(initialsOf("Partar Muni")).toBe("PM");
  });

  it("ignores an abbreviation and a parenthesised epithet", () => {
    expect(initialsOf("F. Ashok Chakma")).toBe("AC");
    expect(initialsOf("Priyo Ranjan (Arbo) Chakma")).toBe("PC");
    expect(initialsOf("S. Dippu Chakma (VCP)")).toBe("DC");
  });

  it("copes with a single word", () => {
    expect(initialsOf("Manekchhua")).toBe("M");
    expect(initialsOf("")).toBe("");
  });
});
