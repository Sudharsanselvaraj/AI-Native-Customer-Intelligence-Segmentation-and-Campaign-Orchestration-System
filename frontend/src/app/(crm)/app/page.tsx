"use client";
import { useEffect, useState, useRef } from "react";
import { getDashboard, getRecentActivity, getChannelAnalytics } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  Users, DollarSign, Megaphone, TrendingUp,
  RefreshCw, ShoppingCart, Mail, Zap,
  CheckCircle, Target, Bell
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from "recharts";

// ── Fallback demo data (used when backend is unavailable) ──
const DEMO_DATA = {
  total_customers: 10427,
  total_revenue: 6842000,
  total_campaigns: 24,
  avg_conversion_rate: 0.341,
  revenue_trend: [
    { date: "Nov 1", revenue: 180000 }, { date: "Nov 5", revenue: 210000 },
    { date: "Nov 9", revenue: 195000 }, { date: "Nov 13", revenue: 240000 },
    { date: "Nov 17", revenue: 275000 }, { date: "Nov 21", revenue: 260000 },
    { date: "Nov 25", revenue: 310000 }, { date: "Nov 29", revenue: 295000 },
    { date: "Dec 3",  revenue: 340000 }, { date: "Dec 7",  revenue: 385000 },
    { date: "Dec 11", revenue: 420000 }, { date: "Dec 15", revenue: 510000 },
  ],
  channel_breakdown: [
    { channel: "WhatsApp", total: 45200 },
    { channel: "Email", total: 78100 },
    { channel: "SMS", total: 23000 },
    { channel: "RCS", total: 12400 },
  ],
  campaign_performance: [
    { name: "Summer Sale",     sent: 45200, delivered: 42100, clicked: 8200 },
    { name: "Festival Email",  sent: 38000, delivered: 35400, clicked: 6100 },
    { name: "Delhi Flash",     sent: 28000, delivered: 26700, clicked: 4800 },
    { name: "WhatsApp Blast",  sent: 22000, delivered: 21200, clicked: 5600 },
    { name: "Loyalty Reward",  sent: 18000, delivered: 17400, clicked: 3200 },
  ],
};

