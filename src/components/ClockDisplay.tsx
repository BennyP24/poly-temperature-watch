import { useState, useEffect } from "react";

interface ClockDisplayProps {
  timezone: string;
  label: string;
  variant?: "default" | "primary" | "accent";
}

export function ClockDisplay({ timezone, label, variant = "default" }: ClockDisplayProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString("en-US", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        setTime(formatted);
      } catch {
        setTime("--:--:--");
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  const colorClass =
    variant === "primary"
      ? "text-primary"
      : variant === "accent"
        ? "text-accent"
        : "text-foreground";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`text-lg font-semibold tabular-nums ${colorClass}`}>
        {time}
      </span>
      <span className="text-[10px] text-muted-foreground">{timezone}</span>
    </div>
  );
}
