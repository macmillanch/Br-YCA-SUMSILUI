# Br. YCA Sumsilui — Plan 3: Finance

> **For agentic workers:** implement task-by-task with
> superpowers:executing-plans or subagent-driven-development, using
> superpowers:test-driven-development inside each task. Steps use checkbox
> (`- [ ]`) syntax.

**Goal:** give the branch a real ledger — a treasurer opens a financial year,
enters vouchers against it, and the public `/finance` pages publish totals,
category breakdowns, charts and a downloadable ledger that are all computed
from those vouchers.

**Architecture:** unchanged from Plans 1 and 2 — one plain `mongodb` collection
per resource, a zod schema in `src/lib/validation/`, a `requireRole`-wrapped
route handler, a server-rendered page reading through `src/lib/content.ts`, and
a client form posting to the API. Finance adds two things Plans 1 and 2 did not
need: arithmetic that must never be wrong (§10 tests it directly), so every
number a page prints is computed in a dependency-free module the unit tests can
run without a database; and a year that can be closed, so writes carry a lock
check before they touch the collection.

**Spec:** `docs/superpowers/specs/2026-09-24-yca-sumsilui-website-design.md`
§5 (chart/table pairing, native `<select>`), §6 (`financialYears`,
`transactions`, `donations`, derived project spend), §7 (`/finance`,
`/finance/[year]`, `/donate`, `/admin/finance`, `/admin/donations`, the finance
API), §8 (the treasurer/super-admin split on locking), §9 (locked year → 409,
delete with dependents, public read fails → unavailable), §10 (fiscal-year
boundaries, summary totals, the lock rule, flows 2 and 3).

## How this plan differs from the spec

**1. Charts are server-rendered SVG, not Recharts.** §5's tools table names
Recharts. This plan draws the bars itself in a server component. Three reasons,
and the user may overrule:

- `/finance` and `/donate` are **public** pages, and §10 caps public pages at
  200 KB of gzipped JavaScript. A chart library is most of that budget on its
  own, and lazy-loading it does not help a page whose whole content is the
  chart.
- §5 already requires "charts always have an equivalent data table below them,
  which is also the no-JS fallback". A server-rendered bar is the same picture
  *with* JavaScript off, so it serves the clause rather than working around it.
- No new dependency: nothing to install, audit, or fail to install on the
  branch's machine. `package.json` dependencies do not change in this plan.

**2. `lockedById`, not `lockedBy`.** §6 writes `lockedBy`; this repository names
every author field `authorId` / `entryById` / `uploadedById`, and the value is
an ObjectId, so the suffix says what it is.

**3. `amountPaise` is always positive; `type` carries the sign.** An expense of
`-5000` and an income of `5000` would both reduce nothing and inflate the
totals. The schema rejects zero and negatives, and every total is
`opening + Σ income − Σ expense`.

## Global constraints

Inherited from Plans 1 and 2 and unchanged:

- Money is integer paise everywhere in the database and on the wire
  (`₹1,250.50` → `125050`). Rupees exist only in a form field.
- Dates a human reads are `YYYY-MM-DD` strings; `createdAt` and friends stay
  `Date`.
- `requireRole(request, allowed, handler)` is the only authorisation gate.
  `super_admin` passes implicitly; an empty allowlist means super-admin only.
- **Never trust a role, user id, amount or year supplied by the browser.** A
  transaction's `yearId` is derived from its date, server-side.
- Nothing is invented. No sample financial figures, no default opening balance
  in the production seed: a number nobody entered must not reach a public page
  (§13).
- A public read that fails reports *unavailable*, never *empty* (§9). A wrong
  balance in an NGO is worse than no balance.
- `npm run build` must never run while `npm run dev` is up (they share
  `.next`).
- Verification for every task: `npm run typecheck && npx vitest run`. The
  task's own flows: `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/<spec>`
  against a seeded test database (`npm run seed:test`).

## File map

