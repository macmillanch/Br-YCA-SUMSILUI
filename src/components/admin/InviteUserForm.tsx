"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Role } from "@/lib/types";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "editor", label: "Editor — notices, members, works, gallery" },
  { value: "treasurer", label: "Treasurer — also finance entries" },
  { value: "super_admin", label: "Super-admin — everything including users" },
];

const FIELD_CLASS =
  "w-full rounded-[4px] border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-green-700";

export function InviteUserForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "editor" as Role });
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { user?: { email?: string }; temporaryPassword?: string };
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setErrors(
          body?.error?.fieldErrors ?? {
            form: body?.error?.message ?? "Could not create the account.",
          },
        );
        return;
      }

      const password = body?.data?.temporaryPassword;
      if (!password) {
        setErrors({ form: "The account was created, but no password came back. Please try again." });
        return;
      }

      setResult({ email: body?.data?.user?.email ?? form.email, temporaryPassword: password });
      setForm({ name: "", email: "", role: "editor" });
      // refresh() re-runs the server component without unmounting this one, so
      // the table grows while the generated password stays on screen to be read.
      router.refresh();
    } catch {
      setErrors({ form: "Network problem. Nothing was created — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? <span className="mt-1 block text-red-700">{errors[name]}</span> : null;

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4" noValidate>
      {errors.form ? (
        <p
          role="alert"
          className="rounded-[4px] border border-red-700/30 bg-red-100 px-3 py-2 text-sm text-red-700"
        >
          {errors.form}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Full name</span>
        <input
          value={form.name}
          onChange={(event) => update("name", event.target.value)}
          autoComplete="off"
          required
          className={FIELD_CLASS}
        />
        {fieldError("name")}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Email</span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          autoComplete="off"
          required
          className={FIELD_CLASS}
        />
        {fieldError("email")}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Role</span>
        <select
          value={form.role}
          onChange={(event) => update("role", event.target.value as Role)}
          className={FIELD_CLASS}
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldError("role")}
      </label>

      <Button type="submit" disabled={busy}>
        {busy ? "Creating" : "Create account"}
      </Button>

      {result ? (
        <div className="rounded-[4px] border border-line bg-paper-alt p-3 text-sm" role="status">
          <p className="font-medium text-ink">Temporary password for {result.email}</p>
          <p
            data-testid="temporary-password"
            className="mt-1 font-mono text-base tracking-wide text-green-900"
          >
            {result.temporaryPassword}
          </p>
          <p className="mt-1 text-ink-muted">
            Hand this over directly. It is shown once and cannot be recovered — if it is lost, reset
            the password from the table below.
          </p>
        </div>
      ) : null}
    </form>
  );
}
