import { useState } from "react";
import type { TemperatureEvent } from "@/lib/polymarket";
import type { CityWeather } from "@/hooks/useWeatherData";
import { SignalBadge } from "./SignalBadge";
import { ClockDisplay } from "./ClockDisplay";
import { ExternalLink, MapPin, Clock, Link, Thermometer, TrendingUp, TrendingDown, DollarSign, Check } from "lucide-react";

interface TemperatureBetCardProps {
  event: TemperatureEvent;
  userTimezone: string;
  weather?: CityWeather;
  isSaved: boolean;
  onToggleSave: () => void;
}

function parseTempRange(title: string): [number, number] | null {
  const belowMatch = title.match(/([\d.]+)\s*°?\s*F?\s+or\s+below/i);
  if (belowMatch) return [-Infinity, parseFloat(belowMatch[1])];
  const aboveMatch = title.match(/([\d.]+)\s*°?\s*F?\s+or\s+above/i);
  if (aboveMatch) return [parseFloat(aboveMatch[1]), Infinity];
  const rangeMatch = title.match(/([\d.]+)\s*°?\s*F?\s+to\s+([\d.]+)\s*°?\s*F?/i);
  if (rangeMatch) return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
  return null;
}

/** Use Math.floor for range matching - 14.8°F counts as 14°F */
function isCorrectAnswer(title: string, highTempF: number | null): boolean {
  if (highTempF === null) return false;
  const floored = Math.floor(highTempF);
  const range = parseTempRange(title);
  if (!range) return false;
  return floored >= range[0] && floored <= range[1];
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

function formatDual(f: number | null, decimals = 3): string {
  if (f === null) return "--";
  return `${f.toFixed(decimals)}°F / ${fToC(f).toFixed(decimals)}°C`;
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:00 ${ampm}`;
}

export function TemperatureBetCard({ event, userTimezone, weather, isSaved, onToggleSave }: TemperatureBetCardProps) {
  const pastPeak = weather?.pastPeak ?? false;
  const highTemp = weather?.highestRecordedF ?? null;

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
        <div className="flex items-center gap-1 shrink-0">
          {/* Save tick */}
          <button
            onClick={onToggleSave}
            className={`rounded-sm p-1 transition-colors ${
              isSaved
                ? "bg-[hsl(var(--signal-resolved))] text-background"
                : "text-muted-foreground hover:text-primary border border-border"
            }`}
            title={isSaved ? "Saved — click to unsave" : "Save this bet"}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <a
            href={event.polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Location */}
      <div className="mb-2 sm:mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate">{event.location}</span>
      </div>

      {/* Weather data — dual °F / °C */}
      {weather && !weather.error && (
        <div className="mb-2 sm:mb-3 rounded-sm border border-border bg-muted/50 p-2 sm:p-3 space-y-2">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Now</span>
              <div className="flex items-center gap-0.5">
                <Thermometer className="h-3 w-3 text-accent" />
                <span className="text-[10px] sm:text-xs font-bold text-accent tabular-nums">
                  {formatDual(weather.currentTempF)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">High</span>
              <div className="flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3 text-destructive" />
                <span className="text-[10px] sm:text-xs font-bold text-destructive tabular-nums">
                  {formatDual(weather.highestRecordedF)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</span>
              <span className="text-[10px] sm:text-xs font-bold text-foreground tabular-nums">
                {formatDual(weather.forecastHighF)}
              </span>
            </div>
          </div>
          {/* Peak hour indicator */}
          {weather.peakHour !== null && (
            <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs">
              <TrendingDown className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Temp drops after <span className="font-semibold text-foreground">{formatHour(weather.peakHour)}</span> local
                {pastPeak && <span className="ml-1 text-[hsl(var(--signal-resolved))] font-bold">· COOLING</span>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Clocks */}
      <div className="mb-2 sm:mb-3 grid grid-cols-3 gap-1 sm:gap-2 rounded-sm border border-border bg-muted/50 p-2 sm:p-3">
        <ClockDisplay timezone={userTimezone} label="You" variant="default" />
        <ClockDisplay timezone={event.timezone} label={event.location} variant="primary" />
        <ClockDisplay timezone="UTC" label="PM" variant="accent" />
      </div>

      {/* Markets / Odds — floor temp for matching */}
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
                    <span className={`text-[10px] sm:text-xs truncate ${correct ? "font-semibold text-[hsl(var(--signal-resolved))]" : "text-foreground"}`}>
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