| File | Responsibility |
|---|---|
| `src/lib/finance-categories.ts` | The fixed income/expense category list and its public labels — one place, so charts stay comparable across years |
| `src/lib/validation/finance.ts` | Year, transaction, edit-with-reason, unlock and donation schemas |
| `src/lib/finance.ts` | All Mongo reads and writes for years, transactions and the donation link |
| `src/lib/finance-summary.ts` | Totals, category breakdown, per-project spend. Pure — no imports from `db` |
| `src/lib/charts.ts` | Bar geometry and short Indian money labels (lakh/crore). Pure |
| `src/lib/csv.ts` | RFC-style CSV with the spreadsheet-formula guard. Pure |
| `src/lib/donations.ts` | A donation and its paired transaction, saved as one unit |
| `src/lib/content.ts` | The three-state finance reads the public pages use |
| `src/components/site/FinanceBarChart.tsx` | The chart, always with its table |
| `src/app/finance/*`, `src/app/finance/[year]/*` | Year summary, full ledger, CSV export |
| `src/app/api/finance/*`, `src/app/api/donations/*` | The §7 endpoints |
| `src/app/admin/finance/*`, `src/app/admin/donations/*` | The treasurer's screens |

---

## Task 1: Finance types, the category list and rupee helpers

**Files:**
- Modify: `src/lib/types.ts` (`TRANSACTION_TYPES`, `FinancialYearDoc`,
  `TransactionRevision`, `TransactionDoc`, `DonationDoc`)
- Create: `src/lib/finance-categories.ts`
- Modify: `src/lib/money.ts` (`rupeesInputToPaise`, `paiseToRupeesInput`)
- Test: `tests/unit/money.test.ts`, `tests/unit/finance-categories.test.ts`,
  `tests/unit/index-specs.test.ts`

**Produces:**
- `INCOME_CATEGORIES = ["subscription","donation","event_collection","grant","interest","other_income"]`,
  `EXPENSE_CATEGORIES = ["event","community_welfare","education","youth","administration","maintenance","relief","other_expense"]`,
  `TransactionType`, `TransactionCategory`, `categoryLabel(category)`,
  `categoriesOf(type): readonly TransactionCategory[]`,
  `isValidCategory(type, category): boolean`.
- `rupeesInputToPaise(value: string): number | null` — accepts `2500`,
  `2500.50`, `2,500.50`, rejects `abc`, `-5`, `1.234`, and blank → `null`.
- `paiseToRupeesInput(paise: number): string` — `0 → ""`, `125050 → "1250.50"`,
  `250000 → "2500"` (the round trip is the test).
- Doc types per the header above, with `FinancialYearDoc.lockedById: ObjectId | null`.

- [ ] Step 1: extend `tests/unit/money.test.ts` with the two helpers, including
      the whole-rupees case and `1.234` (finer than a paisa) → `null`. Run and
      watch them fail.
- [ ] Step 2: implement both on top of the existing `rupeesToPaise`, which
      already throws on a sub-paisa value — catch that into `null` rather than
      letting a form submission 500.
- [ ] Step 3: write `tests/unit/finance-categories.test.ts` asserting the two
      lists are exactly the spec's (§6, verbatim, in order), that
      `categoriesOf("income")` excludes every expense category, and that
      `categoryLabel("event_collection")` is a human phrase, not the key.
- [ ] Step 4: add `finance-categories.ts` and the doc types.
- [ ] Step 5: confirm `tests/unit/index-specs.test.ts` already covers
      `financialYears.label:unique`, `transactions.yearId+date`,
      `transactions.yearId+type+category`, `transactions.projectId`,
      `donations.date`; add the missing `donations.transactionId:unique` spec —
      one transaction per donation is the rule the screens depend on, and it is
      always present, so a plain unique index says it. `npm run seed:test`
      creates it (`ensureIndexes` runs there, and in `npm run seed`).
- [ ] Step 6: `npm run typecheck && npx vitest run`.
- [ ] Step 7: commit `feat: add finance types, categories and rupee helpers`.

---

## Task 2: Open a financial year, lock it, reopen it

**Files:**
- Create: `src/lib/validation/finance.ts`, `src/lib/finance.ts`
- Create: `src/app/api/finance/years/route.ts`,
  `src/app/api/finance/years/[id]/route.ts` (DELETE),
  `src/app/api/finance/years/[id]/lock/route.ts`,
  `src/app/api/finance/years/[id]/unlock/route.ts`
- Test: `tests/unit/finance-years.test.ts`, `tests/unit/require-role.test.ts`

**Produces (`src/lib/validation/finance.ts`):**
- `FINANCIAL_YEAR_SCHEMA = { label, openingBalancePaise, auditPdfUrl }` where
  `label` must parse through `fiscalYearFromLabel` (so `2026-12` and `2026-28`
  are both refused with "A financial year runs from 1 April to 31 March"),
  `openingBalancePaise` is a non-negative integer, `auditPdfUrl` is `""` or a
  URL.
