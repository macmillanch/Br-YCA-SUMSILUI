# Br. YCA Sumsilui — Plan 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a running Next.js application with the YCA design system, a MongoDB data layer, session authentication with a three-role permission model, and working admin screens for site settings and user accounts.

**Architecture:** One Next.js 15 App Router project. Public pages are server components; `/admin` is a server-rendered shell whose forms call `/api/*` route handlers. Every handler authenticates through a single `requireRole` helper that resolves an opaque session cookie against MongoDB and enforces the role allowlist. No ORM — a thin cached `MongoClient` singleton plus typed collection accessors.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, MongoDB driver 6, bcryptjs, zod, Vitest, Playwright, tsx.

**Spec:** `docs/superpowers/specs/2026-09-24-yca-sumsilui-website-design.md` — read it alongside this plan. Sections cited as §n below refer to it.

---

## Roadmap: why this plan stops where it does

The spec is four deliverables stacked. Each produces working, testable software and each could be approved or rejected independently of its neighbours, so they are separate plans, each with its own execution cycle:

| Plan | Delivers | Status |
|---|---|---|
| **1 — Foundation** (this document) | App scaffold, design tokens, DB layer, money/fiscal-year logic, auth, roles, settings, user admin, seed, deployment docs | **to build now** |
| 2 — Content | Members, notices/press releases with Bangla + Chakma, Cloudinary uploads, gallery, projects + work-progress timeline, and their public pages | after Plan 1 |
| 3 — Finance | Financial years, transaction ledger, donations, category charts, CSV export, year locking, `/finance` public pages | after Plan 2 |
| 4 — Public polish | Home composition, about/contact/donate pages, member directory privacy, SEO, Lighthouse budget, Vercel production deploy | after Plan 3 |

Plan 1 deliberately ships a site with an empty home page and no content sections. That is correct: the design system, auth and data layer are what every later plan stands on, and getting them wrong is expensive to undo.

## Prerequisites (do these once, before Task 1)

1. **Git identity.** This machine has none configured, so `git commit` fails. Set it for this repository only — not `--global`:

   ```bash
   cd "C:/Users/macmi/Documents/Br YCA SUMSILUI"
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```

   Every task below ends in a commit; none of them can complete until this is done.

2. **MongoDB Atlas M0 cluster.** Follow `docs/deployment.md` (written in Task 10). Until it exists, Tasks 3–9 still build and unit-test; the dev server and Playwright flows need `MONGODB_URI`.

3. **Node 18.18+.** The client machine has v24.18.0.

## Global Constraints

Every task's requirements implicitly include these. Values are copied verbatim from the spec.

- Money is stored as **integer paise**, never floats and never rupees. `₹1,250.50` is `125050`.
- Financial years are the Indian fiscal year: **1 April → 31 March**, labelled `2026-27`.
- Database name `yca_sumsilui`; test database `yca_sumsilui_test`.
- Session cookie name `yca_session`, `httpOnly`, `secure` in production, `sameSite: lax`, `path: /`, 14-day expiry.
- bcrypt cost **12** in production. Configurable only through `BCRYPT_ROUNDS` so tests can use 4.
- Roles are exactly `super_admin`, `editor`, `treasurer`. `super_admin` passes every allowlist without being listed.
- Roles are read **only** from the resolved session. No handler may accept a role, user id, or amount from the client.
- No secret may be prefixed `NEXT_PUBLIC_`. `.env.local` is gitignored.
- Uploads are ≤ 8 MB, MIME types `image/jpeg`, `image/png`, `image/webp` only (Plan 2 implements uploads).
- Public pages: ≤ 200 KB gzipped JS, LCP < 3.5 s on simulated 4G.
- Folder path contains spaces — always quote it in shell commands.
- Tests: Vitest for pure logic, Playwright for the four flows named in §10 of the spec.

### Spec deviation, recorded

§8 and §11 of the spec list `SESSION_SECRET` as an environment variable. It is **not** needed: session tokens are 32 random bytes, stored only as their SHA-256 hash, and never signed. A secret that no code uses is a secret that can rot. Amend the spec's §8 and §11 to drop `SESSION_SECRET` when Task 3 completes.

---

## File structure

Responsibilities are fixed here before tasks are defined, so each task edits a small, named set of files rather than discovering the layout as it goes.

```
package.json                     deps + scripts
tsconfig.json                    strict, paths alias "@/*" -> "src/*"
next.config.ts                   image remotePatterns for res.cloudinary.net
postcss.config.mjs               @tailwindcss/postcss
vitest.config.ts                 node env, @ alias, tests/unit/**
playwright.config.ts             webServer npm run dev, chromium only
.env.example                     every var, no values
.gitignore                       (exists)

src/
  app/
    layout.tsx                   fonts, <html lang="en">, header/footer shell
    globals.css                  @theme design tokens (§5 of spec)
    page.tsx                     placeholder home; sections arrive in Plan 4
    error.tsx                    public read-failure boundary (§9)
    loading.tsx                  skeleton
    admin/
      login/page.tsx             unauthenticated form
      layout.tsx                 session gate + sidebar
      page.tsx                   dashboard
      settings/page.tsx          super_admin form
      users/page.tsx             super_admin table + invite
    api/
      auth/login/route.ts
      auth/logout/route.ts
      auth/me/route.ts
      settings/route.ts
      users/route.ts
      users/[id]/route.ts
  middleware.ts                  cookie-presence redirect for /admin only
  lib/
    env.ts                       zod-validated process.env, single export `env`
    api-response.ts              ok(), fail(), error body shape
    types.ts                     Role, UserDoc, SessionDoc, SettingsDoc, PublicUser
    db.ts                        cached MongoClient singleton, db(), withTimeout()
    index-specs.ts               INDEX_SPECS: collection -> index definitions (pure)
    mongo-oid.ts                 toObjectId(id) -> ObjectId | null
    money.ts                     paise <-> rupees, formatPaise, groupIndian
    fiscal-year.ts               fiscalYearOf(isoDate), sameFiscalYear
    users.ts                     findUserByEmail, createUser, listUsers, setUserActive, setUserRole
    settings.ts                  DEFAULT_SETTINGS, getSettings, updateSettings, SETTINGS_SCHEMA
    auth/
      password.ts                hashPassword, verifyPassword, PASSWORD_MIN_LENGTH, DUMMY_HASH
      session.ts                 SESSION_COOKIE, newSessionToken, hashToken, createSession,
                                 resolveSession, destroySession, destroySessionsForUser, isSessionLive
      require-role.ts            requireRole, isSameOrigin, AuthError
      login-attempts.ts          attemptKey, computeLock, checkLocked, recordFailure, clearAttempts
      client-ip.ts               ipOf(request)
  components/
    site/SiteHeader.tsx          emblem + wordmark + nav
    site/SiteFooter.tsx          contact from settings
    ui/Button.tsx Input.tsx Field.tsx Card.tsx Flash.tsx
    admin/AdminSidebar.tsx       role-filtered nav (server component)
    admin/RequireSuperAdmin.tsx  renders 403 body for non-super-admin screens

scripts/
  seed.ts                        indexes + settings doc + first super_admin
  seed-test-db.ts                truncate + known users for Playwright

tests/
  unit/money.test.ts fiscal-year.test.ts index-specs.test.ts session.test.ts
  unit/require-role.test.ts login-attempts.test.ts settings.test.ts password.test.ts
  e2e/auth.spec.ts settings.spec.ts users.spec.ts

docs/
  superpowers/specs/...          (exists)
  superpowers/plans/...          (this file)
  deployment.md                  Atlas + Cloudinary + Vercel click-by-click
README.md                        local setup
```

---

## Task 1: Scaffold, design tokens, and the public shell

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/error.tsx`, `src/app/loading.tsx`, `src/components/site/SiteHeader.tsx`, `src/components/site/SiteFooter.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `vitest.config.ts`, `tests/unit/scaffold.test.ts`
- Modify: `.gitignore` (add `.env.test`)

**Interfaces:**
- Consumes: nothing.
- Produces: `@/*` import alias; Tailwind colour classes `green-900 green-700 green-500 green-100 red-700 red-100 ink ink-muted paper paper-alt line`; font CSS variables `--font-display`, `--font-sans`; `<SiteHeader>` and `<SiteFooter>`; the `Button` and `Card` primitives every later task reuses.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "br-yca-sumsilui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "seed": "tsx scripts/seed.ts",
    "seed:test": "tsx scripts/seed-test-db.ts"
  },
  "dependencies": {
    "bcryptjs": "2.4.3",
    "mongodb": "6.9.0",
    "next": "15.0.0",
    "react": "19.0.0-rc-66855b96-20241106",
    "react-dom": "19.0.0-rc-66855b96-20241106",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "1.48.1",
    "@tailwindcss/postcss": "4.0.0",
    "@types/bcryptjs": "2.4.6",
    "@types/node": "22.7.5",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.0",
    "dotenv": "16.4.5",
    "tailwindcss": "4.0.0",
    "tsx": "4.19.1",
    "typescript": "5.6.3",
    "vitest": "2.1.2"
  }
}
```

Run `npm install`. If `npm install` resolves a peer conflict on the React RC versions, run `npm install --legacy-peer-deps` once and note it in `README.md` — do not add an `.npmrc` that silently changes install semantics for the next person.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`noUncheckedIndexedAccess` is on because the money and fiscal-year helpers index strings; it turns a whole class of silent `undefined` into a compile error.

- [ ] **Step 3: Create `postcss.config.mjs`, `next.config.ts`, `vitest.config.ts`, `.env.example`**

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: { BCRYPT_ROUNDS: "4", MONGODB_URI: "mongodb://localhost:27017", MONGODB_DB: "yca_sumsilui_test" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

Unit tests must never reach a real database. `MONGODB_URI` is set here only so `src/lib/env.ts` validates; any test that would open a connection is mis-designed.

`.env.example`:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=yca_sumsilui
BCRYPT_ROUNDS=12
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

Append `.env.test` to `.gitignore`.

- [ ] **Step 4: Write the failing scaffold test**

Create `tests/unit/scaffold.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

describe("design tokens", () => {
  it("defines every colour from spec section 5", () => {
    for (const [token, value] of Object.entries({
      "--color-green-900": "#06411F",
      "--color-green-700": "#0B7A3E",
      "--color-green-500": "#12A05A",
      "--color-green-100": "#E3F2E8",
      "--color-red-700": "#C8102E",
      "--color-red-100": "#FBE6E9",
      "--color-ink": "#14231B",
      "--color-ink-muted": "#5A6B60",
      "--color-paper": "#FFFFFF",
      "--color-paper-alt": "#F7F9F7",
      "--color-line": "#DCE5DE",
    })) {
      expect(css).toContain(`${token}: ${value};`);
    }
  });

  it("loads display and body fonts as CSS variables", () => {
    expect(css).toContain("--font-display");
    expect(css).toContain("--font-sans");
  });
});
```

- [ ] **Step 5: Run it to confirm it fails**

Run: `npx vitest run tests/unit/scaffold.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open 'src/app/globals.css'`

- [ ] **Step 6: Write `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-green-900: #06411F;
  --color-green-700: #0B7A3E;
  --color-green-500: #12A05A;
  --color-green-100: #E3F2E8;
  --color-red-700: #C8102E;
  --color-red-100: #FBE6E9;
  --color-ink: #14231B;
  --color-ink-muted: #5A6B60;
  --color-paper: #FFFFFF;
  --color-paper-alt: #F7F9F7;
  --color-line: #DCE5DE;

  --font-display: var(--font-fraunces), ui-serif, Georgia, serif;
  --font-sans: var(--font-public-sans), ui-sans-serif, system-ui, sans-serif;
}

@layer base {
  html {
    font-family: var(--font-sans);
    color: var(--color-ink);
    background: var(--color-paper);
    -webkit-text-size-adjust: 100%;
  }

  h1, h2, h3 {
    font-family: var(--font-display);
    color: var(--color-green-900);
    text-wrap: balance;
  }

  :focus-visible {
    outline: 2px solid var(--color-green-700);
    outline-offset: 2px;
  }
}

@layer components {
  .container-page {
    width: 100%;
    max-width: 1140px;
    margin-inline: auto;
    padding-inline: 1rem;
  }

  @media (min-width: 768px) {
    .container-page { padding-inline: 1.5rem; }
  }
}
```

- [ ] **Step 7: Write `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Br. YCA Sumsilui", template: "%s | Br. YCA Sumsilui" },
  description:
    "Young Chakma Association, Sumsilui Branch — a Chakma community NGO in Mizoram. Notices, work progress, and public financial records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
