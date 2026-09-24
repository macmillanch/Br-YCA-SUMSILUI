import { config } from "dotenv";

/**
 * Next reads `.env.local`, but a plain `tsx` run does not. Loading it here means
 * `npm run seed` sees exactly the variables the app sees. dotenv never
 * overwrites a value already present in the real environment, so a shell
 * variable still wins.
 */
config({ path: ".env.local" });
config();
