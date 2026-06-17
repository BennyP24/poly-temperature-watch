import { useWallets } from "@/hooks/useWallets";
import { useMultiAccountExecution } from "@/hooks/useMultiAccountExecution";
import { Wallet, Plus, X, Check, ShieldAlert } from "lucide-react";

/**
 * Connect browser-extension wallets (MetaMask / EIP-1193) and choose which ones
 * participate in multi-account execution. Execution is paper today; one action
 * mirrors to each selected wallet. Only BUY / SELL / OPEN ORDER / CLOSE ORDER
 * can ever be executed.
 */
export function WalletBar() {
  const { wallets, selectedWallets, connecting, error, hasInjectedWallet, connect, disconnect, toggleSelected } = useWallets();
  const { mode } = useMultiAccountExecution();

  return (
    <div className="rounded-md border border-border bg-card p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground">Wallets</span>
        </div>

        <button
          onClick={() => void connect()}
          disabled={connecting}
          className="flex items-center gap-1 rounded-sm border border-primary/50 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>

        <span className="flex items-center gap-1 rounded-sm bg-muted px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          {mode === "paper" ? "Paper mode" : "Live mode"} · BUY / SELL / OPEN / CLOSE only
        </span>

        {wallets.length > 0 && (
          <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">
            {selectedWallets.length}/{wallets.length} selected · 1 action = 1 bet per wallet
          </span>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-[10px] text-destructive">{error}</p>
      )}

      {!hasInjectedWallet && wallets.length === 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          No browser wallet detected. Install MetaMask (or a compatible EIP-1193 wallet) to connect.
        </p>
      )}

      {wallets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {wallets.map((w) => (
            <div
              key={w.address}
              className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] transition-colors ${
                w.selected ? "border-primary/50 bg-primary/10" : "border-border bg-muted/40"
              }`}
            >
              <button
                onClick={() => toggleSelected(w.address)}
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                  w.selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"
                }`}
                title={w.selected ? "Selected for multi-account actions" : "Click to include"}
              >
                {w.selected && <Check className="h-2.5 w-2.5" />}
              </button>
              <span className="font-mono tabular-nums text-foreground">{w.label ?? w.address}</span>
              <button
                onClick={() => disconnect(w.address)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Disconnect"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