- `UNLOCK_REASON_SCHEMA = { reason }`, trimmed, at least 10 characters.
- Exports `FinancialYearInput`, `TransactionInput`, `TransactionEditInput`,
  `DonationInput` so later tasks import one module.

**Produces (`src/lib/finance.ts`):**
```ts
export const MANAGE_FINANCE: readonly Role[] = ["treasurer"];
export const REOPEN_FINANCIAL_YEAR: readonly Role[] = [];
export type YearWriteResult = "written" | "duplicate_label" | "overlaps_existing" | "not_found";
export async function openFinancialYear(input: FinancialYearInput): Promise<{ result: YearWriteResult; year?: FinancialYearDoc }>;
export async function listFinancialYears(): Promise<FinancialYearDoc[]>;   // newest startDate first
export async function getFinancialYear(id: ObjectId): Promise<FinancialYearDoc | null>;
export async function getFinancialYearByLabel(label: string): Promise<FinancialYearDoc | null>;
export async function financialYearForDate(isoDate: string): Promise<FinancialYearDoc | null>;
export async function setYearLock(id: ObjectId, locked: boolean, byId: ObjectId, reason?: string): Promise<"locked" | "unlocked" | "already_locked" | "already_open" | "not_found">;
export async function removeFinancialYear(id: ObjectId): Promise<{ removed: boolean; reason: "transactions_exist" | "gone" | null; count: number }>;
export function yearIsClosed(year: FinancialYearDoc): boolean;
export function lockMessage(year: FinancialYearDoc, lockedByName: string): string;
export function yearsOverlap(a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }): boolean;
```

**Rules with tests, in `tests/unit/finance-years.test.ts`:**
- `yearsOverlap` catches `2026-27` beside `2026-27` and beside a hand-typed
  `2026-05-01 → 2027-08-31`; two adjacent years do not overlap.
- `lockMessage` names who closed it and on what date — §9 requires both in the
  409, and the test asserts the sentence contains the name and an ISO date
  rather than a bare "locked".
- In `tests/unit/require-role.test.ts`: `canAccess("treasurer", MANAGE_FINANCE)`
  is true; `canAccess("treasurer", REOPEN_FINANCIAL_YEAR)` is **false**;
  `canAccess("super_admin", REOPEN_FINANCIAL_YEAR)` is true. That is §10's lock
  rule as a unit test — the e2e version comes in Task 9.

**API:** `POST /api/finance/years` (treasurer) → 200 `ok({ year })`, 409
`year_exists` / `year_overlaps`. `DELETE /api/finance/years/[id]` (treasurer,
blocked by §9 when transactions exist → 409 with the count). `POST …/lock`
(treasurer), `POST …/unlock` (super-admin only, reason required → stored as
`unlockReason`). Every route re-reads the year; none trusts an id in the body.

- [ ] Step 1: the failing unit tests above.
- [ ] Step 2: `finance-categories.ts` is already in place; write the schemas.
- [ ] Step 3: implement the store functions; `openFinancialYear` derives
      `startDate`/`endDate` from the label through `fiscalYearFromLabel` and
      ignores any dates a client might send.
- [ ] Step 4: the four route handlers, each through `requireRole`, each
      returning `fail(409, …)` with `lockMessage` where §9 says so.
- [ ] Step 5: `npm run typecheck && npx vitest run`.
- [ ] Step 6: commit `feat: open, lock and reopen financial years`.

---

## Task 3: Vouchers — the ledger itself

**Files:**
- Modify: `src/lib/validation/finance.ts`, `src/lib/finance.ts`
- Create: `src/app/api/finance/transactions/route.ts`,
  `src/app/api/finance/transactions/[id]/route.ts`
- Test: `tests/unit/finance-transactions.test.ts`

**Produces (schemas):**
- `TRANSACTION_SCHEMA = { date, type, category, description, amountPaise,
  voucherNo, party, projectId }` — `date` must be a real calendar date,
  `amountPaise` a positive integer (`min(1)`), `voucherNo` and `party` at
  least 2 characters, `projectId` `""` or a 24-hex ObjectId. A `superRefine`
  rejects a category that belongs to the other type: `event` under `income` is
  a mistake the treasurer must be told about, not data.
- `TRANSACTION_EDIT_SCHEMA` = the same plus a required `reason` of at least 10
  characters. §6: *an NGO ledger that can be silently edited is not a
  transparent ledger.*

