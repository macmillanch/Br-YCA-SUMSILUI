import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="w-full max-w-sm rounded-[12px] border border-line bg-paper p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/yca.jpg" alt="" width={44} height={44} className="rounded-full" />
          <div>
            <p className="font-display text-lg leading-tight text-green-900">YCA Sumsilui</p>
            <p className="text-xs text-ink-muted">Office-bearer area</p>
          </div>
        </div>

        <h1 className="mb-1 text-xl">Sign in</h1>
        <p className="mb-6 text-sm text-ink-muted">
          This area is for YCA office-bearers only.
        </p>

        <LoginForm />
      </div>
    </div>
  );
}
