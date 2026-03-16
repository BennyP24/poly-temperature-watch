import { useEffect, useRef, useCallback } from "react";
import type { TemperatureEvent } from "@/lib/polymarket";
import { useToast } from "@/components/ui/use-toast";

const MICRO_BET_AMOUNT = 25;
const MAX_PRICE = 0.03;
const MAX_OPTIONS = 9;

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
      if (event.markets.length >= MAX_OPTIONS) continue;

      for (const market of event.markets) {
        // Buy YES if price <= 3 cents
        const yesKey = `${market.id}-yes`;
        if (!processedRef.current.has(yesKey)) {
          processedRef.current.add(yesKey);
          if (market.yesPrice <= MAX_PRICE && market.yesPrice > 0 && balanceRef.current >= MICRO_BET_AMOUNT) {
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
              toast({
                title: "Micro Trade: YES",
                description: `YES ${market.groupItemTitle} @ ${(market.yesPrice * 100).toFixed(1)}¢ · $${MICRO_BET_AMOUNT}`,
              });
            }
          }
        }

        // Buy NO if price <= 3 cents
        const noKey = `${market.id}-no`;
        if (!processedRef.current.has(noKey)) {
          processedRef.current.add(noKey);
          if (market.noPrice <= MAX_PRICE && market.noPrice > 0 && balanceRef.current >= MICRO_BET_AMOUNT) {
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
                title: "Micro Trade: NO",
                description: `NO ${market.groupItemTitle} @ ${(market.noPrice * 100).toFixed(1)}¢ · $${MICRO_BET_AMOUNT}`,
              });
            }
          }
        }
      }
    }
  }, [events, accountId, enabled, placeTrade, toast]);

  useEffect(() => {
    processNewEvents();
  }, [processNewEvents]);
}