```

`next/font/google` downloads and self-hosts at build time, so no visitor makes a third-party font request.

- [ ] **Step 8: Write the header, footer, and two UI primitives**

`src/components/site/SiteHeader.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import logo from "../../../assets/yca.jpg";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/notices", label: "Notices" },
  { href: "/works", label: "Works" },
  { href: "/gallery", label: "Gallery" },
  { href: "/finance", label: "Finance" },
  { href: "/executive-members", label: "Members" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="container-page flex flex-wrap items-center gap-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logo} alt="Young Chakma Association emblem" width={56} height={56} priority />
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold text-green-900">
              Young Chakma Association
            </span>
            <span className="block text-xs tracking-wide text-ink-muted uppercase">
              Sumsilui Branch &middot; Mizoram
            </span>
          </span>
        </Link>
        <nav aria-label="Main" className="w-full md:ml-auto md:w-auto">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-green-700 hover:text-green-500 hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
```

`src/components/site/SiteFooter.tsx` — static for now; Task 7 replaces the hardcoded strings with `getSettings()`:

```tsx
export function SiteFooter() {
  return (
    <footer className="mt-16 bg-green-900 text-white">
      <div className="container-page py-8 text-sm">
        <p className="font-display text-base">Young Chakma Association, Sumsilui Branch</p>
        <p className="mt-1 text-white/80">
          Contact details are published once the branch office information is entered in Admin &rarr; Settings.
        </p>
        <p className="mt-4 text-white/60">
          &copy; {new Date().getFullYear()} Br. YCA Sumsilui. Financial records are published in public view.
        </p>
      </div>
    </footer>
  );
}
```

`src/components/ui/Button.tsx`:

```tsx
import Link from "next/link";

type Variant = "primary" | "accent" | "ghost";

const STYLES: Record<Variant, string> = {
  primary: "bg-green-700 text-white hover:bg-green-500",
  accent: "bg-red-700 text-white hover:bg-red-700/90",
  ghost: "border border-line bg-paper text-green-700 hover:bg-green-100",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60";

type Props = {
  variant?: Variant;
  href?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", href, children, className = "", ...rest }: Props) {
  const classes = `${BASE} ${STYLES[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
```

`src/components/ui/Card.tsx`:

```tsx
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-paper p-5 ${className}`}>{children}</div>;
}
```

- [ ] **Step 9: Write `src/app/page.tsx`, `loading.tsx`, `error.tsx`**

`src/app/page.tsx` — placeholder only; Plan 4 composes the real home page:

```tsx
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="container-page py-12">
      <h1 className="text-3xl">Young Chakma Association &mdash; Sumsilui Branch</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        This branch serves the Chakma community of Sumsilui. Notices, project progress and financial
        records are published here in public view.
      </p>
      <Card className="mt-8 max-w-md">
        <h2 className="text-lg">Under construction</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Content sections are added in the next build phases. Office-bearers can sign in at
          <a href="/admin" className="ml-1 text-green-700 underline">/admin</a>.
        </p>
      </Card>
    </div>
  );
}
```

`src/app/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="container-page py-12" role="status" aria-live="polite">
      <div className="h-8 w-2/3 animate-pulse rounded bg-green-100" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-green-100" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-green-100" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
```

`src/app/error.tsx` — the §9 public read-failure boundary:

```tsx
"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div className="container-page py-12">
      <h1 className="text-2xl text-red-700">Details are temporarily unavailable</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        The branch records could not be loaded. This usually clears itself in a moment &mdash; figures
        are never shown from a cached copy, because an out-of-date balance is worse than none.
      </p>
      <button onClick={reset} className="mt-6 rounded bg-green-700 px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 10: Add `assets/yca.jpg` to the TypeScript program**

Importing the logo needs ambient types. Create `src/types/assets.d.ts`:

```ts
declare module "*.jpg" {
  const src: string;
  export default src;
}
```

- [ ] **Step 11: Run tests and the build**

Run: `npx vitest run`
Expected: PASS — 2 tests in `scaffold.test.ts`

Run: `npm run build`
Expected: build succeeds; `/` prerendered as static.

Run: `npm run dev`, open `http://localhost:3000`. Expected: white page, green header with the circular emblem and two-line wordmark, green nav row, dark-green footer. Confirm the emblem is sharp at 375 px width and that the nav wraps rather than overflowing.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with YCA design tokens and public shell

Establishes the white/green/red system from the YCA emblem so later
content work inherits it rather than inventing it page by page."
```

---

## Task 2: Money and fiscal-year logic

**Files:**
- Create: `src/lib/money.ts`, `src/lib/fiscal-year.ts`, `tests/unit/money.test.ts`, `tests/unit/fiscal-year.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `paiseToRupees(paise: number): number`
  - `rupeesToPaise(rupees: number): number`
  - `formatPaise(paise: number): string` → `₹1,23,456.75`, `-₹500`
  - `sumPaise(values: number[]): number`
  - `fiscalYearOf(isoDate: string): { label: string; startDate: string; endDate: string }`
  - `isIsoDate(value: string): boolean`
  - `fiscalYearContains(isoDate: string, label: string): boolean`

  Plan 3's summary code and every admin money input call these; nobody re-implements rounding.

- [ ] **Step 1: Write the failing money tests**

`tests/unit/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPaise, paiseToRupees, rupeesToPaise, sumPaise } from "@/lib/money";

describe("rupeesToPaise", () => {
  it("rounds the float artefact of a decimal rupee amount", () => {
    expect(rupeesToPaise(1250.5)).toBe(125050);
    expect(rupeesToPaise(0.07)).toBe(7);
    expect(rupeesToPaise(1.005)).toBe(101);
  });

  it("rejects non-finite input instead of storing NaN", () => {
    expect(() => rupeesToPaise(Number.NaN)).toThrow(/finite/);
    expect(() => rupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });
});

describe("paiseToRupees", () => {
  it("is the exact inverse for real rupee amounts", () => {
    for (const rupees of [0, 1, 99.99, 1250.5, 100000000]) {
      expect(paiseToRupees(rupeesToPaise(rupees))).toBe(rupees);
    }
  });
});

describe("formatPaise", () => {
  it("groups Indian-style with the last three digits separate", () => {
    expect(formatPaise(0)).toBe("₹0");
    expect(formatPaise(99)).toBe("₹0.99");
    expect(formatPaise(100)).toBe("₹1");
    expect(formatPaise(123456)).toBe("₹1,234.56");
    expect(formatPaise(1234567)).toBe("₹12,345.67");
    expect(formatPaise(12345678)).toBe("₹1,23,456.78");
    expect(formatPaise(1234567890)).toBe("₹1,23,45,678.90");
  });

  it("puts the minus sign before the rupee symbol", () => {
    expect(formatPaise(-50000)).toBe("-₹500");
  });

  it("keeps two decimals only when paise are present", () => {
    expect(formatPaise(1000000)).toBe("₹10,000");
    expect(formatPaise(1000001)).toBe("₹10,000.01");
  });
});

describe("sumPaise", () => {
  it("sums integers exactly with no float drift", () => {
    expect(sumPaise([1, 2, 3])).toBe(6);
    expect(sumPaise(Array(10).fill(10))).toBe(100);
    expect(sumPaise([])).toBe(0);
  });

  it("throws if any value is not an integer", () => {
    expect(() => sumPaise([1, 1.5])).toThrow(/integer/);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run tests/unit/money.test.ts`
Expected: FAIL — `Failed to load url @/lib/money ... Does the file exist?`

- [ ] **Step 3: Write `src/lib/money.ts`**

```ts
export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) throw new Error("rupees must be a finite number");
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  assertInteger(paise);
  return paise / PAISE_PER_RUPEE;
}

export function sumPaise(values: readonly number[]): number {
  return values.reduce((total, value) => {
    assertInteger(value);
    return total + value;
  }, 0);
}

export function formatPaise(paise: number): string {
  assertInteger(paise);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const sub = abs % PAISE_PER_RUPEE;
  return `${sign}\u20B9${groupIndian(rupees)}${sub === 0 ? "" : `.${String(sub).padStart(2, "0")}`}`;
}

function assertInteger(value: number): void {
  if (!Number.isInteger(value)) throw new Error(`expected an integer number of paise, got ${value}`);
}

function groupIndian(rupees: number): string {
  const digits = String(rupees);
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}
```

- [ ] **Step 4: Run the money tests to confirm they pass**

Run: `npx vitest run tests/unit/money.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Write the failing fiscal-year tests**

`tests/unit/fiscal-year.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fiscalYearContains, fiscalYearOf, isIsoDate } from "@/lib/fiscal-year";

describe("fiscalYearOf", () => {
  it("assigns the day before the year rollover to the earlier label", () => {
    expect(fiscalYearOf("2027-03-31")).toEqual({
      label: "2026-27",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
    });
  });

  it("assigns 1 April to the new label", () => {
    expect(fiscalYearOf("2027-04-01").label).toBe("2027-28");
  });

  it("handles a mid-year date", () => {
    expect(fiscalYearOf("2026-12-05").label).toBe("2026-27");
  });

  it("handles the first day of a label", () => {
    expect(fiscalYearOf("2026-04-01").label).toBe("2026-27");
  });

  it("crosses the century correctly", () => {
    expect(fiscalYearOf("2100-04-01").label).toBe("2100-01");
  });

  it("rejects malformed dates rather than guessing", () => {
    expect(() => fiscalYearOf("31/03/2027")).toThrow(/ISO date/);
    expect(() => fiscalYearOf("2027-13-01")).toThrow(/ISO date/);
    expect(() => fiscalYearOf("2027-02-30")).toThrow(/ISO date/);
  });
});

describe("fiscalYearContains", () => {
  it("is true only inside the labelled span", () => {
    expect(fiscalYearContains("2026-04-01", "2026-27")).toBe(true);
    expect(fiscalYearContains("2027-03-31", "2026-27")).toBe(true);
    expect(fiscalYearContains("2027-04-01", "2026-27")).toBe(false);
    expect(fiscalYearContains("2026-03-31", "2026-27")).toBe(false);
  });
});

describe("isIsoDate", () => {
  it("accepts real calendar days only", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-1-05")).toBe(false);
  });
});
```

- [ ] **Step 6: Run them to confirm they fail**

Run: `npx vitest run tests/unit/fiscal-year.test.ts`
Expected: FAIL — cannot resolve `@/lib/fiscal-year`.

- [ ] **Step 7: Write `src/lib/fiscal-year.ts`**

```ts
export interface FiscalYear {
  label: string;
  startDate: string;
  endDate: string;
}

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeap(year) ? 29 : MONTH_DAYS[month - 1];
  return day >= 1 && day <= (limit ?? 31);
}

