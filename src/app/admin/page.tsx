"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Users,
  Activity,
  Search,
  Shield,
  CreditCard,
  Link2,
  Copy,
  Check,
  ChevronRight,
  Loader2,
  Trash2,
  Pencil,
  X,
  Ban,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  creditBalance: number;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  totalCharged: number;
  totalRawCost: number;
  conversationCount: number;
  requestCount: number;
  lastActive: string | null;
  totalPaidCny: number;
  orderCount: number;
}

interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  activeUsers: number;
  bannedUsers: number;
  totalApiCostUsd: number;
  totalApiCostCny: number;
  adminApiCostUsd: number;
  adminApiCostCny: number;
  userApiCostUsd: number;
  userApiCostCny: number;
  userRevenueCny: number;
  profitCny: number;
  totalPaidCny: number;
  totalPaidOrders: number;
}

interface UsageLog {
  type: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  userCostUsd: number;
  createdAt: string;
}

interface OrderData {
  id: string;
  outTradeNo: string;
  amount: number;
  creditAmount: number;
  status: string;
  type: string;
  name: string;
  createdAt: string;
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border/60 bg-card p-5 shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              destructive ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 ${destructive ? "text-destructive" : "text-primary"}`}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-primary/10 text-primary border-primary/20",
    banned: "bg-destructive/10 text-destructive border-destructive/20",
    user: "bg-muted/50 text-muted-foreground border-border/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[role] || styles.user}`}
    >
      {role === "admin" && <Shield className="h-2.5 w-2.5" />}
      {role === "banned" && <Ban className="h-2.5 w-2.5" />}
      {role}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color: Record<string, string> = {
    paid: "bg-green-500",
    pending: "bg-amber-500",
    expired: "bg-muted-foreground/30",
    failed: "bg-destructive",
  };
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${color[status] || "bg-muted-foreground/30"}`}
    />
  );
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [editingCredit, setEditingCredit] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [inviteCreditAmount, setInviteCreditAmount] = useState("5.00");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"usage" | "orders">("usage");
  const [usageLogs, setUsageLogs] = useState<Record<string, UsageLog[]>>({});
  const [orderLogs, setOrderLogs] = useState<Record<string, OrderData[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const usageCacheRef = useRef<Record<string, UsageLog[]>>({});
  const orderCacheRef = useRef<Record<string, OrderData[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  const loadData = useCallback(() => {
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    usageCacheRef.current = {};
    orderCacheRef.current = {};
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadData]);

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
            prev.map((u) => (u.id === userId ? { ...u, ...updated } : u))
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

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        toast.success("User deleted");
      } else {
        const err = await res.json();
        toast.error(err.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete user");
    }
  }, []);

  const confirmRoleChange = useCallback(
    (userId: string, userName: string | null, newRole: string) => {
      const name = userName || "this user";
      if (newRole === "banned") {
        setConfirmDialog({
          open: true,
          title: "Ban User",
          message: `Ban ${name}? They will lose all access immediately.`,
          confirmLabel: "Ban User",
          destructive: true,
          onConfirm: () => {
            updateUser(userId, { role: "banned" });
            setConfirmDialog((d) => ({ ...d, open: false }));
          },
        });
      } else if (newRole === "admin") {
        setConfirmDialog({
          open: true,
          title: "Grant Admin",
          message: `Make ${name} an admin? They'll get full admin access.`,
          confirmLabel: "Grant Admin",
          onConfirm: () => {
            updateUser(userId, { role: "admin" });
            setConfirmDialog((d) => ({ ...d, open: false }));
          },
        });
      } else {
        updateUser(userId, { role: newRole });
      }
    },
    [updateUser]
  );

  const confirmDelete = useCallback(
    (userId: string, userName: string | null) => {
      const name = userName || "this user";
      setConfirmDialog({
        open: true,
        title: "Delete User",
        message: `Permanently delete ${name}? All conversations, data, and usage will be lost. This cannot be undone.`,
        confirmLabel: "Delete Permanently",
        destructive: true,
        onConfirm: () => {
          deleteUser(userId);
          setConfirmDialog((d) => ({ ...d, open: false }));
        },
      });
    },
    [deleteUser]
  );

  const saveCreditEdit = useCallback(
    (userId: string) => {
      const balance = parseFloat(creditInput);
      if (isNaN(balance) || balance < 0) {
        toast.error("Invalid amount");
        return;
      }
      updateUser(userId, { creditBalance: balance });
      setEditingCredit(null);
    },
    [creditInput, updateUser]
  );

  const saveNameEdit = useCallback(
    (userId: string) => {
      if (!nameInput.trim()) {
        toast.error("Name cannot be empty");
        return;
      }
      updateUser(userId, { name: nameInput.trim() });
      setEditingName(null);
    },
    [nameInput, updateUser]
  );

  const loadUserDetail = useCallback(
    async (userId: string) => {
      if (expandedUser === userId) {
        setExpandedUser(null);
        return;
      }
      setExpandedUser(userId);
      setDetailTab("usage");

      const needsUsage = !usageCacheRef.current[userId];
      const needsOrders = !orderCacheRef.current[userId];

      if (!needsUsage && !needsOrders) {
        setUsageLogs((prev) => ({
          ...prev,
          [userId]: usageCacheRef.current[userId],
        }));
        setOrderLogs((prev) => ({
          ...prev,
          [userId]: orderCacheRef.current[userId],
        }));
        return;
      }

      setLoadingDetail(userId);
      try {
        const [usageRes, ordersRes] = await Promise.all([
          needsUsage
            ? fetch(`/api/admin/users/${userId}/usage`).then((r) => r.json())
            : Promise.resolve(usageCacheRef.current[userId]),
          needsOrders
            ? fetch(`/api/admin/users/${userId}/orders`).then((r) => r.json())
            : Promise.resolve(orderCacheRef.current[userId]),
        ]);
        if (Array.isArray(usageRes)) {
          usageCacheRef.current[userId] = usageRes;
          setUsageLogs((prev) => ({ ...prev, [userId]: usageRes }));
        }
        if (Array.isArray(ordersRes)) {
          orderCacheRef.current[userId] = ordersRes;
          setOrderLogs((prev) => ({ ...prev, [userId]: ordersRes }));
        }
      } catch {
        toast.error("Failed to load user details");
      } finally {
        setLoadingDetail(null);
      }
    },
    [expandedUser]
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
      toast.error(
        err instanceof Error ? err.message : "Failed to create invite"
      );
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
      u.role.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
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
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h1 className="text-lg font-semibold tracking-tight">
                Admin Panel
              </h1>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-8 space-y-3">
            {/* Row 1: Users */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={Users}
                label="Users"
                value={stats.totalUsers.toString()}
                subtitle={
                  stats.bannedUsers > 0 ? (
                    <span className="text-destructive">
                      {stats.bannedUsers} banned
                    </span>
                  ) : undefined
                }
              />
              <StatCard
                icon={Activity}
                label="Active (30d)"
                value={stats.activeUsers.toString()}
                subtitle={
                  <span className="text-muted-foreground/50">
                    {stats.totalConversations} chats
                  </span>
                }
              />
              <StatCard
                icon={Wallet}
                label="Received"
                value={`¥${stats.totalPaidCny.toFixed(2)}`}
                subtitle={
                  <span className="text-muted-foreground/50">
                    {stats.totalPaidOrders} orders
                  </span>
                }
              />
              <StatCard
                icon={Receipt}
                label="Profit"
                value={`¥${stats.profitCny.toFixed(2)}`}
                subtitle={
                  <span className={stats.profitCny >= 0 ? "text-green-500" : "text-red-500"}>
                    from paying users
                  </span>
                }
              />
            </div>
            {/* Row 2: Cost breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={TrendingUp}
                label="Total API Cost"
                value={`¥${stats.totalApiCostCny.toFixed(2)}`}
                subtitle={
                  <span className="text-muted-foreground/50">
                    ${stats.totalApiCostUsd.toFixed(4)}
                  </span>
                }
              />
              <StatCard
                icon={Shield}
                label="Admin Cost"
                value={`¥${stats.adminApiCostCny.toFixed(2)}`}
                subtitle={
                  <span className="text-muted-foreground/50">
                    ${stats.adminApiCostUsd.toFixed(4)} (free)
                  </span>
                }
              />
              <StatCard
                icon={CreditCard}
                label="User API Cost"
                value={`¥${stats.userApiCostCny.toFixed(2)}`}
                subtitle={
                  <span className="text-muted-foreground/50">
                    ${stats.userApiCostUsd.toFixed(4)}
                  </span>
                }
              />
              <StatCard
                icon={CreditCard}
                label="User Charged"
                value={`¥${stats.userRevenueCny.toFixed(2)}`}
                subtitle={
                  <span className={stats.userRevenueCny - stats.userApiCostCny >= 0 ? "text-green-500" : "text-red-500"}>
                    margin ¥{(stats.userRevenueCny - stats.userApiCostCny).toFixed(2)}
                  </span>
                }
              />
            </div>
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                  Credit Amount (¥)
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
                {generatingInvite ? "Generating..." : "Generate Invite"}
              </button>
            </div>

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
                          ¥{inv.creditAmount.toFixed(2)}
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

        {/* Users */}
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground/50" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
                Users
              </h2>
              <span className="text-[11px] text-muted-foreground/35">
                ({filteredUsers.length}
                {search ? ` / ${users.length}` : ""})
              </span>
            </div>
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, role, ID..."
                className="rounded-lg border border-border/40 bg-muted/20 pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all w-full sm:w-56"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-xs min-w-[750px]">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground/50">
                  <th className="w-8 px-2 py-2.5" />
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-left px-4 py-2.5 font-medium">Role</th>
                  <th className="text-right px-4 py-2.5 font-medium">
                    Balance
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium">
                    Charged
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium">Paid</th>
                  <th className="text-center px-4 py-2.5 font-medium">
                    Chats
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={user.id}
                    expanded={expandedUser === u.id}
                    detailTab={detailTab}
                    onDetailTabChange={setDetailTab}
                    onToggle={() => loadUserDetail(u.id)}
                    editingCredit={editingCredit === u.id}
                    creditInput={creditInput}
                    onStartCreditEdit={() => {
                      setEditingCredit(u.id);
                      setCreditInput(u.creditBalance.toFixed(2));
                    }}
                    onCreditInputChange={setCreditInput}
                    onSaveCredit={() => saveCreditEdit(u.id)}
                    onCancelCreditEdit={() => setEditingCredit(null)}
                    editingName={editingName === u.id}
                    nameInput={nameInput}
                    onStartNameEdit={() => {
                      setEditingName(u.id);
                      setNameInput(u.name || "");
                    }}
                    onNameInputChange={setNameInput}
                    onSaveName={() => saveNameEdit(u.id)}
                    onCancelNameEdit={() => setEditingName(null)}
                    onRoleChange={(role) =>
                      confirmRoleChange(u.id, u.name, role)
                    }
                    onDelete={() => confirmDelete(u.id, u.name)}
                    onUpdateUser={(updates) => updateUser(u.id, updates)}
                    loadingDetail={loadingDetail === u.id}
                    logs={usageLogs[u.id]}
                    orders={orderLogs[u.id]}
                  />
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        destructive={confirmDialog.destructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}

function UserRow({
  user: u,
  currentUserId,
  expanded,
  detailTab,
  onDetailTabChange,
  onToggle,
  editingCredit,
  creditInput,
  onStartCreditEdit,
  onCreditInputChange,
  onSaveCredit,
  onCancelCreditEdit,
  editingName,
  nameInput,
  onStartNameEdit,
  onNameInputChange,
  onSaveName,
  onCancelNameEdit,
  onRoleChange,
  onDelete,
  onUpdateUser,
  loadingDetail,
  logs,
  orders,
}: {
  user: AdminUser;
  currentUserId: string;
  expanded: boolean;
  detailTab: "usage" | "orders";
  onDetailTabChange: (tab: "usage" | "orders") => void;
  onToggle: () => void;
  editingCredit: boolean;
  creditInput: string;
  onStartCreditEdit: () => void;
  onCreditInputChange: (v: string) => void;
  onSaveCredit: () => void;
  onCancelCreditEdit: () => void;
  editingName: boolean;
  nameInput: string;
  onStartNameEdit: () => void;
  onNameInputChange: (v: string) => void;
  onSaveName: () => void;
  onCancelNameEdit: () => void;
  onRoleChange: (role: string) => void;
  onDelete: () => void;
  onUpdateUser: (updates: Record<string, unknown>) => void;
  loadingDetail: boolean;
  logs?: UsageLog[];
  orders?: OrderData[];
}) {
  const isSelf = u.id === currentUserId;
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(u.email || "");
  const [copiedId, setCopiedId] = useState(false);

  return (
    <>
      <tr
        className={`hover:bg-muted/30 transition-colors ${u.role === "banned" ? "opacity-60" : ""}`}
      >
        <td className="px-2 py-3">
          <button
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  value={nameInput}
                  onChange={(e) => onNameInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveName();
                    if (e.key === "Escape") onCancelNameEdit();
                  }}
                  className="w-32 rounded-md border border-border/30 bg-muted/20 px-2 py-0.5 text-xs outline-none ring-1 ring-primary/30"
                  autoFocus
                />
                <button
                  onClick={onSaveName}
                  className="rounded p-0.5 text-primary hover:bg-primary/10"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={onCancelNameEdit}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group">
                <p className="font-medium truncate">
                  {u.name || "Unnamed"}
                </p>
                <button
                  onClick={onStartNameEdit}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-opacity"
                  title="Edit name"
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                {isSelf && (
                  <span className="text-[9px] rounded-full bg-primary/10 text-primary px-1.5 py-px font-medium">
                    YOU
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-muted-foreground/50 text-[11px] truncate">
                {u.email}
              </p>
              {u.emailVerified && (
                <Check className="h-2.5 w-2.5 text-green-500 shrink-0" />
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {isSelf ? (
            <RoleBadge role={u.role} />
          ) : (
            <select
              value={u.role}
              onChange={(e) => onRoleChange(e.target.value)}
              className={`rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-xs outline-none cursor-pointer ${
                u.role === "banned"
                  ? "text-destructive"
                  : u.role === "admin"
                    ? "text-primary"
                    : ""
              }`}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="banned">banned</option>
            </select>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {editingCredit ? (
            <div className="flex items-center justify-end gap-1">
              <span className="text-muted-foreground">¥</span>
              <input
                value={creditInput}
                onChange={(e) => onCreditInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveCredit();
                  if (e.key === "Escape") onCancelCreditEdit();
                }}
                className="w-20 rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-xs text-right outline-none ring-1 ring-primary/30"
                autoFocus
              />
              <button
                onClick={onSaveCredit}
                className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              >
                OK
              </button>
              <button
                onClick={onCancelCreditEdit}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onStartCreditEdit}
              className="text-right hover:text-primary transition-colors tabular-nums"
              title="Click to edit"
            >
              ¥{u.creditBalance.toFixed(2)}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
          ¥{u.totalCharged.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {u.totalPaidCny > 0 ? (
            <span className="text-green-600">¥{u.totalPaidCny.toFixed(2)}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
          {u.conversationCount}
        </td>
        <td className="px-4 py-3 text-right">
          {!isSelf && (
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete user"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-muted/10 px-4 py-3">
            {/* Info bar */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground/60 mb-3 pb-3 border-b border-border/20">
              <span className="inline-flex items-center gap-1">
                ID:
                <code className="font-mono text-muted-foreground">
                  {u.id.slice(0, 8)}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(u.id);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 1500);
                  }}
                  className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground"
                  title="Copy full ID"
                >
                  {copiedId ? (
                    <Check className="h-2.5 w-2.5 text-green-500" />
                  ) : (
                    <Copy className="h-2.5 w-2.5" />
                  )}
                </button>
              </span>
              <span>
                Email:{" "}
                {editingEmail ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onUpdateUser({ email: emailInput });
                          setEditingEmail(false);
                        }
                        if (e.key === "Escape") setEditingEmail(false);
                      }}
                      className="w-44 rounded-md border border-border/30 bg-muted/20 px-1.5 py-0.5 text-[11px] outline-none ring-1 ring-primary/30"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        onUpdateUser({ email: emailInput });
                        setEditingEmail(false);
                      }}
                      className="rounded p-0.5 text-primary hover:bg-primary/10"
                    >
                      <Check className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => setEditingEmail(false)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ) : (
                  <span className="group inline-flex items-center gap-1">
                    <span className="text-muted-foreground">{u.email}</span>
                    {u.emailVerified ? (
                      <span className="text-green-500 text-[10px]">
                        (verified)
                      </span>
                    ) : (
                      <span className="text-amber-500 text-[10px]">
                        (unverified)
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEmailInput(u.email || "");
                        setEditingEmail(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-opacity"
                    >
                      <Pencil className="h-2 w-2" />
                    </button>
                  </span>
                )}
              </span>
              <span>
                Joined:{" "}
                <span className="text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </span>
              <span>
                Last active:{" "}
                <span className="text-muted-foreground">
                  {u.lastActive ? timeAgo(u.lastActive) : "Never"}
                </span>
              </span>
              <span>
                Requests:{" "}
                <span className="text-muted-foreground tabular-nums">
                  {u.requestCount.toLocaleString()}
                </span>
              </span>
              <span>
                Raw cost:{" "}
                <span className="text-muted-foreground tabular-nums">
                  ¥{(u.totalRawCost * 7).toFixed(4)}
                </span>
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => onDetailTabChange("usage")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  detailTab === "usage"
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground/50 hover:text-foreground"
                }`}
              >
                Usage ({logs?.length ?? 0})
              </button>
              <button
                onClick={() => onDetailTabChange("orders")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  detailTab === "orders"
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground/50 hover:text-foreground"
                }`}
              >
                Orders ({orders?.length ?? 0})
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
              </div>
            ) : detailTab === "usage" ? (
              logs && logs.length > 0 ? (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border/20">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted/20 backdrop-blur-sm">
                      <tr className="text-muted-foreground/50">
                        <th className="text-left px-3 py-1.5 font-medium">
                          Time
                        </th>
                        <th className="text-left px-3 py-1.5 font-medium">
                          Type
                        </th>
                        <th className="text-left px-3 py-1.5 font-medium">
                          Model
                        </th>
                        <th className="text-right px-3 py-1.5 font-medium">
                          Tokens
                        </th>
                        <th className="text-right px-3 py-1.5 font-medium">
                          Charged
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                      {logs.map((log, i) => (
                        <tr
                          key={i}
                          className="text-muted-foreground hover:bg-muted/20"
                        >
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleDateString(
                              "zh-CN",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="rounded-full bg-muted/50 px-1.5 py-0.5">
                              {log.type}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono truncate max-w-[120px]">
                            {log.model.split("/").pop()}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground/60">
                            {(
                              log.inputTokens + log.outputTokens
                            ).toLocaleString()}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            ¥{log.userCostUsd.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground/40 py-6 text-xs">
                  No usage logs
                </p>
              )
            ) : orders && orders.length > 0 ? (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border/20">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/20 backdrop-blur-sm">
                    <tr className="text-muted-foreground/50">
                      <th className="text-left px-3 py-1.5 font-medium">
                        Time
                      </th>
                      <th className="text-left px-3 py-1.5 font-medium">
                        Type
                      </th>
                      <th className="text-right px-3 py-1.5 font-medium">
                        Amount
                      </th>
                      <th className="text-right px-3 py-1.5 font-medium">
                        Credits
                      </th>
                      <th className="text-left px-3 py-1.5 font-medium">
                        Status
                      </th>
                      <th className="text-left px-3 py-1.5 font-medium">
                        Order
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {orders.map((o) => (
                      <tr
                        key={o.id}
                        className="text-muted-foreground hover:bg-muted/20"
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {new Date(o.createdAt).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-1.5 uppercase">
                          {o.type}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          ¥{o.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          ¥{o.creditAmount.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1">
                            <StatusDot status={o.status} />
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground/50 truncate max-w-[100px]">
                          {o.outTradeNo.slice(-8)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground/40 py-6 text-xs">
                No payment orders
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: React.ReactNode;
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
      {subtitle && <p className="text-[11px] mt-0.5">{subtitle}</p>}
    </div>
  );
}