**Produces (`src/lib/finance.ts`):**
```ts
export type TransactionWriteResult = "written" | "no_year_for_date" | "locked" | "not_found" | "linked_donation";
export type TransactionFilter = { yearId?: ObjectId; type?: TransactionType; category?: TransactionCategory; projectId?: ObjectId; search?: string; limit?: number };
export function buildTransactionDoc(input: TransactionInput, yearId: ObjectId, entryById: ObjectId | null): TransactionDoc;
export function describeChanges(before: TransactionDoc, after: TransactionDoc): { field: string; from: string; to: string }[];
export async function insertTransaction(doc: TransactionDoc): Promise<string>;
export async function replaceTransaction(doc: TransactionDoc, edit: { reason: string; byId: ObjectId | null; allowDonationLinked?: boolean }): Promise<TransactionWriteResult>;
export async function removeTransaction(id: ObjectId): Promise<TransactionWriteResult>;
export async function listTransactions(filter: TransactionFilter): Promise<TransactionDoc[]>;
export async function getTransaction(id: ObjectId): Promise<TransactionDoc | null>;
export async function countTransactionsForYear(yearId: ObjectId): Promise<number>;
export async function donationOwningTransaction(transactionId: ObjectId): Promise<DonationDoc | null>;
export function transactionDateOutOfYear(date: string, year: FinancialYearDoc): boolean;
```

**The three guards, each with a unit test:**
- **The year comes from the date.** `yearIdForDate(date)` is what the handler
  uses; a body carrying a different `yearId` changes nothing. When no year
  covers the date → `"no_year_for_date"`, and the 400 message names the year to
  open (`2027-28`) and the date it was given. Test both boundaries §10 names:
  `2027-03-31` lands in `2026-27`, `2027-04-01` in `2027-28` (already covered
  in `fiscal-year.test.ts`; the new test is that the *write* refuses the second
  when only the first is open).
- **A locked year refuses writes** — `replaceTransaction`, `removeTransaction`
  and `insertTransaction` all check `yearIsClosed` first → `"locked"` → 409
  with `lockMessage`.
- **A donation's transaction is not editable here** — `donationOwningTransaction`
  finds the donation, and without `allowDonationLinked` the result is
  `"linked_donation"` → 409 telling the treasurer to use the donation form,
  because the two records must not drift (§6).
- `describeChanges` reports only the fields that actually moved, with amounts
  as rupees and categories as labels, and never reports `updatedAt`.

- [ ] Steps 1-5: RED for each guard, then implement, then
      `npm run typecheck && npx vitest run`.
- [ ] Step 6: `POST /api/finance/transactions` and
      `PATCH|DELETE /api/finance/transactions/[id]` behind `MANAGE_FINANCE`,
      `GET` open to any signed-in admin role, `invalidateFinance()` on every
      write (Task 5 adds it; until then call `revalidatePath("/finance")`
      through the existing helper module).
- [ ] Step 7: commit `feat: enter vouchers into the ledger with a revision trail`.

---

## Task 4: Totals, category breakdown and derived project spend

**Files:**
- Create: `src/lib/finance-summary.ts`, `src/lib/charts.ts`
- Test: `tests/unit/finance-summary.test.ts`, `tests/unit/charts.test.ts`

**Produces (`finance-summary.ts`, no `db` import so the tests need no Mongo):**
```ts
export type LedgerRow = { type: TransactionType; category: TransactionCategory; amountPaise: number; projectId?: ObjectId | null };
export type CategoryTotal = { category: TransactionCategory; label: string; paise: number; share: number };
export function summarise(openingBalancePaise: number, rows: readonly LedgerRow[]): FinanceSnapshot;  // the yearLabel is filled by the caller
export function totalsByCategory(rows: readonly LedgerRow[], type: TransactionType): CategoryTotal[];  // largest first, zero-total categories dropped
export function spendByProject(rows: readonly LedgerRow[]): Map<string, number>;
export function budgetSharePct(spentPaise: number, sanctionedPaise: number): number | null;  // null when nothing was sanctioned
```
`FinanceSnapshot` stays the type `src/lib/content.ts` already exports.

**Tests — §10's fixture ledger, written out:**
- Opening `2500000` (₹25,000) with income `50000000` (₹5,00,000) and expense
  `12500000` (₹1,25,000) closes at `40000000` — ₹4,00,000. Assert the exact
  paise, not the rupee string.
- An empty ledger returns the opening balance unchanged, and
  `incomePaise === 0`, which the pages must render as unavailable-looking text
  rather than a claim — that decision belongs to the read layer, not here.
