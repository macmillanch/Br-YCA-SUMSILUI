import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  buildProjectDoc,
  buildProjectUpdateDoc,
  latestUpdateOf,
  sortUpdatesNewestFirst,
  toPublicProject,
  toProjectFormValues,
} from "@/lib/projects";
import type { ProjectDoc, ProjectUpdateDoc } from "@/lib/types";
import {
  PROJECT_SCHEMA,
  PROJECT_UPDATE_SCHEMA,
  effectiveProjectSlug,
  type ProjectInput,
  type ProjectUpdateInput,
} from "@/lib/validation/projects";

/** ₹2,50,000 — stored as paise because rupees typed into a float lose the paisa. */
const SANCTIONED = 25000000;

const base: ProjectInput = {
  title: "Overhead water tank for the upper lines",
  slug: "",
  description:
    "Storage tank and stand-pipe so that households on the higher ground are not dependent on the morning supply alone.",
  status: "ongoing",
  startDate: "2026-06-01",
  targetDate: "2026-12-31",
  completedDate: "",
  sanctionedAmountPaise: SANCTIONED,
  beneficiaries: 46,
  location: "Sumsilui, upper locality",
  coverImageUrl: "",
  order: 1,
};

function input(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return PROJECT_SCHEMA.parse({ ...base, ...overrides });
}

const updateBase: ProjectUpdateInput = {
  date: "2026-09-15",
  text: "The tank slab has been cast and the stand-pipe is in place.",
  percentComplete: 40,
  photos: [],
};

function updateInput(overrides: Partial<ProjectUpdateInput> = {}): ProjectUpdateInput {
  return PROJECT_UPDATE_SCHEMA.parse({ ...updateBase, ...overrides });
}

function projectDoc(overrides: Partial<ProjectDoc> = {}): ProjectDoc {
  return {
    _id: new ObjectId(),
    slug: "overhead-water-tank-for-the-upper-lines",
    title: base.title,
    description: base.description,
    status: "ongoing",
    startDate: "2026-06-01",
    targetDate: "2026-12-31",
    sanctionedAmountPaise: SANCTIONED,
    beneficiaries: 46,
    location: "Sumsilui, upper locality",
    order: 1,
    createdAt: new Date("2026-06-01T04:00:00Z"),
    updatedAt: new Date("2026-06-01T04:00:00Z"),
    ...overrides,
  };
}

function updateDoc(overrides: Partial<ProjectUpdateDoc> = {}): ProjectUpdateDoc {
  return {
    _id: new ObjectId(),
    projectId: projectDoc()._id,
    date: "2026-09-15",
    text: updateBase.text,
    photos: [],
    percentComplete: 40,
    createdAt: new Date("2026-09-15T10:00:00Z"),
    ...overrides,
  };
}

describe("PROJECT_SCHEMA", () => {
  it("derives the web address from the title when the editor leaves it blank", () => {
    const value = input({ slug: "" });
    expect(effectiveProjectSlug(value)).toBe("overhead-water-tank-for-the-upper-lines");
  });

  it("keeps an address the editor typed instead of overwriting it", () => {
    const value = input({ slug: "upper-lines-water-tank" });
    expect(effectiveProjectSlug(value)).toBe("upper-lines-water-tank");
  });

  it("refuses an address with nothing usable in it", () => {
    // A title written in Chakma script has no ASCII letters to derive from, so
    // the editor has to type an address rather than be given an empty one.
    expect(PROJECT_SCHEMA.safeParse({ ...base, title: "!!!", slug: "" }).success).toBe(false);
    expect(PROJECT_SCHEMA.safeParse({ ...base, slug: "Water Tank" }).success).toBe(false);
  });

  it("refuses a sanctioned amount that is not whole paise", () => {
    expect(PROJECT_SCHEMA.safeParse({ ...base, sanctionedAmountPaise: -1 }).success).toBe(false);
    expect(PROJECT_SCHEMA.safeParse({ ...base, sanctionedAmountPaise: 100.5 }).success).toBe(false);
    expect(PROJECT_SCHEMA.safeParse({ ...base, sanctionedAmountPaise: 0 }).success).toBe(true);
  });

  it("refuses a status the works page has no section for", () => {
    expect(PROJECT_SCHEMA.safeParse({ ...base, status: "cancelled" }).success).toBe(false);
  });

  it("refuses a date that is not a calendar day, and accepts no date", () => {
    expect(PROJECT_SCHEMA.safeParse({ ...base, startDate: "June 2026" }).success).toBe(false);
    expect(PROJECT_SCHEMA.safeParse({ ...base, startDate: "2026-02-30" }).success).toBe(false);
    expect(PROJECT_SCHEMA.safeParse({ ...base, startDate: "", targetDate: "" }).success).toBe(true);
  });

  it("refuses a negative number of beneficiaries", () => {
    expect(PROJECT_SCHEMA.safeParse({ ...base, beneficiaries: -3 }).success).toBe(false);
  });
});

