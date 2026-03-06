import type { TemperatureEvent } from "@/lib/polymarket";
import type { CityWeather } from "@/hooks/useWeatherData";
import { SignalBadge } from "./SignalBadge";
import { ClockDisplay } from "./ClockDisplay";
import { ExternalLink, MapPin, Clock, Link, Thermometer, TrendingUp, DollarSign } from "lucide-react";

interface TemperatureBetCardProps {
  event: TemperatureEvent;
  userTimezone: string;
  weather?: CityWeather;
}

/**
 * Parse temperature range from a groupItemTitle like "49.0°F or below" or "50.0°F to 52.9°F"
 * Returns [low, high] bounds in °F. For "or below" → [-Infinity, X], for "or above" → [X, Infinity]
 */
function parseTempRange(title: string): [number, number] | null {
  // "X°F or below"
  const belowMatch = title.match(/([\d.]+)\s*°?\s*F?\s+or\s+below/i);
  if (belowMatch) return [-Infinity, parseFloat(belowMatch[1])];

  // "X°F or above"
  const aboveMatch = title.match(/([\d.]+)\s*°?\s*F?\s+or\s+above/i);
  if (aboveMatch) return [parseFloat(aboveMatch[1]), Infinity];

  // "X°F to Y°F"
  const rangeMatch = title.match(/([\d.]+)\s*°?\s*F?\s+to\s+([\d.]+)\s*°?\s*F?/i);
  if (rangeMatch) return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];

  return null;
}

function isCorrectAnswer(title: string, highTemp: number | null): boolean {
  if (highTemp === null) return false;
  const range = parseTempRange(title);
  if (!range) return false;
  return highTemp >= range[0] && highTemp <= range[1];
}

export function TemperatureBetCard({ event, userTimezone, weather }: TemperatureBetCardProps) {
  const pastPeak = weather?.pastPeak ?? false;
  // Use highest recorded temp for matching
  const highTemp = weather?.highestRecorded ?? null;

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

      {/* Weather data in °F with 3 decimal places */}
      {weather && !weather.error && (
        <div className="mb-2 sm:mb-3 grid grid-cols-3 gap-1.5 sm:gap-2 rounded-sm border border-border bg-muted/50 p-2 sm:p-3">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Now</span>
            <div className="flex items-center gap-0.5">
              <Thermometer className="h-3 w-3 text-accent" />
              <span className="text-[11px] sm:text-sm font-bold text-accent tabular-nums">
                {weather.currentTemp !== null ? `${weather.currentTemp.toFixed(3)}°F` : "--"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">High</span>
            <div className="flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3 text-destructive" />
              <span className="text-[11px] sm:text-sm font-bold text-destructive tabular-nums">
                {weather.highestRecorded !== null ? `${weather.highestRecorded.toFixed(3)}°F` : "--"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</span>
            <span className="text-[11px] sm:text-sm font-bold text-foreground tabular-nums">
              {weather.forecastHigh !== null ? `${weather.forecastHigh.toFixed(3)}°F` : "--"}
            </span>
          </div>
        </div>
      )}

      {/* Clocks */}
      <div className="mb-2 sm:mb-3 grid grid-cols-3 gap-1 sm:gap-2 rounded-sm border border-border bg-muted/50 p-2 sm:p-3">
        <ClockDisplay timezone={userTimezone} label="You" variant="default" />
        <ClockDisplay timezone={event.timezone} label={event.location} variant="primary" />
        <ClockDisplay timezone="UTC" label="PM" variant="accent" />
      </div>

      {/* Markets / Odds table with correct answer highlighting & profit % */}
      <div className="mb-2 sm:mb-3 space-y-1">
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Temp Range</span>
          <div className="flex gap-3">
            <span>Price</span>
            <span>Profit</span>
          </div>
        </div>
        <div className="max-h-40 sm:max-h-52 space-y-0.5 overflow-y-auto">
          {event.markets
            .sort((a, b) => b.yesPrice - a.yesPrice)
            .map((m) => {
              const correct = isCorrectAnswer(m.groupItemTitle, highTemp);
              const profitPct = m.yesPrice > 0 ? ((1 - m.yesPrice) / m.yesPrice) * 100 : 0;

              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between rounded-sm px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors ${
                    correct
                      ? "bg-[hsl(var(--signal-resolved)/0.15)] border border-[hsl(var(--signal-resolved)/0.5)]"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0 mr-2">
                    {correct && (
                      <span className="text-[9px] font-bold text-[hsl(var(--signal-resolved))]">✓</span>
                    )}
                    <span className={`text-[11px] sm:text-xs truncate ${correct ? "font-semibold text-[hsl(var(--signal-resolved))]" : "text-foreground"}`}>
                      {m.groupItemTitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      <div className="h-1 w-8 sm:w-12 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${correct ? "bg-[hsl(var(--signal-resolved))]" : "bg-primary"}`}
                          style={{ width: `${m.yesPrice * 100}%` }}
                        />
                      </div>
                      <span className={`w-8 sm:w-10 text-right text-[10px] sm:text-xs tabular-nums ${correct ? "text-[hsl(var(--signal-resolved))] font-semibold" : "text-primary"}`}>
                        {(m.yesPrice * 100).toFixed(1)}¢
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <DollarSign className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className={`w-10 sm:w-12 text-right text-[10px] sm:text-xs tabular-nums ${
                        correct ? "text-[hsl(var(--signal-resolved))] font-bold" : "text-muted-foreground"
                      }`}>
                        +{profitPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
