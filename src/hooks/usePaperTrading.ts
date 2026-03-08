import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "paper-device-id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
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

export function usePaperTrading() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [balance, setBalance] = useState(1000);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const deviceId = getDeviceId();

  const loadAccount = useCallback(async () => {
    // Try to find existing account
    const { data: existing } = await supabase
      .from("paper_accounts")
      .select("*")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existing) {
      setAccountId(existing.id);
      setBalance(Number(existing.balance));
    } else {
      // Create new account
      const { data: created } = await supabase
        .from("paper_accounts")
        .insert({ device_id: deviceId, balance: 1000 })
        .select()
        .single();
      if (created) {
        setAccountId(created.id);
        setBalance(Number(created.balance));
      }
    }
    setLoading(false);
  }, [deviceId]);

  const loadTrades = useCallback(async () => {
    if (!accountId) return;
    const { data } = await supabase
      .from("paper_trades")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (data) {
      setTrades(data.map(t => ({
        ...t,
        price: Number(t.price),
        amount: Number(t.amount),
        shares: Number(t.shares),
        payout: Number(t.payout),
        profit: Number(t.profit),
      })));
    }
  }, [accountId]);

  useEffect(() => { loadAccount(); }, [loadAccount]);
  useEffect(() => { loadTrades(); }, [loadTrades]);

  const placeTrade = useCallback(async (params: {
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
    const newBalance = balance - params.amount;

    // Update balance
    await supabase
      .from("paper_accounts")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    // Insert trade
    await supabase
      .from("paper_trades")
      .insert({
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

    setBalance(newBalance);
    await loadTrades();
    return true;
  }, [accountId, balance, loadTrades]);

  const resetBalance = useCallback(async () => {
    if (!accountId) return;
    await supabase
      .from("paper_accounts")
      .update({ balance: 1000, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    // Cancel all open trades and reset
    await supabase
      .from("paper_trades")
      .update({ status: "cancelled" })
      .eq("account_id", accountId)
      .eq("status", "open");

    setBalance(1000);
    await loadTrades();
  }, [accountId, loadTrades]);

  const resolveTrade = useCallback(async (tradeId: string, won: boolean) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;

    const payout = won ? trade.shares : 0;
    const profit = payout - trade.amount;
    const newBalance = balance + payout;

    await supabase
      .from("paper_trades")
      .update({
        status: won ? "won" : "lost",
        payout,
        profit,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", tradeId);

    await supabase
      .from("paper_accounts")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", accountId);

    setBalance(newBalance);
    await loadTrades();
  }, [accountId, balance, trades, loadTrades]);

  const totalProfit = trades
    .filter(t => t.status === "won" || t.status === "lost")
    .reduce((sum, t) => sum + t.profit, 0);

  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status !== "open" && t.status !== "cancelled");

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
