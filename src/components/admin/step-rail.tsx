"use client";

import { Check } from "lucide-react";
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

const STATUS_TEXT: Record<StepStatus, string> = {
  Done: "text-state-empty",
  "Needs attention": "text-state-shared",
  "In progress": "text-primary",
  Ready: "text-primary",
  Waiting: "text-muted-foreground",
};

// A mark in the margin, the step title (14) and a status caption (12). The
// mark tells the state at a glance: a filled check for Done, an amber "!"
// for Needs attention, a primary ring for the current step, a muted number
// otherwise. The current step also gets a 2 px primary left rule and a bold
// title. A vertical rail on laptop, a grid of two (phone) or four (tablet)
// above the content below it.
export function StepRail({ steps, current, onSelect }: StepRailProps) {
  return (
    <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:flex lg:flex-col lg:gap-0">
      {steps.map((step) => {
        const active = step.n === current;
        const done = step.status === "Done";
        const attention = step.status === "Needs attention";
        return (
          <li key={step.n} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect(step.n)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "grid h-full w-full grid-cols-[22px_minmax(0,1fr)] gap-x-2.5 border-l-2 py-2.5 pr-2 pl-3 text-left",
                active ? "border-primary" : "border-transparent hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-px flex size-[22px] items-center justify-center rounded-full text-xs font-semibold",
                  done
                    ? "bg-state-empty text-white"
                    : attention
                      ? "bg-state-shared text-white"
                      : active
                        ? "border-2 border-primary text-primary"
                        : "border border-muted-foreground/40 text-muted-foreground"
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : attention ? "!" : step.n}
              </span>
              <span
                className={cn(
                  "text-sm leading-tight",
                  active && "font-semibold",
                  !active && step.status === "Waiting" && "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
              <span className={cn("col-start-2 text-xs", STATUS_TEXT[step.status])}>{step.status}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
