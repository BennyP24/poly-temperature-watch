import type { TemperatureEvent } from "@/lib/polymarket";
import type { CityWeather } from "@/hooks/useWeatherData";
import { SignalBadge } from "./SignalBadge";
import { ClockDisplay } from "./ClockDisplay";
import { ExternalLink, MapPin, Clock, Link, Thermometer, TrendingUp } from "lucide-react";

interface TemperatureBetCardProps {
  event: TemperatureEvent;
  userTimezone: string;
  weather?: CityWeather;
}

export function TemperatureBetCard({ event, userTimezone, weather }: TemperatureBetCardProps) {
  const pastPeak = weather?.pastPeak ?? false;

  return (
    <div
      className={`relative rounded-md border bg-card p-3 sm:p-4 transition-all hover:border-primary/30 ${
        pastPeak
          ? "border-[hsl(var(--signal-resolved))] shadow-[0_0_12px_hsl(var(--signal-resolved)/0.25)]"
          : event.isNew
            ? "border-signal-new/40 shadow-[0_0_15px_hsl(var(--signal-new)/0.1)]"
            : "border-border"
      }`}
    >
      {/* Past peak badge */}
      {pastPeak && (
        <div className="absolute -top-2 right-3 rounded-sm bg-[hsl(var(--signal-resolved))] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">
          Past Peak
        </div>
      )}

      {/* Header */}
      <div className="mb-2 sm:mb-3 flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <SignalBadge isNew={event.isNew} active={true} />
          <h3 className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-medium leading-snug text-foreground line-clamp-2">
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
      <div className="mb-2 sm:mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate">{event.location}</span>
      </div>

      {/* Weather data */}
      {weather && !weather.error && (
        <div className="mb-2 sm:mb-3 grid grid-cols-3 gap-1.5 sm:gap-2 rounded-sm border border-border bg-muted/50 p-2 sm:p-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Now</span>
            <div className="flex items-center gap-1">
              <Thermometer className="h-3 w-3 text-accent" />
              <span className="text-sm sm:text-base font-bold text-accent tabular-nums">
                {weather.currentTemp !== null ? `${weather.currentTemp}°` : "--"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">High</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-destructive" />
              <span className="text-sm sm:text-base font-bold text-destructive tabular-nums">
                {weather.highestRecorded !== null ? `${weather.highestRecorded}°` : "--"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</span>
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-bold text-foreground tabular-nums">
                {weather.forecastHigh !== null ? `${weather.forecastHigh}°` : "--"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Clocks */}
      <div className="mb-2 sm:mb-3 grid grid-cols-3 gap-1 sm:gap-2 rounded-sm border border-border bg-muted/50 p-2 sm:p-3">
        <ClockDisplay timezone={userTimezone} label="You" variant="default" />
        <ClockDisplay timezone={event.timezone} label={event.location} variant="primary" />
        <ClockDisplay timezone="UTC" label="PM" variant="accent" />
      </div>

      {/* Markets / Odds table */}
      <div className="mb-2 sm:mb-3 space-y-1">
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Temp Range</span>
          <span>Yes Price</span>
        </div>
        <div className="max-h-32 sm:max-h-40 space-y-0.5 overflow-y-auto">
          {event.markets
            .sort((a, b) => b.yesPrice - a.yesPrice)
            .map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-sm bg-muted/30 px-1.5 sm:px-2 py-0.5 sm:py-1"
              >
                <span className="text-[11px] sm:text-xs text-foreground truncate mr-2">{m.groupItemTitle}</span>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <div className="h-1 w-10 sm:w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${m.yesPrice * 100}%` }}
                    />
                  </div>
                  <span className="w-8 sm:w-10 text-right text-[11px] sm:text-xs tabular-nums text-primary">
                    {(m.yesPrice * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Volume & End date */}
      <div className="mb-2 flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
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
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
            <Link className="h-3 w-3" />
            <span>Resolution Source</span>
          </div>
          <a
            href={event.resolutionSource}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate text-[10px] sm:text-[11px] text-primary/80 transition-colors hover:text-primary"
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
              className="block truncate text-[10px] sm:text-[11px] text-muted-foreground transition-colors hover:text-primary"
            >
              {link}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