describe("PROJECT_UPDATE_SCHEMA", () => {
  it("refuses a percentage outside the bar", () => {
    expect(PROJECT_UPDATE_SCHEMA.safeParse({ ...updateBase, percentComplete: 101 }).success).toBe(
      false,
    );
    expect(PROJECT_UPDATE_SCHEMA.safeParse({ ...updateBase, percentComplete: -1 }).success).toBe(
      false,
    );
    expect(PROJECT_UPDATE_SCHEMA.safeParse({ ...updateBase, percentComplete: 33.3 }).success).toBe(
      false,
    );
  });

  it("refuses a report with no date or no text", () => {
    expect(PROJECT_UPDATE_SCHEMA.safeParse({ ...updateBase, date: "" }).success).toBe(false);
    expect(PROJECT_UPDATE_SCHEMA.safeParse({ ...updateBase, text: "   " }).success).toBe(false);
  });

  it("refuses a photo address that is not an address", () => {
    expect(
      PROJECT_UPDATE_SCHEMA.safeParse({ ...updateBase, photos: ["not-a-url"] }).success,
    ).toBe(false);
    expect(
      PROJECT_UPDATE_SCHEMA.safeParse({
        ...updateBase,
        photos: ["https://res.cloudinary.com/demo/image/upload/work.jpg"],
      }).success,
    ).toBe(true);
  });
});

describe("buildProjectDoc", () => {
  it("leaves a field out rather than storing it empty", () => {
    const saved = buildProjectDoc(
      input({ completedDate: "", location: "", coverImageUrl: "", startDate: "", targetDate: "" }),
    );
    // The driver writes an explicit `undefined` as `null`, so an absent date
    // would come back as a value the page then has to re-check.
    expect(saved).not.toHaveProperty("completedDate");
    expect(saved).not.toHaveProperty("coverImageUrl");
    expect(saved).not.toHaveProperty("location");
  });

  it("keeps the identity and the original date when editing", () => {
    const existing = projectDoc();
    const saved = buildProjectDoc(input(), existing);
    expect(saved._id).toEqual(existing._id);
    expect(saved.createdAt).toEqual(existing.createdAt);
    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(existing.updatedAt.getTime());
  });
});

describe("buildProjectUpdateDoc", () => {
  it("files the report under the project it was added to", () => {
    const projectId = new ObjectId();
    const saved = buildProjectUpdateDoc(updateInput({ percentComplete: 70 }), projectId);
    expect(saved.projectId).toEqual(projectId);
    expect(saved.percentComplete).toBe(70);
    expect(saved.date).toBe("2026-09-15");
  });
});

describe("latestUpdateOf", () => {
  it("takes the report from the latest date", () => {
    const earlier = updateDoc({ date: "2026-08-01", percentComplete: 20 });
    const later = updateDoc({ date: "2026-09-15", percentComplete: 55 });
    expect(latestUpdateOf([earlier, later])?._id).toEqual(later._id);
    expect(latestUpdateOf([later, earlier])?._id).toEqual(later._id);
  });

  it("treats the report saved later as the newer one on the same date", () => {
    const first = updateDoc({
      date: "2026-09-15",
      percentComplete: 40,
      createdAt: new Date("2026-09-15T09:00:00Z"),
    });
    const corrected = updateDoc({
      date: "2026-09-15",
      percentComplete: 60,
      createdAt: new Date("2026-09-15T17:00:00Z"),
    });
    expect(latestUpdateOf([first, corrected])?._id).toEqual(corrected._id);
  });

  it("has nothing to say about a project with no reports", () => {
    expect(latestUpdateOf([])).toBeNull();
  });
});