export function fiscalYearOf(isoDate: string): FiscalYear {
  if (!isIsoDate(isoDate)) throw new Error(`expected an ISO date (YYYY-MM-DD), got "${isoDate}"`);
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return {
    label: labelFor(startYear),
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
}

export function fiscalYearContains(isoDate: string, label: string): boolean {
  const { startDate, endDate } = parseLabel(label);
  return isoDate >= startDate && isoDate <= endDate;
}

export function labelFor(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function parseLabel(label: string): FiscalYear {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) throw new Error(`expected a fiscal-year label like 2026-27, got "${label}"`);
  const startYear = Number(match[1]);
  return { label, startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31` };
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
```

Dates are compared as `YYYY-MM-DD` strings throughout the project. String comparison on a zero-padded ISO date is exact and sidesteps the timezone shifts that make `Date` comparisons wrong when the browser is in IST and the server is in UTC.

- [ ] **Step 8: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS — money, fiscal-year and scaffold tests all green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/money.ts src/lib/fiscal-year.ts tests/unit/money.test.ts tests/unit/fiscal-year.test.ts
git commit -m "feat: add paise money and Indian fiscal-year helpers

Both are pure and unit-tested because a rounding error or an off-by-one
year boundary in a published NGO ledger is a credibility problem, not a
display bug."
```

---

## Task 3: Environment, database layer, and shared types

**Files:**
- Create: `src/lib/env.ts`, `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/index-specs.ts`, `src/lib/mongo-oid.ts`, `tests/unit/index-specs.test.ts`
- Modify: `docs/superpowers/specs/2026-09-24-yca-sumsilui-website-design.md` (drop `SESSION_SECRET` from §8 and §11)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `env: { MONGODB_URI, MONGODB_DB, BCRYPT_ROUNDS, NODE_ENV, isProduction }`
  - `getDb(): Promise<Db>`, `getClient(): Promise<MongoClient>`, `withTimeout<T>(p: Promise<T>, ms?: number): Promise<T>`
  - `COLLECTIONS` — const map of collection name strings
  - `INDEX_SPECS: Record<string, IndexSpec[]>` where `IndexSpec = { key: Document; unique?: boolean }`
  - `ensureIndexes(): Promise<string[]>`
  - types `Role`, `UserDoc`, `SessionDoc`, `SettingsDoc`, `PublicUser`, `AuthContext`
  - `toObjectId(value: unknown): ObjectId | null`, `requireObjectId(value: unknown): ObjectId` (throws `ApiError`)

- [ ] **Step 1: Write `src/lib/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z
    .string()
    .refine((v) => v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"), {
      message: "MONGODB_URI must start with mongodb:// or mongodb+srv://",
    }),
  MONGODB_DB: z.string().min(1).default("yca_sumsilui"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment — ${detail}. Copy .env.example to .env.local and fill it in.`);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
};
```

Validation at import time means a misconfigured deploy fails on the first request with a readable message rather than at 2 a.m. with an opaque driver error.

- [ ] **Step 2: Write `src/lib/types.ts`**

Every document type here is a **type alias, not an `interface`**. The MongoDB driver constrains its schema generic to `Document`, which is an index-signature type, and TypeScript only gives an implicit index signature to object-literal types — an `interface` fails that constraint and forces a cast at every call site. This is the single most common friction point with the official driver and it is cheaper to design around it here than to fight it in Tasks 4–9.

```ts
import type { ObjectId } from "mongodb";

export const ROLES = ["super_admin", "editor", "treasurer"] as const;
export type Role = (typeof ROLES)[number];

export type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  role: Role;
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
};

export type SessionDoc = {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
};

export type SettingsDoc = {
  _id: ObjectId;
  key: "site";
  branchName: string;
  registrationNo: string;
  branchFoundedYear: number | null;
  addressLine: string;
  district: string;
  state: string;
  phone: string;
  email: string;
  facebookUrl: string;
  whatsappNumber: string;
  aboutText: string;
  missionText: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  footerNote: string;
  updatedAt: Date;
  updatedById: ObjectId | null;
};

export type AuthContext = {
  user: UserDoc;
  sessionId: ObjectId;
};
```

- [ ] **Step 3: Write the failing index-spec test**

`tests/unit/index-specs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COLLECTIONS, INDEX_SPECS } from "@/lib/index-specs";

const names = Object.values(COLLECTIONS);

describe("index specs", () => {
  it("covers every collection the app writes to", () => {
    expect(Object.keys(INDEX_SPECS).sort()).toEqual([...names].sort());
  });

  it("uniquely constrains email and session token", () => {
    expect(INDEX_SPECS.users).toContainEqual({ key: { email: 1 }, unique: true });
    expect(INDEX_SPECS.sessions).toContainEqual({ key: { tokenHash: 1 }, unique: true });
  });

  it("indexes every foreign key used in a lookup", () => {
    expect(INDEX_SPECS.sessions).toContainEqual({ key: { userId: 1 } });
    expect(INDEX_SPECS.transactions).toContainEqual({ key: { yearId: 1, date: -1 } });
    expect(INDEX_SPECS.projectUpdates).toContainEqual({ key: { projectId: 1, date: -1 } });
  });

  it("indexes the fields public listings sort on", () => {
    expect(INDEX_SPECS.notices).toContainEqual({ key: { status: 1, publishedAt: -1 } });
    expect(INDEX_SPECS.members).toContainEqual({ key: { memberType: 1, current: 1, order: 1 } });
  });

  it("never declares a non-unique index on a field that must be unique", () => {
    for (const [collection, specs] of Object.entries(INDEX_SPECS)) {
      const plain = specs.filter((s) => !s.unique).map((s) => JSON.stringify(s.key));
      for (const spec of specs.filter((s) => s.unique)) {
        expect(plain, `${collection} duplicates a unique key as non-unique`).not.toContain(
          JSON.stringify(spec.key),
        );
      }
    }
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run tests/unit/index-specs.test.ts`
Expected: FAIL — cannot resolve `@/lib/index-specs`.

- [ ] **Step 5: Write `src/lib/index-specs.ts`**

```ts
import type { Document } from "mongodb";

export const COLLECTIONS = {
  users: "users",
  sessions: "sessions",
  members: "members",
  notices: "notices",
  financialYears: "financialYears",
  transactions: "transactions",
  donations: "donations",
  projects: "projects",
  projectUpdates: "projectUpdates",
  galleryItems: "galleryItems",
  settings: "settings",
  loginAttempts: "loginAttempts",
} as const;

export interface IndexSpec {
  key: Document;
  unique?: boolean;
}

export const INDEX_SPECS: Record<keyof typeof COLLECTIONS, IndexSpec[]> = {
  users: [{ key: { email: 1 }, unique: true }],
  sessions: [
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1 } },
    { key: { expiresAt: 1 } },
  ],
  members: [
    { key: { memberType: 1, current: 1, order: 1 } },
    { key: { name: 1 } },
  ],
  notices: [
    { key: { slug: 1 }, unique: true },
    { key: { status: 1, publishedAt: -1 } },
    { key: { kind: 1, status: 1, publishedAt: -1 } },
  ],
  financialYears: [{ key: { label: 1 }, unique: true }],
  transactions: [
    { key: { yearId: 1, date: -1 } },
    { key: { yearId: 1, type: 1, category: 1 } },
    { key: { projectId: 1 } },
    { key: { voucherNo: 1 } },
  ],
  donations: [{ key: { date: -1 } }, { key: { acknowledgePublicly: 1, date: -1 } }],
  projects: [
    { key: { slug: 1 }, unique: true },
    { key: { status: 1, order: 1 } },
  ],
  projectUpdates: [{ key: { projectId: 1, date: -1 } }],
  galleryItems: [
    { key: { album: 1, order: 1 } },
    { key: { eventId: 1 } },
  ],
  settings: [{ key: { key: 1 }, unique: true }],
  loginAttempts: [
    { key: { key: 1 }, unique: true },
    { key: { expiresAt: 1 } },
  ],
};
```

`transactions` and `projects` carry `yearId`/`projectId`/`eventId` indexes before those collections are written in Plans 2–3. Declaring them once here means the seed script and the running app agree on one definition of the schema's shape.

- [ ] **Step 6: Write `src/lib/db.ts`**

```ts
import { MongoClient, type Db, type Document } from "mongodb";
import { env } from "./env";
import { COLLECTIONS, INDEX_SPECS } from "./index-specs";

const DEFAULT_TIMEOUT_MS = 5000;

interface CacheEntry {
  client: MongoClient | null;
  connecting: Promise<MongoClient>;
}

declare global {
  // eslint-disable-next-line no-var
  var __ycaMongo: CacheEntry | undefined;
}

async function connect(): Promise<MongoClient> {
  if (!globalThis.__ycaMongo) {
    const client = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: DEFAULT_TIMEOUT_MS,
      connectTimeoutMS: DEFAULT_TIMEOUT_MS,
      maxPoolSize: 1,
    });
    const connecting = client.connect().then(() => {
      globalThis.__ycaMongo!.client = client;
      return client;
    });
    globalThis.__ycaMongo = { client: null, connecting };
    connecting.catch(() => {
      globalThis.__ycaMongo = undefined;
    });
  }
  return globalThis.__ycaMongo.connecting;
}

export async function getClient(): Promise<MongoClient> {
  return withTimeout(connect());
}

export async function getDb(): Promise<Db> {
  return (await getClient()).db(env.MONGODB_DB);
}

export async function collection<T extends Document>(name: string) {
  return (await getDb()).collection<T>(name);
}

export function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`database operation exceeded ${ms}ms — is the Atlas cluster paused?`)),
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

export async function ensureIndexes(): Promise<string[]> {
  const db = await getDb();
  const created: string[] = [];
  for (const [logicalName, specs] of Object.entries(INDEX_SPECS)) {
    const physical = COLLECTIONS[logicalName as keyof typeof COLLECTIONS];
    for (const spec of specs) {
      await db
        .collection(physical)
        .createIndex(spec.key, spec.unique ? { unique: true } : undefined);
      created.push(`${physical}.${Object.keys(spec.key).join("_")}${spec.unique ? ":unique" : ""}`);
    }
  }
  return created;
}
```

`maxPoolSize: 1` is deliberate. Atlas M0 caps concurrent connections but Vercel serverless can spin many warm functions; a single connection per function is the setting that survives that.

- [ ] **Step 7: Write `src/lib/mongo-oid.ts`**

```ts
import { ObjectId } from "mongodb";
import { ApiError } from "./api-response";

export function toObjectId(value: unknown): ObjectId | null {
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
  if (value instanceof ObjectId) return value;
  return null;
}

export function requireObjectId(value: unknown, field = "id"): ObjectId {
  const oid = toObjectId(value);
  if (!oid) throw new ApiError(400, "invalid_id", `${field} is not a valid id`);
  return oid;
}
```

`src/lib/api-response.ts` is created here because `mongo-oid` needs `ApiError`:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(
  status: ApiError["status"],
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
): NextResponse {
  return NextResponse.json({ error: { code, message, fieldErrors } }, { status });
}

export function fromError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.fieldErrors);
  }
  if (error instanceof ZodError) {
    const fieldErrors: FieldErrors = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "form";
      fieldErrors[path] ??= issue.message;
    }
    return fail(400, "validation_failed", "Some fields need attention", fieldErrors);
  }
  console.error(error);
  return fail(500, "server_error", "Something went wrong. Please try again.");
}
```

The `{ error: { code, message, fieldErrors } }` body shape is the contract every admin form in Plans 1–3 relies on to render field-level messages (§9).

- [ ] **Step 8: Run the unit suite and typecheck**

Run: `npx vitest run`
Expected: PASS, including the 5 index-spec tests.

Run: `npm run typecheck`
Expected: no errors. If `next/server` is reported missing, run `npm install` again — `next` must be present for its own types.

- [ ] **Step 9: Amend the spec**

In `docs/superpowers/specs/2026-09-24-yca-sumsilui-website-design.md`, remove `SESSION_SECRET` from the secrets list in §8 and from the env-var comment in §11. Add one sentence to §8:

> Session tokens are opaque random values stored only as SHA-256 hashes, so no signing secret is required.

- [ ] **Step 10: Commit**

```bash
git add src/lib tests/unit/index-specs.test.ts docs/superpowers/specs
git commit -m "feat: add env validation, Mongo layer and index specs

One authoritative index definition, asserted by test, so the seed script
and the running app cannot disagree about what is indexed."
```

---

## Task 4: Passwords and sessions

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/users.ts`, `tests/unit/password.test.ts`, `tests/unit/session.test.ts`

**Interfaces:**
- Consumes: `getDb`, `collection`, `COLLECTIONS` (Task 3), `env` (Task 3), types (Task 3).
- Produces:
  - `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`, `PASSWORD_MIN_LENGTH: 10`, `DUMMY_HASH: string`, `generateTemporaryPassword(): string`
  - `SESSION_COOKIE: "yca_session"`, `SESSION_TTL_MS`, `newSessionToken(): string`, `hashToken(token: string): string`, `isSessionLive(input: { expiresAt: Date; active: boolean }, now: Date): boolean`
  - `createSession(userId: ObjectId, userAgent: string | undefined, now?: Date): Promise<{ token: string; expiresAt: Date }>`
  - `resolveSession(token: string, now?: Date): Promise<AuthContext | null>`
  - `destroySession(token: string): Promise<void>`, `destroySessionsForUser(userId: ObjectId): Promise<number>`
  - `findUserByEmail(email: string): Promise<UserDoc | null>`, `findUserById(id: ObjectId): Promise<UserDoc | null>`, `listUsers(): Promise<PublicUser[]>`, `createUser(input): Promise<UserDoc>`, `setUserActive(id, active): Promise<void>`, `setUserRole(id, role): Promise<void>`, `touchLastLogin(id): Promise<void>`, `toPublicUser(doc: UserDoc): PublicUser`

- [ ] **Step 1: Write the failing password tests**

`tests/unit/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DUMMY_HASH,
  PASSWORD_MIN_LENGTH,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

describe("hashPassword", () => {
  it("verifies its own output and rejects a near miss", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery!", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently twice", async () => {
    expect(await hashPassword("aaaaaaaaaa")).not.toEqual(await hashPassword("aaaaaaaaaa"));
  });
});

describe("DUMMY_HASH", () => {
  it("is a real bcrypt string so a missing user still costs a compare", async () => {
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
  });
});

describe("generateTemporaryPassword", () => {
  it("is long enough to satisfy the policy and varies", () => {
    const first = generateTemporaryPassword();
    expect(first.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    expect(new Set(Array.from({ length: 20 }, generateTemporaryPassword)).size).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/password.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/password`.

- [ ] **Step 3: Write `src/lib/auth/password.ts`**

```ts
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

export const PASSWORD_MIN_LENGTH = 10;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Compared against when no user matches the submitted email, so a failed login
 * costs the same whether or not the account exists.
 */
export const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpDLhIuYWkZBqLxGZDk9cQDkPvqJ2";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTemporaryPassword(): string {
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
```

