"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Users,
  DollarSign,
  Activity,
  Search,
  Shield,
  CreditCard,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  creditBalance: number;
  createdAt: string;
  totalCost: number;
}

interface AdminStats {
  totalUsers: number;
  totalCost: number;
  totalRevenue: number;
  activeUsers: number;
}

interface InviteData {
  id: string;
  token: string;
  creditAmount: number;
  used: boolean;
  usedByUserId: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [editingCredit, setEditingCredit] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState("");
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [inviteCreditAmount, setInviteCreditAmount] = useState("5.00");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => toast.error("Failed to load stats"));

    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => toast.error("Failed to load users"));

    fetch("/api/admin/invites")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInvites(data);
      })
      .catch(() => {});
  }, [user]);

  const updateUser = useCallback(
    async (userId: string, updates: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const updated = await res.json();
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, ...updated } : u
            )
          );
          toast.success("User updated");
        } else {
          const err = await res.json();
          toast.error(err.error || "Update failed");
        }
      } catch {
        toast.error("Failed to update user");
      }
    },
    []
  );

  const saveCreditEdit = useCallback(
    (userId: string) => {
      const balance = parseFloat(creditInput);
      if (isNaN(balance)) {
        toast.error("Invalid amount");
        return;
      }
      updateUser(userId, { creditBalance: balance });
      setEditingCredit(null);
    },
    [creditInput, updateUser]
  );

  const generateInvite = useCallback(async () => {
    const amount = parseFloat(inviteCreditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid credit amount");
      return;
    }
    setGeneratingInvite(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditAmount: amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invite");
      setGeneratedLink(data.url);
      setInvites((prev) => [data.invite, ...prev]);
      toast.success("Invite link generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setGeneratingInvite(false);
    }
  }, [inviteCreditAmount]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }, [generatedLink]);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              icon={Users}
              label="Total Users"
              value={stats.totalUsers.toString()}
            />
            <StatCard
              icon={Activity}
              label="Active (30d)"
              value={stats.activeUsers.toString()}
            />
            <StatCard
              icon={DollarSign}
              label="Raw Cost"
              value={`$${stats.totalCost.toFixed(4)}`}
            />
            <StatCard
              icon={CreditCard}
              label="Revenue"
              value={`$${stats.totalRevenue.toFixed(4)}`}
            />
          </div>
        )}

        {/* Invite Links */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-muted-foreground/50" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
              Invite Links
            </h2>
          </div>

          <div className="rounded-xl border border-border/40 bg-card shadow-sm p-4 space-y-4">
            {/* Generate form */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                  Credit Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={inviteCreditAmount}
                  onChange={(e) => setInviteCreditAmount(e.target.value)}
                  className="w-full rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={generateInvite}
                disabled={generatingInvite}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {generatingInvite ? "Generating..." : "Generate Invite Link"}
              </button>
            </div>

            {/* Generated link */}
            {generatedLink && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 bg-transparent text-xs outline-none truncate"
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}

            {/* Existing invites list */}
            {invites.length > 0 && (
              <div className="border-t border-border/30 pt-3">
                <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-2">
                  Recent Invites
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            inv.used
                              ? "bg-muted-foreground/30"
                              : new Date(inv.expiresAt) < new Date()
                                ? "bg-destructive/50"
                                : "bg-green-500"
                          }`}
                        />
                        <span className="font-mono text-muted-foreground">
                          {inv.token}
                        </span>
                        <span className="text-muted-foreground/50">
                          ${inv.creditAmount.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-muted-foreground/40">
                        {inv.used
                          ? "Used"
                          : new Date(inv.expiresAt) < new Date()
                            ? "Expired"
                            : "Active"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Users Table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground/50" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
                Users
              </h2>
              <span className="text-[11px] text-muted-foreground/35">
                ({users.length})
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="rounded-lg border border-border/40 bg-muted/20 pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all w-48"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground/50">
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-left px-4 py-2.5 font-medium">Role</th>
                  <th className="text-right px-4 py-2.5 font-medium">Credits</th>
                  <th className="text-right px-4 py-2.5 font-medium">Spent</th>
                  <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{u.name || "Unnamed"}</p>
                        <p className="text-muted-foreground/50 text-[11px]">
                          {u.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateUser(u.id, { role: e.target.value })
                        }
                        className="rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-xs outline-none"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingCredit === u.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-muted-foreground">$</span>
                          <input
                            value={creditInput}
                            onChange={(e) => setCreditInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveCreditEdit(u.id);
                              if (e.key === "Escape") setEditingCredit(null);
                            }}
                            className="w-20 rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-xs text-right outline-none ring-1 ring-primary/30"
                            autoFocus
                          />
                          <button
                            onClick={() => saveCreditEdit(u.id)}
                            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCredit(null)}
                            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCredit(u.id);
                            setCreditInput(u.creditBalance.toFixed(2));
                          }}
                          className="text-right hover:text-primary transition-colors"
                          title="Click to edit credits"
                        >
                          ${u.creditBalance.toFixed(2)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      ${Number(u.totalCost).toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingCredit(u.id);
                          setCreditInput(
                            (u.creditBalance + 5).toFixed(2)
                          );
                        }}
                        className="rounded-md border border-border/30 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        +$5
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground/40"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />
        <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
