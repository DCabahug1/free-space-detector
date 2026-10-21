import { cn } from "@/lib/utils";

interface HighlightProps {
  text: string;
  // The raw search input. Matched case-insensitively, every occurrence.
  query: string;
  className?: string;
}

// Wraps every match of the query inside the text in a <mark>, so search
// results show which part of a name matched: "Mapl" in "Maple Hall".
export function Highlight({ text, query, className }: HighlightProps) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(q, from); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className={cn("bg-primary/25 text-inherit", className)}>
        {text.slice(at, at + q.length)}
      </mark>
    );
    from = at + q.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}