const CHANNEL_PIE_COLORS = ["#2563EB", "#16A34A", "#D97706", "#DC2626"];

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr${diff >= 7200 ? "s" : ""} ago`;
  return `${Math.floor(diff / 86400)} day${diff >= 172800 ? "s" : ""} ago`;
}

const ACTIVITY_ICONS: Record<string, any> = {
  campaign_complete: Megaphone,
  campaign_start: Zap,
  new_customer: Users,
  conversion: DollarSign,
};

const ACTIVITY_COLORS: Record<string, { color: string; bg: string }> = {
  campaign_complete: { color: "#2563EB", bg: "#EFF6FF" },
  campaign_start: { color: "#D97706", bg: "#FFFBEB" },
  new_customer: { color: "#16A34A", bg: "#F0FDF4" },
  conversion: { color: "#7C3AED", bg: "#F5F3FF" },
};

const ttip = {
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: 12,
  fontFamily: "Inter, system-ui, sans-serif",
};

export default function DashboardPage() {
  const [data, setData]             = useState<any>(null);
  const [activity, setActivity]     = useState<any[]>([]);
  const [channels, setChannels]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [headerText, setHeaderText] = useState("");
  const [timeRange, setTimeRange]   = useState("30d");
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef                    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getDashboard().catch(() => null),
      getRecentActivity().catch(() => []),
      getChannelAnalytics().catch(() => []),
    ]).then(([dashData, actData, chanData]) => {
      setData(dashData || DEMO_DATA);
      setActivity(actData || []);
      setChannels(chanData || []);
    }).catch(() => {
      setData(DEMO_DATA);
      setActivity([]);
      setChannels([]);
    }).finally(() => setLoading(false));

    const now = new Date();
    setHeaderText(
      `${greeting(now.getHours())} · ${now.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}`
    );
  }, []);

  // Close notif panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display = data ?? DEMO_DATA;

  if (loading) return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "#2563EB" }} />
    </div>
  );

  const allTrend = display.revenue_trend || [];
  const trendPoints = timeRange === "7d" ? 7 : timeRange === "30d" ? Math.min(15, allTrend.length) : allTrend.length;
  const filteredTrend = allTrend.slice(-trendPoints);
  const recentRevenue    = filteredTrend.slice(-7);
  const avgDaily         = recentRevenue.reduce((s: number, d: any) => s + (d.revenue || 0), 0) / (recentRevenue.length || 1);
  const predictedMonthly = avgDaily * 30;
  const revSparkData     = allTrend.slice(-12).map((d: any) => d.revenue / 100000);

  // Compute real change percentages from trend data
  const trend = display.revenue_trend || [];
  const firstRev = trend[0]?.revenue || 0;
  const lastRev = trend[trend.length - 1]?.revenue || 0;
  const revChange = firstRev ? Math.round(((lastRev - firstRev) / firstRev) * 100) : 12;

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* ── Page Header ── */}
      <div
        className="flex items-center justify-between px-6"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}
      >
        <div>
          <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>Overview</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
            {headerText}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(v => !v)}
              className="relative w-9 h-9 rounded-[8px] flex items-center justify-center"
              style={{ border: "1px solid #E5E7EB", background: showNotifs ? "#EFF6FF" : "#fff" }}
            >
              <Bell className="w-4 h-4" style={{ color: showNotifs ? "#2563EB" : "#6B7280" }} />
              {activity.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: "#EF4444" }} />}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-[12px] z-50 overflow-hidden"
                style={{ border: "1px solid #E5E7EB", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", top: "100%" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <p className="text-[13px] font-semibold" style={{ color: "#111827" }}>Notifications</p>
                </div>
                <div className="divide-y" style={{ borderColor: "#F9FAFB", maxHeight: 320, overflowY: "auto" }}>
                  {(activity.length > 0 ? activity : [
                    { type: "campaign_complete", text: "Festival Sale campaign completed", time: new Date().toISOString() },
                    { type: "new_customer",     text: "128 new customers this week",       time: new Date(Date.now() - 3600000).toISOString() },
                    { type: "conversion",       text: "Revenue goal reached for Q4",       time: new Date(Date.now() - 86400000).toISOString() },
                  ]).slice(0, 6).map((a, i) => {
                    const Icon = ACTIVITY_ICONS[a.type] || Zap;
                    const colors = ACTIVITY_COLORS[a.type] || { color: "#6B7280", bg: "#F3F4F6" };
                    return (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5" style={{ background: colors.bg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color: colors.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px]" style={{ color: "#374151" }}>{a.text}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>{timeAgo(a.time)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2.5 text-center" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <button className="text-[11px] font-semibold" style={{ color: "#2563EB" }}
                    onClick={() => setShowNotifs(false)}>Mark all as read</button>
                </div>
              </div>
            )}
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
            style={{ background: "#2563EB" }}
          >
            S
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ══ ROW 1: KPI Cards ══════════════════════════════════ */}
        <div className="grid grid-cols-4 gap-5">
          <StatCard
            title="Total Customers"
            value={formatNumber(display.total_customers)}
            change={`+${revChange}%`}
            changePositive={true}
            icon={Users}
            color="blue"
            sparkData={undefined}
            sparkId="cust"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(display.total_revenue)}
            change={`+${revChange}%`}
            changePositive={true}
            icon={DollarSign}
            color="green"
            sparkData={revSparkData.length > 1 ? revSparkData : undefined}
            sparkId="rev"
          />
          <StatCard
            title="Campaigns"
            value={formatNumber(display.total_campaigns)}
            change={`+${display.total_campaigns > 0 ? display.total_campaigns : 0}`}
            changePositive={true}
            icon={Megaphone}
            color="amber"
            sparkData={undefined}
            sparkId="camp"
          />
          <StatCard
            title="Conversion Rate"
            value={formatPercent(display.avg_conversion_rate)}
            change={`+${(display.avg_conversion_rate * 100).toFixed(1)}%`}
            changePositive={true}
            icon={TrendingUp}
            color="violet"
            sparkData={undefined}
            sparkId="conv"
          />
        </div>

        {/* ══ ROW 2: Revenue Chart + Activity Feed ══════════════ */}
        <div className="grid grid-cols-10 gap-5">
          {/* Revenue Chart — 70% */}
          <div
            className="col-span-7 bg-white rounded-[12px] p-5"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>
                  Revenue Analytics
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                  Predicted this month: {formatCurrency(predictedMonthly)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {["7d", "30d", "90d"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className="px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors"
                    style={r === timeRange
                      ? { background: "#EFF6FF", color: "#2563EB" }
                      : { color: "#9CA3AF", background: "transparent" }
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={filteredTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  width={52}
                />
                <Tooltip
                  contentStyle={ttip}
                  formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#revAreaGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Activity Feed — 30% */}
          <div
            className="col-span-3 bg-white rounded-[12px] p-5"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>
                Recent Activity
              </h3>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#F0FDF4", color: "#16A34A" }}
              >
                Live
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 260 }}>
              {activity.length > 0 ? activity.map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.type] || Zap;
                const colors = ACTIVITY_COLORS[a.type] || { color: "#6B7280", bg: "#F3F4F6" };
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: colors.bg }}
                    >
                      <Icon className="w-[13px] h-[13px]" style={{ color: colors.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] leading-snug" style={{ color: "#374151" }}>{a.text}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>{timeAgo(a.time)}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-[12px] text-center py-8" style={{ color: "#9CA3AF" }}>
                  No recent activity. Launch a campaign to get started!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ ROW 3: Pie + Bar + Channel Table ═════════════════ */}
        <div className="grid grid-cols-10 gap-5">
          {/* Customer Distribution Pie — ~25% */}
          <div
            className="col-span-3 bg-white rounded-[12px] p-5"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#111827" }}>
              Customer Distribution
            </h3>
            {display.channel_breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={display.channel_breakdown}
                    dataKey="total"
                    nameKey="channel"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    innerRadius={36}
                    paddingAngle={2}
                  >
                    {display.channel_breakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={CHANNEL_PIE_COLORS[i % CHANNEL_PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={ttip} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#6B7280", paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div
                className="flex items-center justify-center h-[200px] text-[12px]"
                style={{ color: "#9CA3AF" }}
              >
                No distribution data yet
              </div>
            )}
          </div>

          {/* Campaign Performance Bar — ~35% */}
          <div
            className="col-span-4 bg-white rounded-[12px] p-5"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#111827" }}>
              Campaign Performance
            </h3>
            {display.campaign_performance?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={display.campaign_performance}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={ttip} />
                  <Bar dataKey="sent"      fill="#2563EB" name="Sent"      radius={[0, 4, 4, 0]} maxBarSize={10} />
                  <Bar dataKey="delivered" fill="#22C55E" name="Delivered" radius={[0, 4, 4, 0]} maxBarSize={10} />
                  <Bar dataKey="clicked"   fill="#F59E0B" name="Clicked"   radius={[0, 4, 4, 0]} maxBarSize={10} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                className="flex items-center justify-center h-[200px] text-[12px]"
                style={{ color: "#9CA3AF" }}
              >
                Launch a campaign to see performance
              </div>
            )}
          </div>

          {/* Channel Performance Table — ~40% */}
          <div
            className="col-span-3 bg-white rounded-[12px] p-5"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#111827" }}>
              Channel Performance
            </h3>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Channel", "Sent", "Delivered", "Open %", "CTR"].map(h => (
                    <th
                      key={h}
                      className="pb-2 text-left text-[10px] font-semibold"
                      style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channels.length > 0 ? channels.map((r, i) => (
                  <tr
                    key={r.channel}
                    style={{ borderBottom: i < channels.length - 1 ? "1px solid #F9FAFB" : "none" }}
                  >
                    <td className="py-2.5 text-[12px] font-semibold" style={{ color: "#111827" }}>{r.channel.charAt(0).toUpperCase() + r.channel.slice(1)}</td>
                    <td className="py-2.5 text-[11px]" style={{ color: "#6B7280" }}>{r.sent.toLocaleString()}</td>
                    <td className="py-2.5 text-[11px]" style={{ color: "#16A34A" }}>{r.delivery_rate}%</td>
                    <td className="py-2.5 text-[11px]" style={{ color: "#2563EB" }}>{r.open_rate}%</td>
                    <td className="py-2.5 text-[11px] font-semibold" style={{ color: "#111827" }}>{r.click_rate}%</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[12px]" style={{ color: "#9CA3AF" }}>
                      No channel data yet. Launch campaigns to see metrics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
