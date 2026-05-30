"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import ChatView from "@/components/chat/chat-view";
import OnboardingFlow from "@/components/onboarding/onboarding-flow";
import { useConversations } from "@/hooks/use-conversations";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { useI18n } from "@/hooks/use-i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/constants";

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        {/* TAGLINE — edit this */}
        <p className="mt-4 text-lg font-medium text-foreground/80">The last AI app you&apos;ll ever need.</p>
        {/* SUBTEXT — edit this */}
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Pay-as-you-go access to every major model. No subscriptions, no lock-in.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground/50">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Link href="/legal/privacy" className="hover:text-muted-foreground transition-colors">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/legal/terms" className="hover:text-muted-foreground transition-colors">
            Terms of Service
          </Link>
        </div>
        {APP_NAME} · Engineered by{" "}
        <a href="https://zigao.wang" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Zigao Wang
        </a>
      </footer>
    </div>
  );
}

function AppSkeleton() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex w-[250px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-11 items-center px-3 border-b border-sidebar-border/50">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="px-2 py-1.5">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="flex-1 space-y-1.5 px-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </div>
      {/* Chat area skeleton */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="space-y-3 w-full max-w-md px-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarOpenRef = useRef(true);
  const sidebarBeforeMobile = useRef<boolean | null>(null);

  const setSidebar = useCallback((val: boolean) => {
    sidebarOpenRef.current = val;
    setSidebarOpen(val);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile && sidebarBeforeMobile.current === null) {
        sidebarBeforeMobile.current = sidebarOpenRef.current;
        setSidebar(false);
      } else if (!isMobile && sidebarBeforeMobile.current !== null) {
        setSidebar(sidebarBeforeMobile.current);
        sidebarBeforeMobile.current = null;
      }
    };
    window.addEventListener("resize", handleResize);
    if (window.innerWidth < 1024) {
      sidebarBeforeMobile.current = true;
      setSidebar(false);
    }
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebar]);
  const { createConversation } = useConversations();
  const { user, isLoading: authLoading, refresh: refreshAuth } = useAuth();
  const { creditBalance } = useCredits();
  const { t } = useI18n();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Cmd/Ctrl + B: Toggle sidebar
      if (mod && e.key === "b") {
        e.preventDefault();
        setSidebar(!sidebarOpenRef.current);
      }

      // Cmd/Ctrl + Shift + S: Toggle sidebar (alternative)
      if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault();
        setSidebar(!sidebarOpenRef.current);
      }

      // Cmd/Ctrl + N: New chat
      if (mod && e.key === "n") {
        e.preventDefault();
        createConversation();
      }

      // Cmd/Ctrl + /: Toggle shortcuts help
      if (mod && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Escape: close any open modal
      if (e.key === "Escape") {
        setShowShortcuts(false);
      }

      // / key: focus chat input (when not in an input)
      if (e.key === "/" && !mod && !isInput) {
        e.preventDefault();
        const chatInput = document.querySelector("textarea[placeholder]") as HTMLTextAreaElement;
        chatInput?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createConversation, setSidebar]);

  const toggleSidebar = useCallback(() => {
    setSidebar(!sidebarOpenRef.current);
  }, [setSidebar]);

  if (!user && authLoading) {
    return <AppSkeleton />;
  }

  if (!user) return <LandingPage />;

  if (showOnboarding) {
    return (
      <OnboardingFlow
        creditBalance={creditBalance}
        onComplete={() => {
          setShowOnboarding(false);
          refreshAuth();
        }}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={toggleSidebar} />

      <ChatView
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onCollapseSidebar={() => setSidebar(false)}
        onOpenSidebar={() => setSidebar(true)}
      />

      {/* Shortcuts help modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border/50 bg-card p-6 shadow-lg animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">{t("shortcuts.title")}</h2>
            <div className="space-y-2">
              {[
                [t("shortcuts.newChat"), "\u2318 N"],
                [t("shortcuts.toggleSidebar"), "\u2318 B"],
                [t("shortcuts.modelSelector"), "\u2318 K"],
                [t("shortcuts.focusInput"), "/"],
                [t("shortcuts.help"), "\u2318 /"],
                [t("shortcuts.close"), "Esc"],
              ].map(([label, shortcut]) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <kbd className="rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    {shortcut}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