`DUMMY_HASH` must be a genuine bcrypt string of the same cost as production. If it is malformed, `bcrypt.compare` throws early and the timing defence evaporates silently — hence the regex assertion in Step 1.

- [ ] **Step 4: Run the password tests**

Run: `npx vitest run tests/unit/password.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing session tests**

`tests/unit/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  hashToken,
  isSessionLive,
  newSessionToken,
} from "@/lib/auth/session";

describe("token shape", () => {
  it("issues 32 random bytes, url-safe, and never repeats", () => {
    const tokens = new Set(Array.from({ length: 50 }, newSessionToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes deterministically to 64 hex characters", () => {
    const token = newSessionToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  it("names the cookie exactly as the spec requires", () => {
    expect(SESSION_COOKIE).toBe("yca_session");
    expect(SESSION_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});

describe("isSessionLive", () => {
  const now = new Date("2026-09-24T10:00:00.000Z");

  it("accepts a live session for an active user", () => {
    expect(isSessionLive({ expiresAt: new Date(now.getTime() + 1000), active: true }, now)).toBe(true);
  });

  it("rejects exactly at expiry", () => {
    expect(isSessionLive({ expiresAt: now, active: true }, now)).toBe(false);
  });

  it("rejects a session belonging to a deactivated user", () => {
    expect(isSessionLive({ expiresAt: new Date(now.getTime() + 60_000), active: false }, now)).toBe(false);
  });

  it("rejects a session that expired a second ago", () => {
    expect(isSessionLive({ expiresAt: new Date(now.getTime() - 1000), active: true }, now)).toBe(false);
  });
});
```

- [ ] **Step 6: Run to confirm failure**

Run: `npx vitest run tests/unit/session.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/session`.

- [ ] **Step 7: Write `src/lib/auth/session.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/index-specs";
import { collection } from "@/lib/db";
import type { AuthContext, SessionDoc, UserDoc } from "@/lib/types";

export const SESSION_COOKIE = "yca_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSessionLive(input: { expiresAt: Date; active: boolean }, now: Date): boolean {
  return input.active && now.getTime() < input.expiresAt.getTime();
}

export async function createSession(
  userId: ObjectId,
  userAgent: string | undefined,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const doc: SessionDoc = {
    _id: new ObjectId(),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: now,
    userAgent: userAgent?.slice(0, 200),
  };
  await collection<SessionDoc>(COLLECTIONS.sessions).insertOne(doc);
  return { token, expiresAt };
}

export async function resolveSession(token: string, now = new Date()): Promise<AuthContext | null> {
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  const session = await sessions.findOne({ tokenHash: hashToken(token) });
  if (!session) return null;

  const users = await collection<UserDoc>(COLLECTIONS.users);
  const user = await users.findOne({ _id: session.userId });
  if (!user) {
    await sessions.deleteOne({ _id: session._id }).catch(() => undefined);
    return null;
  }
  if (!isSessionLive({ expiresAt: session.expiresAt, active: user.active }, now)) {
    await sessions.deleteOne({ _id: session._id }).catch(() => undefined);
    return null;
  }
  return { user, sessionId: session._id };
}

export async function destroySession(token: string): Promise<void> {
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  await sessions.deleteOne({ tokenHash: hashToken(token) });
}

export async function destroySessionsForUser(userId: ObjectId): Promise<number> {
  const sessions = await collection<SessionDoc>(COLLECTIONS.sessions);
  const result = await sessions.deleteMany({ userId });
  return result.deletedCount;
}
```

Note that `resolveSession` deletes the session row when it finds an expired one or one whose user has gone. Expired rows would otherwise accumulate forever — nothing else removes them, and Atlas M0's 512 MB is not large.

- [ ] **Step 8: Run the session tests**

Run: `npx vitest run tests/unit/session.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 9: Write `src/lib/users.ts`**

```ts
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/index-specs";
import { collection } from "@/lib/db";
import { hashPassword } from "./auth/password";
import type { PublicUser, Role, UserDoc } from "./types";

export function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    active: doc.active,
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
  };
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  return users.findOne({ email: normalizeEmail(email) });
}

export async function findUserById(id: ObjectId): Promise<UserDoc | null> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  return users.findOne({ _id: id });
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  const docs = await users.find({}).sort({ createdAt: 1 }).toArray();
  return docs.map(toPublicUser);
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
  phone?: string;
}): Promise<UserDoc> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  const doc: UserDoc = {
    _id: new ObjectId(),
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password),
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    role: input.role,
    active: true,
    createdAt: new Date(),
  };
  await users.insertOne(doc);
  return doc;
}

export async function setUserActive(id: ObjectId, active: boolean): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { active } });
}

export async function setUserRole(id: ObjectId, role: Role): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { role } });
}

export async function setPassword(id: ObjectId, password: string): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password) } });
}

export async function touchLastLogin(id: ObjectId): Promise<void> {
  const users = await collection<UserDoc>(COLLECTIONS.users);
  await users.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

- [ ] **Step 10: Typecheck, then commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/auth src/lib/users.ts tests/unit/password.test.ts tests/unit/session.test.ts
git commit -m "feat: add bcrypt passwords and hashed session tokens

Tokens are opaque and stored only as hashes, and a missing account still
pays a bcrypt compare so login cannot be used to enumerate emails."
```

---

## Task 5: `requireRole`, CSRF origin check, and login rate limiting

**Files:**
- Create: `src/lib/auth/require-role.ts`, `src/lib/auth/login-attempts.ts`, `src/lib/auth/client-ip.ts`, `tests/unit/require-role.test.ts`, `tests/unit/login-attempts.test.ts`

**Interfaces:**
- Consumes: `resolveSession`, `SESSION_COOKIE` (Task 4), `ApiError`, `fail` (Task 3), `collection`, `COLLECTIONS` (Task 3).
- Produces:
  - `requireRole(request: NextRequest, allowed: readonly Role[], handler: (ctx: AuthContext) => Promise<Response>): Promise<Response>`
  - `isSameOrigin(request: NextRequest): boolean`
  - `canAccess(role: Role, allowed: readonly Role[]): boolean`
  - `attemptKey(email: string, ip: string): string`
  - `computeLock(state: { count: number; firstAt: number } | null, now: number, max: number, windowMs: number): { allowed: boolean; retryAfterSec: number }`
  - `checkLocked(key: string, now?: Date): Promise<{ allowed: boolean; retryAfterSec: number }>`
  - `recordFailure(key: string, now?: Date): Promise<void>`, `clearAttempts(key: string): Promise<void>`
  - `ipOf(request: Request): string`

`requireRole` is the single authorisation gate. Every route handler in Plans 1–4 goes through it; a handler that forgets is the bug this task exists to make impossible.

- [ ] **Step 1: Write the failing authorisation tests**

`tests/unit/require-role.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canAccess, isSameOrigin } from "@/lib/auth/require-role";

describe("canAccess", () => {
  it("grants super_admin every allowlist without naming them", () => {
    expect(canAccess("super_admin", ["treasurer"])).toBe(true);
    expect(canAccess("super_admin", [])).toBe(true);
  });

  it("grants a listed role", () => {
    expect(canAccess("treasurer", ["treasurer"])).toBe(true);
    expect(canAccess("editor", ["editor", "treasurer"])).toBe(true);
  });

  it("refuses an unlisted role", () => {
    expect(canAccess("editor", ["treasurer"])).toBe(false);
    expect(canAccess("treasurer", ["editor"])).toBe(false);
  });
});

function requestWith(headers: Record<string, string>, host = "ycasumsilui.vercel.app") {
  return {
    headers: new Headers(headers),
    nextUrl: new URL(`https://${host}/api/settings`),
  } as never;
}

describe("isSameOrigin", () => {
  it("accepts a matching Origin", () => {
    expect(isSameOrigin(requestWith({ Origin: "https://ycasumsilui.vercel.app" }))).toBe(true);
  });

  it("refuses a cross-site Origin", () => {
    expect(isSameOrigin(requestWith({ Origin: "https://evil.example" }))).toBe(false);
  });

  it("refuses a malformed Origin rather than crashing", () => {
    expect(isSameOrigin(requestWith({ Origin: "not a url" }))).toBe(false);
  });

  it("refuses a mismatched port", () => {
    expect(isSameOrigin(requestWith({ Origin: "https://ycasumsilui.vercel.app:8443" }))).toBe(false);
  });

  it("accepts a request with no Origin, which is a non-browser client", () => {
    expect(isSameOrigin(requestWith({}))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/require-role.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/require-role`.

- [ ] **Step 3: Write `src/lib/auth/require-role.ts`**

```ts
import type { NextRequest } from "next/server";
import { fail } from "@/lib/api-response";
import type { AuthContext, Role } from "@/lib/types";
import { SESSION_COOKIE, resolveSession } from "./session";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function canAccess(role: Role, allowed: readonly Role[]): boolean {
  return role === "super_admin" || allowed.includes(role);
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function requireRole(
  request: NextRequest,
  allowed: readonly Role[],
  handler: (ctx: AuthContext) => Promise<Response>,
): Promise<Response> {
  if (MUTATING.has(request.method) && !isSameOrigin(request)) {
    return fail(403, "csrf", "Cross-site request blocked.");
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return fail(401, "unauthenticated", "Please sign in.");

  const ctx = await resolveSession(token);
  if (!ctx) return fail(401, "session_expired", "Your session has expired. Please sign in again.");
  if (!canAccess(ctx.user.role, allowed)) {
    return fail(403, "forbidden", "Your role does not allow this action.");
  }

  return handler(ctx);
}
```

- [ ] **Step 4: Run the authorisation tests**

Run: `npx vitest run tests/unit/require-role.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Write the failing rate-limit tests**

`tests/unit/login-attempts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { attemptKey, computeLock } from "@/lib/auth/login-attempts";

const WINDOW = 15 * 60 * 1000;
const MAX = 5;

describe("attemptKey", () => {
  it("lowercases the email and keeps the ip", () => {
    expect(attemptKey("Treasurer@YCA.In", "203.0.113.7")).toBe("treasurer@yca.in|203.0.113.7");
  });
});

describe("computeLock", () => {
  it("allows the first attempt", () => {
    expect(computeLock(null, 1_000, MAX, WINDOW)).toEqual({ allowed: true, retryAfterSec: 0 });
  });

  it("allows up to the maximum", () => {
    const state = { count: MAX - 1, firstAt: 1_000 };
    expect(computeLock(state, 2_000, MAX, WINDOW).allowed).toBe(true);
  });

  it("blocks at the maximum and reports the remaining window", () => {
    const state = { count: MAX, firstAt: 0 };
    const result = computeLock(state, 60_000, MAX, WINDOW);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBe(14 * 60);
  });

  it("resets once the window has elapsed", () => {
    const state = { count: MAX, firstAt: 0 };
    expect(computeLock(state, WINDOW, MAX, WINDOW).allowed).toBe(true);
  });

  it("never reports a negative retry", () => {
    const state = { count: MAX, firstAt: 0 };
    expect(computeLock(state, WINDOW + 1, MAX, WINDOW).retryAfterSec).toBe(0);
  });
});
```

- [ ] **Step 6: Run to confirm failure, then write `src/lib/auth/login-attempts.ts`**

Run: `npx vitest run tests/unit/login-attempts.test.ts`
Expected: FAIL — cannot resolve the module.

```ts
import { COLLECTIONS } from "@/lib/index-specs";
import { collection } from "@/lib/db";

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

type AttemptDoc = {
  _id?: ObjectId;
  key: string;
  count: number;
  firstAt: Date;
  expiresAt: Date;
};

export function attemptKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip || "unknown"}`;
}

export function computeLock(
  state: { count: number; firstAt: number } | null,
  now: number,
  max = MAX_ATTEMPTS,
  windowMs = WINDOW_MS,
): { allowed: boolean; retryAfterSec: number } {
  if (!state || state.count < max) return { allowed: true, retryAfterSec: 0 };
  const remaining = state.firstAt + windowMs - now;
  if (remaining <= 0) return { allowed: true, retryAfterSec: 0 };
  return { allowed: false, retryAfterSec: Math.ceil(remaining / 1000) };
}

export async function checkLocked(
  key: string,
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const attempts = await collection<AttemptDoc>(COLLECTIONS.loginAttempts);
  const doc = await attempts.findOne({ key, expiresAt: { $gt: now } });
  if (!doc) return { allowed: true, retryAfterSec: 0 };
  return computeLock({ count: doc.count, firstAt: doc.firstAt.getTime() }, now.getTime());
}

export async function recordFailure(key: string, now = new Date()): Promise<void> {
  const attempts = await collection<AttemptDoc>(COLLECTIONS.loginAttempts);
  const existing = await attempts.findOne({ key, expiresAt: { $gt: now } });
  if (existing) {
    await attempts.updateOne({ key }, { $inc: { count: 1 } });
    return;
  }
  await attempts.updateOne(
    { key },
    { $set: { key, count: 1, firstAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS) } },
    { upsert: true },
  );
}

export async function clearAttempts(key: string): Promise<void> {
  const attempts = await collection<AttemptDoc>(COLLECTIONS.loginAttempts);
  await attempts.deleteOne({ key });
}
```

Add `import { ObjectId } from "mongodb";` at the top of the file alongside the existing imports.

- [ ] **Step 7: Run the rate-limit tests**

Run: `npx vitest run tests/unit/login-attempts.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 8: Write `src/lib/auth/client-ip.ts`**

```ts
export function ipOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth tests/unit/require-role.test.ts tests/unit/login-attempts.test.ts
git commit -m "feat: add requireRole gate, origin check and login throttle

One function decides authorisation for every API route, and super_admin
passes implicitly so a new allowlist cannot accidentally exclude the
account that maintains the site."
```

---

## Task 6: Login, logout, session gate, and the end-to-end harness

**Files:**
- Create: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/components/admin/LoginForm.tsx`, `playwright.config.ts`, `tests/e2e/auth.spec.ts`, `scripts/seed-test-db.ts`, `src/lib/validation/auth.ts`

**Why login is at `/login` and not `/admin/login`:** a nested layout applies to every route beneath it, so a public page inside `/admin` would force the gated layout in Task 7 to inspect the request path and decide whether it applies — one component doing two jobs. Keeping the one public route in the admin chrome out of the `/admin` segment is worth a slightly worse URL.

**Interfaces:**
- Consumes: `requireRole` (Task 5), `createSession`/`resolveSession`/`destroySession` (Task 4), `findUserByEmail`/`touchLastLogin`/`toPublicUser` (Task 4), `checkLocked`/`recordFailure`/`clearAttempts`/`attemptKey` (Task 5), `ipOf` (Task 5), `DUMMY_HASH`/`verifyPassword` (Task 4), `ok`/`fail`/`fromError` (Task 3).
- Produces:
  - `POST /api/auth/login` → `200 { data: { user: PublicUser } }` + `Set-Cookie`, or `401 invalid_credentials`, or `429 rate_limited`
  - `POST /api/auth/logout` → `204`, clears the cookie
  - `GET /api/auth/me` → `200 { data: { user: PublicUser } }` or `401`
  - `LOGIN_SCHEMA: ZodSchema<{ email, password }>`
  - e2e fixtures at `tests/e2e/auth.spec.ts` and the `npm run seed:test` command every later e2e spec depends on

- [ ] **Step 1: Write the login validation schema**

`src/lib/validation/auth.ts`:

```ts
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

export const LOGIN_SCHEMA = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(200, "Password is too long"),
});

export const PASSWORD_SCHEMA = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, "Password is too long");
```

Login deliberately does not enforce `PASSWORD_MIN_LENGTH` — an existing account must remain signable-in after the policy is tightened. Creation and reset do enforce it (Task 9).

- [ ] **Step 2: Write `src/app/api/auth/login/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { fail, fromError, ok } from "@/lib/api-response";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { attemptKey, checkLocked, clearAttempts, recordFailure } from "@/lib/auth/login-attempts";
import { createSession } from "@/lib/auth/session";
import { ipOf } from "@/lib/auth/client-ip";
import { findUserByEmail, toPublicUser, touchLastLogin } from "@/lib/users";
import { env } from "@/lib/env";
import { LOGIN_SCHEMA } from "@/lib/validation/auth";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const parsed = LOGIN_SCHEMA.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, "validation_failed", "Email and password are required.");
    }
    const { email, password } = parsed.data;
    const key = attemptKey(email, ipOf(request));

    const lock = await checkLocked(key);
    if (!lock.allowed) {
      const minutes = Math.ceil(lock.retryAfterSec / 60);
      return fail(429, "rate_limited", `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
    }

    const user = await findUserByEmail(email);
    const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !user.active || !matches) {
      await recordFailure(key);
      return fail(401, "invalid_credentials", "Email or password is incorrect.");
    }

    await clearAttempts(key);
    const { token, expiresAt } = await createSession(user._id, request.headers.get("user-agent") ?? undefined);
    await touchLastLogin(user._id);

    const response = ok({ user: toPublicUser(user) });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    return fromError(error);
  }
}
```

`user?.passwordHash ?? DUMMY_HASH` is the whole enumeration defence in one expression: a wrong email pays a real bcrypt compare, so the response time does not reveal whether the address exists. `!user.active` is checked *after* the compare for the same reason.

- [ ] **Step 3: Write logout and me**

`src/app/api/auth/logout/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { ok } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const response = ok({ signedOut: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
```

`src/app/api/auth/me/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/users";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return fail(401, "unauthenticated", "Please sign in.");
  const ctx = await resolveSession(token);
  if (!ctx) return fail(401, "session_expired", "Your session has expired.");
  return ok({ user: toPublicUser(ctx.user) });
}
```

This handler reads the session directly rather than going through `requireRole`. `requireRole` answers "may this actor perform that action" and takes an allowlist; "who am I" has no allowlist to check, and passing `[]` would mean "super-admin only" — the convention Tasks 8 and 9 rely on — which is wrong for a question every signed-in role asks.

- [ ] **Step 4: Write `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "yca_session";
const LOGIN_PATH = "/login";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;
  const hasSession = Boolean(request.cookies.get(COOKIE)?.value);

  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/login"] };
```

Middleware runs on the Edge runtime, so it cannot reach MongoDB. It only redirects on cookie *presence*; the layout in Task 7 confirms the session actually resolves. A stale cookie therefore lands on `/admin`, fails resolution, and is redirected again — with the cookie cleared — rather than being trusted.

- [ ] **Step 5: Write the login screen**

`src/components/admin/LoginForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not sign in.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="w-full rounded border border-line px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded border border-line px-3 py-2"
        />
      </label>

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
```

`src/app/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl">Office-bearer sign in</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          This area is for YCA office-bearers. The public site is at
          <a href="/" className="ml-1 text-green-700 underline">the home page</a>.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write the Playwright config and test-data seeder**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MONGODB_DB: process.env.MONGODB_DB_TEST ?? "yca_sumsilui_test",
      BCRYPT_ROUNDS: "4",
    },
  },
});
```

`workers: 1` because every spec shares one test database and truncates it.

`scripts/seed-test-db.ts`:

```ts
import "dotenv/config";
import { env } from "../src/lib/env";
import { ensureIndexes, getDb } from "../src/lib/db";
import { createUser, findUserByEmail } from "../src/lib/users";
import { COLLECTIONS } from "../src/lib/index-specs";

export const TEST_USERS = [
  { email: "admin@test.yca.local", name: "Test Admin", role: "super_admin" as const },
  { email: "editor@test.yca.local", name: "Test Editor", role: "editor" as const },
  { email: "treasurer@test.yca.local", name: "Test Treasurer", role: "treasurer" as const },
];

export const TEST_PASSWORD = "branch-test-password";

async function main() {
  if (env.MONGODB_DB !== "yca_sumsilui_test" && !process.env.ALLOW_ANY_DB) {
    throw new Error(`refusing to truncate "${env.MONGODB_DB}" — point MONGODB_DB at yca_sumsilui_test`);
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
```

Scripts import by relative path rather than the `@/` alias so they do not depend on the runner resolving tsconfig paths. No settings document is written here: `getSettings()` already falls back to `DEFAULT_SETTINGS` when none exists, and the specs in Task 8 create what they need.

The refusal to truncate anything but the test database is not paranoia — this script deletes every document in every collection, and it will be run by hand, on a laptop, against a connection string that may point at production.

- [ ] **Step 7: Write the auth e2e spec**

`tests/e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

async function signIn(page: import("@playwright/test").Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
}

test("a correct password reaches the dashboard and a wrong one does not", async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/login");

  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill("definitely-not-the-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toContainText("Email or password is incorrect");
  await expect(page).toHaveURL(/\/login$/);
});

test("an unauthenticated visitor is pushed to the login page", async ({ page }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/login$/);
});

test("the login endpoint refuses a wrong role without leaking the reason", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { email: "nobody@test.yca.local", password: "branch-test-password" },
  });
  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe("invalid_credentials");
});

test("an editor cannot write to the settings endpoint", async ({ page, request }) => {
  await signIn(page, EDITOR);
  const cookie = (await page.context().cookies())[0]?.value;
  const response = await request.patch("/api/settings", {
    headers: { cookie: `yca_session=${cookie}` },
    data: { branchName: "Hijacked" },
  });
  expect(response.status()).toBe(403);
});
```

The last spec is the one that matters most: it proves the server refuses, not merely that the admin UI hides the button.

- [ ] **Step 8: Run the specs and expect the settings spec to fail**

Run: `npm run seed:test` then `npx playwright test tests/e2e/auth.spec.ts`
Expected: the first three specs PASS. The fourth FAILS with `404` or `405` rather than `403`, because `/api/settings` does not exist until Task 8. Leave it failing and note it here — do not delete the assertion.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/auth src/middleware.ts src/app/admin/login src/components/admin/LoginForm.tsx playwright.config.ts tests/e2e/auth.spec.ts scripts/seed-test-db.ts src/lib/validation/auth.ts
git commit -m "feat: add login, logout, session gate and e2e harness

A missing account still pays a bcrypt compare so login cannot enumerate
emails, and the e2e harness truncates only a database explicitly named
yca_sumsilui_test."
```

---

## Task 7: Admin shell and dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/SignOutButton.tsx`, `src/components/admin/AdminSidebar.tsx`, `src/lib/nav.ts`, `src/app/admin/loading.tsx`

**Interfaces:**
- Consumes: `resolveSession`, `SESSION_COOKIE` (Task 4), `canSee` from the new `src/lib/nav.ts`, `listUsers` (Task 4).
- Produces:
  - `NAV_ITEMS: readonly NavItem[]` — the single source of truth for admin navigation
  - `visibleNav(role: Role): NavItem[]` and `canSee(role: Role, allowed: readonly Role[]): boolean`
  - the `AdminLayout` gate that guarantees every `/admin/**` page renders with a live session

- [ ] **Step 1: Write `src/lib/nav.ts`**

```ts
import type { Role } from "@/lib/types";

export type NavItem = {
  href: string;
  label: string;
  roles: readonly Role[];
  availableInPlan: number;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Dashboard", roles: ["editor", "treasurer"], availableInPlan: 1 },
  { href: "/admin/notices", label: "Notices & press releases", roles: ["editor", "treasurer"], availableInPlan: 2 },
  { href: "/admin/members", label: "Members", roles: ["editor", "treasurer"], availableInPlan: 2 },
  { href: "/admin/works", label: "Works & progress", roles: ["editor", "treasurer"], availableInPlan: 2 },
  { href: "/admin/gallery", label: "Gallery", roles: ["editor", "treasurer"], availableInPlan: 2 },
  { href: "/admin/finance", label: "Finance", roles: ["treasurer"], availableInPlan: 3 },
  { href: "/admin/donations", label: "Donations", roles: ["treasurer"], availableInPlan: 3 },
  { href: "/admin/settings", label: "Settings", roles: [], availableInPlan: 1 },
  { href: "/admin/users", label: "Users", roles: [], availableInPlan: 1 },
];

export function canSee(role: Role, allowed: readonly Role[]): boolean {
  return role === "super_admin" || allowed.includes(role);
}

export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.availableInPlan <= 1 && canSee(role, item.roles),
  );
}
```

`roles: []` means **super-admin only**, matching what `requireRole` does with an empty allowlist — one convention across the nav table and the API, so nobody has to remember which file reads an empty list the other way. `availableInPlan` keeps the roadmap visible in the code: an editor's sidebar grows as each plan lands without anyone re-deciding who may see what.

- [ ] **Step 2: Write the gated layout**

`src/app/admin/layout.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SignOutButton } from "./SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const ctx = token ? await resolveSession(token) : null;

  if (!ctx) {
    return (
      <div className="container-page flex min-h-[60vh] items-center justify-center">
        <p className="text-ink-muted">
          Your session has ended. <Link href="/login" className="text-green-700 underline">Sign in again</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-[200px_1fr]">
      <aside>
        <AdminSidebar role={ctx.user.role} name={ctx.user.name} />
      </aside>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <p className="text-sm text-ink-muted">
            Signed in as <span className="font-medium text-ink">{ctx.user.name}</span>
            <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-900">{ctx.user.role}</span>
          </p>
          <SignOutButton />
        </div>
        {children}
      </div>
    </div>
  );
}
```

`src/components/admin/AdminSidebar.tsx`:

```tsx
import Link from "next/link";
import { visibleNav } from "@/lib/nav";
import type { Role } from "@/lib/types";

export function AdminSidebar({ role, name }: { role: Role; name: string }) {
  const items = visibleNav(role);
  return (
    <nav aria-label="Admin">
      <p className="mb-3 font-display text-sm text-green-900">Br. YCA Sumsilui</p>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded px-2 py-1.5 hover:bg-green-100">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-2 text-xs text-ink-muted">Signed in: {name}</p>
    </nav>
  );
}
```

`src/app/admin/SignOutButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded border border-line px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
    >
      Sign out
    </button>
  );
}
```

`src/app/admin/loading.tsx`:

```tsx
export default function AdminLoading() {
  return <div className="h-64 animate-pulse rounded-lg bg-green-100" aria-label="Loading" />;
}
```

- [ ] **Step 3: Write the dashboard**

`src/app/admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/users";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
  if (!ctx) return null;

  const [users, settings] = await Promise.all([listUsers(), getSettings()]);
  const missing = [
    settings.branchName ? null : "branch name",
    settings.addressLine ? null : "address",
    settings.phone ? null : "phone",
    settings.email ? null : "email",
    settings.accountNumber ? null : "bank account details",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-3xl font-semibold text-green-700">{users.length}</p>
          <p className="text-sm text-ink-muted">Admin accounts</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">0</p>
          <p className="text-sm text-ink-muted">Notices published</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold text-green-700">0</p>
          <p className="text-sm text-ink-muted">Ongoing works</p>
        </Card>
      </div>

      {missing.length > 0 ? (
        <Card className="border-red-700/30 bg-red-100">
          <h2 className="text-base text-red-700">Still to complete</h2>
          <p className="mt-1 text-sm">
            These details appear on the public site and are still blank: {missing.join(", ")}.
            Fill them in under Settings.
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-base">What is ready now</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Sign-in, site settings and user accounts. Notices, members, works and the gallery come in
          the next build phase; the ledger and published finances after that.
        </p>
      </Card>
    </div>
  );
}
```

The two zero counters are honest placeholders with labels that will be replaced by real queries in Plans 2 and 3 — not fake numbers, which would be worse on a finance site.

- [ ] **Step 4: Run the e2e auth specs again**

Run: `npm run seed:test && npx playwright test tests/e2e/auth.spec.ts`
Expected: the three auth specs PASS with the `/login` paths. The editor-settings spec still FAILS (`404` not `403`).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin src/components/admin src/lib/nav.ts
git commit -m "feat: add role-filtered admin shell and dashboard

Login lives at /login so the gated /admin layout never has to decide
whether it applies, and the sidebar is derived from one nav table that
carries each section's build phase."
```

---

## Task 8: Settings — the branch's own words and bank details

**Files:**
- Create: `src/lib/settings.ts`, `src/app/api/settings/route.ts`, `src/app/admin/settings/page.tsx`, `src/components/admin/SettingsForm.tsx`, `tests/unit/settings.test.ts`
- Modify: `src/components/site/SiteFooter.tsx` (consume settings), `tests/e2e/settings.spec.ts` (create)

**Interfaces:**
- Consumes: `collection`, `COLLECTIONS` (Task 3), `ApiError`/`ok`/`fail` (Task 3), `requireRole` (Task 5), `toObjectId` (Task 3), `SettingsDoc` (Task 3).
- Produces:
  - `DEFAULT_SETTINGS: SettingsValues`
  - `SETTINGS_SCHEMA: ZodType<SettingsValues>`
  - `getSettings(): Promise<SettingsValues>` — never throws on a missing document
  - `upsertSettings(values: SettingsValues, byId?: ObjectId | null): Promise<SettingsValues>`
  - `SettingsValues` interface
  - `GET /api/settings` (any signed-in role) and `PATCH /api/settings` (super_admin only)

- [ ] **Step 1: Write the failing settings tests**

`tests/unit/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA } from "@/lib/settings";

describe("SETTINGS_SCHEMA", () => {
  it("accepts the shipped defaults", () => {
    expect(() => SETTINGS_SCHEMA.parse(DEFAULT_SETTINGS)).not.toThrow();
  });

  it("rejects a blank branch name", () => {
    const result = SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchName: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email, URL and UPI id", () => {
    for (const [field, value] of [
      ["email", "not-an-email"],
      ["facebookUrl", "javascript:alert(1)"],
      ["upiId", "!!broken!!"],
    ] as const) {
      expect(SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, [field]: value }).success).toBe(false);
    }
  });

  it("accepts an empty contact field, because a branch may not have one yet", () => {
    expect(SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, whatsappNumber: "" }).success).toBe(true);
  });

  it("clamps the founding year to a plausible range", () => {
    expect(SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchFoundedYear: 1899 }).success).toBe(false);
    expect(SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchFoundedYear: 3000 }).success).toBe(false);
    expect(SETTINGS_SCHEMA.safeParse({ ...DEFAULT_SETTINGS, branchFoundedYear: null }).success).toBe(true);
  });

  it("strips whitespace from every text field", () => {
    const parsed = SETTINGS_SCHEMA.parse({ ...DEFAULT_SETTINGS, branchName: "  Br. YCA Sumsilui  " });
    expect(parsed.branchName).toBe("Br. YCA Sumsilui");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/settings.test.ts`
Expected: FAIL — cannot resolve `@/lib/settings`.

- [ ] **Step 3: Write `src/lib/settings.ts`**

```ts
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collection } from "@/lib/db";
import { COLLECTIONS } from "@/lib/index-specs";
import type { SettingsDoc } from "@/lib/types";

const trimmed = (max: number) => z.string().trim().max(max);

export const SETTINGS_SCHEMA = z.object({
  branchName: z.string().trim().min(1, "Branch name is required").max(120),
  registrationNo: trimmed(60),
  branchFoundedYear: z.number().int().min(1900).max(2100).nullable(),
  addressLine: trimmed(200),
  district: trimmed(60),
  state: trimmed(60),
  phone: trimmed(20),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address")]),
  facebookUrl: z.union([
    z.literal(""),
    z.string().trim().url("Enter a full URL").refine((v) => /^https:\/\/([\w.-]+\.)?facebook\.com\//.test(v), {
      message: "Use an https://facebook.com link",
    }),
  ]),
  whatsappNumber: trimmed(20),
  aboutText: trimmed(4000),
  missionText: trimmed(2000),
  bankName: trimmed(80),
  bankBranch: trimmed(80),
  accountNumber: trimmed(30),
  ifsc: trimmed(15),
  upiId: z.union([
    z.literal(""),
    z.string().trim().regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, "Use the name@bank UPI form"),
  ]),
  footerNote: trimmed(300),
});

