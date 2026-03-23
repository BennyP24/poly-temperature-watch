import type { TimeSubTab } from "@/lib/eventTimeBucket";

const OPTIONS: { key: TimeSubTab; label: string }[] = [
  { key: "last24h", label: "Last 24h" },
  { key: "current", label: "Current" },
  { key: "future", label: "Future" },
];

interface TimeSubTabBarProps {
  value: TimeSubTab;
  onChange: (value: TimeSubTab) => void;
}

export function TimeSubTabBar({ value, onChange }: TimeSubTabBarProps) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/40 p-1"
      role="tablist"
      aria-label="Time filter"
    >
      {OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`rounded-sm px-2.5 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors ${
            value === key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
