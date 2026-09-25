# Deployment

Everything outside the code, in the order that works. Nothing here is optional
except where it says so, and the three traps worth reading twice are marked
**Careful**.

---

## 1. MongoDB Atlas (free M0)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and create an account.
2. When it asks for a plan, choose **Free / M0**. The paid trials convert
   themselves into a bill if you leave them running.
3. Choose the cluster region **ap-south-1 (Mumbai)**. It is the closest region to
   Mizoram; on a slow mobile connection the difference in how long a page takes
   is the most noticeable thing in this list.
4. Set the cluster name to something you will recognise later, e.g.
   `yca-sumsilui`. Leave the default TTL and backup settings alone — M0 has
   neither, which is one reason the site's own data has to be small and
   re-creatable.
5. **Database Access → Add New Database User.**
   - Username: something new, used for nothing else.
   - Password: **Careful** — use only letters and digits, no `@ : / ? # [ ]`.
     The password is pasted into a connection URL, and a single `@` or `/` makes
     the driver fail with an error that does not mention the password at all.
     Generate a long random one and store it in a password manager.
   - Role: `Read and write to any database`.
6. **Network Access → Add IP Address → Allow Access From Anywhere**, which adds
   `0.0.0.0/0`.
   - This is deliberate. Vercel's Hobby plan does not give you a fixed list of
     outbound IPs, so an allowlist would have to be edited every time a
     deployment moves.
   - The compensating control is that this database user exists for this one
     purpose, its password appears nowhere except `MONGODB_URI`, and it can only
     reach this cluster over TLS. Anyone who wants in has to have your Vercel
     project's environment first.
7. **Connect → Drivers → Copy.** It looks like:

       mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority

   Replace `<user>` and `<password>`. In `.env.local` set it as `MONGODB_URI`,
   and set `MONGODB_DB=yca_sumsilui`.
8. Run `npm run seed` **once**, locally. It creates every collection and index,
   the settings document, and the first super-admin from `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD`. Nothing else in the project creates indexes.
9. Sign in at `/login`, change nothing yet, and confirm the dashboard opens. If
   the seed worked and the login does not, the problem is `MONGODB_DB` pointing
   at a different database than the seed used.

Re-running `npm run seed` is safe: it reports `already exists — nothing to
create` and leaves any settings an office-bearer has typed untouched.

There is **no** `SESSION_SECRET`. Sessions are random 32-byte tokens stored
hashed in the `sessions` collection, so there is nothing to sign and nothing to
rotate if the site is redeploied — a signed-in editor stays signed in.

---

## 2. Cloudinary

Needed for photo uploads. The gallery works without it — an office-bearer adds a
picture by its web address — but an uploaded file is refused until the three
values below are set.

1. Sign up at <https://cloudinary.com/users/register/free> and note the **Cloud
   name** shown in the dashboard header.
2. **Settings → API Keys**: copy the API Key and API Secret. The secret is
   server-side only — it must never appear in a `NEXT_PUBLIC_*` variable or in
   any file under `src/` that a browser downloads.
3. **Settings → Upload → Upload presets → Add upload preset**, and set the
   **Signing Mode to `Authenticated`** (not "unsigned").
   - **Careful** — an unsigned preset lets anyone on the internet write files
     into the branch's photo library using only your cloud name. The free tier
     then burns out on someone else's uploads, and the gallery becomes a place
     strangers can post to.
   - Note the preset's **Folder** prefix, e.g. `yca-sumsilui/`, so the site's
     images are separable from anything else in the account.
   - This site does **not** read the preset. Every upload is signed with the API
     secret on the server, so the preset exists to keep the account honest if a
     browser ever uploads to it directly.
4. Put the values the site reads in `.env.local`: `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. `CLOUDINARY_UPLOAD_PRESET` is
   optional and unused by this code.

Uploads are verified on the server: JPEG, PNG or WebP only, 8 MB maximum. A file
the browser claims is a photo but whose bytes say otherwise is rejected before
anything reaches Cloudinary. While the three values above are missing, an upload
is refused with a plain explanation on the admin screen rather than a half-saved
picture, and a picture can still be added by its web address.

---

## 3. Vercel

1. Push the repository to GitHub. `.env.local` is gitignored — confirm with
   `git status --ignored` before the first push; if it is listed as tracked,
   stop and fix that before publishing anything.
2. Go to <https://vercel.com/new> and import the repository. Vercel detects
   **Next.js**; leave the build command (`npm run build`) and output directory
   empty so the defaults apply.
3. Add the environment variables under **Project → Settings → Environment
   Variables** for **Production, Preview and Development**:
   `MONGODB_URI`, `MONGODB_DB`, `BCRYPT_ROUNDS`, `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   Paste each value with no surrounding quotes or trailing space.
