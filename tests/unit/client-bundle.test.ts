import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What a visitor's browser downloads is decided by the imports of the files that
 * begin `"use client"` — and a single `import { helper } from "@/lib/finance"`
 * is enough to put the database driver and the connection code into a public
 * bundle. `import type` is erased by the compiler and brings nothing, so the two
 * lines look almost alike to whoever is building a screen.
 *
 * The failure is loud in development (the page stops compiling) and quiet in a
 * build that passes, which is the wrong way round for something that publishes
 * the branch's server code. So the rule is checked here rather than remembered.
 */
const SRC = resolve(process.cwd(), "src");

/** Modules that have no business being in the browser, wherever they are reached from. */
const SERVER_ONLY = /from "@\/lib\/db"|from "mongodb"|require\("mongodb"\)|from "next\/cache"/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** `@/lib/finance` → src/lib/finance.ts, or null when the address names nothing. */
function resolveLib(spec: string): string | null {
  const base = join(SRC, spec.replace("@/lib/", "lib/"));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // Not there; the next spelling may be.
    }
  }
  return null;
}

/**
 * The `@/lib/...` modules a piece of source asks for in a way that survives
 * compilation.
 *
 * A clause stops at the first `;` so that a line cannot reach back over the
 * statements above it — without that, the type-only import below
 * `import { useState } from "react"` is read as part of the react line, and the
 * check finds violations in code that has none.
 */
function valueImportsOf(source: string): string[] {
  const found: string[] = [];
  for (const statement of source.matchAll(
    /^(?:import|export)\s+(?!type\b)([^;]*?)from\s+"(@\/lib\/[^"]+)"|^import\s+"(@\/lib\/[^"]+)"/gm,
  )) {
    const clause = (statement[1] ?? "").trim();
    // `{ a, type B }` still brings `a`, `{ type B }` brings nothing, and a bare
    // `import "x"` brings the whole module.
    if (
      statement[1] !== undefined &&
      clause.replace(/type\s+\w+/g, "").replace(/[{},\s*]/g, "") === ""
    ) {
      continue;
    }
    const spec = statement[2] ?? statement[3];
    if (spec) found.push(spec);
  }
  return found;
}

function valueImports(file: string): string[] {
  return valueImportsOf(readFileSync(file, "utf8"));
}

function reachesTheDatabase(spec: string, seen: Set<string>): boolean {
  const file = resolveLib(spec);
  if (!file || seen.has(file)) return false;
  seen.add(file);
  // `import type { ObjectId } from "mongodb"` names the driver without fetching it.
  const text = readFileSync(file, "utf8").replace(/^import type[^;]*;/gm, "");
  if (SERVER_ONLY.test(text)) return true;
  return valueImports(file).some((next) => reachesTheDatabase(next, seen));
}

/**
 * The reading above decides what the check below sees, so it is tested on its
 * own: a rule that reports nothing because it understood nothing would pass
 * every run forever.
 */
describe("reading an import line", () => {
  it("brings nothing from a type-only line", () => {
    expect(valueImportsOf('import type { AdminYearRow } from "@/lib/finance";')).toEqual([]);
  });

  it("brings the value out of a line that mixes the two", () => {
    expect(
      valueImportsOf('import { closedLabelsOf, type AdminYearRow } from "@/lib/finance";'),
    ).toEqual(["@/lib/finance"]);
  });

  it("does not read past the statement above the one it is looking at", () => {
    expect(
      valueImportsOf(
        'import { useState } from "react";\nimport type { AdminGalleryItem } from "@/lib/gallery";',
      ),
    ).toEqual([]);
  });

  it("follows an import written over several lines", () => {
    expect(
      valueImportsOf('import {\n  groupByAlbum,\n  type GalleryAlbum,\n} from "@/lib/gallery";'),
    ).toEqual(["@/lib/gallery"]);
  });
});

describe("what the browser is sent", () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => readFileSync(file, "utf8").startsWith('"use client"'))
    .flatMap((file) =>
      valueImports(file)
        .filter((spec) => reachesTheDatabase(spec, new Set()))
        .map((spec) => `${relative(SRC, file)} imports ${spec} for a value`),
    );

  it("never carries the database behind a client component's own imports", () => {
    expect(offenders).toEqual([]);
  });
});