describe("sortUpdatesNewestFirst", () => {
  it("puts the timeline in the order a reader wants", () => {
    const updates = [
      updateDoc({ date: "2026-07-01", _id: new ObjectId() }),
      updateDoc({ date: "2026-09-15", _id: new ObjectId() }),
      updateDoc({ date: "2026-08-10", _id: new ObjectId() }),
    ];
    expect(sortUpdatesNewestFirst(updates).map((update) => update.date)).toEqual([
      "2026-09-15",
      "2026-08-10",
      "2026-07-01",
    ]);
  });
});

describe("toPublicProject", () => {
  it("shows the percentage the branch last reported", () => {
    const card = toPublicProject(
      projectDoc(),
      latestUpdateOf([updateDoc({ percentComplete: 55 })]),
      0,
    );
    expect(card.percentComplete).toBe(55);
    expect(card.sanctionedPaise).toBe(SANCTIONED);
    expect(card.slug).toBe("overhead-water-tank-for-the-upper-lines");
  });

  it("says nothing at all about progress when no report exists", () => {
    const card = toPublicProject(projectDoc(), null, null);
    expect(card.percentComplete).toBeNull();
    // 0 would read as "the branch has done nothing", which is a claim about the
    // work rather than an admission that it has not been reported yet.
    expect(card.percentComplete).not.toBe(0);
  });

  it("states a clean zero for a work no voucher has drawn against", () => {
    const card = toPublicProject(projectDoc(), null, 0);

    // The ledger was read and found nothing, which is a fact worth publishing —
    // it is not the same answer as the one below, where nothing was read at all.
    expect(card.spentPaise).toBe(0);
    expect(card.budgetSharePct).toBe(0);
  });

  it("states no spend and no share when the ledger could not be read", () => {
    const card = toPublicProject(projectDoc(), null, null);

    expect(card.spentPaise).toBeNull();
    // A bar drawn from a figure nobody read would be the site inventing an
    // account, and §9 asks for a sentence instead.
    expect(card.budgetSharePct).toBeNull();
  });

  it("says by how much a work has gone past what was sanctioned", () => {
    const card = toPublicProject(projectDoc(), null, SANCTIONED + SANCTIONED / 2);

    // 150 rather than 100: a work that cost more than the branch sanctioned is
    // the thing a public account should not hide behind a full bar.
    expect(card.budgetSharePct).toBe(150);
  });

  it("gives no share of an amount nobody sanctioned", () => {
    const card = toPublicProject(projectDoc({ sanctionedAmountPaise: 0 }), null, 500000);

    expect(card.spentPaise).toBe(500000);
    expect(card.budgetSharePct).toBeNull();
  });

  it("keeps a completed work at full bar whatever its last report said", () => {
    const card = toPublicProject(
      projectDoc({ status: "completed", completedDate: "2026-08-30" }),
      latestUpdateOf([updateDoc({ percentComplete: 80 })]),
      SANCTIONED,
    );
    expect(card.percentComplete).toBe(100);
  });
});

describe("toProjectFormValues", () => {
  it("puts the saved document back into the form's own shape", () => {
    const values = toProjectFormValues(projectDoc());
    expect(values).toMatchObject({
      title: base.title,
      slug: "overhead-water-tank-for-the-upper-lines",
      status: "ongoing",
      startDate: "2026-06-01",
      completedDate: "",
      location: "Sumsilui, upper locality",
      sanctionedAmountPaise: SANCTIONED,
      beneficiaries: 46,
      order: 1,
    });
    expect(values.coverImageUrl).toBe("");
  });
});
