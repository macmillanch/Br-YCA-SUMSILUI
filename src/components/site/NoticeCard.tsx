import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { KIND_LABEL, type PublicNotice } from "@/lib/content";

function shortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function NoticeCard({ notice }: { notice: PublicNotice }) {
  return (
    <Card as="article" className="flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{KIND_LABEL[notice.kind]}</Badge>
        <span className="text-xs text-ink-muted">{shortDate(notice.publishedOn)}</span>
      </div>
      <h3 className="mt-3 text-lg leading-snug">
        <Link href={`/notices/${notice.slug}`} className="hover:text-green-700">
          {notice.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-ink-muted">{notice.excerpt}</p>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {notice.eventDate ? (
          <span className="text-ink">
            Event: <span className="font-medium">{shortDate(notice.eventDate)}</span>
          </span>
        ) : null}
        <Link
          href={`/notices/${notice.slug}`}
          className="font-medium text-green-700 underline underline-offset-2 hover:text-green-500"
        >
          Read more
        </Link>
      </p>
    </Card>
  );
}
