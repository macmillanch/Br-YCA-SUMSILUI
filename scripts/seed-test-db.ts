import "./load-env";

// Assign before src/lib/env is evaluated: this script always targets the test
// database, so `npm run seed:test` needs no shell-specific env prefix, and the
// production database can never be truncated by mistake.
process.env.MONGODB_DB = process.env.MONGODB_DB_TEST ?? "yca_sumsilui_test";

const { env } = await import("../src/lib/env");
const { ensureIndexes, getDb } = await import("../src/lib/db");
const { COLLECTIONS } = await import("../src/lib/index-specs");
const { createUser, findUserByEmail } = await import("../src/lib/users");
const TEST_PASSWORD = "branch-test-password";

const TEST_USERS = [
  { email: "admin@test.yca.local", name: "Test Admin", role: "super_admin" },
  { email: "editor@test.yca.local", name: "Test Editor", role: "editor" },
  { email: "treasurer@test.yca.local", name: "Test Treasurer", role: "treasurer" },
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

  console.log(`test database "${env.MONGODB_DB}" reset with ${TEST_USERS.length} users`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
