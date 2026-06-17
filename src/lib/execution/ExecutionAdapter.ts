/**
 * Execution layer for multi-account trading.
 *
 * The only operations that may ever be executed are BUY, SELL, OPEN_ORDER and
 * CLOSE_ORDER — this is enforced by the `ExecutionActionType` union and the
 * `isAllowedAction` guard, so no other side-effecting action can flow through.
 *
 * Today execution is "paper" (simulated) via `PaperExecutionAdapter`. The hybrid
 * design lets a real wallet-backed adapter (`RealExecutionAdapter`) be plugged in
 * later without changing call sites: each connected wallet gets exactly one action.
 */

export const EXECUTION_ACTIONS = ["BUY", "SELL", "OPEN_ORDER", "CLOSE_ORDER"] as const;
export type ExecutionActionType = (typeof EXECUTION_ACTIONS)[number];

/** Type guard: only the four whitelisted operations are permitted. */
export function isAllowedAction(action: string): action is ExecutionActionType {
  return (EXECUTION_ACTIONS as readonly string[]).includes(action);
}

export interface WalletAccount {
  /** Checksummed or lowercase EVM address. */
  address: string;
  /** Optional human label. */
  label?: string;
}

export interface ExecutionRequest {
  type: ExecutionActionType;
  marketId: string;
  marketTitle?: string;
  side: "yes" | "no";
  /** Limit/marketable price in dollars (0..1). */
  price: number;
  /** USD to spend for BUY/OPEN_ORDER. */
  amountUsd?: number;
  /** Shares to dispose for SELL/CLOSE_ORDER. */
  shares?: number;
}

export interface ExecutionResult {
  ok: boolean;
  walletAddress: string;
  action: ExecutionActionType;
  detail?: string;
  error?: string;
}

export interface ExecutionAdapter {
  readonly mode: "paper" | "real";
  execute(wallet: WalletAccount, req: ExecutionRequest): Promise<ExecutionResult>;
}

function describe(req: ExecutionRequest): string {
  const px = `${(req.price * 100).toFixed(1)}\u00a2`;
  switch (req.type) {
    case "BUY":
      return `BUY ${req.side.toUpperCase()} $${(req.amountUsd ?? 0).toFixed(2)} @ ${px}`;
    case "OPEN_ORDER":
      return `OPEN ${req.side.toUpperCase()} order $${(req.amountUsd ?? 0).toFixed(2)} @ ${px}`;
    case "SELL":
      return `SELL ${req.side.toUpperCase()} ${(req.shares ?? 0).toFixed(2)} sh @ ${px}`;
    case "CLOSE_ORDER":
      return `CLOSE ${req.side.toUpperCase()} order (${(req.shares ?? 0).toFixed(2)} sh)`;
  }
}

/**
 * Simulated adapter. Validates the action is whitelisted and returns a synthetic
 * fill. No real funds move. Safe default for the hybrid model.
 */
export class PaperExecutionAdapter implements ExecutionAdapter {
  readonly mode = "paper" as const;

  async execute(wallet: WalletAccount, req: ExecutionRequest): Promise<ExecutionResult> {
    if (!isAllowedAction(req.type)) {
      return { ok: false, walletAddress: wallet.address, action: req.type, error: "Action not permitted" };
    }
    return {
      ok: true,
      walletAddress: wallet.address,
      action: req.type,
      detail: `Paper ${describe(req)}`,
    };
  }
}

/**
 * Placeholder for real on-chain execution via a connected wallet + Polymarket CLOB.
 * Intentionally not implemented yet; throwing keeps it from silently no-op'ing.
 */
export class RealExecutionAdapter implements ExecutionAdapter {
  readonly mode = "real" as const;

  async execute(_wallet: WalletAccount, req: ExecutionRequest): Promise<ExecutionResult> {
    if (!isAllowedAction(req.type)) {
      return { ok: false, walletAddress: _wallet.address, action: req.type, error: "Action not permitted" };
    }
    throw new Error("Real wallet execution is not enabled yet");
  }
}

/**
 * Fan out a single action to many wallets: one action per wallet. Disallowed
 * actions are rejected up front for every wallet so nothing leaks through.
 */
export async function executeAcrossWallets(
  adapter: ExecutionAdapter,
  wallets: WalletAccount[],
  req: ExecutionRequest,
): Promise<ExecutionResult[]> {
  if (!isAllowedAction(req.type)) {
    return wallets.map((w) => ({
      ok: false,
      walletAddress: w.address,
      action: req.type,
      error: "Action not permitted",
    }));
  }
  return Promise.all(
    wallets.map(async (w) => {
      try {
        return await adapter.execute(w, req);
      } catch (e) {
        return {
          ok: false,
          walletAddress: w.address,
          action: req.type,
          error: e instanceof Error ? e.message : "Execution failed",
        };
      }
    }),
  );
}
