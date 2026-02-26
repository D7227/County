import { type ScrapeStatus } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, PlayCircle, XCircle } from "lucide-react";

const variants: Record<ScrapeStatus, { color: string; icon: any; label: string }> = {
  pending: {
    color: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    icon: Clock,
    label: "On Deck",
  },
  processing: {
    color: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    icon: PlayCircle,
    label: "Active",
  },
  completed: {
    color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    icon: CheckCircle2,
    label: "Success",
  },
  failed: {
    color: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    icon: XCircle,
    label: "Failed",
  },
};

export function StatusBadge({ status }: { status: string }) {
  // Safe fallback for unknown statuses
  const normalizedStatus = (variants[status as ScrapeStatus] ? status : 'pending') as ScrapeStatus;
  const variant = variants[normalizedStatus];
  const Icon = variant.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      variant.color
    )}>
      <Icon className="w-3.5 h-3.5" />
      {variant.label}
    </span>
  );
}
