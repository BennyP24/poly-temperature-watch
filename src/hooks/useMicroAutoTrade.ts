import { useEffect, useRef, useCallback } from "react";
import type { TemperatureEvent } from "@/lib/polymarket";
import { useToast } from "@/components/ui/use-toast";

const MICRO_BET_AMOUNT = 100;
const MAX_NO_PRICE = 0.03; // 3 cents

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

    for (const event of events) {
      for (const market of event.markets) {
        const key = `${market.id}`;
        if (processedRef.current.has(key)) continue;

        // Only buy NO options at ≤ 3¢
        if (market.noPrice > MAX_NO_PRICE || market.noPrice <= 0) {
          processedRef.current.add(key);
          continue;
        }

        if (balanceRef.current < MICRO_BET_AMOUNT) {
          processedRef.current.add(key);
          continue;
        }

        processedRef.current.add(key);

        const success = await placeTrade({
          eventId: event.id,
          eventTitle: event.title,
          marketId: market.id,
          marketTitle: market.groupItemTitle,
          side: "no",
          price: market.noPrice,
          amount: MICRO_BET_AMOUNT,
          betUrl: event.polymarketUrl,
        });

        if (success) {
          toast({
            title: "🤖 Micro Trade Placed",
            description: `NO ${market.groupItemTitle} @ ${(market.noPrice * 100).toFixed(1)}¢ · $${MICRO_BET_AMOUNT}`,
          });
        }
      }
    }
  }, [events, accountId, enabled, placeTrade, toast]);

  useEffect(() => {
    processNewEvents();
  }, [processNewEvents]);
}
