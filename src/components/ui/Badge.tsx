const TONE = {
  green: "bg-green-100 text-green-900",
  red: "bg-red-100 text-red-700",
  muted: "bg-paper-alt text-ink-muted",
} as const;

export function Badge({
  children,
  tone = "green",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
