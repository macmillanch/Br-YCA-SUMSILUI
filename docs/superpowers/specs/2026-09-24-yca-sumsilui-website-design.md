# Br. YCA Sumsilui — Website Design

**Date:** 2026-09-24
**Status:** Approved by client in brainstorming session
**Project root:** `C:\Users\macmi\Documents\Br YCA SUMSILUI`

## 1. Summary

A public website for the Sumsilui branch of the Young Chakma Association (YCA), Mizoram — a
Chakma community NGO whose parent body was established in 1978. The site publishes the branch's
executive members, notices and press releases, photo gallery, work progress on projects, and its
financial records in full public view. Office-bearers maintain all content through a
password-protected admin area with role-based permissions.

Visually the site follows the YCA emblem — white, green and red — interpreted as a clean,
institutional design rather than a decorated one.

## 2. Goals

1. A visiting community member can answer, in under a minute: who runs this branch, what is
   happening when, what work has been done, and where the money went.
2. Financial records are public, per financial year, with totals that cannot be arithmetically
   wrong (computed server-side from an integer-paise ledger).
3. Three office-bearers with different responsibilities can maintain the site without being able
   to damage each other's data or the user list.
4. The site is usable on a slow mobile connection in Sumsilui.

### Non-goals (explicitly out of scope for v1)

- Online payment collection. The donate page displays bank and UPI details; it does not process
  transactions.
- Multi-branch or state-level YCA site. This is the Sumsilui branch only.
- Member login for ordinary community members. Only admin accounts authenticate.
- Automated SMS/WhatsApp broadcast of notices.
- Translation of the whole site. Bilingual text exists on notices only.

## 3. Constraints

- **Budget:** free tiers only. Vercel Hobby, MongoDB Atlas M0 (512 MB), Cloudinary free
  (25 GB bandwidth/storage).
- **Connectivity:** low-bandwidth, mobile-first. This drives server-rendered public pages,
  Cloudinary's automatic WebP/resize, and a JS budget on public pages.
- **Existing assets:** the YCA emblem supplied by the client
  (`C:\Users\macmi\Downloads\yca.jpg`, copied to `assets/yca.jpg` in this repo) is the source
  logo.
- **Client maintains content**, not a developer. Every admin screen must be writable by someone
  whose expertise is accounting or community work, not software.

## 4. Architecture

```
Browser
  ├── public pages  → Next.js Server Components → MongoDB Atlas (read)
  │                 → Cloudinary CDN (images)
  └── /admin        → React client components → /api/* route handlers
                                                  → session check (Mongo)
                                                  → role check
                                                  → zod validation
                                                  → MongoDB Atlas (read/write)
                                                  → Cloudinary (signed upload)
```

One Next.js 15 App Router project in TypeScript, deployed to Vercel. MongoDB Atlas is the only
database. There is no separate API server and no ORM: a thin `lib/db.ts` exposes a cached
`MongoClient` singleton plus typed collection accessors, which keeps the data layer inspectable
and avoids an abstraction the project does not need.

**Why server components for public pages:** the HTML for a notice arrives in one small response,
so first paint does not wait on a JS bundle plus a client fetch. It also makes notices indexable
by search engines, which matters for a public-facing NGO.

**Why Cloudinary instead of Mongo for images:** an M0 cluster's 512 MB would be consumed by a
single event's worth of phone photographs. Cloudinary also transforms images on the fly, which is
the difference between a 4 MB gallery thumbnail and a 60 KB one.

### Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript, React Server Components |
| Styling | Tailwind CSS with design tokens defined in §5 |
| Database | MongoDB Atlas M0, official `mongodb` driver |
| Auth | Custom session-cookie auth (`bcryptjs` + random tokens), no auth provider |
| Images | Cloudinary, server-signed uploads |
| Charts | Recharts (lazy-loaded, admin and finance pages only) |
| Validation | zod schemas shared between client forms and API handlers |
| Testing | Vitest (unit), Playwright (flows) |
| Fonts | `next/font` (self-hosted; no Google Fonts request at runtime) |

## 5. Design system

