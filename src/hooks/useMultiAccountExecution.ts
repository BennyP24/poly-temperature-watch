import { useCallback, useMemo, useState } from "react";
import {
  PaperExecutionAdapter,
  RealExecutionAdapter,
  executeAcrossWallets,
  type ExecutionAdapter,
  type ExecutionRequest,
  type ExecutionResult,
  type WalletAccount,
} from "@/lib/execution/ExecutionAdapter";

/**
 * Runs a single trading action across multiple connected wallets — one action
 * (BUY / SELL / OPEN_ORDER / CLOSE_ORDER) per wallet. Mode is "paper" today;
 * passing `mode: "real"` selects the (not-yet-enabled) real adapter so the call
 * sites never change when real execution is turned on.
 */
export function useMultiAccountExecution(options?: { mode?: "paper" | "real" }) {
  const mode = options?.mode ?? "paper";
  const adapter: ExecutionAdapter = useMemo(
    () => (mode === "real" ? new RealExecutionAdapter() : new PaperExecutionAdapter()),
    [mode],
  );

  const [running, setRunning] = useState(false);
  const [lastResults, setLastResults] = useState<ExecutionResult[]>([]);

  const run = useCallback(
    async (wallets: WalletAccount[], req: ExecutionRequest): Promise<ExecutionResult[]> => {
      setRunning(true);
      try {
        const results = await executeAcrossWallets(adapter, wallets, req);
        setLastResults(results);
        return results;
      } finally {
        setRunning(false);
      }
    },
    [adapter],
  );

  return { run, running, lastResults, mode: adapter.mode };
}
