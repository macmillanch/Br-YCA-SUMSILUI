import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { NoticeForm } from "@/components/admin/NoticeForm";
import { NotPermitted } from "@/components/admin/NotPermitted";
import { maySee, readAdminContext } from "@/lib/auth/admin-page";
import { istCalendarDate } from "@/lib/dates";
import { toObjectId } from "@/lib/mongo-oid";
import { getNotice, toFormValues } from "@/lib/notices";

export const metadata: Metadata = { title: "Edit notice", robots: { index: false } };

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await readAdminContext();
  if (!ctx) return null;
  if (!maySee(ctx, ["editor"])) {
    return (
      <NotPermitted
        title="Edit notice"
        body="Only an editor changes notices. Ask an editor, or a super-admin to change your role."
      />
    );
  }

  const noticeId = toObjectId(id);
  if (!noticeId) notFound();
  const doc = await getNotice(noticeId);
  if (!doc) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl">Edit notice</h1>
        <Badge tone={doc.status === "published" ? "green" : "muted"}>
          {doc.status === "published"
            ? `Published ${doc.publishedAt ? istCalendarDate(doc.publishedAt) : ""}`
            : "Draft"}
        </Badge>
      </div>
      <p className="max-w-prose text-sm text-ink-muted">
        Editing a published notice changes what readers see the next time they open it. The
        publication date stays the day it first went out.
      </p>
      <NoticeForm
        noticeId={id}
        initial={toFormValues(doc)}
        publishedOn={doc.publishedAt ? istCalendarDate(doc.publishedAt) : null}
      />
    </div>
  );
}
