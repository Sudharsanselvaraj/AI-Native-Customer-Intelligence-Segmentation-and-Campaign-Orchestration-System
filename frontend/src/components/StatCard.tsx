import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  color?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = "brand" }: StatCardProps) {
  const colorMap: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colorMap[color] || colorMap.brand)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn("mt-3 text-xs font-medium", trend >= 0 ? "text-green-600" : "text-red-500")}>
          {trend >= 0 ? "+" : ""}{trend.toFixed(1)}% from last month
        </div>
      )}
    </div>
  );
}
