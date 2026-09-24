import "./load-env";
import { env } from "../src/lib/env";
import { ensureIndexes, getDb } from "../src/lib/db";
import { COLLECTIONS } from "../src/lib/index-specs";
import { createUser, findUserByEmail } from "../src/lib/users";
import type { Role } from "../src/lib/types";

export const TEST_USERS: readonly { email: string; name: string; role: Role }[] = [
  { email: "admin@test.yca.local", name: "Test Admin", role: "super_admin" },
  { email: "editor@test.yca.local", name: "Test Editor", role: "editor" },
  { email: "treasurer@test.yca.local", name: "Test Treasurer", role: "treasurer" },
];

export const TEST_PASSWORD = "branch-test-password";

async function main() {
  if (env.MONGODB_DB !== "yca_sumsilui_test" && !process.env.ALLOW_ANY_DB) {
    throw new Error(
      `refusing to truncate "${env.MONGODB_DB}" — point MONGODB_DB at yca_sumsilui_test`,
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