- A negative closing balance survives (an overdrawn year is a real state and
  the page prints it in red).
- `totalsByCategory` shares sum to 1 (to 1e-9) for a five-row fixture, and
  `share` is `0` not `NaN` when the type's total is zero.
- `spendByProject` ignores income rows entirely — money received is not money
  spent on a work — and returns `0` for a project that appears only as income.
- `charts.ts`: `niceScaleMax([0, 0])` returns a positive number and never 0
  (a zero divide would be an `Infinity` bar width); `barFraction` clamps into
  0..1; `formatShortPaise` covers `0 → "₹0"`, `999999 → "₹9,999.99"`,
  `10000000 → "₹10.0 lakh"`, `1250000000 → "₹1.25 crore"`.

- [ ] Steps: RED → implement → `npm run typecheck && npx vitest run` →
      commit `feat: total a financial year and its categories`.

---

## Task 5: The three-state finance reads and the public `/finance`

**Files:**
- Modify: `src/lib/content.ts` (replace both Plan 2 stubs),
  `src/components/site/FinanceSummary.tsx`, `src/app/finance/page.tsx`,
  `src/app/page.tsx`, `src/lib/invalidate.ts` (`invalidateFinance`)
- Create: `src/components/site/FinanceBarChart.tsx`
- Test: `tests/unit/content.test.ts`, `tests/e2e/finance.spec.ts`

**Produces (`src/lib/content.ts`):**
```ts
export type FinanceYearOption = { label: string; startDate: string; endDate: string; locked: boolean };
export async function getFinanceYears(): Promise<PublicRead<FinanceYearOption>>;
export type FinanceSummaryContent = { snapshot: FinanceSnapshot | null; unavailable: boolean; yearsOpened: number };
/** The current fiscal year if it is open, else the newest one that is. */
export function financeYearToOpen(years: readonly FinancialYearDoc[], today: Date): FinancialYearDoc | null;
export async function getFinanceSummary(label?: string): Promise<FinanceSummaryContent>;
/** Pure, and the reason the three states are testable without a database. */
export function toFinanceContent(year: FinancialYearDoc | null, rows: readonly LedgerRow[] | null, yearsOpened: number): FinanceSummaryContent;
export type PublicLedgerRow = { date: string; voucherNo: string; description: string; party: string; categoryLabel: string; amountPaise: number };
export type FinanceYearDetail =
  | { state: "ready"; year: FinanceYearOption; snapshot: FinanceSnapshot; income: CategoryTotal[]; expense: CategoryTotal[]; rows: readonly PublicLedgerRow[]; auditPdfUrl: string | null }
  | { state: "missing" }
  | { state: "unavailable" };
export async function getFinanceYearDetail(label: string): Promise<FinanceYearDetail>;
```
`HomepageContent.finance` becomes `FinanceSummaryContent` (it was
`FinanceSnapshot | null`), and the front page's section header prints the label
that travels inside the snapshot.

**`financeYearToOpen` is unit-tested, because it is the one place the site
decides which year a visitor sees as "this year":** with `2026-27` open on
2026-09-24 it returns `2026-27`; with only `2024-25` and `2025-26` open it
returns `2025-26`, not `null`; with none open it returns `null`; and a year
opened ahead of today — `2027-28` while it is still September 2026 — is the
newest thing there is, so it is returned rather than skipped, because closing
accounts in advance is the treasurer's own business.

**`FinanceSummary` gets the same `unavailable` prop `ContactSection` has** and,
through an outage, renders `<SectionUnavailable what="The branch's figures" />`
instead of three cards of `₹0` — §9 says the finance summary shows that message
"rather than a stale figure", and a zero is a stale figure with extra confidence.

**`/finance` page:** native `<select name="year">` from the real years (already
in the markup), then summary cards, then
`<FinanceBarChart title="Income and expenditure" …>` with its `<table>`
alongside, then the category breakdown with its own bar chart and table, then
the last eight vouchers, then the audit PDF link when one is saved. The chart
is `<svg role="img" aria-label="…">` inside a `<figure>` whose `<figcaption>`
names the year, and the table below carries every number again — so the chart
is decoration for anyone who prefers the numbers, exactly as §5 asks.

