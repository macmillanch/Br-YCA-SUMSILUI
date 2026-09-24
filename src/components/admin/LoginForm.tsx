"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? "Could not sign in. Please try again.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink " +
    "focus:border-green-700";

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Email</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          className={field}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Password</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className={field}
        />
      </label>

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
