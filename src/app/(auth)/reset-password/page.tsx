"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-sm text-destructive">{t("auth.resetLinkInvalid")}</p>
        <Link href="/login" className="text-sm font-medium text-foreground hover:underline">
          {t("auth.backToSignIn")}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetPasswordBtn"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("auth.resetPassword")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetPasswordDesc")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {t("auth.newPassword")}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.resetPasswordBtn")}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
