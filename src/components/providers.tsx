"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { ConversationProvider } from "@/hooks/use-conversations";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delay={300}>
        <ConversationProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ConversationProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
