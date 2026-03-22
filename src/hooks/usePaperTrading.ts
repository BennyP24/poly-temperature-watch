import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_COOKIE_KEY = "paper_device_id";

function safeLocalStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeLocalStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
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
  document.cookie = `${base}; domain=.lovable.app`;
  if (!readCookie(name)) document.cookie = base;
}

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `paper-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDeviceId(prefix: string): string {
  if (typeof window === "undefined") return "";
  const lsKey = `${prefix}-device-id`;
  const ckKey = `${prefix}_device_id`;
  const localId = safeLocalStorageGet(lsKey);
  const cookieId = readCookie(ckKey);
  const id = localId || cookieId || generateDeviceId();
  if (localId !== id) safeLocalStorageSet(lsKey, id);
  if (cookieId !== id) writeCookie(ckKey, id);
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
  bet_url?: string | null;
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

export function usePaperTrading(prefix = "paper") {
  const [accountId, setAccountId] = useState<string | null>(() => safeLocalStorageGet(`${prefix}-account-id`));
  const [balance, setBalance] = useState(1000);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId] = useState<string>(() => getDeviceId(prefix));

  const loadAccount = useCallback(async () => {
    if (!deviceId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Try upsert first (creates if new)
      await supabase
        .from("paper_accounts")
        .upsert({ device_id: deviceId, balance: 1000 }, { onConflict: "device_id", ignoreDuplicates: true });

      // Always fetch the current account to get the real balance
      const { data: existing } = await supabase
        .from("paper_accounts").select("*").eq("device_id", deviceId).limit(1).maybeSingle();
      if (existing) {
        setAccountId(existing.id);
        safeLocalStorageSet(`${prefix}-account-id`, existing.id);
        setBalance(Number(existing.balance));
      }
    } finally { setLoading(false); }
  }, [deviceId, prefix]);

  const loadTrades = useCallback(async () => {
    if (!accountId) return;
    const { data } = await supabase
      .from("paper_trades").select("*").eq("account_id", accountId).order("created_at", { ascending: false });
    if (data) {
      setTrades(data.map((t) => ({
        ...t,
        status: sanitizeTradeStatus(t.status),
        price: Number(t.price),
        amount: Number(t.amount),
        shares: Number(t.shares),
        payout: Number(t.payout ?? 0),
        profit: Number(t.profit ?? 0),
      })));
    }
  }, [accountId]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { loadTrades(); }, [loadTrades]);

  // Periodic sync to keep local state aligned with Supabase
  useEffect(() => {
    if (!accountId) return;
    const interval = setInterval(async () => {
      const { data: acct } = await supabase
        .from("paper_accounts").select("balance").eq("id", accountId).maybeSingle();
      if (acct) setBalance(Number(acct.balance));
      await loadTrades();
    }, 30_000);
    return () => clearInterval(interval);
  }, [accountId, loadTrades]);

  const placeTrade = useCallback(
    async (params: {
      eventId: string; eventTitle: string; marketId: string; marketTitle: string;
      side: "yes" | "no"; price: number; amount: number; betUrl?: string;
    }) => {
      if (!accountId) return false;
      if (params.amount > balance || params.amount <= 0 || params.price <= 0 || params.price >= 1) return false;
      const shares = params.amount / params.price;
      const nextBalance = balance - params.amount;
      const nowIso = new Date().toISOString();

      const { error: balanceError } = await supabase
        .from("paper_accounts").update({ balance: nextBalance, updated_at: nowIso }).eq("id", accountId);
      if (balanceError) return false;

      const { error: tradeError } = await supabase.from("paper_trades").insert({
        account_id: accountId,
        event_id: params.eventId, event_title: params.eventTitle,
        market_id: params.marketId, market_title: params.marketTitle,
        side: params.side, price: params.price, amount: params.amount,
        shares, status: "open",
        bet_url: params.betUrl ?? null,
      });

      if (tradeError) {
        await supabase.from("paper_accounts").update({ balance, updated_at: new Date().toISOString() }).eq("id", accountId);
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
    await supabase.from("paper_accounts").update({ balance: 1000, updated_at: nowIso }).eq("id", accountId);
    await supabase.from("paper_trades").update({ status: "cancelled" }).eq("account_id", accountId).eq("status", "open");
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
      await supabase.from("paper_trades").update({ status: won ? "won" : "lost", payout, profit, resolved_at: nowIso }).eq("id", tradeId).eq("account_id", accountId);
      await supabase.from("paper_accounts").update({ balance: nextBalance, updated_at: nowIso }).eq("id", accountId);
      setBalance(nextBalance);
      await loadTrades();
    },
    [accountId, balance, trades, loadTrades]
  );

  const sellTrade = useCallback(
    async (tradeId: string, bidPrice: number, options?: { payoutUsd?: number }) => {
      const trade = trades.find((t) => t.id === tradeId);
      if (!accountId || !trade || trade.status !== "open") return false;
      const payout =
        options?.payoutUsd != null && Number.isFinite(options.payoutUsd) && options.payoutUsd >= 0
          ? options.payoutUsd
          : trade.shares * bidPrice;
      if (!Number.isFinite(payout) || payout < 0) return false;
      if (options?.payoutUsd == null && (bidPrice <= 0 || bidPrice >= 1)) return false;
      const profit = payout - trade.amount;
      const nextBalance = balance + payout;
      const nowIso = new Date().toISOString();
      await supabase.from("paper_trades").update({ status: "sold", payout, profit, resolved_at: nowIso }).eq("id", tradeId).eq("account_id", accountId).eq("status", "open");
      await supabase.from("paper_accounts").update({ balance: nextBalance, updated_at: nowIso }).eq("id", accountId);
      setBalance(nextBalance);
      await loadTrades();
      return true;
    },
    [accountId, balance, trades, loadTrades]
  );

  const restoreSession = useCallback(
    async (payload: { balance: number; trades: ImportedPaperTrade[] }) => {
      if (!accountId) return false;
      const nextBalance = Number(payload.balance);
      if (!Number.isFinite(nextBalance) || nextBalance < 0) return false;
      const nowIso = new Date().toISOString();
      await supabase.from("paper_accounts").update({ balance: nextBalance, updated_at: nowIso }).eq("id", accountId);
      await supabase.from("paper_trades").delete().eq("account_id", accountId);
      const insertable = payload.trades
        .map((trade) => ({
          account_id: accountId,
          event_id: trade.event_id, event_title: trade.event_title,
          market_id: trade.market_id, market_title: trade.market_title,
          side: trade.side === "no" ? "no" : "yes",
          price: Number(trade.price), amount: Number(trade.amount), shares: Number(trade.shares),
          status: sanitizeTradeStatus(trade.status),
          payout: Number(trade.payout ?? 0), profit: Number(trade.profit ?? 0),
          resolved_at: trade.resolved_at ?? null,
          created_at: trade.created_at ? new Date(trade.created_at).toISOString() : nowIso,
        }))
        .filter((t) => Number.isFinite(t.price) && t.price > 0 && Number.isFinite(t.amount) && t.amount >= 0 && Number.isFinite(t.shares) && t.shares >= 0);
      if (insertable.length > 0) await supabase.from("paper_trades").insert(insertable);
      setBalance(nextBalance);
      await loadTrades();
      return true;
    },
    [accountId, loadTrades]
  );

  const totalProfit = trades
    .filter((t) => t.status === "won" || t.status === "lost" || t.status === "sold")
    .reduce((sum, t) => sum + t.profit, 0);

  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status !== "open" && t.status !== "cancelled");

  return {
    accountId,
    balance, trades, openTrades, closedTrades, totalProfit, loading,
    placeTrade, resetBalance, resolveTrade, sellTrade, restoreSession,
  };
}
