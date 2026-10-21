import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

// Back navigation for every page below a root (public map, admin overview).
export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-8 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
