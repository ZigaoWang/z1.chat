import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">{children}</div>
      <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground/50">
        <Link href="/legal/privacy" className="hover:text-muted-foreground transition-colors">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/legal/terms" className="hover:text-muted-foreground transition-colors">
          Terms of Service
        </Link>
      </div>
    </div>
  );
}
