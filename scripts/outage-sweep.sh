#!/usr/bin/env bash
# §9 outage sweep: with the database unreachable, every public page must stay
# standing and name the outage. It must never print ₹0, "not published yet", a
# placeholder the branch never gave, or a stack trace — an unreachable database
# is not a branch that published nothing.
#
# Run it in three steps, in this order:
#
#   MONGODB_DB=yca_sumsilui_test npm run dev &      # healthy server
#   scripts/outage-sweep.sh collect                 # remember a real work and notice
#
#   kill the server, then start it against a port nothing listens on:
#   MONGODB_URI="mongodb://127.0.0.1:59999/?directConnection=true" \
#     MONGODB_DB=yca_sumsilui_test npm run dev &
#   scripts/outage-sweep.sh sweep                   # the check itself
#
# The environment beats .env.local, so the dead URI needs no file edited. Exit is
# 0 only when every page passes.
#
# Run against a healthy server this fails by design — those pages are not naming
# an outage, and a settings field the branch never filled in really does say "not
# published yet" and a zero balance really does print ₹0. The point of the check
# is that the two answers never swap places: an unreachable database may borrow
# neither the sentence belonging to an empty one nor the figure belonging to a
# year nobody has entered anything against.
set -u
BASE="${YCA_BASE_URL:-http://localhost:3000}"
SLUG_FILE="${TMPDIR:-/tmp}/yca-slug.txt"
NOTICE_FILE="${TMPDIR:-/tmp}/yca-notice.txt"

# Pages whose content is a list the database holds, so each has to say the
# figures or notices could not be read. The year's label is the address of the
# year the test database opens. /about and /contact are prose with a few settings
# in them, so they are checked for invention rather than for the sentence.
# An array, not a space-separated string: a query address holds a `?`, and an
# unquoted expansion would hand that to the glob matcher.
LIST_PAGES=(/ /finance /finance/2026-27 /works /notices /press-releases /gallery /members /executive-members /donate)
# The last two are the same lists with a reader's question attached: a search that
# cannot be answered names the outage rather than the empty register it cannot
# rule out, and a page number is not an excuse to invent a figure.
QUERY_PAGES=("/members?q=chakma&page=2" "/notices?page=2")
PROSE_PAGES=(/about /contact)

case "${1:-}" in
collect)
  # Anchored on the anchor tag: the dynamic route itself appears in the page as
  # `/works/page`, which is an address inside the framework, not a work.
  html="$(curl -s -m 90 "$BASE/works")"
  slug="$(printf '%s' "$html" | grep -o 'href="/works/[^"]*"' | head -1 | cut -d/ -f3 | cut -d'"' -f1)"
  notices="$(curl -s -m 90 "$BASE/notices")"
  notice="$(printf '%s' "$notices" | grep -o 'href="/notices/[^"]*"' | head -1 | cut -d/ -f3 | cut -d'"' -f1)"
  if [ -z "$slug" ] || [ -z "$notice" ]; then
    echo "collect: a work and a notice are both needed (work='$slug' notice='$notice')"
    exit 1
  fi
  printf '%s' "$slug" > "$SLUG_FILE"
  printf '%s' "$notice" > "$NOTICE_FILE"
  echo "collect: will sweep /works/$slug and /notices/$notice"
  ;;
sweep)
  slug="$(cat "$SLUG_FILE" 2>/dev/null || true)"
  notice="$(cat "$NOTICE_FILE" 2>/dev/null || true)"
  # A work or a notice that exists is as unreadable as the list that holds it, so
  # the detail pages name the outage on the same terms as their list does.
  pages=("${LIST_PAGES[@]}" "${QUERY_PAGES[@]}")
  [ -n "$slug" ] && pages+=("/works/$slug")
  [ -n "$notice" ] && pages+=("/notices/$notice")
  must_name=("${pages[@]}")
  pages+=("${PROSE_PAGES[@]}")

  fail=0
  for p in "${pages[@]}"; do
    body="$(mktemp)"
    code="$(curl -s -o "$body" -w '%{http_code}' -m 120 "$BASE$p")"
    # React puts a comment between two pieces of text it prints side by side, so
    # the sentence is only a sentence once those markers are out.
    flat="$(sed 's/<!-- -->//g' "$body")"
    says="$(grep -c "temporarily unavailable" "$body" || true)"
    shell="$(grep -o 'aria-label="Main"' "$body" | head -1 || true)"
    zero="$(grep -o '₹0' "$body" | head -1 || true)"
    # An unreachable register is not an empty one, so the copy that belongs to a
    # search finding nothing is as much a lie here as the copy for a branch that
    # published nothing. The `yet` is what tells the two apart: the directory's own
    # description says family details "are not published", which is true on an
    # outage too.
    placeholder="$(grep -ioE 'not (been )?published yet|matches that name|example\.(com|test)|your-.*-here|TODO|lorem' "$body" | head -1 || true)"
    # The section's own name and its verb have to agree; a sentence that names the
    # outage but reads as a mistake is still a mistake in front of a reader.
    wants=("")
    case "$p" in
    /members*) wants=("The member register is temporarily unavailable") ;;
    /executive-members) wants=("The office-bearer list is temporarily unavailable") ;;
    /donate) wants=("The account details are temporarily unavailable" "The list of contributions is temporarily unavailable") ;;
    /notices/*) wants=("This notice is temporarily unavailable") ;;
    /notices*) wants=("Notices are temporarily unavailable") ;;
    /press-releases) wants=("Press releases are temporarily unavailable") ;;
    /works/*) wants=("This work is temporarily unavailable") ;;
    /works) wants=("Works are temporarily unavailable") ;;
    /gallery) wants=("The photographs are temporarily unavailable") ;;
    esac
    grammar=""
    for want in "${wants[@]}"; do
      [ -z "$want" ] && continue
      printf '%s' "$flat" | grep -qF "$want" || grammar="missing: $want"
    done
    # `next/dist/` is deliberately not matched: a dev-mode page lists the
    # framework's own module paths in its payload on every request, so failing on
    # it would say nothing about a leak. What has to stay out is a failure a
    # reader can see — the error boundary's own words, or the driver's error name.
    trace="$(grep -o 'Application error\|Minified React error\|Unhandled Runtime Error\|Unhandled Server Error\|MongoServerSelectionError\|MongoNetworkError\|SyntaxError\|Internal Server Error' "$body" | head -1 || true)"

    is_prose=0
    for named in "${PROSE_PAGES[@]}"; do [ "$named" = "$p" ] && is_prose=1; done

    verdict="OK"
    # §9: the layout and its navigation still stand — only the section that could
    # not be read gives up its own figure.
    if [ "$code" != "200" ] || [ -z "$shell" ] || [ -n "$zero" ] || [ -n "$trace" ] || [ -n "$placeholder" ] ||
      [ -n "$grammar" ]; then
      verdict="FAIL"; fail=1
    elif [ "$is_prose" = 0 ] && [ "$says" -lt 1 ]; then
      verdict="FAIL"; fail=1
    fi
    printf '%-5s %-40s code=%s nav=%s outage-named=%s zero=%s placeholder=%s trace=%s %s\n' \
      "$verdict" "$p" "$code" "${shell:+yes}" "$says" "${zero:-no}" "${placeholder:-no}" "${trace:-no}" "${grammar:-}"
    rm -f "$body"
  done
  if [ "$fail" = 0 ]; then
    echo "sweep: every page names the outage or holds its prose, and none invents a figure"
  fi
  exit "$fail"
  ;;
*)
  echo "usage: scripts/outage-sweep.sh collect|sweep"
  exit 2
  ;;
esac
