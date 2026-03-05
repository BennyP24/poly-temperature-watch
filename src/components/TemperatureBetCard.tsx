import type { TemperatureEvent } from "@/lib/polymarket";
import { SignalBadge } from "./SignalBadge";
import { ClockDisplay } from "./ClockDisplay";
import { ExternalLink, MapPin, Clock, Link } from "lucide-react";

interface TemperatureBetCardProps {
  event: TemperatureEvent;
  userTimezone: string;
}

export function TemperatureBetCard({ event, userTimezone }: TemperatureBetCardProps) {
  return (
    <div
      className={`relative rounded-md border bg-card p-4 transition-all hover:border-primary/30 ${
        event.isNew ? "border-signal-new/40 shadow-[0_0_15px_hsl(var(--signal-new)/0.1)]" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <SignalBadge isNew={event.isNew} active={true} />
          <h3 className="mt-2 text-sm font-medium leading-snug text-foreground">
            {event.title}
          </h3>
        </div>
        <a
          href={event.polymarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Location */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 text-primary" />
        <span>{event.location}</span>
      </div>

      {/* Clocks */}
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-sm border border-border bg-muted/50 p-3">
        <ClockDisplay timezone={userTimezone} label="Your Time" variant="default" />
        <ClockDisplay timezone={event.timezone} label={event.location} variant="primary" />
        <ClockDisplay timezone="UTC" label="Polymarket" variant="accent" />
      </div>

      {/* Markets / Odds table */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Temperature Range</span>
          <span>Yes Price</span>
        </div>
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {event.markets
            .sort((a, b) => b.yesPrice - a.yesPrice)
            .map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1"
              >
                <span className="text-xs text-foreground">{m.groupItemTitle}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${m.yesPrice * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-primary">
                    {(m.yesPrice * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Volume & End date */}
      <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Vol: ${Number(event.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Ends {new Date(event.endDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Resolution Source */}
      {event.resolutionSource && (
        <div className="border-t border-border pt-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Link className="h-3 w-3" />
            <span>Resolution Source</span>
          </div>
          <a
            href={event.resolutionSource}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-[11px] text-primary/80 transition-colors hover:text-primary"
          >
            {event.resolutionSource}
          </a>
        </div>
      )}

      {/* Additional reference links */}
      {event.referenceLinks.length > 1 && (
        <div className="mt-1 space-y-0.5">
          {event.referenceLinks.slice(1).map((link, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[11px] text-muted-foreground transition-colors hover:text-primary"
            >
              {link}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
