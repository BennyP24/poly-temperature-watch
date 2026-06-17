import { useCallback, useEffect, useState } from "react";

/**
 * Browser-extension wallet connection (MetaMask / EIP-1193) for the hybrid
 * multi-account model. Connected addresses are remembered in localStorage and
 * each can be toggled as "selected" so one action fans out to the chosen wallets.
 *
 * No signing or on-chain calls happen here yet — execution stays paper. A real
 * adapter can later use these addresses + the injected provider to sign orders.
 */

const STORAGE_KEY = "connected-wallets-v1";

export interface ConnectedWallet {
  address: string;
  label?: string;
  selected: boolean;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

/** True when a browser wallet (e.g. MetaMask) is injected. */
export function hasInjectedWallet(): boolean {
  return getProvider() !== null;
}

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function loadStored(): ConnectedWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((w) => w && typeof w.address === "string")
      .map((w) => ({ address: String(w.address), label: w.label, selected: w.selected !== false }));
  } catch {
    return [];
  }
}

function persist(wallets: ConnectedWallet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  } catch {
    /* ignore */
  }
}

export function useWallets() {
  const [wallets, setWallets] = useState<ConnectedWallet[]>(() => loadStored());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    persist(wallets);
  }, [wallets]);

  const mergeAddresses = useCallback((addresses: string[]) => {
    if (addresses.length === 0) return;
    setWallets((prev) => {
      const map = new Map(prev.map((w) => [w.address.toLowerCase(), w]));
      for (const addr of addresses) {
        const key = addr.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { address: addr, label: shortAddress(addr), selected: true });
        }
      }
      return Array.from(map.values());
    });
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No browser wallet detected. Install MetaMask or a compatible wallet.");
      return false;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      mergeAddresses(Array.isArray(accounts) ? accounts : []);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection rejected");
      return false;
    } finally {
      setConnecting(false);
    }
  }, [mergeAddresses]);

  const disconnect = useCallback((address: string) => {
    setWallets((prev) => prev.filter((w) => w.address.toLowerCase() !== address.toLowerCase()));
  }, []);

  const toggleSelected = useCallback((address: string) => {
    setWallets((prev) =>
      prev.map((w) =>
        w.address.toLowerCase() === address.toLowerCase() ? { ...w, selected: !w.selected } : w,
      ),
    );
  }, []);

  // Reflect account changes from the wallet extension.
  useEffect(() => {
    const provider = getProvider();
    if (!provider?.on) return;
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      if (Array.isArray(accounts)) mergeAddresses(accounts);
    };
    provider.on("accountsChanged", handler);
    return () => provider.removeListener?.("accountsChanged", handler);
  }, [mergeAddresses]);

  const selectedWallets = wallets.filter((w) => w.selected);

  return {
    wallets,
    selectedWallets,
    connecting,
    error,
    hasInjectedWallet: hasInjectedWallet(),
    connect,
    disconnect,
    toggleSelected,
    shortAddress,
  };
}
