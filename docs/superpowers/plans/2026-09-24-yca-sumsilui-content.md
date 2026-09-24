# Br. YCA Sumsilui — Plan 2: Content

> **For agentic workers:** implement task-by-task with
> superpowers:executing-plans or subagent-driven-development. Steps use
> checkbox (`- [ ]`) syntax.

**Goal:** replace every piece of sample content on the public site with
MongoDB-backed records an editor can create and edit in `/admin`.

**Architecture:** the same shape Plan 1 established — a plain `mongodb`
collection per resource, a zod schema in `src/lib/validation/`, a
`requireRole`-wrapped route handler, a server-rendered page that reads through
`src/lib/content.ts`, and a client form component that calls the API. Public
pages keep `revalidate = 300`; every write calls `revalidatePath` so a published
notice appears without a redeploy.

**Spec:** `docs/superpowers/specs/2026-09-24-yca-sumsilui-website-design.md`
§6 (members, notices, projects, projectUpdates, galleryItems), §7, §8, §10.

## How this plan differs from Plan 1

Plan 1's document carried every line of code. This one names the files, the
exact exported signatures, and the acceptance test for each task, and leaves the
bodies to the task in which they are written — because Plan 1's code is now in
the repository and is the pattern to copy. Where this document states a
signature, later tasks must use it verbatim.

## Global constraints

Inherited from Plan 1 and unchanged:

- Money is integer paise. Dates compare as `YYYY-MM-DD` strings.
- `requireRole(request, allowed, handler)` is the only authorisation gate.
  `super_admin` passes implicitly; an empty allowlist means super-admin only.
- Mutating requests must pass the same-origin check inside `requireRole`.
- Nothing is invented. A field no one has typed renders as "not published yet".
- The Cloudinary API secret never reaches the browser; uploads are verified
  server-side as `image/jpeg | image/png | image/webp`, max 8 MB.
- `npm run build` must never run while `npm run dev` is up (they share `.next`).
- Verification for every task: `npm run typecheck && npx vitest run`, plus the
  task's own e2e spec via `npm run seed:test && PLAYWRIGHT_CHANNEL=chrome npx playwright test`.

---

## Task 1: Content collections, types and indexes

**Files:**
- Modify: `src/lib/types.ts` (add `MemberDoc`, `NoticeDoc`, `ProjectDoc`,
  `ProjectUpdateDoc`, `GalleryItemDoc`)
- Modify: `src/lib/index-specs.ts` (five collections)
- Modify: `src/lib/content.ts` (the public view-models stop being sample-only)
- Test: `tests/unit/index-specs.test.ts`

**Produces:**
- `COLLECTIONS.members | notices | projects | projectUpdates | galleryItems`
- Unique indexes: `members` none, `notices.slug`, `projects.slug`.
  Non-unique: `notices.status+publishedAt`, `notices.kind+publishedAt`,
  `members.memberType+current+order`, `projects.status+order`,
  `galleryItems.album+order`, `projectUpdates.projectId+date`.

- [ ] Step 1: extend the failing index-spec test with the five collections and
      the slug uniqueness, then make it pass.
- [ ] Step 2: add the doc types. `notices` carries `titleEn/bodyEn` plus
      optional `titleBn/bodyBn/titleCdp/bodyCdp`, `kind`, `status`,
      `publishedAt`, `eventDate`, `venue`, `attachments[]`, `authorId`.
- [ ] Step 3: `npm run seed` against the local database and confirm
      `mongosh` lists the new indexes.
- [ ] Step 4: commit `feat: add content collections and indexes`.

---

## Task 2: Notices — editor, API and the real `/notices`

**Files:**
- Create: `src/lib/validation/notices.ts`, `src/lib/notices.ts`,
  `src/app/api/notices/route.ts`, `src/app/api/notices/[id]/route.ts`,
  `src/app/admin/notices/page.tsx`, `src/app/admin/notices/[id]/page.tsx`,
  `src/components/admin/NoticesTable.tsx`, `src/components/admin/NoticeForm.tsx`
- Modify: `src/lib/content.ts` (`getNotices`/`getNoticeBySlug` read Mongo,
  falling back to sample content only when the collection is empty),
  `src/lib/nav.ts` (notices row already exists)