- [ ] Step 1: failing unit tests for `financeYearToOpen`, for
      `toFinanceContent(year, rows) ⇒ { snapshot, unavailable: false, yearsOpened }`
      and for the unreadable case
      `toFinanceContent(null, null) ⇒ { snapshot: null, unavailable: true, yearsOpened: 0 }`,
      and for the empty-but-readable case (`yearsOpened: 0` with a clean read →
      the page's own words differ from the outage's). `toFinanceContent` is
      exported pure for exactly that test; `getFinanceSummary` is the thin
      Mongo-reading wrapper over it, as `toContactDetails` is for contact.
- [ ] Step 2: implement the reads with the same `try/catch → unavailable` shape
      the notices read uses.
- [ ] Step 3: the chart component (pure props, no client JS) and the page.
- [ ] Step 4: `GET /api/finance/summary?year=` — §7's route, and the one place
      the summary is offered as JSON. It calls `getFinanceSummary(label)` for
      any signed-in admin role and returns
      `{ data: { snapshot, unavailable } }`; a read that failed answers 200 with
      `unavailable: true` rather than a 500, so a caller cannot tell an outage
      from a year with no vouchers except by reading the flag, which is the
      point of the flag.
- [ ] Step 5: `invalidateFinance()` clears `/finance`, `/finance/*`, `/donate`,
      `/works`, `/works/*` and `/` — a voucher changes a work's spent figure
      too, which Task 8 depends on.
- [ ] Step 6: `npm run typecheck && npx vitest run`.
- [ ] Step 7: commit `feat: publish the year's figures on the public finance page`.

---

## Task 6: The full ledger for one year, with filters and a spreadsheet export

**Files:**
- Modify: `src/app/finance/[year]/page.tsx` (replaces the Plan 2 placeholder),
  `src/lib/charts.ts` if the axis needs a second helper
- Create: `src/lib/csv.ts`, `src/app/finance/[year]/export/route.ts`
- Test: `tests/unit/csv.test.ts`

**Produces:**
- `csvCell(value: string | number): string` and
  `csvRows(rows: readonly (readonly (string | number)[])[]): string` —
  quotes every field, doubles an inner quote, joins with CRLF and prefixes a
  UTF-8 BOM so Excel reads ₹ correctly.
- **The spreadsheet-formula guard:** a description of `=cmd|…` or `@SUM(…)` or
  a leading `+`/tab/CR is stored as text, not executed. `csvCell` prefixes
  those with a single quote. §6 data is typed by trusted office-bearers, but
  notice titles and party names reach CSV from a form, and a treasurer opening
  the file in Excel should not be the attack surface. Test all four lead
  characters plus an ordinary value.
- `/finance/[year]` reads `getFinanceYearDetail(label)`; `missing` →
  `notFound()` (the route already refuses unknown labels through
  `generateStaticParams` + `dynamicParams = false`), `unavailable` → the
  `<SectionUnavailable>` block **and no `EmptyState`** — "no accounts
  published" and "we could not look" must never render on the same page.
- Filters are a `method="get"` form with `<select>`s for type and category,
  read from `searchParams` server-side, so filtering works with JS off and the
  URL is shareable.
- Running balance column: `Σ` over the sorted rows, computed with `sumPaise`.
  The ledger is printed oldest-first with a running balance, which is how an
  audited cash book reads.
- The export route streams the *filtered* rows for that year, names the file
  `yca-sumsilui-<label>.csv`, and is public (the ledger it exports is already
  public) with `Cache-Control: no-store` so a downloaded file is never a stale
  one.

- [ ] Steps: RED on `csv.test.ts` → implement → wire the page → add
      "Download this year as a spreadsheet (CSV)" beside the filters →
      `npm run typecheck && npx vitest run` → commit
      `feat: publish a filterable year ledger with CSV export`.

---

## Task 7: Donations and the voucher they must match

**Files:**
- Create: `src/lib/donations.ts`, `src/app/api/donations/route.ts`,
  `src/app/api/donations/[id]/route.ts`
- Modify: `src/app/donate/page.tsx`
- Test: `tests/unit/donations.test.ts`

**Produces:**
```ts
export function donationTransactionInput(input: DonationInput, donorName: string): TransactionInput;  // type "income", category "donation", party = donorName, description = purpose
export type DonationWriteResult = "written" | "no_year_for_date" | "locked" | "not_found";
export async function saveDonation(input: DonationInput, byId: ObjectId): Promise<{ result: DonationWriteResult; donation?: DonationDoc }>;
export async function editDonation(id: ObjectId, input: DonationInput, edit: { reason: string; byId: ObjectId }): Promise<DonationWriteResult>;
export async function removeDonation(id: ObjectId, byId: ObjectId): Promise<DonationWriteResult>;
export async function listDonations(yearId?: ObjectId): Promise<DonationDoc[]>;
export async function getPublicDonations(limit?: number): Promise<PublicRead<AcknowledgedDonation>>;
export type AcknowledgedDonation = { donorName: string; amountPaise: number; date: string; purpose: string };
```

