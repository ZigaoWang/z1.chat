import Link from "next/link";
import { FileText, Shield } from "lucide-react";

export default function LegalPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Legal</h1>
      <p className="text-sm text-muted-foreground mb-8">法律文件 / Legal Documents</p>

      <div className="grid gap-3">
        <Link
          href="/legal/privacy"
          className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <Shield className="h-4 w-4 text-muted-foreground/60" />
          <div>
            <div className="text-sm font-medium">隐私政策 / Privacy Policy</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5">我们如何收集、使用和保护您的信息</div>
          </div>
        </Link>
        <Link
          href="/legal/terms"
          className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <FileText className="h-4 w-4 text-muted-foreground/60" />
          <div>
            <div className="text-sm font-medium">服务条款 / Terms of Service</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5">使用 z1.chat 的条款和条件</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