export type SettingsValues = z.infer<typeof SETTINGS_SCHEMA>;

export const DEFAULT_SETTINGS: SettingsValues = {
  branchName: "Young Chakma Association, Sumsilui Branch",
  registrationNo: "",
  branchFoundedYear: null,
  addressLine: "",
  district: "Lawngtlai",
  state: "Mizoram",
  phone: "",
  email: "",
  facebookUrl: "",
  whatsappNumber: "",
  aboutText: "",
  missionText: "",
  bankName: "",
  bankBranch: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  footerNote: "",
};

export async function getSettings(): Promise<SettingsValues> {
  const settings = await collection<SettingsDoc>(COLLECTIONS.settings);
  const doc = await settings.findOne({ key: "site" });
  if (!doc) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...pickValues(doc) };
}

export async function upsertSettings(
  values: SettingsValues,
  byId: ObjectId | null = null,
): Promise<SettingsValues> {
  const parsed = SETTINGS_SCHEMA.parse(values);
  const settings = await collection<SettingsDoc>(COLLECTIONS.settings);
  await settings.updateOne(
    { key: "site" },
    { $set: { ...parsed, key: "site", updatedAt: new Date(), updatedById: byId } },
    { upsert: true },
  );
  return parsed;
}

function pickValues(doc: SettingsDoc): SettingsValues {
  const { _id, key, updatedAt, updatedById, ...rest } = doc;
  void _id;
  void key;
  void updatedAt;
  void updatedById;
  return rest as SettingsValues;
}
```

`facebookUrl` is validated against an https Facebook pattern because it is rendered as a link in the public footer; a stored `javascript:` URL becomes an XSS vector the moment someone pastes it in.

- [ ] **Step 4: Run the settings tests**

Run: `npx vitest run tests/unit/settings.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Write `src/app/api/settings/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { fail, fromError, ok } from "@/lib/api-response";
import { getSettings, SETTINGS_SCHEMA, upsertSettings } from "@/lib/settings";
import { toObjectId } from "@/lib/mongo-oid";

export async function GET(request: NextRequest) {
  try {
    return requireRole(request, ["editor", "treasurer"], async () => ok({ settings: await getSettings() }));
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    return requireRole(request, [], async ({ user }) => {
      const body = await request.json().catch(() => null);
      const parsed = SETTINGS_SCHEMA.safeParse(body);
      if (!parsed.success) {
        const fieldErrors = Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join(".") || "form", issue.message]),
        );
        return fail(400, "validation_failed", "Some fields need attention", fieldErrors);
      }
      const saved = await upsertSettings(parsed.data, toObjectId(user._id));
      return ok({ settings: saved });
    });
  } catch (error) {
    return fromError(error);
  }
}
```