- `saveDonation` opens a transaction and a donation **or neither**: it writes
  the transaction first, then the donation with that `transactionId`; if the
  second insert fails it deletes the first, and the 500 the treasurer sees says
  the entry was not kept. Atlas M0 gives us no replica set, so a transaction
  cannot span both collections — this is the honest substitute, and the test
  asserts the rollback path by making the donation insert fail.
- `editDonation` calls `replaceTransaction` with
  `allowDonationLinked: true` — the only caller allowed to — so the ledger and
  the acknowledgement list cannot drift (§6).
- `removeDonation` deletes both, in that order, and the reason shown in the
  admin UI says so plainly.
- `getPublicDonations` filters on `acknowledgePublicly: true` **in the query**,
  so a name nobody agreed to publish never reaches a page's payload (the same
  rule `showContactPublicly` follows in `members.ts`).
- `/donate` adds "Contributions acknowledged with thanks" — name, purpose,
  amount, date — with the three-state read; and keeps the existing note that
  receipts come from the Treasurer.

- [ ] Steps: RED (the paired input, the visibility filter, the rollback) →
      implement → routes behind `MANAGE_FINANCE` → page → commit
      `feat: record a donation and its matching ledger voucher`.

---

## Task 8: What each work has actually cost

**Files:**
- Modify: `src/lib/content.ts` (`PublicProject.spentPaise`),
  `src/lib/finance.ts`, `src/lib/projects.ts`,
  `src/components/site/ProjectCard.tsx`, `src/app/works/page.tsx`,
  `src/app/works/[slug]/page.tsx`, `src/app/admin/works/[id]/page.tsx`
- Test: `tests/unit/projects.test.ts`, `tests/e2e/works.spec.ts`

Plan 2 left the deliberate hole this task fills: `projects.ts` says spend "is
summed from the ledger in Plan 3". It is now summed, and only from the ledger.

```ts
// finance.ts — the Mongo half: one query for the page's works, then Task 4's
// pure spendByProject over the rows it returns.
export async function spendByProjectIds(ids: readonly ObjectId[]): Promise<Map<string, number> | null>;  // null = the ledger could not be read
// content.ts
PublicProject.spentPaise: number | null;   // null only through an outage
PublicProject.budgetSharePct: number | null;  // null when nothing was sanctioned
```

- A work with no vouchers against it shows **₹0 of ₹2,50,000** — the ledger was
  read cleanly and says nobody has drawn against it, which is a fact worth
  publishing.
- A work whose spend could not be read shows "the figures could not be read
  just now" and no bar at all (§9).
- `budgetSharePct` clamps at 100 for display but the page prints the real
  overspend percentage in the caption — a work that cost more than it was
  sanctioned for is exactly the thing a public account should not hide.
- `getWorks` and `publicProjectBySlug` go through one helper so the card, the
  detail page and the admin screen can never disagree.

- [ ] Steps: RED on the three cases (clean zero, outage `null`, overspend) →
      implement → update the cards → commit
      `feat: derive each work's spend from the ledger`.

---

## Task 9: The treasurer's screens, the dashboard and the proof

**Files:**
- Create: `src/app/admin/finance/page.tsx`, `src/app/admin/finance/[year]/page.tsx`,
  `src/app/admin/donations/page.tsx`, and the client components
  `FinancialYearForm`, `FinancialYearsTable`, `TransactionForm`,
  `TransactionsTable`, `DonationForm`, `DonationsTable`
- Modify: `src/lib/nav.ts` (both rows `ready: true`), `src/app/admin/page.tsx`,
  `scripts/seed-test-db.ts`, `tests/e2e/finance.spec.ts`,
  `tests/e2e/donations.spec.ts`, `tests/e2e/admin-nav.spec.ts`,
  `README.md`, `docs/deployment.md`

**Screens:**
- `/admin/finance` lists the years with opening balance, income, expense and
  closing beside a lock state, and offers "Open a financial year". Lock and
  unlock buttons appear only for the roles that may use them (§9: the UI hides
  what the API refuses), so a treasurer sees "Close this year" and never sees
  "Reopen".
