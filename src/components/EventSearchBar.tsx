import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface EventSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function EventSearchBar({
  value,
  onChange,
  placeholder = "Search title, city, outcome…",
  id = "bet-search",
}: EventSearchBarProps) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 text-sm"
        aria-label="Search bets by title, location, or temperature range"
      />
    </div>
  );
}
