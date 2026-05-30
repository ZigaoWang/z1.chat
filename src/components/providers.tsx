"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { ConversationProvider } from "@/hooks/use-conversations";
import { AuthProvider } from "@/hooks/use-auth";
import { CreditProvider } from "@/hooks/use-credits";
import { I18nProvider } from "@/hooks/use-i18n";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AccentColorProvider } from "@/components/accent-color-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delay={300}>
        <I18nProvider>
          <AuthProvider>
            <AccentColorProvider />
            <CreditProvider>
              <ConversationProvider>
                {children}
                <Toaster position="bottom-right" richColors />
              </ConversationProvider>
            </CreditProvider>
          </AuthProvider>
        </I18nProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
