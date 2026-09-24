import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ROLE_LABEL } from "@/lib/types";
import { SignOutButton } from "./SignOutButton";

/**
 * The gate that middleware cannot provide: it runs on the Edge runtime and
 * cannot reach MongoDB, so it only checks that a cookie exists. This layout
 * confirms the session actually resolves and belongs to an active user.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const ctx = token ? await resolveSession(token) : null;

  if (!ctx) {
    return (
      <div className="container-page flex min-h-[60vh] items-center justify-center">
        <p className="text-ink-muted">
          Your session has ended.{" "}
          <Link href="/login" className="text-green-700 underline">
            Sign in again
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-10 md:grid-cols-[210px_1fr]">
      <aside>
        <AdminSidebar role={ctx.user.role} name={ctx.user.name} />
      </aside>
      <div className="min-w-0">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <p className="text-sm text-ink-muted">
            Signed in as <span className="font-medium text-ink">{ctx.user.name}</span>
            <span className="ml-2 rounded-[4px] bg-green-100 px-2 py-0.5 text-xs text-green-900">
              {ROLE_LABEL[ctx.user.role]}
            </span>
          </p>
          <SignOutButton />
        </div>
        {children}
      </div>
    </div>
  );
}