The empty allowlist on `PATCH` is the convention from Task 7's `canSee`: an empty list means super-admin only, because `canAccess` admits `super_admin` implicitly and everyone else by membership. It is exactly the rule §8 sets for settings.

- [ ] **Step 6: Write the settings form and screen**

`src/components/admin/SettingsForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SettingsValues } from "@/lib/settings";

type TextKey = Exclude<keyof SettingsValues, "branchFoundedYear">;

const TEXT_FIELDS: { name: TextKey; label: string; hint?: string; multiline?: boolean }[] = [
  { name: "branchName", label: "Branch name" },
  { name: "registrationNo", label: "Registration number", hint: "Societies Registration Act number, if registered" },
  { name: "addressLine", label: "Office address" },
  { name: "district", label: "District" },
  { name: "state", label: "State" },
  { name: "phone", label: "Office phone" },
  { name: "email", label: "Email" },
  { name: "whatsappNumber", label: "WhatsApp number", hint: "With country code, e.g. 919876543210" },
  { name: "facebookUrl", label: "Facebook page", hint: "https://facebook.com/..." },
  { name: "aboutText", label: "About the branch", multiline: true },
  { name: "missionText", label: "Mission and objectives", multiline: true },
  { name: "bankName", label: "Bank name" },
  { name: "bankBranch", label: "Branch" },
  { name: "accountNumber", label: "Account number" },
  { name: "ifsc", label: "IFSC" },
  { name: "upiId", label: "UPI ID", hint: "name@bank" },
  { name: "footerNote", label: "Footer note" },
];

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof SettingsValues>(name: K, value: SettingsValues[K]) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setErrors({});
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus("idle");
      setErrors(body?.error?.fieldErrors ?? { form: body?.error?.message ?? "Could not save." });
      return;
    }
    setStatus("saved");
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      {errors.form ? <p role="alert" className="text-sm text-red-700">{errors.form}</p> : null}

      {TEXT_FIELDS.map((field) => (
        <label key={field.name} className="block text-sm">
          <span className="mb-1 block font-medium">{field.label}</span>
          {field.multiline ? (
            <textarea
              rows={4}
              value={values[field.name]}
              onChange={(e) => set(field.name, e.target.value)}
              className="w-full rounded border border-line px-3 py-2"
            />
          ) : (
            <input
              value={values[field.name]}
              onChange={(e) => set(field.name, e.target.value)}
              className="w-full rounded border border-line px-3 py-2"
            />
          )}
          {errors[field.name] ? <span className="text-red-700">{errors[field.name]}</span> : null}
          {field.hint ? <span className="block text-xs text-ink-muted">{field.hint}</span> : null}
        </label>
      ))}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Branch founded year</span>
        <input
          type="number"
          min={1900}
          max={2100}
          value={values.branchFoundedYear ?? ""}
          onChange={(e) => set("branchFoundedYear", e.target.value === "" ? null : Number(e.target.value))}
          className="w-32 rounded border border-line px-3 py-2"
        />
        {errors.branchFoundedYear ? <span className="text-red-700">{errors.branchFoundedYear}</span> : null}
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving" : "Save settings"}
        </Button>
        {status === "saved" ? <span className="text-sm text-green-700" role="status">Saved.</span> : null}
      </div>
    </form>
  );
}
```