Colours taken from the YCA emblem and restrained for legibility. Red is an accent, never a large
fill — a big red panel reads as an error, not as an institution.

```
--color-green-900  #06411F   footer background, deepest text-on-green
--color-green-700  #0B7A3E   primary: nav, buttons, headings, links
--color-green-500  #12A05A   hover/active, success state, positive balance
--color-green-100  #E3F2E8   section tint, table stripe
--color-red-700    #C8102E   donate button, alerts, deficit state, active nav marker
--color-red-100    #FBE6E9   alert background
--color-ink        #14231B   body text
--color-ink-muted  #5A6B60   captions, metadata
--color-paper      #FFFFFF   page background
--color-paper-alt  #F7F9F7   alternating sections
--color-line       #DCE5DE   borders, dividers
```

Typography: **Fraunces** for the association name and page titles — a serif carries the
institutional weight the circular seal already implies. **Public Sans** for body, navigation and
all admin UI. **Noto Sans Bengali** and **Noto Sans Chakma** are loaded only on routes that
render Bangla or Chakma text, so no visitor downloads a font they will not read.

Layout: 1140 px content max-width, 12-column desktop grid collapsing to a single column at
768 px; 8 px spacing scale; 4 px radius on controls, 12 px on cards; header shows the circular
emblem beside a two-line lockup — "Young Chakma Association" / "Sumsilui Branch · Mizoram". The
emblem's lamp motif appears as a small inline SVG divider on section headings.

Accessibility: WCAG 2.1 AA contrast on every text/background pair (the green-700/white and
red-700/white pairs both pass at body size); visible focus rings; skip-to-content link; gallery
requires alt text at upload time; all tables have proper `<th scope>`; the finance year selector
is a native `<select>`; charts always have an equivalent data table below them, which is also the
no-JS fallback.

## 6. Data model

All collections live in the `yca_sumsilui` database. Money is stored as **integer paise**
(`₹1,250.50` → `125050`). Every `_id` is an ObjectId unless noted. Timestamps are ISO dates.

### `users`
`email` (unique, lowercased), `passwordHash`, `name`, `phone`, `role`
(`super_admin` | `editor` | `treasurer`), `active` (bool), `lastLoginAt`, `createdAt`.

### `sessions`
`tokenHash` (unique — SHA-256 of the issued token), `userId`, `expiresAt`, `createdAt`,
`userAgent`. Index on `userId` so a deactivation can delete all of a user's sessions.

### `members`
`name`, `memberType` (`office_bearer` | `community_member`), `position` (free text: President,
Vice President, General Secretary, Joint Secretary, Treasurer, Executive Member…), `term`
(e.g. `2026-2028`), `photoUrl`, `phone`, `email`, `address`, `ward`, `order` (int, controls display
sequence), `current` (bool — false moves them to a "Past office-bearers" list),
`showContactPublicly` (bool, default false).

One collection serves both pages: `/executive-members` shows `memberType: office_bearer` with
`current: true` sorted by `order`, and `/members` shows `memberType: community_member`.
`current` is meaningless for ordinary community members and is not exposed on their form.

### `notices`
`slug` (unique), `titleEn`, `bodyEn`, `titleBn`, `bodyBn`, `titleCdp`, `bodyCdp` (Chakma script),
`kind` (`notice` | `press_release` | `announcement`), `status` (`draft` | `published`),
`publishedAt`, `eventDate`, `venue`, `attachments[]` (`{ name, url, mimeType, size }`),
`authorId`, `createdAt`, `updatedAt`.

`titleBn`/`bodyBn`/`titleCdp`/`bodyCdp` are optional. The public language toggle for a notice only
renders the languages that are non-empty.

### `financialYears`
`label` (e.g. `2026-27`), `startDate`, `endDate` (April 1 → March 31, Indian fiscal year),
`openingBalancePaise`, `locked` (bool), `lockedAt`, `lockedBy`, `unlockReason`, `auditPdfUrl`.

### `transactions`
`yearId`, `date`, `type` (`income` | `expense`), `category`, `description`, `amountPaise`,
`voucherNo`, `party` (`receivedFrom` for income, `paidTo` for expense), `projectId` (optional link),
`entryById`, `createdAt`, `revisions[]` (`{ at, byId, changes, reason }`).

