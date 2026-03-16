import { useState } from "react";
import type { TemperatureEvent, TemperatureMarket } from "@/lib/polymarket";
import type { CityWeather, DateWeather } from "@/hooks/useWeatherData";
import type { ResolutionStatus } from "@/hooks/useResolutionData";
import { SignalBadge, type SignalStatus } from "./SignalBadge";
import { ClockDisplay } from "./ClockDisplay";
import { ExternalLink, MapPin, Clock, Link, Thermometer, TrendingUp, TrendingDown, Check, Copy, Eye, BarChart3, Zap, ShieldCheck } from "lucide-react";

interface TemperatureBetCardProps {
  event: TemperatureEvent;
  userTimezone: string;
  weather?: CityWeather;
  isSaved: boolean;
  onToggleSave: () => void;
  isMicroSaved?: boolean;
  onToggleMicroSave?: () => void;
  refNumber: number;
  isObservation: boolean;
  betDate?: string;
  onPlaceTrade?: (market: TemperatureMarket) => void;
  resolutionStatus?: ResolutionStatus;
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

function isCorrectAnswer(title: string, highTempF: number | null): boolean {
  if (highTempF === null) return false;
  const rounded = Math.round(highTempF);
  const range = parseTempRange(title);
  if (!range) return false;
  return rounded >= range[0] && rounded <= range[1];
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

function getDateWeather(weather: CityWeather | undefined, betDate: string | undefined): DateWeather | null {
  if (!weather?.dates || !betDate) return null;
  return weather.dates[betDate] ?? null;
}

function deriveSignalStatus(
  isObservation: boolean,
  dateWeather: DateWeather | null,
  weather: CityWeather | undefined,
  resolutionStatus: ResolutionStatus | undefined,
): SignalStatus {
  if (!isObservation) return "forecast";

  if (dateWeather?.isPast) {
    if (resolutionStatus?.isObserved) return "resolved-observed";
    return "resolved-observed";
  }

  if (dateWeather?.isToday) {
    const coolingConfirmed = dateWeather.observedCoolingConfirmed ?? weather?.observedCoolingConfirmed ?? false;
    if (coolingConfirmed) return "live-observed-cooling";
    return "live-heating";
  }

  return "live";
}

export function TemperatureBetCard({ event, userTimezone, weather, isSaved, onToggleSave, isMicroSaved, onToggleMicroSave, refNumber, isObservation, betDate, onPlaceTrade, resolutionStatus }: TemperatureBetCardProps) {
  const dateWeather = getDateWeather(weather, betDate);

  const highTemp = dateWeather?.highF ?? weather?.highestRecordedF ?? null;
  const pastPeak = dateWeather?.pastPeak ?? weather?.pastPeak ?? false;
  const peakHour = dateWeather?.peakHour ?? weather?.peakHour ?? null;
  const observedCoolingConfirmed = dateWeather?.observedCoolingConfirmed ?? weather?.observedCoolingConfirmed ?? false;
  const coolingStartHour = dateWeather?.coolingStartHour ?? weather?.coolingStartHour ?? null;

  const [copied, setCopied] = useState(false);
  const refId = `#T${String(refNumber).padStart(3, "0")}`;

  const copyRef = () => {
    navigator.clipboard.writeText(refId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const signalStatus = deriveSignalStatus(isObservation, dateWeather, weather, resolutionStatus);

  // Only show resolution temperature after observed cooling is confirmed
  const showResolutionTemp = isObservation && observedCoolingConfirmed;

  // Cooling hour from hourly data
  const coolingHour = (() => {
    if (!isObservation || !dateWeather?.hourly) return coolingStartHour;
    const hourly = dateWeather.hourly;
    let peakIdx = 0;
    for (let i = 1; i < hourly.length; i++) {
      if (hourly[i].tempF > hourly[peakIdx].tempF) peakIdx = i;
    }
    return hourly[peakIdx]?.hour ?? null;
  })();

  const isCooling = isObservation && observedCoolingConfirmed;
  const hoursSinceCooling = coolingHour !== null && weather?.currentHour !== undefined
    ? Math.max(0, weather.currentHour - coolingHour)
    : null;

  // Time until market close
  const msUntilClose = event.endDate ? new Date(event.endDate).getTime() - Date.now() : null;
  const hoursUntilClose = msUntilClose !== null ? Math.max(0, Math.floor(msUntilClose / 3600000)) : null;

  return (
    <div
      className={`relative rounded-md border bg-card p-3 sm:p-4 transition-all hover:border-primary/30 ${
        isCooling
          ? "border-emerald-500/60 shadow-[0_0_12px_hsl(142_71%_45%/0.25)]"
          : signalStatus === "live-heating"
            ? "border-orange-400/40 shadow-[0_0_10px_hsl(25_95%_53%/0.1)]"
            : event.isNew
              ? "border-signal-new/40 shadow-[0_0_15px_hsl(var(--signal-new)/0.1)]"
              : "border-border"
      }`}
    >
      {/* Status banner */}
      {isCooling && (
        <div className="absolute -top-2 right-3 rounded-sm bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          Observed Cooling
        </div>
      )}

      {/* Ref number + Signal badge + date */}
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={copyRef}
          className="flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          title={`Copy reference ${refId}`}
        >
          {refId}
          {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        </button>
        <SignalBadge status={signalStatus} />
        {betDate && (
          <span className="text-[9px] text-muted-foreground">{betDate}</span>
        )}
        {resolutionStatus?.isObserved && (
          <span className="flex items-center gap-0.5 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
            <ShieldCheck className="h-2.5 w-2.5" />
            Source Verified
          </span>
        )}
      </div>

      {/* Time ribbon */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm bg-muted/40 px-2 py-1.5 text-[9px] text-muted-foreground">
        {peakHour !== null && (
          <span>Peak: <span className="font-semibold text-foreground">{formatHour(peakHour)}</span></span>
        )}
        {hoursSinceCooling !== null && hoursSinceCooling > 0 && (
          <span>Cooling: <span className="font-semibold text-emerald-400">{hoursSinceCooling}h ago</span></span>
        )}
        {hoursUntilClose !== null && (
          <span>Closes: <span className="font-semibold text-foreground">{hoursUntilClose}h</span></span>
        )}
        {weather?.currentHour !== undefined && (
          <span>Local: <span className="font-semibold text-foreground">{formatHour(weather.currentHour)}</span></span>
        )}
      </div>

      {/* Header */}
      <div className="mb-2 sm:mb-3 flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-xs sm:text-sm font-medium leading-snug text-foreground line-clamp-2">
            {event.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleSave}
            className={`rounded-sm p-1 transition-colors ${
              isSaved ? "bg-[hsl(var(--signal-resolved))] text-background" : "text-muted-foreground hover:text-primary border border-border"
            }`}
            title={isSaved ? "Saved — click to unsave" : "Save this bet"}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          {onToggleMicroSave && (
            <button
              onClick={onToggleMicroSave}
              className={`rounded-sm p-1 transition-colors ${
                isMicroSaved ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-accent border border-border"
              }`}
              title={isMicroSaved ? "Micro-saved — click to unsave" : "Mark as micro trade"}
            >
              <Zap className="h-3.5 w-3.5" />
            </button>
          )}
          <a href={event.polymarketUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-primary">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Location */}
      <div className="mb-2 sm:mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate">{event.location}</span>
      </div>

      {/* Weather data */}
      {weather && !weather.error && (
        <div className="mb-2 sm:mb-3 rounded-sm border border-border bg-muted/50 p-2 sm:p-3 space-y-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Resolution Source Data</span>
            {showResolutionTemp && (
              <span className="ml-auto text-[8px] uppercase tracking-widest text-emerald-400 font-bold">Observed</span>
            )}
            {!isObservation && (
              <span className="ml-auto text-[8px] uppercase tracking-widest text-blue-400 font-bold">Forecast</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
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
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
                {showResolutionTemp ? "Observed High" : isObservation ? "Recorded High (Unconfirmed)" : "Forecast High"}
              </span>
              <div className="flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3 text-destructive" />
                <span className={`text-[10px] sm:text-xs font-bold tabular-nums ${showResolutionTemp ? "text-emerald-400" : "text-destructive"}`}>
                  {formatDual(highTemp)}
                </span>
                {resolutionStatus?.isObserved && resolutionStatus.observedHighF !== null && (
                  <span className="ml-1 text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {resolutionStatus.observedHighF.toFixed(1)}°F
                  </span>
                )}
              </div>
            </div>
          </div>
          {showResolutionTemp && highTemp !== null && (
            <div className="text-center text-[9px] text-muted-foreground">
              Settles at: <span className="font-bold text-foreground">{Math.round(highTemp)}°F / {fToC(Math.round(highTemp)).toFixed(1)}°C</span>
              <span className="text-[8px] ml-1">(≥0.5 rounds up)</span>
            </div>
          )}
          {!showResolutionTemp && isObservation && (
            <div className="text-center text-[9px] text-orange-400">
              Waiting for observed cooling confirmation before resolving...
            </div>
          )}
          {/* Cooling indicator */}
          {isObservation && coolingHour !== null && (
            <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs">
              <TrendingDown className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Temp drops after <span className="font-semibold text-foreground">{formatHour(coolingHour)}</span> local
                {isCooling && <span className="ml-1 text-emerald-400 font-bold">· OBSERVED COOLING</span>}
                {!isCooling && pastPeak && <span className="ml-1 text-orange-400">· Awaiting confirmation</span>}
              </span>
            </div>
          )}
          {/* Hourly breakdown with OBS/FCST tags */}
          {dateWeather?.hourly && (
            <details className="text-[9px]" open={isObservation && dateWeather.hourly.length > 0}>
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Hourly breakdown</summary>
              <div className="mt-1 grid grid-cols-6 sm:grid-cols-8 gap-0.5">
                {dateWeather.hourly.map(h => (
                  <div key={h.hour} className={`text-center rounded-sm px-0.5 py-0.5 ${
                    h.isRecorded
                      ? "bg-muted border border-transparent"
                      : "bg-muted/20 border border-dashed border-border"
                  } ${h.hour === coolingHour ? "ring-1 ring-emerald-500" : ""}`}>
                    <div className="text-[8px] text-muted-foreground">{formatHour(h.hour)}</div>
                    <div className="text-[9px] font-bold text-foreground tabular-nums">{h.tempF.toFixed(1)}°F</div>
                    <div className="text-[8px] text-muted-foreground tabular-nums">{h.tempC.toFixed(1)}°C</div>
                    <div className={`text-[7px] font-bold mt-0.5 ${h.isRecorded ? "text-emerald-400" : "text-blue-400"}`}>
                      {h.isRecorded ? "OBS" : "FCST"}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Clocks */}
      <div className="mb-2 sm:mb-3 grid grid-cols-3 gap-1 sm:gap-2 rounded-sm border border-border bg-muted/50 p-2 sm:p-3">
        <ClockDisplay timezone={userTimezone} label="You" variant="default" />
        <ClockDisplay timezone={event.timezone} label={event.location} variant="primary" />
        <ClockDisplay timezone="UTC" label="PM" variant="accent" />
      </div>

      {/* Markets / Odds */}
      <div className="mb-2 sm:mb-3 space-y-1">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-1 sm:gap-x-2 items-center text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 sm:px-2">
          <span>Range</span>
          <span className="text-center w-14 sm:w-16">YES</span>
          <span className="text-center w-10 sm:w-12">+%</span>
          <span className="text-center w-14 sm:w-16">NO</span>
          <span className="text-center w-10 sm:w-12">+%</span>
        </div>
        <div className="max-h-48 sm:max-h-56 space-y-0.5 overflow-y-auto">
          {event.markets
            .sort((a, b) => b.yesPrice - a.yesPrice)
            .map((m) => {
              const correct = showResolutionTemp && isCorrectAnswer(m.groupItemTitle, highTemp);
              const yesProfitPct = m.yesPrice > 0 ? ((1 - m.yesPrice) / m.yesPrice) * 100 : 0;
              const noProfitPct = m.noPrice > 0 ? ((1 - m.noPrice) / m.noPrice) * 100 : 0;

              return (
                <div
                  key={m.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-1 sm:gap-x-2 items-center rounded-sm px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors ${
                    correct
                      ? "bg-emerald-500/15 border border-emerald-500/50"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {correct && <span className="text-[9px] font-bold text-emerald-400">✓</span>}
                    <span className={`text-[10px] sm:text-xs truncate ${correct ? "font-semibold text-emerald-400" : "text-foreground"}`}>
                      {m.groupItemTitle}
                    </span>
                  </div>
                  <span className={`w-14 sm:w-16 text-center text-[10px] sm:text-xs font-semibold tabular-nums ${correct ? "text-emerald-400" : "text-[hsl(var(--signal-resolved))]"}`}>
                    {(m.yesPrice * 100).toFixed(1)}¢
                  </span>
                  <span className="w-10 sm:w-12 text-center text-[10px] sm:text-xs tabular-nums text-[hsl(var(--signal-resolved))]">
                    +{yesProfitPct.toFixed(0)}%
                  </span>
                  <span className="w-14 sm:w-16 text-center text-[10px] sm:text-xs font-semibold tabular-nums text-destructive">
                    {(m.noPrice * 100).toFixed(1)}¢
                  </span>
                  <span className="w-10 sm:w-12 text-center text-[10px] sm:text-xs tabular-nums text-destructive">
                    +{noProfitPct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
        </div>
        {onPlaceTrade && event.markets.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {event.markets
              .sort((a, b) => b.yesPrice - a.yesPrice)
              .slice(0, 5)
              .map(m => (
                <button
                  key={m.id}
                  onClick={() => onPlaceTrade(m)}
                  className="rounded-sm bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary hover:bg-primary/30 transition-colors"
                >
                  BET {m.groupItemTitle}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Volume & End date */}
      <div className="mb-2 flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
        <span>Vol: ${Number(event.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Ends {new Date(event.endDate).toLocaleDateString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
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
          <a href={event.resolutionSource} target="_blank" rel="noopener noreferrer"
            className="mt-0.5 block truncate text-[10px] sm:text-[11px] text-primary/80 transition-colors hover:text-primary">
            {event.resolutionSource}
          </a>
        </div>
      )}

      {event.referenceLinks.length > 1 && (
        <div className="mt-1 space-y-0.5">
          {event.referenceLinks.slice(1).map((link, i) => (
            <a key={i} href={link} target="_blank" rel="noopener noreferrer"
              className="block truncate text-[10px] sm:text-[11px] text-muted-foreground transition-colors hover:text-primary">
              {link}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
