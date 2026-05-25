import { useState, useEffect, useCallback, useMemo } from "react";
import type { PaperTrade } from "./usePaperTrading";
import type { MarketPrice, MarketSideBooks } from "./useMarketPrices";
import { normalizeMarketId } from "@/lib/polymarket";
import { computeSellWalkForTrade } from "@/components/OrderBookExitPreview";

export interface AutoSellConfig {
  enabled: boolean;
  profitTargetPercent: number; // default 20%
  trailIncrementCents: number; // default 2¢ (0.02)
  mode: "paper" | "real"; // real is disabled for now
}

export interface AutoSellTarget {
  tradeId: string;
  marketId: string;
  entryPrice: number;
  initialTpPrice: number;
  currentTpPrice: number;
  highWaterMark: number; // highest bid seen
  side: "yes" | "no";
  createdAt: number;
}

const STORAGE_KEY = "auto-sell-config";
const TARGETS_KEY = "auto-sell-targets";

function loadConfig(): AutoSellConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled ?? false,
        profitTargetPercent: parsed.profitTargetPercent ?? 20,
        trailIncrementCents: parsed.trailIncrementCents ?? 2,
        mode: "paper", // always paper for now
      };
    }
  } catch {}
  return {
    enabled: false,
    profitTargetPercent: 20,
    trailIncrementCents: 2,
    mode: "paper",
  };
}

function saveConfig(config: AutoSellConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadTargets(): Map<string, AutoSellTarget> {
  try {
    const stored = localStorage.getItem(TARGETS_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as AutoSellTarget[];
      return new Map(arr.map(t => [t.tradeId, t]));
    }
  } catch {}
  return new Map();
}

function saveTargets(targets: Map<string, AutoSellTarget>) {
  localStorage.setItem(TARGETS_KEY, JSON.stringify([...targets.values()]));
}

interface UseAutoSellParams {
  openTrades: PaperTrade[];
  realTimePrices?: Map<string, MarketPrice>;
  orderBooksByMarketId?: Map<string, MarketSideBooks>;
  onSell: (tradeId: string, bidPrice: number, options?: { payoutUsd?: number }) => void | Promise<boolean>;
}

export function useAutoSell({
  openTrades,
  realTimePrices,
  orderBooksByMarketId,
  onSell,
}: UseAutoSellParams) {
  const [config, setConfigState] = useState<AutoSellConfig>(loadConfig);
  const [targets, setTargets] = useState<Map<string, AutoSellTarget>>(loadTargets);

  const setConfig = useCallback((updates: Partial<AutoSellConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...updates, mode: "paper" as const }; // force paper mode
      saveConfig(next);
      return next;
    });
  }, []);

  const toggleEnabled = useCallback(() => {
    setConfig({ enabled: !config.enabled });
  }, [config.enabled, setConfig]);

  // Register a new trade for auto-sell
  const registerTrade = useCallback((trade: PaperTrade) => {
    if (!config.enabled) return;
    
    // Calculate initial T/P price = entry + 20% profit
    // If entry is 0.03, we want to sell when bid hits 0.036 (20% of 0.03 = 0.006)
    const profitAmount = trade.price * (config.profitTargetPercent / 100);
    const initialTpPrice = trade.price + profitAmount;
    
    const target: AutoSellTarget = {
      tradeId: trade.id,
      marketId: normalizeMarketId(trade.market_id),
      entryPrice: trade.price,
      initialTpPrice,
      currentTpPrice: initialTpPrice,
      highWaterMark: trade.price,
      side: trade.side,
      createdAt: Date.now(),
    };
    
    setTargets(prev => {
      const next = new Map(prev);
      next.set(trade.id, target);
      saveTargets(next);
      return next;
    });
  }, [config.enabled, config.profitTargetPercent]);

  // Remove a target (when trade is closed)
  const removeTarget = useCallback((tradeId: string) => {
    setTargets(prev => {
      const next = new Map(prev);
      next.delete(tradeId);
      saveTargets(next);
      return next;
    });
  }, []);

  // Clean up targets for trades that no longer exist
  useEffect(() => {
    const openTradeIds = new Set(openTrades.map(t => t.id));
    let changed = false;
    const next = new Map(targets);
    for (const [tradeId] of next) {
      if (!openTradeIds.has(tradeId)) {
        next.delete(tradeId);
        changed = true;
      }
    }
    if (changed) {
      setTargets(next);
      saveTargets(next);
    }
  }, [openTrades, targets]);

  // Monitor prices and execute sells
  useEffect(() => {
    if (!config.enabled || targets.size === 0 || !realTimePrices) return;

    const trailIncrement = config.trailIncrementCents / 100; // convert cents to decimal

    for (const [tradeId, target] of targets) {
      const trade = openTrades.find(t => t.id === tradeId);
      if (!trade) continue;

      const sides = orderBooksByMarketId?.get(target.marketId);
      const { walk, hasBook } = computeSellWalkForTrade(trade, sides);
      
      // Get current bid price
      const rtPrice = realTimePrices.get(target.marketId);
      const bidPrice = rtPrice
        ? target.side === "yes"
          ? rtPrice.yesPrice
          : rtPrice.noPrice
        : null;

      if (bidPrice === null) continue;

      // Update high water mark and trailing T/P
      if (bidPrice > target.highWaterMark) {
        const newHighWaterMark = bidPrice;
        // Trail up: for every 2¢ increase, move T/P up by 2¢
        const increaseFromEntry = newHighWaterMark - target.entryPrice;
        const trailSteps = Math.floor(increaseFromEntry / trailIncrement);
        const newTpPrice = Math.max(
          target.initialTpPrice,
          target.entryPrice + (trailSteps * trailIncrement)
        );

        if (newHighWaterMark !== target.highWaterMark || newTpPrice !== target.currentTpPrice) {
          setTargets(prev => {
            const next = new Map(prev);
            next.set(tradeId, {
              ...target,
              highWaterMark: newHighWaterMark,
              currentTpPrice: newTpPrice,
            });
            saveTargets(next);
            return next;
          });
        }
      }

      // Check if we should sell
      if (bidPrice >= target.currentTpPrice) {
        // Execute sell
        const payoutUsd = hasBook && walk.fills.length > 0 ? walk.totalUsd : undefined;
        const refPrice = bidPrice ?? walk.fills[0]?.price ?? 0;
        
        if (refPrice > 0) {
          void onSell(tradeId, refPrice, payoutUsd !== undefined ? { payoutUsd } : undefined);
          removeTarget(tradeId);
        }
      }
    }
  }, [config.enabled, targets, realTimePrices, orderBooksByMarketId, openTrades, onSell, removeTarget, config.trailIncrementCents]);

  // Get target info for a specific trade
  const getTarget = useCallback((tradeId: string): AutoSellTarget | undefined => {
    return targets.get(tradeId);
  }, [targets]);

  // Summary stats
  const stats = useMemo(() => {
    const activeTargets = [...targets.values()];
    return {
      activeCount: activeTargets.length,
      targets: activeTargets,
    };
  }, [targets]);

  return {
    config,
    setConfig,
    toggleEnabled,
    registerTrade,
    removeTarget,
    getTarget,
    stats,
  };
}
