import { describe, it, expect } from "vitest";
import {
  isAllowedAction,
  EXECUTION_ACTIONS,
  PaperExecutionAdapter,
  RealExecutionAdapter,
  executeAcrossWallets,
  type ExecutionRequest,
  type WalletAccount,
} from "./ExecutionAdapter";

const wallets: WalletAccount[] = [
  { address: "0xaaa" },
  { address: "0xbbb" },
];

function req(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return { type: "BUY", marketId: "m1", side: "yes", price: 0.5, amountUsd: 10, ...overrides };
}

describe("isAllowedAction", () => {
  it("permits exactly the four whitelisted operations", () => {
    expect(EXECUTION_ACTIONS).toEqual(["BUY", "SELL", "OPEN_ORDER", "CLOSE_ORDER"]);
    for (const a of EXECUTION_ACTIONS) expect(isAllowedAction(a)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAllowedAction("TRANSFER")).toBe(false);
    expect(isAllowedAction("WITHDRAW")).toBe(false);
    expect(isAllowedAction("buy")).toBe(false); // case-sensitive
  });
});

describe("PaperExecutionAdapter", () => {
  it("executes each whitelisted action and reports the wallet", async () => {
    const adapter = new PaperExecutionAdapter();
    for (const type of EXECUTION_ACTIONS) {
      const res = await adapter.execute(wallets[0], req({ type, shares: 5 }));
      expect(res.ok).toBe(true);
      expect(res.walletAddress).toBe("0xaaa");
      expect(res.action).toBe(type);
    }
  });

  it("rejects a non-whitelisted action", async () => {
    const adapter = new PaperExecutionAdapter();
    // @ts-expect-error intentional invalid action
    const res = await adapter.execute(wallets[0], req({ type: "TRANSFER" }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not permitted/i);
  });
});

describe("RealExecutionAdapter", () => {
  it("is not enabled yet for valid actions", async () => {
    const adapter = new RealExecutionAdapter();
    await expect(adapter.execute(wallets[0], req())).rejects.toThrow(/not enabled/i);
  });
});

describe("executeAcrossWallets", () => {
  it("runs one action per wallet", async () => {
    const results = await executeAcrossWallets(new PaperExecutionAdapter(), wallets, req());
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.walletAddress)).toEqual(["0xaaa", "0xbbb"]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("rejects a disallowed action for every wallet without calling the adapter", async () => {
    // @ts-expect-error intentional invalid action
    const results = await executeAcrossWallets(new RealExecutionAdapter(), wallets, req({ type: "DRAIN" }));
    expect(results).toHaveLength(2);
    expect(results.every((r) => !r.ok && /not permitted/i.test(r.error ?? ""))).toBe(true);
  });

  it("captures adapter errors per wallet", async () => {
    const results = await executeAcrossWallets(new RealExecutionAdapter(), wallets, req());
    expect(results.every((r) => !r.ok && /not enabled/i.test(r.error ?? ""))).toBe(true);
  });
});
