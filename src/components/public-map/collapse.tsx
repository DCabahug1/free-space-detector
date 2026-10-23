import { cn } from "@/lib/utils";

// Height animation for the directory's drop downs: the grid row eases from
// 0fr to 1fr, so the content needs no measured height. Closed content stays
// mounted but inert, so it is skipped by focus and screen readers.
export function Collapse({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      inert={!open}
      aria-hidden={!open}
    >
      <div className={cn("min-h-0 overflow-hidden", className)}>{children}</div>
    </div>
  );
}
