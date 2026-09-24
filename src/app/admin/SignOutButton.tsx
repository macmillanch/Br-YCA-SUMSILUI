"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setBusy(false);
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-[4px] border border-line px-3 py-1.5 text-sm text-green-900 hover:bg-green-100 disabled:opacity-60"
    >
      {busy ? "Signing out" : "Sign out"}
    </button>
  );
}
