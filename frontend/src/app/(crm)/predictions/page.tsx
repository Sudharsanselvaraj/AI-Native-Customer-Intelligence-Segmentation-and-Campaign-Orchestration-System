"use client";
import { Activity, TrendingUp, TrendingDown, Users, DollarSign, AlertCircle, Brain } from "lucide-react";
import {
  AreaChart, Area, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

// Deterministic forecast data
const MONTHLY_FORECAST = [
  { month: "Jul", predicted: 4200000, lower: 3800000, upper: 4600000 },
  { month: "Aug", predicted: 4850000, lower: 4350000, upper: 5350000 },
  { month: "Sep", predicted: 5200000, lower: 4600000, upper: 5800000 },
  { month: "Oct", predicted: 6100000, lower: 5400000, upper: 6800000 },
  { month: "Nov", predicted: 7800000, lower: 6900000, upper: 8700000 },
  { month: "Dec", predicted: 9400000, lower: 8200000, upper: 10600000 },
];

const CHURN_RISK_SEGMENTS = [
  { name: "Inactive 90d",  count: 340,  risk: 78, revenue: "₹12.4L" },
  { name: "Single purchase",count: 1200, risk: 62, revenue: "₹8.7L" },
  { name: "Low engagement", count: 820,  risk: 45, revenue: "₹6.1L" },
  { name: "Price sensitive",count: 560,  risk: 38, revenue: "₹4.2L" },
];

const SEGMENT_GROWTH = [
  { name: "High Value",  now: 1240, predicted: 1480, growth: "+19.4%" },
  { name: "Regular",     now: 8420, predicted: 9650, growth: "+14.6%" },
  { name: "New Buyers",  now: 3100, predicted: 4200, growth: "+35.5%" },
  { name: "At Risk",     now: 920,  predicted: 680,  growth: "-26.1%" },
];

const AI_INSIGHTS = [
  { icon: TrendingUp,   color: "#22C55E", bg: "rgba(34,197,94,0.08)",  title: "Revenue on track",          desc: "Predicted ₹94L for Q4 based on current campaign velocity and seasonal trends." },
  { icon: AlertCircle,  color: "#F59E0B", bg: "rgba(245,158,11,0.08)", title: "340 customers at churn risk", desc: "Inactive 90+ day segment at 78% churn probability. Launch a win-back campaign now." },
  { icon: TrendingUp,   color: "#635BFF", bg: "rgba(99,91,255,0.08)",  title: "New buyer segment surging",   desc: "35.5% projected growth in new buyers — optimal time to invest in onboarding flows." },
  { icon: Brain,        color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", title: "Festival uplift predicted",   desc: "AI models expect 2.3× revenue lift during Diwali season (Oct–Nov). Prepare campaigns." },
];

function fmtINR(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

export default function PredictionsPage() {
  return (
    <div className="pb-10">
      {/* Header */}
      <div
        className="px-8 h-[72px] flex items-center gap-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="w-9 h-9 rounded-[12px] flex items-center justify-center"
          style={{ background: "rgba(99,91,255,0.08)" }}
        >
          <Activity className="w-5 h-5" style={{ color: "#635BFF" }} />
        </div>
        <div>
          <h1 className="text-[16px] font-bold" style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}>Predictions</h1>
          <p className="text-[12px]" style={{ color: "var(--t3)" }}>Statistical forecasts based on historical order and campaign data</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="px-8 pt-6 grid grid-cols-4 gap-4">
        {[
          { label: "Predicted Q4 Revenue", value: "₹9.4Cr",  delta: "+22%", icon: DollarSign, color: "#635BFF" },
          { label: "Customers at Risk",     value: "2,920",   delta: "4.2%", icon: AlertCircle,color: "#EF4444" },
          { label: "Projected Growth",      value: "+18%",    delta: "vs Q3", icon: TrendingUp, color: "#22C55E" },
          { label: "Model Confidence",      value: "87%",     delta: "High",  icon: Brain,      color: "#8B5CF6" },
        ].map((k) => (
          <div key={k.label} className="card lift bg-white flex items-center gap-4 px-5 py-4" style={{ borderRadius: "var(--r-lg)" }}>
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `${k.color}14` }}>
              <k.icon className="w-5 h-5" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--t3)" }}>{k.label}</p>
              <p className="text-[20px] font-bold" style={{ color: "var(--t1)", letterSpacing: "-0.03em" }}>{k.value}</p>
              <span className="text-[11px]" style={{ color: "var(--t3)" }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="px-8 pt-5 grid grid-cols-3 gap-5">
        {/* Revenue forecast */}
        <div className="card bg-white p-6 col-span-2" style={{ borderRadius: "var(--r-lg)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>Revenue Forecast — Next 6 Months</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--t3)" }}>95% confidence interval · AI model based on 2 years of data</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.08)", color: "#16A34A" }}>
              +22% YoY projected
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MONTHLY_FORECAST}>
              <defs>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#635BFF" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#635BFF" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#635BFF" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#635BFF" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={fmtINR} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
                formatter={(v: number) => fmtINR(v)}
              />
              <Area type="monotone" dataKey="upper"     stroke="none"    fill="url(#bandGrad)" />
              <Area type="monotone" dataKey="predicted" stroke="#635BFF" strokeWidth={2.5} fill="url(#predGrad)" dot={{ r: 4, fill: "#635BFF", strokeWidth: 2, stroke: "#fff" }} />
              <Line type="monotone" dataKey="lower"     stroke="rgba(99,91,255,0.3)" strokeWidth={1} strokeDasharray="4 3" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI Insights */}
        <div className="card bg-white p-5" style={{ borderRadius: "var(--r-lg)" }}>
          <h3 className="text-[13px] font-bold mb-4" style={{ color: "var(--t1)" }}>AI Insights</h3>
          <div className="space-y-3">
            {AI_INSIGHTS.map((ins, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-[12px]" style={{ background: ins.bg }}>
                <ins.icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ins.color }} />
                <div>
                  <p className="text-[12px] font-bold" style={{ color: ins.color }}>{ins.title}</p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--t2)" }}>{ins.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Churn + Segment Growth */}
      <div className="px-8 pt-5 grid grid-cols-2 gap-5">
        {/* Churn risk */}
        <div className="card bg-white p-6" style={{ borderRadius: "var(--r-lg)" }}>
          <h3 className="text-[13px] font-bold mb-4" style={{ color: "var(--t1)" }}>Churn Risk Breakdown</h3>
          <div className="space-y-3">
            {CHURN_RISK_SEGMENTS.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>{s.name}</span>
                    <span className="text-[11px] ml-2" style={{ color: "var(--t3)" }}>{s.count} customers · {s.revenue} at risk</span>
                  </div>
                  <span
                    className="score-badge"
                    style={{
                      color: s.risk >= 70 ? "#DC2626" : s.risk >= 50 ? "#D97706" : "#16A34A",
                      background: s.risk >= 70 ? "rgba(239,68,68,0.1)" : s.risk >= 50 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)",
                    }}
                  >
                    {s.risk}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
                  <div
                    className="h-full rounded-full progress-bar"
                    style={{
                      width: `${s.risk}%`,
                      background: s.risk >= 70 ? "#EF4444" : s.risk >= 50 ? "#F59E0B" : "#22C55E",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Segment growth predictions */}
        <div className="card bg-white p-6" style={{ borderRadius: "var(--r-lg)" }}>
          <h3 className="text-[13px] font-bold mb-4" style={{ color: "var(--t1)" }}>Segment Growth Predictions</h3>
          <div className="space-y-3">
            {SEGMENT_GROWTH.map((s) => {
              const positive = !s.growth.startsWith("-");
              return (
                <div key={s.name} className="flex items-center gap-4 p-3 rounded-[12px]" style={{ background: "var(--surface2)" }}>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>{s.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--t3)" }}>
                      {s.now.toLocaleString()} → {s.predicted.toLocaleString()} customers
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {positive
                      ? <TrendingUp className="w-4 h-4" style={{ color: "#22C55E" }} />
                      : <TrendingDown className="w-4 h-4" style={{ color: "#EF4444" }} />
                    }
                    <span
                      className="text-[13px] font-bold"
                      style={{ color: positive ? "#16A34A" : "#DC2626" }}
                    >
                      {s.growth}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
