import "./load-env";
import { env } from "../src/lib/env";
import { ensureIndexes } from "../src/lib/db";
import {
  DEFAULT_SETTINGS,
  hasSettingsDocument,
  upsertSettings,
} from "../src/lib/settings";
import { createUser, findUserByEmail } from "../src/lib/users";
import { PASSWORD_MIN_LENGTH } from "../src/lib/auth/password";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local before seeding.");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  // Both seed scripts are one keystroke apart and one of them deletes documents.
  if (env.MONGODB_DB === "yca_sumsilui_test") {
    throw new Error("This is the test database. Use npm run seed:test instead.");
  }

  console.log(`seeding "${env.MONGODB_DB}"`);
  const created = await ensureIndexes();
  console.log(`  ${created.length} indexes ensured`);

  // Only ever create it: re-seeding after an index change must not wipe the
  // contact and bank details an office-bearer has since typed in.
  // No financial year is opened here either: an opening balance is the branch's
  // own audited figure, and one a script typed would be published as its money.
  if (await hasSettingsDocument()) {
    console.log("  settings document already exists — left untouched");
  } else {
    await upsertSettings(DEFAULT_SETTINGS);
    console.log("  settings document created with every value blank — nothing is invented");
  }

  if (await findUserByEmail(email)) {
    console.log(`  ${email} already exists — nothing to create`);
    return;
  }
  await createUser({ email, name: "Super Admin", role: "super_admin", password });
  console.log(`  created super_admin ${email}`);
  console.log("  sign in at /login and add the other office-bearers under Users.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(String(error instanceof Error ? error.message : error));
    process.exit(1);
  },
);
