import "./load-env";

// Assign before src/lib/env is evaluated: this script always targets the test
// database, so `npm run seed:test` needs no shell-specific env prefix, and the
// production database can never be truncated by mistake.
process.env.MONGODB_DB = process.env.MONGODB_DB_TEST ?? "yca_sumsilui_test";

const { env } = await import("../src/lib/env");
const { ensureIndexes, getDb } = await import("../src/lib/db");
const { COLLECTIONS } = await import("../src/lib/index-specs");
const { insertTransaction, openFinancialYear, replaceTransaction } = await import(
  "../src/lib/finance"
);
const { currentFiscalYear } = await import("../src/lib/fiscal-year");
const { createUser, findUserByEmail } = await import("../src/lib/users");
const TEST_PASSWORD = "branch-test-password";

const TEST_USERS = [
  { email: "admin@test.yca.local", name: "Test Admin", role: "super_admin" },
  { email: "editor@test.yca.local", name: "Test Editor", role: "editor" },
  { email: "treasurer@test.yca.local", name: "Test Treasurer", role: "treasurer" },
] as const;

/**
 * A year's book for the screens to be tested against, and nothing a member could
 * mistake for the branch's money: every line says TEST in its voucher number and
 * in the words a reader of the ledger would see.
 *
 * The months fall inside whichever year the script opens, so the guards accept
 * the entries the same way they would accept a treasurer's own.
 */
const FIXTURE_VOUCHERS = [
  { monthDay: "04-12", type: "income", category: "subscription", amountPaise: 4_000_000, voucherNo: "TEST-001", party: "TEST members, Riala meeting", description: "TEST subscriptions collected at the April meeting" },
  { monthDay: "05-03", type: "income", category: "event_collection", amountPaise: 1_500_000, voucherNo: "TEST-002", party: "TEST collection, Bualka", description: "TEST collection at the May program" },
  { monthDay: "06-21", type: "expense", category: "event", amountPaise: 2_250_000, voucherNo: "TEST-003", party: "TEST hall, Aizawl", description: "TEST hall rent for the June program" },
  { monthDay: "07-08", type: "expense", category: "administration", amountPaise: 450_000, voucherNo: "TEST-004", party: "TEST transport", description: "TEST vehicle hire for the July visit" },
  { monthDay: "08-16", type: "expense", category: "education", amountPaise: 350_000, voucherNo: "TEST-005", party: "TEST press", description: "TEST photocopying of study material" },
  { monthDay: "09-05", type: "expense", category: "community_welfare", amountPaise: 1_200_000, voucherNo: "TEST-006", party: "TEST families, Tuipui", description: "TEST relief packets" },
] as const;

async function main() {
  if (env.MONGODB_DB !== "yca_sumsilui_test" && !process.env.ALLOW_ANY_DB) {
    throw new Error(
      `refusing to truncate "${env.MONGODB_DB}" — set MONGODB_DB_TEST to a scratch database`,
    );
  }

  const db = await getDb();
  for (const name of Object.values(COLLECTIONS)) {
    await db.collection(name).deleteMany({});
  }
  await ensureIndexes();

  for (const spec of TEST_USERS) {
    if (!(await findUserByEmail(spec.email))) {
      await createUser({ ...spec, password: TEST_PASSWORD });
    }
  }

  // An open year and a handful of vouchers, so the screens and the end-to-end
  // tests have a book to read. The production seed never comes here: a branch's
  // first year is opened by its own Treasurer, from its own audited figure, and
  // an opening balance typed by a script would be a figure the site published as
  // the branch's money.
  const year = currentFiscalYear();
  const label = year.label;
  const startYear = year.startDate.slice(0, 4);
  const opened = await openFinancialYear({
    label,
    openingBalancePaise: 0,
    auditPdfUrl: "",
  });
  if (opened.result !== "written") {
    throw new Error(`the test year ${label} could not be opened: ${opened.result}`);
  }

  const treasurer = await findUserByEmail("treasurer@test.yca.local");
  if (!treasurer) throw new Error("the test treasurer was not created");

  let corrected = false;
  for (const entry of FIXTURE_VOUCHERS) {
    const voucher = {
      date: `${startYear}-${entry.monthDay}`,
      type: entry.type,
      category: entry.category,
      amountPaise: entry.amountPaise,
      voucherNo: entry.voucherNo,
      party: entry.party,
      description: entry.description,
      projectId: "",
    };
    const written = await insertTransaction(voucher, treasurer._id);
    if (written.result !== "written") {
      throw new Error(`the test voucher ${entry.voucherNo} was refused: ${written.result}`);
    }
    // One line is corrected rather than left as it was written, so the trail a
    // reader of the book has to be able to find is there to look at.
    if (entry.voucherNo === "TEST-005" && !corrected) {
      const changed = await replaceTransaction(
        written.transaction._id,
        {
          ...voucher,
          amountPaise: 320_000,
          reason: "Fixture: the paper bill read thirty-two hundred rupees, not thirty-five.",
        },
        treasurer._id,
      );
      if (changed.result !== "written") {
        throw new Error(`the test correction was refused: ${changed.result}`);
      }
      corrected = true;
    }
  }

  console.log(
    `test database "${env.MONGODB_DB}" reset with ${TEST_USERS.length} users, ${label} open and ${FIXTURE_VOUCHERS.length} test vouchers`,
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
