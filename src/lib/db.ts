import { MongoClient, type Db, type Document } from "mongodb";
import { env } from "@/lib/env";
import { COLLECTIONS, INDEX_SPECS, type CollectionName } from "@/lib/index-specs";

/**
 * An Atlas M0 cluster sleeps when idle, so the first request after a quiet
 * period can hang. Every call is bounded by this instead.
 */
const DEFAULT_TIMEOUT_MS = 5000;

type CacheEntry = {
  client: MongoClient | null;
  connecting: Promise<MongoClient>;
};

declare global {
  // Must be `var` to attach to globalThis in a module scope.
  // eslint-disable-next-line no-var
  var __ycaMongo: CacheEntry | undefined;
}

function connect(): Promise<MongoClient> {
  if (!globalThis.__ycaMongo) {
    const client = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS,
      connectTimeoutMS: DEFAULT_TIMEOUT_MS,
      // Vercel can keep many warm functions alive; one connection each is what
      // an M0 cluster's connection cap survives.
      maxPoolSize: 1,
    });

    const connecting = client.connect().then(() => {
      const entry = globalThis.__ycaMongo;
      if (entry) entry.client = client;
      return client;
    });

    connecting.catch(() => {
      // A failed attempt must not be cached, or every later request inherits it.
      if (globalThis.__ycaMongo?.connecting === connecting) {
        globalThis.__ycaMongo = undefined;
      }
    });

    globalThis.__ycaMongo = { client: null, connecting };
  }

  return globalThis.__ycaMongo.connecting;
}

export function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`database operation exceeded ${ms}ms — is the Atlas cluster paused?`),
        ),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function getClient(): Promise<MongoClient> {
  return withTimeout(connect());
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(env.MONGODB_DB);
}

export async function collection<T extends Document>(name: CollectionName) {
  return (await getDb()).collection<T>(COLLECTIONS[name]);
}

export async function ensureIndexes(): Promise<string[]> {
  const db = await getDb();
  const created: string[] = [];

  for (const [logicalName, specs] of Object.entries(INDEX_SPECS)) {
    const physical = COLLECTIONS[logicalName as CollectionName];
    for (const spec of specs) {
      const options: Document = {};
      if (spec.unique) options.unique = true;
      if (spec.expireAfterSeconds !== undefined) {
        options.expireAfterSeconds = spec.expireAfterSeconds;
      }
      await db.collection(physical).createIndex(spec.key, options);
      const suffix = spec.unique ? ":unique" : spec.expireAfterSeconds !== undefined ? ":ttl" : "";
      created.push(`${physical}.${Object.keys(spec.key).join("_")}${suffix}`);
    }
  }

  return created;
}
