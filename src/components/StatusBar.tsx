import { ClockDisplay } from "./ClockDisplay";

interface StatusBarProps {
  totalBets: number;
  newSignals: number;
  lastRefresh: Date | null;
  userTimezone: string;
}

export function StatusBar({ totalBets, newSignals, lastRefresh, userTimezone }: StatusBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Active Bets
          </span>
          <span className="text-xl font-bold text-foreground tabular-nums">{totalBets}</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            New Signals
          </span>
          <span className="text-xl font-bold text-signal-new tabular-nums">{newSignals}</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Last Refresh
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {lastRefresh
              ? lastRefresh.toLocaleTimeString("en-US", { hour12: false })
              : "--:--:--"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ClockDisplay timezone={userTimezone} label="Local" variant="default" />
        <div className="h-8 w-px bg-border" />
        <ClockDisplay timezone="UTC" label="UTC / Polymarket" variant="accent" />
      </div>
    </div>
  );
}
