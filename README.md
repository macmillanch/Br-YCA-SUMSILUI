# Br. YCA Sumsilui

Website of the Sumsilui branch of the Young Chakma Association, Mizoram. Public
notices, work progress, photographs and — once the branch keeps its ledger here —
financial records; an admin area for office-bearers.

Live now: notices and press releases, the committee and member register, works
with dated progress reports, the photograph gallery, and the year's accounts —
the treasurer keeps a ledger of vouchers per financial year, and every figure on
the public pages is totalled from those lines. Nothing publishes a number nobody
entered: a page with no year open says so, and a page during an outage says it
cannot read the figures rather than printing `₹0`.

## Before you start

- Node 18.18+ (the app targets Node 20 on Vercel)
- A MongoDB Atlas M0 cluster — `docs/deployment.md` walks through it
- A Cloudinary account, for photo uploads. Without its keys the gallery still
  works — an office-bearer adds a picture by its web address — but an uploaded
  file is refused with a plain explanation.

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
| `npm run seed:test` | resets `yca_sumsilui_test`: the three test users, the current year open, and six clearly TEST-labelled vouchers in it |
| `npm run seed:committee` | records the committee from `data/committee-2026-2028.json` — adds anyone missing, never rewrites a saved record |
| `npm run test:e2e` | resets `yca_sumsilui_test` first, then runs the Playwright flows |

The specs share that one test database, so each run starts from an empty branch:
several of them assert what a page looks like before anything has been published.
`npx playwright test` alone reuses whatever the last run left and will report
failures that belong to no feature — use `npm run test:e2e`.

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
- Empty and unreadable are different answers. A public read reports which one it
  got, and only the empty one may say "not published yet" — through an outage the
  section says it is temporarily unavailable, so a database that cannot be
  reached never reads as a branch that has published nothing.
- The design tokens in `src/app/globals.css` come from the YCA emblem. Red is an
  accent, not a fill.

## Keeping the accounts

A year is opened once (**Admin → Finance**: the label, the opening balance the
audit left, and the audited report's address if there is one). The treasurer then
enters vouchers against it — every figure dated inside the year, one head from a
fixed list, amounts in rupees that become integer paise.

- **Correcting** a line asks for a sentence why, and keeps the figure it replaced
  where the public ledger can show both.
- **Closing** a year stops the entries. A closed year cannot be deleted and cannot
  be written into; only a `super_admin` reopens it, and only with a reason that is
  then printed beside the year.
- A **contribution** is entered once on its own screen and writes two records — the
  income voucher and the donation that names it — so the thank-you list on
  `/donate` and the accounts cannot drift apart. A donor's name appears publicly
  only when the box is ticked: silence is not consent. Unchecked, the figure still
  stands in the ledger as *Contribution (name with the Treasurer)*.
- **No financial year is opened by `npm run seed`.** Opening one, and the six TEST
  vouchers that prove the screens, belong to `npm run seed:test` alone.

## Roles

| Role | Can do |
| --- | --- |
| `super_admin` | everything, including other accounts and branch settings |
| `treasurer` | the year's vouchers and contributions, plus what an editor can do — but not opening, closing or reopening a year |
| `editor` | notices, members, works and gallery |

Deactivating an account signs it out on its next request — the sessions are
deleted, not flagged. No one can change their own role or deactivate themselves,
so keep at least two super-admin accounts.

## Design and plans

- `docs/superpowers/specs/` — the approved design
- `docs/superpowers/plans/` — build phases: 1 foundation, 2 content, 3 finance,
  4 public polish
