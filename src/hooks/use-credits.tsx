"use client";

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./use-auth";

interface CreditContextValue {
  creditBalance: number;
  isZero: boolean;
  isLow: boolean;
  isCritical: boolean;
  refresh: () => Promise<void>;
}

const CreditContext = createContext<CreditContextValue>({
  creditBalance: 0,
  isZero: true,
  isLow: true,
  isCritical: true,
  refresh: async () => {},
});

export function CreditProvider({ children }: { children: ReactNode }) {
  const { user, refresh: refreshAuth } = useAuth();

  const creditBalance = user?.creditBalance ?? 0;

  const value = useMemo(
    () => ({
      creditBalance,
      isZero: creditBalance <= 0,
      isLow: creditBalance > 0 && creditBalance < 1,
      isCritical: creditBalance > 0 && creditBalance < 0.5,
      refresh: refreshAuth,
    }),
    [creditBalance, refreshAuth]
  );

  return (
    <CreditContext value={value}>
      {children}
    </CreditContext>
  );
}

export function useCredits() {
  return useContext(CreditContext);
}