- `/admin/finance/[year]` is the voucher book: the add form, the filtered list,
  each row's edit form asking for the reason a line is being changed, the
  revision trail under the row it changed, and the category totals down the
  side. A locked year renders the form disabled with the date and name from
  `lockMessage`, so the treasurer learns why before the API has to say it.
- `/admin/donations` is the donation book, and the only place a donation's
  voucher can be edited.
- Dashboard: the current-FY income/expense/balance cards come from
  `getFinanceSummary()`, and the "the year's accounts come with the finance
  screens" sentence goes away — it is now false.

**`scripts/seed-test-db.ts`** opens the current fiscal year with
`openingBalancePaise: 0` so the flows have somewhere to write, and prints that
it did. **`scripts/seed.ts` does not** — the production seed must not put a
balance figure on a public page that no treasurer entered (§13). That
asymmetry belongs in a comment in `seed-test-db.ts`, where someone will look for
it.

**e2e, which is §10's flow 2 and 3 plus this plan's locks:**
1. *(§10 flow 2)* treasurer signs in, adds an expense with a voucher number →
   `/finance` shows the reduced closing balance and the expense bar grows; the
   year's ledger page lists the voucher with its party.
2. *(§10 flow 3)* editor posts to `/api/finance/transactions` → `403`, and the
   editor's sidebar still offers no Finance row.
3. treasurer enters a voucher dated in a year the branch has not opened → the
   form names the year to open, and the ledger is unchanged.
4. treasurer closes the year → a second voucher in it is refused and the page
   says who closed it; the treasurer is offered no reopen button;
   `POST …/unlock` as treasurer is `403`.
5. super-admin reopens it with a reason → the reason shows in the year's audit
   trail; without a reason → `400`.
6. treasurer records a donation → it appears once in the ledger as
   `donation` income and once in `/donate`'s acknowledgements when ticked, and
   the paired voucher is not editable from the finance screen (`linked_donation`).
7. editing a voucher's amount as the treasurer records the old and new figures
   in the revision line the page shows.
8. `/finance/2026-27/export.csv` downloads and its first line is the header
   row; the file's text contains the voucher just entered.

**Closing pass, in order:**
- [ ] `npm run seed:test && PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` — twice
      in a row, so a green run is not another run's leftovers.
- [ ] `npx vitest run && npm run typecheck` — every unit test, no DB.
- [ ] Stop the dev server, then `npm run build`, then restart `npm run dev`
      (never both at once).
- [ ] **§9 outage proof:** point a scratch env at a closed port and curl
      `/`, `/finance`, `/finance/2026-27`, `/donate`, `/works`,
      `/works/<a slug>`. Every page must answer 200 with "temporarily
      unavailable" where the figures belong — no `₹0`, no stack trace, no
      "no accounts published yet" beside a database that merely could not be
      reached. Record the output in the commit message body.
- [ ] `grep -rn "SAMPLE_" src/` still returns nothing, and
      `grep -rn "openingBalancePaise: [1-9]" scripts/seed.ts` returns nothing.
- [ ] README: the finance screens move from "coming" to "ready", and the new
      `MANAGE_FINANCE` / reopen split goes into the roles paragraph.
      `docs/deployment.md`: a treasurer closing a year for the first time is a
      supported action, and the unlocking warning is stated.
- [ ] Commit `feat: give the treasurer the finance and donation screens`.

---

## Definition of done

- A treasurer opens a year, enters vouchers against it, and every public figure
  — summary card, bar, category table, ledger row, CSV, a work's spend — comes
  from those vouchers.
- An editor cannot write to finance at all (403 at the API, no row in the
  sidebar); a treasurer can lock a year and cannot reopen one; only a
  super-admin can, and only with a stored reason.
- No financial number appears anywhere that no one entered: the production seed
  opens no year and sets no balance.
- The outage sweep finds no page that mistakes "could not read" for "nothing
  published".
- All unit tests, both e2e runs, typecheck and build pass, with the output in
  the record.

## Deferred

- Search, pagination, the gallery lightbox, the Lighthouse budget audit, and
  §9's "session expired mid-edit, the form's data survives" rule — Plan 4.
- The treasurer's own audit PDF is only a URL field until someone can upload
  one; `POST /api/upload` accepts images only. Add a document type there in
  Plan 4, or keep linking a hosted file.
- Interest income on the bank account, GST/TDS on payments, and payroll-style
  recurring expenses: real NGO books, but out of scope for a branch site whose
  ledger is a few dozen vouchers a year.
