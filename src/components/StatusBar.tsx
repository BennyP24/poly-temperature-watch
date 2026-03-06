import { ClockDisplay } from "./ClockDisplay";

interface StatusBarProps {
  totalBets: number;
  newSignals: number;
  lastRefresh: Date | null;
  userTimezone: string;
}

export function StatusBar({ totalBets, newSignals, lastRefresh, userTimezone }: StatusBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-md border border-border bg-card px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
            Active
          </span>
          <span className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{totalBets}</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
            New
          </span>
          <span className="text-lg sm:text-xl font-bold text-signal-new tabular-nums">{newSignals}</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
            Refreshed
          </span>
          <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
            {lastRefresh
              ? lastRefresh.toLocaleTimeString("en-US", { hour12: false })
              : "--:--:--"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 border-t sm:border-t-0 border-border pt-2 sm:pt-0">
        <ClockDisplay timezone={userTimezone} label="Local" variant="default" />
        <div className="h-8 w-px bg-border" />
        <ClockDisplay timezone="UTC" label="UTC / PM" variant="accent" />
      </div>
    </div>
  );
}
