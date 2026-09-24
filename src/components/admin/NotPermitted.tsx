/**
 * Shown where a page would otherwise leak a list its viewer may not manage. The
 * API refuses the same request; this only saves an editor from staring at a
 * table of rows they cannot touch.
 */
export function NotPermitted({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl">{title}</h1>
      <p className="max-w-prose text-sm leading-6 text-ink-muted">{body}</p>
    </div>
  );
}
