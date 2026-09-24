import { Button } from "@/components/ui/Button";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="max-w-prose">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-green-700">{eyebrow}</p>
        ) : null}
        <h2 id={id} className="mt-1 text-2xl leading-snug sm:text-[28px]">
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? (
        <Button href={action.href} variant="ghost" className="shrink-0">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
