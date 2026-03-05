import type { ParsedTemperatureBet } from "@/lib/polymarket";
import { SignalBadge } from "./SignalBadge";
import { ClockDisplay } from "./ClockDisplay";
import { ExternalLink, MapPin, Clock } from "lucide-react";

interface TemperatureBetCardProps {
  bet: ParsedTemperatureBet;
  userTimezone: string;
}

export function TemperatureBetCard({ bet, userTimezone }: TemperatureBetCardProps) {
  const yesPrice = bet.prices[0] ?? 0;
  const noPrice = bet.prices[1] ?? 0;

  return (
    <div
      className={`relative rounded-md border bg-card p-4 transition-all hover:border-primary/30 ${
        bet.isNew ? "border-signal-new/40 shadow-[0_0_15px_hsl(var(--signal-new)/0.1)]" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <SignalBadge isNew={bet.isNew} active={bet.active} />
          <h3 className="mt-2 text-sm font-medium leading-snug text-foreground">
            {bet.question}
          </h3>
        </div>
        <a
          href={bet.polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Location */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{bet.location}</span>
      </div>

      {/* Odds bar */}
      <div className="mb-4 space-y-1.5">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Yes {(yesPrice * 100).toFixed(0)}¢</span>
          <span>No {(noPrice * 100).toFixed(0)}¢</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="rounded-full bg-primary transition-all"
            style={{ width: `${yesPrice * 100}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground">
          Vol: ${Number(bet.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Clocks */}
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-sm border border-border bg-muted/50 p-3">
        <ClockDisplay timezone={userTimezone} label="Your Time" variant="default" />
        <ClockDisplay timezone={bet.timezone} label="Bet Location" variant="primary" />
        <ClockDisplay timezone="UTC" label="Polymarket" variant="accent" />
      </div>

      {/* End date */}
      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>
          Ends: {new Date(bet.endDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Reference links */}
      {bet.referenceLinks.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Reference Sources
          </span>
          {bet.referenceLinks.map((link, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[11px] text-primary/80 transition-colors hover:text-primary"
            >
              {link}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