Categories are a fixed list defined in `lib/finance-categories.ts` so category charts stay
comparable across years: income — `subscription`, `donation`, `event_collection`,
`grant`, `interest`, `other_income`; expense — `event`, `community_welfare`, `education`, `youth`,
`administration`, `maintenance`, `relief`, `other_expense`.

`revisions` exists because an NGO ledger that can be silently edited is not a transparent ledger.
The public finance page shows the current values; the revision trail is visible to admins.

### `donations`
`donorName`, `amountPaise`, `date`, `purpose`, `acknowledgePublicly` (bool), `transactionId`.
Saving a donation always creates its paired `income` transaction in the same handler. The
transaction is not separately editable or deletable while the donation exists — the donation form
is the only way to change it — so the acknowledgement list and the ledger cannot drift apart.

### `projects`
`slug`, `title`, `description`, `status` (`proposed` | `ongoing` | `completed` | `deferred`),
`startDate`, `targetDate`, `completedDate`, `sanctionedAmountPaise`, `beneficiaries`, `location`,
`coverImageUrl`, `order`.

A project's spend is **derived** by summing transactions that carry its `projectId`, not typed in.
This is deliberate: two independently maintained numbers always disagree eventually.

### `projectUpdates`
`projectId`, `date`, `text`, `photos[]`, `percentComplete`. The work-progress timeline on a
project page, newest first.

### `galleryItems`
`album`, `caption`, `alt`, `imageUrl`, `thumbUrl`, `takenAt`, `eventId` (optional link to a
notice), `order`, `uploadedById`.

### `settings`
Single document, `key: "site"`. Branch name, registration number, founding year of the branch,
address, phone, email, Facebook/WhatsApp links, about and mission text, bank name/branch/account
number/IFSC, UPI ID, homepage banner images, footer note.

Read by public pages (contact, donate, about, footer) so the client can correct a phone number
without a code change.

### `loginAttempts`
`key` (`email|ip`), `count`, `firstAt`, `expiresAt`. Supports the rate limit in §8.

## 7. Routes

### Public

| Path | Content |
|---|---|
| `/` | Hero with emblem and branch identity; latest 4 notices; ongoing works with progress bars; current-FY income/expense/balance summary; photo strip; quick contact |
| `/about` | Mission, history of YCA since 1978, founding of the Sumsilui branch, objectives (all from `settings`) |
| `/executive-members` | Card grid of current office-bearers with photo, position, term; contact shown only where `showContactPublicly`; past office-bearers below |
| `/members` | Community member directory: name + ward/position only, searchable by name, paginated |
| `/notices` | Filter by kind, paginated, newest first |
| `/notices/[slug]` | Single notice, language toggle, attachments, related event date/venue |
| `/press-releases` | Same data source as notices, filtered to `kind: press_release` |
| `/works` | Project cards grouped by status, with sanctioned amount, spent, percent complete |
| `/works/[slug]` | Project detail + update timeline + photos |
| `/gallery` | Albums, masonry grid, lightbox viewer |
| `/finance` | Year selector; summary cards; income-vs-expense chart; category breakdown; recent transactions; link to audit PDF |
| `/finance/[year]` | Full ledger for one year, filterable by type/category, CSV export |
| `/donate` | Bank + UPI details from settings; acknowledgement list of public donations; note that receipts are issued by the Treasurer |
| `/contact` | Address, phone, email, office-bearer contacts, map embed |

Public pages are cached with `revalidatePath` on write, so a notice published by an editor appears
immediately without a rebuild.

### Admin (`/admin`, sidebar layout)

`/admin` dashboard (drafts, recent activity, current-FY figures) · `/admin/members` ·
`/admin/notices` (new/edit, per-field language tabs) · `/admin/works` and `/admin/works/[id]/updates` ·
`/admin/gallery` (multi-upload, album assignment) · `/admin/finance` (years, transactions,
category view, lock action) · `/admin/donations` · `/admin/users` (super-admin) ·
`/admin/settings` (super-admin).

