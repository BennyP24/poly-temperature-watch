import { useEffect, useRef, useCallback } from "react";
import type { TemperatureEvent } from "@/lib/polymarket";
import { useToast } from "@/components/ui/use-toast";

const MICRO_BET_AMOUNT = 25;
const MAX_PRICE = 0.03;
const MAX_OPTIONS = 9;
const NEW_EVENT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

interface MicroAutoTradeOpts {
  events: TemperatureEvent[] | undefined;
  accountId: string | null;
  balance: number;
  placeTrade: (params: {
    eventId: string; eventTitle: string; marketId: string; marketTitle: string;
    side: "yes" | "no"; price: number; amount: number; betUrl?: string;
  }) => Promise<boolean>;
  enabled: boolean;
}

export function useMicroAutoTrade({ events, accountId, balance, placeTrade, enabled }: MicroAutoTradeOpts) {
  const processedRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const processNewEvents = useCallback(async () => {
    if (!enabled || !events || !accountId) return;

    const now = Date.now();

    for (const event of events) {
      if (event.markets.length >= MAX_OPTIONS) continue;

      // Only process brand-new events (created within the last few hours)
      const createdAt = new Date(event.createdAt).getTime();
      if (now - createdAt > NEW_EVENT_WINDOW_MS) continue;

      for (const market of event.markets) {
        const yesKey = `${market.id}-yes`;
        if (processedRef.current.has(yesKey)) continue;

        if (market.yesPrice > MAX_PRICE || market.yesPrice <= 0) {
          processedRef.current.add(yesKey);
          continue;
        }

        if (balanceRef.current < MICRO_BET_AMOUNT) continue;

        const success = await placeTrade({
          eventId: event.id,
          eventTitle: event.title,
          marketId: market.id,
          marketTitle: market.groupItemTitle,
          side: "yes",
          price: market.yesPrice,
          amount: MICRO_BET_AMOUNT,
          betUrl: event.polymarketUrl,
        });

        if (success) {
          processedRef.current.add(yesKey);
          toast({
            title: "Micro Trade: YES",
            description: `YES ${market.groupItemTitle} @ ${(market.yesPrice * 100).toFixed(1)}¢ · $${MICRO_BET_AMOUNT}`,
          });
        }
        // If trade failed, don't add to processedRef so it retries next cycle
      }
    }
  }, [events, accountId, enabled, placeTrade, toast]);

  useEffect(() => {
    processNewEvents();
  }, [processNewEvents]);
}
