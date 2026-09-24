import { initialsOf } from "@/lib/members";
import type { PublicMember } from "@/lib/content";

/**
 * One person on the committee page. A photograph is the branch's to supply, so
 * a card without one shows the person's initials on a plain field rather than a
 * stock face — an invented portrait on a page of real names would be worse than
 * a monogram.
 */
export function MemberCard({ member }: { member: PublicMember }) {
  return (
    <li className="flex h-full flex-col rounded-[12px] border border-line bg-paper p-5">
      <div className="flex items-center gap-4">
        {member.photoUrl ? (
          // The address comes from the branch's own upload, whose host is not
          // known at build time, so this stays a plain img until the upload
          // screen fixes the host in `images.remotePatterns`.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photoUrl}
            alt={member.name}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-green-100 font-display text-lg font-semibold text-green-900"
          >
            {initialsOf(member.name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[17px] leading-snug text-green-900">{member.name}</h3>
          {member.position ? <p className="mt-0.5 text-sm text-ink">{member.position}</p> : null}
        </div>
      </div>

      <p className="mt-3 flex-1 text-xs uppercase tracking-[0.1em] text-ink-muted">
        {member.term ?? "Term not published"}
      </p>

      {member.phone || member.email ? (
        <ul className="mt-3 space-y-1 text-sm">
          {member.phone ? (
            <li>
              <a
                href={`tel:${member.phone.replace(/[^+\d]/g, "")}`}
                className="text-green-700 hover:text-green-500"
              >
                {member.phone}
              </a>
            </li>
          ) : null}
          {member.email ? (
            <li>
              <a
                href={`mailto:${member.email}`}
                className="break-all text-green-700 hover:text-green-500"
              >
                {member.email}
              </a>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}
