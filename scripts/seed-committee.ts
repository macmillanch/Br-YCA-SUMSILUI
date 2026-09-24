import { readFileSync } from "node:fs";
import { z } from "zod";
import "./load-env";
import { MEMBER_TYPE_SCHEMA } from "../src/lib/validation/members";

/**
 * Records the branch committee from its own approval order.
 *
 * The committee is a public list of real people, so this script is deliberately
 * additive: it inserts names that are not there yet and never rewrites one that
 * is. Re-running it after the office-bearers have added photographs or turned
 * "show contact publicly" on for someone cannot undo that work. Correct a wrong
 * spelling in Admin → Members, or remove the row there and run this again.
 *
 * Usage: npm run seed:committee
 */

const FILE_SCHEMA = z.object({
  term: z.string().regex(/^\d{4}-\d{4}$/, "term must read like 2026-2028"),
  approvalOrder: z.string().min(1),
  approvedOn: z.string().min(1),
  members: z
    .array(
      z.object({
        name: z.string().min(2),
        memberType: MEMBER_TYPE_SCHEMA,
        position: z.string().default(""),
        fatherName: z.string().default(""),
        phone: z.string().default(""),
        order: z.number().int(),
      }),
    )
    .min(1),
});

async function main() {
  const { env } = await import("../src/lib/env");
  const { ensureIndexes, getDb } = await import("../src/lib/db");
  const { COLLECTIONS } = await import("../src/lib/index-specs");
  const { buildMemberDoc, insertMember, memberExists } = await import("../src/lib/members");
  const { MEMBER_SCHEMA } = await import("../src/lib/validation/members");

  const url = new URL("../data/committee-2026-2028.json", import.meta.url);
  const file = FILE_SCHEMA.parse(JSON.parse(readFileSync(url, "utf8")));

  console.log(`order ${file.approvalOrder} of ${file.approvedOn} — term ${file.term}`);
  console.log(`writing into database "${env.MONGODB_DB}"`);

  await getDb();
  await ensureIndexes();

  const added: string[] = [];
  const skipped: string[] = [];
  for (const row of file.members) {
    // Parsing through the same schema the admin form uses means a typo in this
    // file stops the run instead of reaching the public page.
    const input = MEMBER_SCHEMA.parse({
      name: row.name,
      memberType: row.memberType,
      position: row.position,
      fatherName: row.fatherName,
      term: file.term,
      order: row.order,
      current: true,
      showContactPublicly: false,
      phone: row.phone,
      email: "",
      address: "",
      ward: "",
      photoUrl: "",
    });

    if (await memberExists(input.name, input.term)) {
      skipped.push(input.name);
      continue;
    }
    await insertMember(buildMemberDoc(input));
    added.push(`${input.order}. ${input.name}${input.position ? ` — ${input.position}` : ""}`);
  }

  const db = await getDb();
  const total = await db.collection(COLLECTIONS.members).countDocuments({ term: file.term });

  console.log(`\n${added.length} recorded, ${skipped.length} already present (${total} for ${file.term})`);
  for (const name of added) console.log(`  + ${name}`);
  if (skipped.length > 0) console.log(`\nunchanged: ${skipped.join(", ")}`);
  console.log(
    "\nNo phone number reaches the public site until 'Show contact publicly' is turned on for that person.",
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
