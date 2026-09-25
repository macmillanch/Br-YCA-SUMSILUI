export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[12px] border border-dashed border-line bg-paper-alt p-8">
      <h2 className="text-lg">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-6 text-ink-muted">{body}</p>
      {action ? (
        <p className="mt-4 text-sm">
          <a href={action.href} className="text-green-700 underline underline-offset-2">
            {action.label}
          </a>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Spec §9: when a public read fails, the page keeps its layout and navigation
 * and only the affected section says so. An error page for a photo strip would
 * read as though the branch had closed.
 *
 * `what` is the reader's name for the section, and `many` agrees the verb with
 * it — half the sections are a plural list and half are one thing the branch
 * keeps, and "this notice are temporarily unavailable" is not something to put
 * in front of a member who came for one answer.
 */
export function SectionUnavailable({ what, many = true }: { what: string; many?: boolean }) {
  return (
    <p
      role="status"
      className="rounded-[12px] border border-dashed border-line bg-paper-alt p-6 text-sm text-ink-muted"
    >
      {what} {many ? "are" : "is"} temporarily unavailable — please try again.
    </p>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="border-b border-line pb-6">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-700">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-3xl leading-tight sm:text-[36px]">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-prose text-[15px] leading-7 text-ink-muted">{description}</p>
      ) : null}
    </header>
  );
}