4. Deploy. Then check the two things that prove the wiring survived:
   - `https://<your-domain>/login` renders and a seeded account signs in.
   - `https://<your-domain>/api/auth/me` returns `401` while you are signed out.
     A `200` here from a fresh browser means sessions are leaking.
5. Run `npm run seed` locally once more with `MONGODB_URI` set to the Atlas
   string, if step 1.8 was done against a local database instead.

`BCRYPT_ROUNDS=12` in production. Lowering it makes stolen password hashes
cheaper to brute-force; the tests override it to `4` only because they create
hundreds of users and would otherwise spend minutes hashing.

---

## 4. After any change to `INDEX_SPECS`

Run `npm run seed` again. Indexes are created idempotently, and a missing one
shows up as a slow listing rather than an error, so it is easy to forget. If an
existing index's keys change but keep its name, Atlas will refuse the new
definition — drop the old index in **Data Explorer → Indexes** and re-run the
seed.

---

## 5. Launch checklist

- [ ] Every branch detail under **Settings** is filled in and correct: address,
      phone, email, office-bearer contacts, bank and UPI details. Anything left
      blank displays as "Not published yet", which is fine before launch and
      not fine after.
- [ ] A second super-admin account exists, so the role cannot be lost when
      someone leaves.
- [ ] Every sample notice and sample work created during development is
      deleted, or clearly labelled as a specimen.
- [ ] **No placeholder financial figures remain anywhere.** A made-up rupee
      amount published as the branch's accounts is a trust problem no redesign
      fixes. Finance data goes in only when the treasurer has verified it.
- [ ] The production ledger holds no `TEST-` voucher numbers. Those six lines are
      written only by `npm run seed:test`, only into `yca_sumsilui_test`, and only
      beside a year that script opens. If one appears on Atlas, a seed was run
      with the wrong `MONGODB_DB` — delete the lines and check the environment.
- [ ] The current year has been opened on Atlas with the opening balance the last
      audit closed on (§6), and the treasurer's own account has the `treasurer`
      role — not a shared super-admin.
- [ ] `/login` refuses five wrong passwords in fifteen minutes — try it once on
      production to confirm the `loginAttempts` collection is being written.
- [ ] The custom domain is attached, and every page still works over HTTPS.
      The session cookie is marked `Secure`, so an HTTP origin cannot set it and
      login appears to succeed but never sticks.

---

## 6. Keeping the year's accounts

None of this is a deploy step — it is what the branch does afterwards, and it is
written down here because the order matters once real money is in the database.

1. **Open the year** (**Admin → Finance**): the label (`2026-27`), the opening
   balance — which is what the last audited year closed with, not a figure typed
   from memory — and the address of the audited report if one exists. The report
   can be attached later, after the year closes; the year list has a box for it.
   Opening a year is the super-admin's or treasurer's call, and the app never
   opens one by itself: `npm run seed` deliberately does not.
2. **Enter the vouchers.** Each is a date inside the year, one head from the fixed
   list, a rupee amount, the voucher number on the paper, who the money came from
   or went to, and what it was for. A date outside every opened year is refused on
   the spot, which is why a contribution received in March belongs to the year it
   fell in rather than to whichever week it is typed.
3. **Record contributions on their own screen.** One entry writes the income
   voucher and the thank-you together, so `/donate` and the ledger can be checked
   against each other. The donor's name is published only if the box is ticked;
   unchecked, the figure still stands in the accounts as *Contribution (name with
   the Treasurer)*. Withdrawing a name later is a correction, not a deletion, so
   the money a member has already read stays where it was.
4. **Correct, don't delete.** A wrong line is edited with a sentence why. The old
   figure stays beside the new one in the year's audit trail, which is what an
   auditor reads when they ask how a number moved. Removing a line is for a line
   that should not have existed at all — it leaves no trace but the removal.
5. **Close the year when the audit is done.** A closed year takes no entries, and
   neither its vouchers nor its contributions can change. Reopening is a
   super-admin's act and asks for a reason, which is then printed beside the year
   for anyone who reads the list.

**During an outage the public pages say they cannot read the figures.** They do
not print `₹0`, and they do not say "nothing has been published" — an unreachable
database and an empty one are different answers, and only one of them is a claim
about the branch's money.