- Test: `tests/e2e/notices.spec.ts`

**Produces:**
- `NOTICE_SCHEMA` — `slug` (auto-derived from `titleEn`, editable, unique,
  `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`), `titleEn` 3-160, `bodyEn` ≥ 1, `kind` enum,
  `status` enum, optional `titleBn/bodyBn/titleCdp/bodyCdp`, `eventDate`,
  `venue`.
- `listNotices(filter)`, `getNotice(id)`, `createNotice`, `updateNotice`,
  `publishNotice`, `deleteNotice`.
- API: `GET|POST /api/notices` allowlist `["editor"]`;
  `GET|PATCH|DELETE /api/notices/[id]` allowlist `["editor"]`.
- A draft is invisible to the public list and 404s by slug.

**Acceptance (e2e):** an editor writes a notice in English and Chakma, saves it
as a draft, sees it in `/admin/notices` marked Draft, finds it absent from
`/notices`, publishes it, and it appears on `/notices` and `/` without a
restart; the language toggle shows only the two languages that have text; a
duplicate slug returns the field error "That web address is already used".

- [ ] Commit `feat: add notices with draft/publish and per-language text`.

---

## Task 3: Members — office-bearers and the community directory

**Files:**
- Create: `src/lib/validation/members.ts`, `src/lib/members.ts`,
  `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`,
  `src/app/admin/members/page.tsx`, `src/components/admin/MembersTable.tsx`,
  `src/components/admin/MemberForm.tsx`
- Modify: `src/app/executive-members/page.tsx`, create
  `src/app/members/page.tsx`
- Test: `tests/e2e/members.spec.ts`

**Produces:**
- `MEMBER_SCHEMA` — `name` 2-80, `memberType` enum, `position`, `term`
  (`/^\d{4}-\d{4}$/` or blank), `order` int ≥ 0, `current` bool,
  `showContactPublicly` bool default false, `phone`, `email`, `address`,
  `ward`, `photoUrl`.
- `listMembers({ memberType, current })` sorted by `order` then `name`.
- Phone and email are omitted from the public payload unless
  `showContactPublicly` is true — enforced in `toPublicMember`, not in the UI.
- `current: false` renders under "Past office-bearers".

**Acceptance (e2e):** the president, entered with `showContactPublicly` off,
appears on `/executive-members` with position and term and no contact line;
turning it on publishes the phone; a past office-bearer moves below the current
list; an ordinary community member appears only on `/members`.

- [ ] Commit `feat: add office-bearer and member directories`.

---

## Task 4: Works — projects and their progress timeline

**Files:**
- Create: `src/lib/validation/projects.ts`, `src/lib/projects.ts`,
  `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`,
  `src/app/api/projects/[id]/updates/route.ts`,
  `src/app/admin/works/page.tsx`, `src/app/admin/works/[id]/page.tsx`,
  `src/components/admin/ProjectsTable.tsx`, `src/components/admin/ProjectForm.tsx`,
  `src/components/admin/ProjectUpdates.tsx`
- Modify: `src/app/works/page.tsx`, `src/app/works/[slug]/page.tsx`
- Test: `tests/e2e/works.spec.ts`

**Produces:**
- `PROJECT_SCHEMA` — `slug`, `title`, `description`, `status` enum,
  `startDate`, `targetDate`, `completedDate`, `sanctionedAmountPaise` (int ≥ 0),
  `beneficiaries` (int ≥ 0), `location`, `coverImageUrl`, `order`.
- `PROJECT_UPDATE_SCHEMA` — `date`, `text`, `percentComplete` 0-100, `photos[]`.
- `percentComplete` on a project card is the **latest** update's value; a
  project with no updates shows "No progress report yet", never 0%.
- Spend stays derived (Plan 3 wires it to transactions); until then the card
  shows the sanctioned amount and "Spent — published with the accounts".

**Acceptance (e2e):** an editor creates a project, adds two dated updates, and
`/works/[slug]` lists them newest first with the progress bar at the second
update's percentage; a project with no updates shows no percentage; deleting the
project deletes its updates in the same handler.

- [ ] Commit `feat: add works with a dated progress timeline`.

---

## Task 5: Uploads and gallery

