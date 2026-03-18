import { Link } from "react-router-dom";
import { Thermometer, Zap, Briefcase, ArrowRight } from "lucide-react";
import { usePaperTrading } from "@/hooks/usePaperTrading";
import { ClockDisplay } from "@/components/ClockDisplay";

const Landing = () => {
  const paper = usePaperTrading("paper");
  const micro = usePaperTrading("micro");

  return (
    <div className="relative min-h-screen bg-background">
      <div className="scanline fixed inset-0 z-50 h-[200%]" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Thermometer className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            POLYMARKET TEMP TRACKER
          </h1>
          <p className="mt-2 text-xs sm:text-sm uppercase tracking-widest text-muted-foreground">
            Daily Temperature Bets · Resolution Source Data
          </p>
        </div>

        {/* Clock bar */}
        <div className="mb-10 mx-auto max-w-md grid grid-cols-3 gap-3 rounded-md border border-border bg-card p-3">
          <ClockDisplay timezone={Intl.DateTimeFormat().resolvedOptions().timeZone} label="Local" variant="default" />
          <ClockDisplay timezone="UTC" label="Polymarket" variant="primary" />
          <ClockDisplay timezone="Asia/Jerusalem" label="Israel" variant="accent" />
        </div>

        {/* Account Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Normal Temp Account */}
          <Link
            to="/temp"
            className="group relative rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Normal Temp</h2>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Paper Trading Account</p>
              </div>
            </div>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              Trade temperature bets after observed cooling is confirmed.
              View ready-to-trade signals and monitoring feeds.
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-sm bg-muted/50 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Balance</div>
                <div className="text-sm font-bold text-foreground tabular-nums">${paper.balance.toFixed(0)}</div>
              </div>
              <div className="rounded-sm bg-muted/50 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Open</div>
                <div className="text-sm font-bold text-foreground tabular-nums">{paper.openTrades.length}</div>
              </div>
              <div className="rounded-sm bg-muted/50 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">P&L</div>
                <div className={`text-sm font-bold tabular-nums ${paper.totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                  {paper.totalProfit >= 0 ? "+" : ""}{paper.totalProfit.toFixed(0)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
              Open Account <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          {/* Micro-Trades Account */}
          <Link
            to="/micro"
            className="group relative rounded-lg border border-border bg-card p-6 transition-all hover:border-accent/50 hover:shadow-[0_0_20px_hsl(var(--accent)/0.1)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10">
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Micro-Trades</h2>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Auto-Trade Account</p>
              </div>
            </div>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              Auto-buy YES at 3 cents or less when brand-new bets go live at 00:00 UTC.
              Fast reaction with midnight boost mode.
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-sm bg-muted/50 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Balance</div>
                <div className="text-sm font-bold text-foreground tabular-nums">${micro.balance.toFixed(0)}</div>
              </div>
              <div className="rounded-sm bg-muted/50 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Open</div>
                <div className="text-sm font-bold text-foreground tabular-nums">{micro.openTrades.length}</div>
              </div>
              <div className="rounded-sm bg-muted/50 p-2 text-center">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">P&L</div>
                <div className={`text-sm font-bold tabular-nums ${micro.totalProfit >= 0 ? "text-accent" : "text-destructive"}`}>
                  {micro.totalProfit >= 0 ? "+" : ""}{micro.totalProfit.toFixed(0)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-accent group-hover:gap-2 transition-all">
              Open Account <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
          Polymarket Gamma API · Open-Meteo Weather · Auto-refreshes every 5s
        </div>
      </div>
    </div>
  );
};

export default Landing;
