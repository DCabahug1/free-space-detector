"use client";

import { cn } from "@/lib/utils";

export type StepStatus = "Done" | "In progress" | "Waiting" | "Needs attention" | "Ready";

export interface Step {
  n: number;
  title: string;
  status: StepStatus;
}

interface StepRailProps {
  steps: Step[];
  current: number;
  onSelect: (n: number) => void;
}

// Number in the margin (mono 12), step title, status caption. The current
// step gets a 2 px primary left rule and a bold title. A vertical rail on
// laptop, a grid of two (phone) or four (tablet) above the content below it.
export function StepRail({ steps, current, onSelect }: StepRailProps) {
  return (
    <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:flex lg:flex-col">
      {steps.map((step) => {
        const active = step.n === current;
        return (
          <li key={step.n} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect(step.n)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "grid h-full w-full grid-cols-[20px_minmax(0,1fr)] gap-x-2 border-l-2 py-2 pr-2 pl-3 text-left",
                active ? "border-primary" : "border-transparent hover:bg-card"
              )}
            >
              <span className="pt-0.5 font-mono text-xs text-muted-foreground">{step.n}</span>
              <span className={cn("text-[15px] leading-tight", active && "font-semibold")}>
                {step.title}
              </span>
              <span
                className={cn(
                  "col-start-2 text-[13px]",
                  step.status === "Needs attention"
                    ? "text-state-full"
                    : step.status === "Waiting"
                      ? "text-state-shared"
                      : "text-muted-foreground"
                )}
              >
                {step.status}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
