export type SignalStatus =
  | "forecast"
  | "live-heating"
  | "live-observed-cooling"
  | "resolved-observed"
  | "new"
  | "live"
  | "closed";

interface SignalBadgeProps {
  isNew?: boolean;
  active?: boolean;
  status?: SignalStatus;
}

const STATUS_CONFIG: Record<SignalStatus, { label: string; dotClass: string; bgClass: string; textClass: string; pulse?: boolean }> = {
  forecast: {
    label: "Forecast",
    dotClass: "bg-blue-400",
    bgClass: "bg-blue-500/15",
    textClass: "text-blue-400",
  },
  "live-heating": {
    label: "Live · Heating",
    dotClass: "bg-orange-400",
    bgClass: "bg-orange-500/15",
    textClass: "text-orange-400",
    pulse: true,
  },
  "live-observed-cooling": {
    label: "Live · Observed Cooling",
    dotClass: "bg-emerald-400",
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-400",
  },
  "resolved-observed": {
    label: "Resolved · Observed",
    dotClass: "bg-gray-400",
    bgClass: "bg-gray-500/15",
    textClass: "text-gray-400",
  },
  new: {
    label: "New Signal",
    dotClass: "bg-signal-new",
    bgClass: "bg-signal-new/15",
    textClass: "text-signal-new",
    pulse: true,
  },
  live: {
    label: "Live",
    dotClass: "bg-signal-live",
    bgClass: "bg-signal-live/10",
    textClass: "text-signal-live",
  },
  closed: {
    label: "Closed",
    dotClass: "",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
  },
};

export function SignalBadge({ isNew, active, status }: SignalBadgeProps) {
  let resolvedStatus: SignalStatus;
  if (status) {
    resolvedStatus = status;
  } else if (isNew) {
    resolvedStatus = "new";
  } else if (active) {
    resolvedStatus = "live";
  } else {
    resolvedStatus = "closed";
  }

  const config = STATUS_CONFIG[resolvedStatus];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.bgClass} ${config.textClass} ${config.pulse ? "signal-glow signal-pulse" : ""}`}>
      {config.dotClass && <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass} ${config.pulse ? "animate-pulse" : ""}`} />}
      {config.label}
    </span>
  );
}
