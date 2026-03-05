interface SignalBadgeProps {
  isNew: boolean;
  active: boolean;
}

export function SignalBadge({ isNew, active }: SignalBadgeProps) {
  if (isNew) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-signal-new/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-signal-new signal-glow signal-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-new" />
        New Signal
      </span>
    );
  }

  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-signal-live/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-signal-live">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-live" />
        Live
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      Closed
    </span>
  );
}
