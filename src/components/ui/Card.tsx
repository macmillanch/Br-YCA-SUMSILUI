export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
}) {
  return (
    <Tag className={`rounded-[12px] border border-line bg-paper ${className}`}>{children}</Tag>
  );
}
