import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatsCard({ title, value, icon, trend, trendUp, className }: StatsCardProps) {
  return (
    <div className={cn(
      "glass rounded-2xl p-6 border-white/20 card-hover",
      className
    )}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold font-display tracking-tight">{value}</h3>
        </div>
        <div className="p-3 bg-secondary/50 rounded-xl text-primary">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs font-medium">
          <span className={cn(
            "px-2 py-0.5 rounded-full",
            trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {trend}
          </span>
          <span className="ml-2 text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  );
}
