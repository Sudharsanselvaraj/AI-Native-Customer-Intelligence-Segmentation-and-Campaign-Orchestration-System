import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

// ── Mini sparkline (SVG) ─────────────────────────────────
function MiniSparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  if (!data || data.length < 2) return null;
  const w = 80, h = 32;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 6) - 3,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${h} L 0 ${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spk-${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface StatCardProps {
  title:          string;
  value:          string;
  change?:        string;
  changePositive?: boolean;
  icon:           LucideIcon;
  color?:         "blue" | "green" | "amber" | "rose" | "violet";
  sparkData?:     number[];
  sparkId?:       string;
}

const PALETTE: Record<string, { icon: string; iconBg: string; spark: string }> = {
  blue:   { icon: "#2563EB", iconBg: "#EFF6FF", spark: "#2563EB" },
  green:  { icon: "#16A34A", iconBg: "#F0FDF4", spark: "#22C55E" },
  amber:  { icon: "#D97706", iconBg: "#FFFBEB", spark: "#F59E0B" },
  rose:   { icon: "#DC2626", iconBg: "#FEF2F2", spark: "#EF4444" },
  violet: { icon: "#7C3AED", iconBg: "#F5F3FF", spark: "#8B5CF6" },
};

export function StatCard({
  title, value, change, changePositive = true,
  icon: Icon, color = "blue", sparkData, sparkId = "0"
}: StatCardProps) {
  const pal = PALETTE[color] || PALETTE.blue;

  return (
    <div
      className="slide-up bg-white rounded-[12px] px-5 pt-5 pb-4 flex flex-col transition-shadow hover:shadow-md"
      style={{ border: "1px solid #E5E7EB" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-[12px] font-medium" style={{ color: "#6B7280" }}>{title}</p>
          <p
            className="text-[28px] font-semibold mt-1 leading-none"
            style={{ color: "#111827", letterSpacing: "-0.02em" }}
          >
            {value}
          </p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {changePositive
                ? <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: "#16A34A" }} />
                : <TrendingDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#DC2626" }} />
              }
              <span
                className="text-[12px] font-semibold"
                style={{ color: changePositive ? "#16A34A" : "#DC2626" }}
              >
                {change}
              </span>
              <span className="text-[11px]" style={{ color: "#9CA3AF" }}>vs last month</span>
            </div>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: pal.iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: pal.icon }} />
        </div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-3 -mx-1">
          <MiniSparkline data={sparkData} color={pal.spark} id={sparkId} />
        </div>
      )}
    </div>
  );
}
