"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.sendResetLink"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("auth.resetLinkSent")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.resetLinkSentDesc", { email })}
          </p>
        </div>
        <Link href="/login" className="text-sm font-medium text-foreground hover:underline">
          {t("auth.backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("auth.forgotPasswordTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.forgotPasswordDesc")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.sendResetLink")}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:underline">
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