`TextKey` exists because `branchFoundedYear` is the one non-string field. Listing every key as `keyof SettingsValues` would make the value type `string | number | null` and the text inputs would not type-check — which is exactly the kind of thing that gets "fixed" with a cast and then quietly accepts a string year.

`src/app/admin/settings/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div>
      <h1 className="text-2xl">Settings</h1>
      <p className="mt-1 mb-6 text-sm text-ink-muted">
        These values appear on the public contact, donate and about pages, and in the footer.
        Only a super-admin can change them.
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
```

This page renders for any signed-in role and does not re-check `super_admin`. That is deliberate: the read is harmless, `PATCH /api/settings` is the enforcement point, and re-resolving the session here would duplicate the gate the layout already runs. Plan 4 decides whether non-super-admins should see the screen at all.

- [ ] **Step 7: Make the footer consume settings**

Replace `src/components/site/SiteFooter.tsx`:

```tsx
import Link from "next/link";
import { getSettings } from "@/lib/settings";

export async function SiteFooter() {
  const settings = await getSettings();
  const parts = [settings.addressLine, settings.district, settings.state].filter(Boolean);

  return (
    <footer className="mt-16 bg-green-900 text-white">
      <div className="container-page grid gap-8 py-8 text-sm md:grid-cols-3">
        <div>
          <p className="font-display text-base">Young Chakma Association</p>
          <p className="mt-1 text-white/80">{settings.branchName}</p>
          {settings.registrationNo ? <p className="mt-1 text-white/60">Reg. {settings.registrationNo}</p> : null}
        </div>
        <div>
          <p className="font-medium">Contact</p>
          {parts.length ? <address className="mt-1 not-italic text-white/80">{parts.join(", ")}</address> : null}
          {settings.phone ? <p className="mt-1 text-white/80">Phone: {settings.phone}</p> : null}
          {settings.email ? (
            <p className="mt-1">
              <a href={`mailto:${settings.email}`} className="text-white underline">{settings.email}</a>
            </p>
          ) : null}
          {settings.facebookUrl ? (
            <p className="mt-1">
              <a href={settings.facebookUrl} className="text-white underline" rel="me noreferrer" target="_blank">
                Facebook
              </a>
            </p>
          ) : null}
        </div>
        <div>
          <p className="font-medium">Records</p>
          <p className="mt-1 text-white/80">{settings.footerNote || "Financial records are published in public view."}</p>
          <p className="mt-1">
            <Link href="/finance" className="text-white underline">View finances</Link>
          </p>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page py-4 text-xs text-white/60">
          &copy; {new Date().getFullYear()} {settings.branchName}
        </div>
      </div>
    </footer>
  );
}
```

The footer is now an async server component reading MongoDB, so the home page is dynamic. That is the correct trade for a site whose purpose is publishing current records — and it is why `loading.tsx` exists.

- [ ] **Step 8: Write the settings e2e spec**

`tests/e2e/settings.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };

async function signInAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");
}

test("a saved phone number appears in the public footer", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel(/office phone/i).fill("9138765432");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/");
  await expect(page.locator("footer")).toContainText("9138765432");
});

test("an invalid email is refused with a field message", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/settings");
  await page.getByLabel(/^email$/i).fill("nope");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
});
```

- [ ] **Step 9: Run the suite**

Run: `npm run seed:test && npx playwright test tests/e2e/settings.spec.ts tests/e2e/auth.spec.ts`
Expected: all PASS, including the editor-forbidden spec from Task 6 that was failing on `404`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/settings.ts src/app/api/settings src/app/admin/settings src/components/admin/SettingsForm.tsx src/components/site/SiteFooter.tsx tests
git commit -m "feat: add site settings with super-admin-only writes

Branch contact and bank details live in the database so a corrected phone
number does not need a deploy, and the Facebook field is URL-pattern
validated because the footer renders it as a link."
```

---

## Task 9: Users — inviting office-bearers and cutting them off

**Files:**
- Create: `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/admin/users/page.tsx`, `src/components/admin/UsersTable.tsx`, `src/components/admin/InviteUserForm.tsx`, `tests/e2e/users.spec.ts`, `src/lib/validation/users.ts`

**Interfaces:**
- Consumes: `requireRole` (Task 5), `createUser`/`listUsers`/`setUserActive`/`setUserRole`/`generateTemporaryPassword` (Tasks 4–5), `ApiError`/`ok`/`fail` (Task 3), `ROLES` (Task 3).
- Produces:
  - `GET /api/users` → `{ data: { users: PublicUser[] } }` (super_admin)
  - `POST /api/users` → `{ data: { user: PublicUser, temporaryPassword: string } }` (super_admin)
  - `PATCH /api/users/[id]` → `{ data: { user: PublicUser } }`, body `{ active?: boolean, role?: Role }` (super_admin)
  - `INVITE_SCHEMA`

- [ ] **Step 1: Write `src/lib/validation/users.ts`**

```ts
import { z } from "zod";
import type { Role } from "@/lib/types";
import { PASSWORD_SCHEMA } from "./auth";

/**
 * Spelled out rather than `z.enum(ROLES)`: zod wants a mutable tuple and
 * `ROLES` in src/lib/types.ts is `as const`, so passing it is a type error.
 * The check below is what keeps the two lists from drifting apart silently.
 */
export const ROLE_SCHEMA = z.enum(["super_admin", "editor", "treasurer"]);

type RoleDrift = Role extends z.infer<typeof ROLE_SCHEMA> ? true : false;
const rolesAgree: RoleDrift = true;
void rolesAgree;

export const INVITE_SCHEMA = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  name: z.string().trim().min(2, "Enter the full name").max(80),
  role: ROLE_SCHEMA,
  phone: z.string().trim().max(20).optional(),
  password: PASSWORD_SCHEMA.optional(),
});

export const USER_PATCH_SCHEMA = z
  .object({
    active: z.boolean().optional(),
    role: ROLE_SCHEMA.optional(),
  })
  .refine((value) => value.active !== undefined || value.role !== undefined, {
    message: "Nothing to change",
  });
```

`Role extends z.infer<typeof ROLE_SCHEMA>` is a compile-time drift check: if someone adds a fourth role to `src/lib/types.ts` and forgets this file, `npm run typecheck` fails on that line instead of the new role being silently unassignable through the API.

- [ ] **Step 2: Write `src/app/api/users/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { ApiError, fail, fromError, ok } from "@/lib/api-response";
import { generateTemporaryPassword } from "@/lib/auth/password";
import { createUser, findUserByEmail, listUsers, toPublicUser } from "@/lib/users";
import { INVITE_SCHEMA } from "@/lib/validation/users";

export async function GET(request: NextRequest) {
  try {
    return requireRole(request, [], async () => ok({ users: await listUsers() }));
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return requireRole(request, [], async () => {
      const parsed = INVITE_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        const fieldErrors = Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join(".") || "form", issue.message]),
        );
        return fail(400, "validation_failed", "Some fields need attention", fieldErrors);
      }
      const { email, name, role, phone, password } = parsed.data;
      if (await findUserByEmail(email)) {
        return fail(409, "duplicate_email", "That email already has an account.");
      }
      const temporaryPassword = password ?? generateTemporaryPassword();
      const created = await createUser({ email, name, role, phone, password: temporaryPassword });
      return ok({ user: toPublicUser(created), temporaryPassword });
    });
  } catch (error) {
    return fromError(error);
  }
}
```

The temporary password is returned in the response body and never stored in plain text — the super-admin reads it once on screen and passes it to the new office-bearer in person. Emailing a password from a free-tier SMTP would be worse.

Both handlers pass `[]` as the allowlist. That is the settings-route pattern from Task 8: an empty list admits only `super_admin`, because `canAccess` grants it implicitly and refuses everyone else. It reads as an accident at the call site, so leave the comment `// [] = super_admin only` on each one.

- [ ] **Step 3: Write `src/app/api/users/[id]/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { fail, fromError, ok } from "@/lib/api-response";
import { destroySessionsForUser } from "@/lib/auth/session";
import { findUserById, setUserActive, setUserRole, toPublicUser } from "@/lib/users";
import { requireObjectId } from "@/lib/mongo-oid";
import { USER_PATCH_SCHEMA } from "@/lib/validation/users";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return requireRole(request, [], async ({ user: actor }) => {
      const targetId = requireObjectId(id);
      const parsed = USER_PATCH_SCHEMA.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return fail(400, "validation_failed", "Some fields need attention");

      if (targetId.equals(actor._id)) {
        return fail(409, "self_change", "You cannot change your own role or deactivate yourself.");
      }

      const target = await findUserById(targetId);
      if (!target) return fail(404, "not_found", "No such account.");

      if (parsed.data.role) await setUserRole(targetId, parsed.data.role);
      if (parsed.data.active === false) {
        await setUserActive(targetId, false);
        await destroySessionsForUser(targetId);
      }
      if (parsed.data.active === true) await setUserActive(targetId, true);

      const updated = await findUserById(targetId);
      return ok({ user: toPublicUser(updated!) });
    });
  } catch (error) {
    return fromError(error);
  }
}
```

Two rules worth their cost: an admin cannot lock themselves out of the only super-admin account, and deactivation destroys sessions so the cut-off takes effect on the target's next request rather than up to fourteen days later.

- [ ] **Step 4: Write the users screen**

`src/components/admin/InviteUserForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string }[] = [
  { value: "editor", label: "Editor — notices, members, works, gallery" },
  { value: "treasurer", label: "Treasurer — also finance entries" },
  { value: "super_admin", label: "Super-admin — everything including users" },
];

export function InviteUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "editor" as Role });
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      const first = body?.error?.fieldErrors
        ? Object.values(body.error.fieldErrors)[0]
        : body?.error?.message;
      setError(first ?? "Could not create the account.");
      return;
    }
    setResult({ email: body.data.user.email, temporaryPassword: body.data.temporaryPassword });
    setForm({ name: "", email: "", role: "editor" });
    onCreated();
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-3">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Full name</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded border border-line px-3 py-2" required />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded border border-line px-3 py-2" required />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Role</span>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="w-full rounded border border-line px-3 py-2">
          {ROLES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>

      <Button type="submit" disabled={busy}>{busy ? "Creating" : "Create account"}</Button>

      {result ? (
        <div className="rounded border border-line bg-paper-alt p-3 text-sm" role="status">
          <p className="font-medium">Temporary password for {result.email}</p>
          <p className="mt-1 font-mono text-base">{result.temporaryPassword}</p>
          <p className="mt-1 text-ink-muted">
            Hand this to the person directly. It is shown once and cannot be recovered — create a new
            one by resetting the account if it is lost.
          </p>
        </div>
      ) : null}
    </form>
  );
}
```

`src/components/admin/UsersTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { PublicUser, Role } from "@/lib/types";

export function UsersTable({ users, currentUserId, onChange }: {
  users: PublicUser[];
  currentUserId: string;
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: { active?: boolean; role?: Role }) {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!response.ok) {
      const parsed = await response.json().catch(() => null);
      setError(parsed?.error?.message ?? "Could not update that account.");
      return;
    }
    onChange();
  }

  return (
    <div>
      {error ? <p role="alert" className="mb-3 text-sm text-red-700">{error}</p> : null}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="py-2">Name</th>
            <th scope="col" className="py-2">Email</th>
            <th scope="col" className="py-2">Role</th>
            <th scope="col" className="py-2">Last sign-in</th>
            <th scope="col" className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <tr key={user.id} className="border-b border-line/60">
                <td className="py-2">{user.name}{isSelf ? <span className="ml-1 text-xs text-ink-muted">(you)</span> : null}</td>
                <td className="py-2">{user.email}</td>
                <td className="py-2">
                  <select
                    value={user.role}
                    disabled={isSelf || busyId === user.id}
                    onChange={(e) => patch(user.id, { role: e.target.value as Role })}
                    className="rounded border border-line px-2 py-1"
                  >
                    <option value="editor">editor</option>
                    <option value="treasurer">treasurer</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                </td>
                <td className="py-2 text-ink-muted">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-IN") : "never"}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    disabled={isSelf || busyId === user.id}
                    onClick={() => patch(user.id, { active: !user.active })}
                    className="rounded border border-line px-2 py-1 text-green-700 hover:bg-green-100 disabled:opacity-40"
                  >
                    {user.active ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`src/app/admin/users/page.tsx`:

```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { listUsers } from "@/lib/users";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import { UsersTable } from "@/components/admin/UsersTable";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

