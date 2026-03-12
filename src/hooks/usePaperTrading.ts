import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "paper-device-id";
const DEVICE_COOKIE_KEY = "paper_device_id";
const ACCOUNT_KEY = "paper-account-id";

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  const base = `${name}=${encoded}; path=/; max-age=31536000; samesite=lax`;

  // Cross-subdomain persistence on lovable.app previews/published.
  document.cookie = `${base}; domain=.lovable.app`;
  if (!readCookie(name)) {
    document.cookie = base;
  }
}

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `paper-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const localId = safeLocalStorageGet(DEVICE_KEY);
  const cookieId = readCookie(DEVICE_COOKIE_KEY);
  const id = localId || cookieId || generateDeviceId();

  if (localId !== id) safeLocalStorageSet(DEVICE_KEY, id);
  if (cookieId !== id) writeCookie(DEVICE_COOKIE_KEY, id);

  return id;
}

export interface PaperTrade {
  id: string;
  event_id: string;
  event_title: string;
  market_id: string;
  market_title: string;
  side: string;
  price: number;
  amount: number;
  shares: number;
  status: string;
  payout: number;
  profit: number;
  created_at: string;
  resolved_at: string | null;
}

export interface ImportedPaperTrade {
  event_id: string;
  event_title: string;
  market_id: string;
  market_title: string;
  side: string;
  price: number;
  amount: number;
  shares: number;
  status: string;
  payout?: number;
  profit?: number;
  created_at?: string;
  resolved_at?: string | null;
}

const ALLOWED_STATUSES = new Set(["open", "won", "lost", "sold", "cancelled"]);

function sanitizeTradeStatus(status: string | undefined): string {
  if (!status) return "open";
  const normalized = status.toLowerCase();
  return ALLOWED_STATUSES.has(normalized) ? normalized : "open";
}


export function usePaperTrading() {
  const [accountId, setAccountId] = useState<string | null>(() => safeLocalStorageGet(ACCOUNT_KEY));
  const [balance, setBalance] = useState(1000);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId] = useState<string>(() => getDeviceId());

  const loadAccount = useCallback(async () => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Use upsert to handle race conditions - device_id has unique constraint
      const { data: account, error: upsertError } = await supabase
        .from("paper_accounts")
        .upsert(
          { device_id: deviceId, balance: 1000 },
          { onConflict: "device_id", ignoreDuplicates: true }
        )
        .select()
        .single();

      if (upsertError) {
        // upsert with ignoreDuplicates returns nothing if row exists, so fetch it
        const { data: existing, error: fetchError } = await supabase
          .from("paper_accounts")
          .select("*")
          .eq("device_id", deviceId)
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error("Failed to load paper account", fetchError);
          return;
        }

        if (existing) {
          setAccountId(existing.id);
          safeLocalStorageSet(ACCOUNT_KEY, existing.id);
          setBalance(Number(existing.balance));
        }
        return;
      }

      if (account) {
        setAccountId(account.id);
        safeLocalStorageSet(ACCOUNT_KEY, account.id);
        setBalance(Number(account.balance));
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const loadTrades = useCallback(async () => {
    if (!accountId) return;

    const { data, error } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load paper trades", error);
      return;
    }

    if (data) {
      setTrades(
        data.map((t) => ({
          ...t,
          status: sanitizeTradeStatus(t.status),
          price: Number(t.price),
          amount: Number(t.amount),
          shares: Number(t.shares),
          payout: Number(t.payout ?? 0),
          profit: Number(t.profit ?? 0),
        }))
      );
    }
  }, [accountId]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  const placeTrade = useCallback(
    async (params: {
      eventId: string;
      eventTitle: string;
      marketId: string;
      marketTitle: string;
      side: "yes" | "no";
      price: number;
      amount: number;
    }) => {
      if (!accountId) return false;
      if (params.amount > balance) return false;
      if (params.amount <= 0 || params.price <= 0 || params.price >= 1) return false;

      const shares = params.amount / params.price;
      const nextBalance = balance - params.amount;
      const nowIso = new Date().toISOString();

      const { error: balanceError } = await supabase
        .from("paper_accounts")
        .update({ balance: nextBalance, updated_at: nowIso })
        .eq("id", accountId);

      if (balanceError) {
        console.error("Failed to update balance while placing trade", balanceError);
        return false;
      }

      const { error: tradeError } = await supabase.from("paper_trades").insert({
        account_id: accountId,
        event_id: params.eventId,
        event_title: params.eventTitle,
        market_id: params.marketId,
        market_title: params.marketTitle,
        side: params.side,
        price: params.price,
        amount: params.amount,
        shares,
        status: "open",
      });

      if (tradeError) {
        console.error("Failed to insert paper trade", tradeError);
        await supabase
          .from("paper_accounts")
          .update({ balance, updated_at: new Date().toISOString() })
          .eq("id", accountId);
        return false;
      }

      setBalance(nextBalance);
      await loadTrades();
      return true;
    },
    [accountId, balance, loadTrades]
  );

  const resetBalance = useCallback(async () => {
    if (!accountId) return;

    const nowIso = new Date().toISOString();

    const { error: accountError } = await supabase
      .from("paper_accounts")
      .update({ balance: 1000, updated_at: nowIso })
      .eq("id", accountId);

    if (accountError) {
      console.error("Failed to reset paper account balance", accountError);
      return;
    }

    const { error: tradesError } = await supabase
      .from("paper_trades")
      .update({ status: "cancelled" })
      .eq("account_id", accountId)
      .eq("status", "open");

    if (tradesError) {
      console.error("Failed to cancel open trades", tradesError);
      return;
    }

    setBalance(1000);
    await loadTrades();
  }, [accountId, loadTrades]);

  const resolveTrade = useCallback(
    async (tradeId: string, won: boolean) => {
      if (!accountId) return;

      const trade = trades.find((t) => t.id === tradeId);
      if (!trade || trade.status !== "open") return;

      const payout = won ? trade.shares : 0;
      const profit = payout - trade.amount;
      const nextBalance = balance + payout;
      const nowIso = new Date().toISOString();

      const { error: tradeError } = await supabase
        .from("paper_trades")
        .update({
          status: won ? "won" : "lost",
          payout,
          profit,
          resolved_at: nowIso,
        })
        .eq("id", tradeId)
        .eq("account_id", accountId);

      if (tradeError) {
        console.error("Failed to resolve paper trade", tradeError);
        return;
      }

      const { error: accountError } = await supabase
        .from("paper_accounts")
        .update({ balance: nextBalance, updated_at: nowIso })
        .eq("id", accountId);

      if (accountError) {
        console.error("Failed to apply resolved trade payout", accountError);
        return;
      }

      setBalance(nextBalance);
      await loadTrades();
    },
    [accountId, balance, trades, loadTrades]
  );

  const totalProfit = trades
    .filter((t) => t.status === "won" || t.status === "lost")
    .reduce((sum, t) => sum + t.profit, 0);

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status !== "open" && t.status !== "cancelled");

  return {
    balance,
    trades,
    openTrades,
    closedTrades,
    totalProfit,
    loading,
    placeTrade,
    resetBalance,
    resolveTrade,
  };
}