`/admin/login` sits outside the sidebar layout. Middleware redirects unauthenticated requests under
`/admin` to login and redirects an authenticated visitor away from it. Middleware does **not**
authorise roles — every handler re-checks (§8).

### API

`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` ·
`GET|POST /api/members`, `PATCH|DELETE /api/members/[id]` ·
`GET|POST /api/notices`, `PATCH|DELETE /api/notices/[id]` ·
`GET|POST /api/projects`, `PATCH|DELETE /api/projects/[id]`, `GET|POST /api/projects/[id]/updates` ·
`GET|POST /api/gallery`, `PATCH|DELETE /api/gallery/[id]` ·
`GET|POST /api/finance/years`, `GET|POST /api/finance/transactions`,
`PATCH|DELETE /api/finance/transactions/[id]`, `GET /api/finance/summary?year=`,
`POST /api/finance/years/[id]/lock`, `POST /api/finance/years/[id]/unlock` ·
`GET|POST /api/donations` · `GET|POST /api/users`, `PATCH /api/users/[id]` (super-admin) ·
`GET|PATCH /api/settings` (patch super-admin) · `POST /api/upload`.

All list endpoints accept `page`, `limit`, and resource-specific filters. Write responses return
the saved document so the client does not refetch.

## 8. Authentication and authorization

**Login.** zod-validates input, looks up by lowercased email, compares against `passwordHash`
with bcrypt (cost 12). On success, generates 32 random bytes, stores the SHA-256 hash in `sessions`
with `expiresAt = now + 14 days`, and sets the token as a cookie: `httpOnly`, `secure`,
`sameSite: lax`, `path: /`, name `yca_session`. A failed lookup and a wrong password return the
identical message and take a comparable code path, so the endpoint does not confirm which emails
exist.

**Every mutating handler** runs through `requireRole(handler, ["editor","treasurer"])`, which reads
the cookie, resolves session → user, verifies `active` and non-expiry, and returns `401` (no or
expired session) or `403` (right session, wrong role). Nothing trusts a role, user id, or amount
supplied by the client.

**Role matrix**

| Capability | editor | treasurer | super_admin |
|---|---|---|---|
| Notices, press releases, gallery, projects, member list | write | write | write |
| Transactions, donations | — | write | write |
| Financial year lock | — | lock (closing direction, allowed) | lock and unlock |
| Users: invite, change role, deactivate | — | — | write |
| Settings (contact, bank, about) | read | read | write |
| Delete another user's content | — | — | write |

**Locking is the safe direction, so a treasurer may do it; reopening is not, so only super_admin
may unlock, and the unlock reason is stored.**

**Deactivation** sets `active: false` and deletes that user's sessions, so access ends within one
request rather than at token expiry.

**Login rate limit:** 5 failed attempts per email+IP per 15 minutes via `loginAttempts`, returning
`429` with a retry hint. Implemented in Mongo because the free tier gives us no Redis.

**CSRF:** `sameSite: lax` cookie plus a same-origin check on mutating requests in
`requireRole`. No state-changing endpoint accepts `GET`.

**Uploads:** the browser sends the file to `/api/upload`; the handler verifies MIME type
(`image/jpeg`, `image/png`, `image/webp`) and size (≤ 8 MB), then performs the Cloudinary upload
server-side using the API secret held as a Vercel env var. No unsigned preset, no client-side
upload.

**Content safety:** notice bodies accept a markdown subset (headings, bold, italic, lists, links)
rendered server-side and sanitised to an allowlist of tags and attributes. Raw HTML from the
database is never injected.