export default async function UsersPage() {
  const store = await cookies();
  const ctx = await resolveSession(store.get(SESSION_COOKIE)?.value ?? "");
  if (!ctx) return null;

  const users = await listUsers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Deactivating an account signs it out immediately. You cannot change your own role or
          deactivate yourself.
        </p>
      </div>
      <UsersTable users={users} currentUserId={ctx.user._id.toHexString()} onChange={() => window.location.reload()} />
      <div>
        <h2 className="text-lg">Invite an office-bearer</h2>
        <div className="mt-3">
          <InviteUserForm onCreated={() => window.location.reload()} />
        </div>
      </div>
    </div>
  );
}
```

`window.location.reload()` is a deliberate blunt instrument for a table this small; a router-refresh-based optimistic update would be more code than the feature deserves.

- [ ] **Step 5: Write the users e2e spec**

`tests/e2e/users.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@test.yca.local", password: "branch-test-password" };
const EDITOR = { email: "editor@test.yca.local", password: "branch-test-password" };

test("a super-admin creates an account that can then sign in", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");

  await page.goto("/admin/users");
  await page.getByLabel(/full name/i).fill("New Executive Member");
  await page.getByLabel(/^email$/i).fill("newmember@test.yca.local");
  await page.getByRole("button", { name: /create account/i }).click();

  const panel = page.getByRole("status").filter({ hasText: "Temporary password" });
  await expect(panel).toBeVisible();
  const password = (await panel.locator(".font-mono").innerText()).trim();
  expect(password.length).toBeGreaterThanOrEqual(10);

  await page.goto("/admin");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL("**/login");

  const response = await request.post("/api/auth/login", {
    data: { email: "newmember@test.yca.local", password },
  });
  expect(response.ok()).toBeTruthy();
});

test("an editor cannot list users", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EDITOR.email);
  await page.getByLabel(/password/i).fill(EDITOR.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");

  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "yca_session")?.value;
  const response = await request.get("/api/users", {
    headers: { cookie: `yca_session=${token}` },
  });
  expect(response.status()).toBe(403);
});

test("deactivating an account ends its session at once", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/admin");

  const editorLogin = await request.post("/api/auth/login", { data: EDITOR });
  const editorToken = editorLogin.headers()["set-cookie"]?.match(/yca_session=([^;]+)/)?.[1];
  expect(editorToken).toBeTruthy();

  const before = await request.get("/api/auth/me", { headers: { cookie: `yca_session=${editorToken}` } });
  expect(before.status()).toBe(200);

  await page.goto("/admin/users");
  await page.getByRole("row", { name: /Test Editor/ }).getByRole("button", { name: /deactivate/i }).click();
  await expect(page.getByText(/Test Editor/)).toBeVisible();

  const after = await request.get("/api/auth/me", { headers: { cookie: `yca_session=${editorToken}` } });
  expect(after.status()).toBe(401);
});
```

This spec is the one that proves deactivation is immediate rather than eventual: the same token that returned `200` returns `401` one request after the button is clicked, because `PATCH /api/users/[id]` destroyed the session row.

- [ ] **Step 6: Run everything**

Run: `npm run seed:test && npx playwright test`
Expected: PASS across `auth`, `settings`, `users`.

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all green; build reports `/admin/*` as dynamic.

- [ ] **Step 7: Verify in the browser**

Run `npm run dev`, then by hand: sign in as the seeded super-admin, invite an editor, copy the temporary password, sign out, sign in as that editor, and confirm the sidebar shows no Users or Settings entries. Confirm that typing `/admin/users` as the editor is refused by the API even though the page still renders its shell — and note whether that is acceptable. It is, for Plan 1: the table would be empty and every action 403s. Locking the page itself out is Plan 4's job.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/users src/app/admin/users src/components/admin src/lib/validation/users.ts tests/e2e/users.spec.ts
git commit -m "feat: add user invitations, roles and immediate deactivation

Deactivation destroys the account's sessions so a departing office-bearer
loses access on their next request, and self-demotion is blocked so the
last super-admin cannot be locked out by accident."
```

---

## Task 10: Seed script, environment template, and deployment instructions

**Files:**
- Create: `scripts/seed.ts`, `README.md`, `docs/deployment.md`
- Modify: `package.json` (confirm `seed` script), `.env.example` (add `MONGODB_DB_TEST`)

**Interfaces:**
- Consumes: `ensureIndexes`, `getDb` (Task 3), `createUser`, `findUserByEmail` (Task 4), `DEFAULT_SETTINGS`, `upsertSettings` (Task 8).
- Produces: `npm run seed`, and the written steps that make the client's Atlas and Cloudinary accounts usable.

- [ ] **Step 1: Write `scripts/seed.ts`**

```ts
import "dotenv/config";
import { env } from "../src/lib/env";
import { ensureIndexes } from "../src/lib/db";
import { createUser, findUserByEmail } from "../src/lib/users";
import { DEFAULT_SETTINGS, upsertSettings } from "../src/lib/settings";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local before seeding.");
  }
  if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
  }
  if (env.MONGODB_DB === "yca_sumsilui_test") {
    throw new Error("This is the test database. Use npm run seed:test instead.");
  }

  console.log(`seeding "${env.MONGODB_DB}"`);
  const created = await ensureIndexes();
  console.log(`  ${created.length} indexes ensured`);

  await upsertSettings(DEFAULT_SETTINGS);
  console.log("  settings document ready");

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
```

`upsertSettings(DEFAULT_SETTINGS)` creates the document but does not overwrite values an admin has already entered — `$set` on the same defaults is a no-op. Indexes come only from `ensureIndexes()`, so there is exactly one place that decides what is indexed.

The guard against seeding the test database exists because both scripts are one keystroke apart and one of them deletes documents.

- [ ] **Step 2: Run it against the real cluster**

Run: `npm run seed`
Expected: `seeding "yca_sumsilui"`, an index count, `settings document ready`, `created super_admin …`.

Run it a second time.
Expected: `already exists — nothing to create`, exit 0. Seeding must be safe to repeat.

- [ ] **Step 3: Sign in with the seeded account**

Run `npm run dev`, open `/login`, sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Expected: dashboard with 1 admin account and the "Still to complete" panel listing address, phone, email and bank details. Fill in the branch name and phone, save, and confirm the value appears in the public footer at `/`.

- [ ] **Step 4: Write `docs/deployment.md`**

Write it as numbered click-by-click steps for a reader who has never used these services. It must cover, in this order:

**MongoDB Atlas**
1. Sign up at mongodb.com/cloud/atlas, choose the **M0 Free** cluster, region `ap-south-1 (Mumbai)` — the closest to Mizoram, and the difference in query latency on a slow connection is the most noticeable thing in this list.
2. Create a database user with a password containing no characters that need URL-encoding (`@ : / ? # [ ]`). The connection string breaks otherwise and the error message does not say so.
3. Network access: add `0.0.0.0/0`. State plainly in the doc why — Vercel's serverless egress IPs are not fixed on the Hobby plan — and that the compensating control is a dedicated database user whose password appears nowhere but `MONGODB_URI`.
4. Copy the **Connect → Drivers** string, replace `<password>`, put it in `.env.local` as `MONGODB_URI`.
5. Run `npm run seed` once. It creates the collections and indexes; nothing else does.

**Cloudinary** (needed from Plan 2; set it up now so the env vars are complete)
1. Sign up free, note the **Cloud name**.
2. Generate an API key and secret.
3. Settings → **Upload** → delivery type must stay `authenticated`. An unsigned preset would let anyone on the internet write into the branch's photo library.
4. Put all three in `.env.local`.

**Vercel**
1. Push the repository to GitHub.
2. Import the repo; framework is detected as Next.js; build command `npm run build`, output default.
3. Project → Settings → Environment Variables: add `MONGODB_URI`, `MONGODB_DB`, `BCRYPT_ROUNDS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` for Production, Preview and Development.
4. Deploy, then run `npm run seed` locally once against the production database.
5. Check the deployed `/login` works and that `/api/auth/me` returns `401` when signed out.

**After any change to `INDEX_SPECS`**
Run `npm run seed` again. Indexes are created idempotently and a missing one shows up as a slow listing, not an error, so it is easy to forget.

- [ ] **Step 5: Write `README.md`**

```markdown
# Br. YCA Sumsilui

Website of the Sumsilui branch of the Young Chakma Association, Mizoram.
Public notices, work progress and financial records; admin area for office-bearers.

## Before you start

- Node 18.18+
- A MongoDB Atlas M0 cluster — see `docs/deployment.md`
- A Cloudinary account (needed from Plan 2)

## Local setup

    npm install
    cp .env.example .env.local     # fill in the values
    npm run seed                   # indexes, settings, first super-admin
    npm run dev                    # http://localhost:3000

Sign in at `/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (no database needed) |
| `npm run seed:test` | resets `yca_sumsilui_test` with known users |
| `npm run test:e2e` | Playwright flows — needs a test database and `seed:test` first |
| `npm run seed` | indexes + settings + first super-admin on the current database |

## Layout

    src/app        public pages, /admin screens, /api route handlers
    src/lib        db, auth, money, fiscal-year, settings, validation
    src/components site chrome, ui primitives, admin forms
    scripts        seed and test-db seeding
    tests          unit (pure) and e2e (Playwright)

## Conventions

- Money is **integer paise**, never rupee floats. Use `src/lib/money.ts`.
- Dates are compared as `YYYY-MM-DD` strings, never `Date` objects. Use `src/lib/fiscal-year.ts`.
- Every API handler goes through `requireRole`. `super_admin` passes implicitly.
- The design tokens in `src/app/globals.css` come from the YCA emblem. Red is an accent, not a fill.

## Design and plans

- `docs/superpowers/specs/` — the approved design
- `docs/superpowers/plans/` — build phases: 1 foundation, 2 content, 3 finance, 4 public polish
```

- [ ] **Step 6: Add `MONGODB_DB_TEST` to `.env.example`**

```
MONGODB_DB_TEST=yca_sumsilui_test
```

- [ ] **Step 7: Final verification**

Run: `npx vitest run`
Expected: PASS — every unit test from Tasks 1–9.

Run: `npm run seed:test && npx playwright test`
Expected: PASS — auth, settings, users specs.

Run: `npm run typecheck && npm run build`
Expected: no type errors; build succeeds.

Open `http://localhost:3000` at 375 px and 1440 px and screenshot both. Confirm: emblem renders sharp, nav wraps cleanly on mobile with no horizontal scroll, footer shows the seeded branch name and phone, and `/login` is reachable and usable on the narrow layout.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed.ts README.md docs/deployment.md .env.example
git commit -m "feat: add seed script, README and deployment walkthrough

Written for someone who has not used Atlas before: the Mumbai region, the
unencoded-password trap in connection strings, and the unsigned-upload
risk are each worth more than the code they configure."
```

---

## Definition of done for Plan 1

- [ ] `npx vitest run`, `npm run typecheck`, `npm run build` all pass.
- [ ] `npm run seed:test && npx playwright test` passes — all three specs, including the Task 6 spec that asserts an editor gets `403` from `PATCH /api/settings`.
- [ ] A real Atlas cluster holds indexes, a settings document and one working super-admin.
- [ ] Public home page and footer render with the YCA design system at 375 px and 1440 px, screenshotted.
- [ ] `docs/deployment.md` has been followed start to finish by someone other than its author, and every place they got stuck has been rewritten.
- [ ] The spec's `SESSION_SECRET` amendment from Task 3 has been applied.

## Spec requirements deferred, and where they land

The self-review against the spec found these named requirements with no task in this plan. Each is listed with the plan that owns it, so nothing is quietly dropped.

| Spec | Requirement | Owner |
|---|---|---|
| §9 | Form data survives a session expiring mid-edit, and the user returns to the same edit | Plan 2 — it needs the notice editor; `SettingsForm` in Task 8 loses its state on a 401 and that is accepted for now |
| §9 | "Locked financial year rejects writes" | Plan 3 |
| §10 | Notice markdown sanitiser tests | Plan 2 |
| §10 | Treasurer adds an expense and `/finance` updates | Plan 3 |
| §10 | Editor refused on `/api/finance/transactions` | Plan 3 |
| §10 | Member directory hides phone unless flagged | Plan 2 (data) + Plan 4 (page) |
| §10 | Lighthouse budget check | Plan 4 — there is no public content to measure before then |
| §5 | `Noto Sans Bengali` / `Noto Sans Chakma` | Plan 2, on the notice routes only |
| §8 | Cloudinary signed uploads | Plan 2 |

Task 8's `SettingsForm` is the one place in this plan where the deferred §9 rule is observable: an editor whose session lapses while typing a long "About the branch" text loses it on save. It is recorded here rather than patched in because the fix — keeping form state across the login round-trip — is the same mechanism the notice editor needs, and building it twice is worse than building it once in Plan 2.

## What Plan 1 does not include

No content exists yet. Members, notices, gallery, works, the ledger and every public page beyond the placeholder home are Plans 2–4. The site is not ready to show the general body at the end of this plan; it is ready for the content work to begin.