**Files:**
- Create: `src/lib/cloudinary.ts`, `src/lib/validation/gallery.ts`,
  `src/lib/gallery.ts`, `src/app/api/upload/route.ts`,
  `src/app/api/gallery/route.ts`, `src/app/api/gallery/[id]/route.ts`,
  `src/app/admin/gallery/page.tsx`, `src/components/admin/GalleryUploader.tsx`
- Modify: `src/app/gallery/page.tsx`, `src/lib/env.ts` (Cloudinary vars become
  required only when the upload route is reached, not at boot)
- Test: `tests/e2e/gallery.spec.ts`

**Produces:**
- `uploadToCloudinary(buffer, { folder, publicId })` — server-side only, reads
  `CLOUDINARY_*` from the environment, signs the request with the API secret.
- `POST /api/upload` — accepts one file, allowlist `["editor"]`, verifies the
  magic bytes rather than the claimed MIME type, rejects > 8 MB with
  `file_too_large`, returns `{ url, thumbUrl, publicId }`.
- `galleryItems` store `album`, `caption`, `alt` (required — the grid is read
  by screen readers), `imageUrl`, `thumbUrl`, `takenAt`, `order`.
- `/gallery` groups by album; a photo without a caption renders the alt text.

**Acceptance (e2e):** a real 1×1 PNG posted through `/api/upload` returns a URL
and appears in `/gallery` under its album; a file whose bytes are not an image
is refused with 400 even when its declared type says `image/png`; a 9 MB body
is refused before anything is sent upstream. Where Cloudinary credentials are
absent the route returns `503 upload_not_configured` and the admin screen says
so plainly instead of failing with an unknown error.

- [ ] Commit `feat: add signed Cloudinary uploads and the gallery`.

---

## Task 6: Retire the sample content

**Files:**
- Modify: `src/lib/content.ts` (delete `SAMPLE_NOTICES`, `SAMPLE_PROJECTS`,
  the sample `finance` block and `isSample`), `src/app/page.tsx`,
  `src/app/about/page.tsx`, `src/app/admin/page.tsx`
- Test: `tests/unit/content.test.ts`

**Produces:**
- `getHomepageContent()` returns real published notices, real ongoing works,
  the real current-year finance summary (zeros until Plan 3, labelled as such),
  and the real gallery strip.
- `isSample` disappears, and with it the `DEMO CONTENT` / `DEMO FIGURES` badges
  — the only place they are allowed to survive is the finance section until real
  ledger data exists, where the label must stay.
- `/about` reads `missionText`, `aboutText`, `branchFoundedYear` and
  `registrationNo` from settings. The one approved historical fact — "Young
  Chakma Association was established in 1978" — stays in prose.
- An empty collection renders the section's "Nothing published yet" state, not a
  blank gap and not a sample.

**Acceptance:** `grep -rn "SAMPLE_" src/` returns nothing. The homepage with an
empty database shows four section headings, each with its empty-state sentence,
and no invented rupee amounts anywhere.

- [ ] Commit `refactor: read the homepage and about page from the database`

---

## Task 7: Sidebar, dashboard and the closing pass

**Files:**
- Modify: `src/lib/nav.ts` (members/notices/works/gallery become available once
  their screens exist), `src/app/admin/page.tsx` (real counts and the draft
  list), `README.md`, `docs/deployment.md`
- Test: `tests/e2e/admin-nav.spec.ts`

- [ ] Commit `feat: complete the content admin screens`.

---

## Definition of done for Plan 2

- [ ] `npx vitest run`, `npm run typecheck`, `npm run build` all pass.
- [ ] `npm run seed:test && npx playwright test` passes across auth, settings,
      users, notices, members, works, gallery.
- [ ] No `SAMPLE_` identifier remains in `src/`.
- [ ] An editor with no super-admin help can publish a notice, add an
      office-bearer, log a work update and add a photo.
- [ ] Every public page still renders when MongoDB is unreachable, with the
      affected section saying so.

## Deferred to Plan 3 and 4

Financial years, transactions, donations, locks and charts (Plan 3). Search
pagination on `/members`, the lightbox, Lighthouse budget, CSV export, and the
§9 rule that form state survives a session expiring mid-edit (Plan 4).
