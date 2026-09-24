# Br. YCA Sumsilui

Website of the Sumsilui branch of the Young Chakma Association, Mizoram. Public
notices, work progress and financial records; an admin area for office-bearers.

## Before you start

- Node 18.18+ (the app targets Node 20 on Vercel)
- A MongoDB Atlas M0 cluster — `docs/deployment.md` walks through it
- A Cloudinary account (needed from Plan 2, for photo uploads)

## Local setup

    npm install
    cp .env.example .env.local     # then fill in the values
    npm run seed                   # indexes, settings document, first super-admin
    npm run dev                    # http://localhost:3000

Sign in at `/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, then fill in
the branch's real contact details under **Settings** and add the other
office-bearers under **Users**.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests — no database needed |
| `npm run seed` | indexes + settings + first super-admin on the current database |
| `npm run seed:test` | resets `yca_sumsilui_test` with the three known test users |
| `npm run seed:committee` | records the committee from `data/committee-2026-2028.json` — adds anyone missing, never rewrites a saved record |
| `npm run test:e2e` | Playwright flows; run `seed:test` first |

`npm run test:e2e` needs a browser. Playwright downloads its own pinned Chromium
on first use (`npx playwright install chromium`). If that download is
unavailable, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` drives the Chrome
already installed on the machine instead. CI leaves it unset.

**Never run `npm run build` while `npm run dev` is up.** Both use `.next`, and
the build replaces the dev server's chunks under it; the running dev server then
requests a CSS file that no longer exists and reloads in a loop with no client
JavaScript, so no form works. Delete `.next` and restart `npm run dev` to recover.

**A server left on port 3000 by a test run reads the test database.** Playwright
starts `npm run dev` itself with `MONGODB_DB=yca_sumsilui_test`, and later runs
reuse whatever is already listening — so a page can look empty of the names
`npm run seed:committee` just recorded. Stop that server and run `npm run dev` to
browse the database in `.env.local`.

## Layout

    src/app          public pages, /admin screens, /api route handlers
    src/lib          db, auth, money, fiscal-year, settings, validation
    src/components   site chrome, ui primitives, admin forms
    scripts          seed, test-database seeding
    tests            unit (pure) and e2e (Playwright)
    docs             deployment walkthrough, specs and build plans

## Conventions

- Money is **integer paise**, never rupee floats. Use `src/lib/money.ts`.
- Dates compare as `YYYY-MM-DD` strings, never `Date` objects. Use
  `src/lib/fiscal-year.ts`. The fiscal year runs 1 April → 31 March and is
  labelled `2026-27`.
- Every mutating API handler goes through `requireRole`. `super_admin` passes
  implicitly, and an empty allowlist means super-admin only.
- Nothing is invented. A branch detail no one has typed is rendered as "Not
  published yet", never as a plausible-looking placeholder.
- The design tokens in `src/app/globals.css` come from the YCA emblem. Red is an
  accent, not a fill.

## Roles

| Role | Can do |
| --- | --- |
| `super_admin` | everything, including other accounts and branch settings |
| `treasurer` | finance entries, plus what an editor can do |
| `editor` | notices, members, works and gallery |

Deactivating an account signs it out on its next request — the sessions are
deleted, not flagged. No one can change their own role or deactivate themselves,
so keep at least two super-admin accounts.

## Design and plans

- `docs/superpowers/specs/` — the approved design
- `docs/superpowers/plans/` — build phases: 1 foundation, 2 content, 3 finance,
  4 public polish