**Secrets:** `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `SESSION_SECRET` exist only as Vercel project env vars and in a local
`.env.local` that is gitignored. Nothing prefixed `NEXT_PUBLIC_` may contain a secret.

## 9. Error handling and resilience

Atlas M0 sleeps when idle, so the first request after a gap can take 3–5 seconds. The client is a
cached singleton promise with a 5-second operation timeout; public pages have `loading.tsx`
skeletons and an `error.tsx` boundary per route group.

- **Public read fails** → layout and navigation still render; the affected section shows
  "Details are temporarily unavailable — please try again." The finance summary shows that message
  rather than a stale figure. A wrong balance in an NGO is worse than no balance.
- **Write fails validation** → `400` with `{ error: { code, message, fieldErrors } }`; the form
  marks the offending fields and keeps everything the user typed.
- **Wrong role** → `403`, and the admin UI hides actions the current role cannot take so the
  refusal is rarely reached.
- **Locked year** → `409` with the lock date and who locked it.
- **Delete with dependents** → blocked with an explanation (a financial year with transactions, a
  project with updates) rather than cascading silently.
- **Upload fails** → the image is reported per-file; other form inputs survive.
- **Session expired mid-edit** → the form's data is kept in the tab, the user is sent to login, and
  returning to `/admin` resumes the edit.

Errors are logged server-side with a request id; the client sees a friendly message, never a stack
trace.

## 10. Testing

**Vitest unit tests** on the logic where a silent bug is expensive:
- paise↔rupee conversion and `₹` formatting (including `0`, sub-rupee, and > 1 crore values)
- financial-year assignment at boundaries — `2027-03-31` must fall in `2026-27`, `2027-04-01` in
  `2027-28`
- summary totals (income, expense, closing balance = opening + income − expense) against a fixture
  ledger
- `requireRole` for each role against each protected handler
- the lock rule: treasurer blocked from unlocking, super-admin allowed with a reason
- notice markdown sanitiser strips `<script>` and `on*` attributes

**Playwright flows** against a dedicated test database:
1. login → create a notice → it appears on `/notices` → logout → it is still public
2. treasurer adds an expense → `/finance` total and chart update
3. editor posting to `/api/finance/transactions` is refused with `403`
4. `/members` hides a phone number whose `showContactPublicly` is false

**Build and performance:** `next build` type-checks. Lighthouse on the homepage enforces the
low-bandwidth budget: ≤ 200 KB gzipped JS on public pages and Largest Contentful Paint < 3.5 s on
a simulated 4G connection.

**Manual verification before any completion claim:** dev server running, each admin screen
exercised in a real browser, public pages screenshotted at 375 px and 1440 px.

## 11. Setup

Prerequisites: Node 18.18+ (the client's machine has v24.18.0), a MongoDB Atlas M0 cluster, a
Cloudinary account, a Vercel account.

```
npm install
cp .env.example .env.local     # fill in MONGODB_URI, CLOUDINARY_*, SESSION_SECRET
npm run seed                   # creates indexes, settings doc, first super_admin
npm run dev
```

`npm run seed` is idempotent: it creates/verifies indexes (`sessions.tokenHash`,
`notices.slug`, `transactions.yearId+date`, `members.current+order`,
`galleryItems.album+order`, `projects.status+order`), inserts the default `settings` document, and
creates the first `super_admin` from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env.local`,
printing a warning to change that password on first login.

Atlas network access must allow Vercel's egress; the practical setting for a free-tier NGO site is
an Atlas allowlist of `0.0.0.0/0` combined with a dedicated database user whose password appears
only in `MONGODB_URI`. This is stated plainly because it is the weakest point in the design and
someone must own it.

## 12. Deployment

Vercel Hobby, connected to the repository. Preview deploys per pull request, production on merge to
`main`. Env vars set in the Vercel project for both environments. Domain: Vercel's free
`*.vercel.app` subdomain at first; a custom domain (e.g. `ycasumsilui.org.in`) is a DNS change plus
one env var update later, and is deliberately not part of v1.

## 13. Content the client will supply after launch

The site ships with representative placeholder content — sample members labelled as such, two
sample notices, one sample project, and one financial year with a handful of illustrative
transactions — so every screen is visible and reviewable. Real data is entered through the admin
area by office-bearers; no code change is needed to replace any of it. Before public launch the
client must confirm the placeholder content has been replaced or removed, in particular the
sample financial figures, since published numbers that are not real would undercut the site's
whole purpose.

## 14. Deliverables

1. Next.js application in this repository, running locally.
2. Seed script and `.env.example`.
3. Public pages listed in §7 with the design system in §5.
4. Admin area with the role model in §8.
5. Tests in §10 passing.
6. Written setup and deployment steps, including the exact Atlas and Cloudinary clicks.
