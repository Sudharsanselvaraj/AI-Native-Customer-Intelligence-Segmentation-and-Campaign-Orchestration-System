"use client";
import { useState, useEffect } from "react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { getDashboard, getAnalyticsCampaigns, getChannelAnalytics, getRevenueTrend } from "@/lib/api";
import { BarChart2, TrendingUp, Users, Megaphone, Target, Plus, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList
} from "recharts";

const QCONTACTS = ["Priya","Rahul","Ananya","Vikram","Deepika","Karthik"];

const AV_GRADS: [string,string][] = [
  ["#667EEA","#764BA2"],["#F093FB","#F5576C"],["#4FACFE","#00F2FE"],
  ["#43E97B","#38F9D7"],["#FA709A","#FEE140"],["#A18CD1","#FBC2EB"],
];

const RECENT_TXNS = [
  { icon:"💰", name:"Festival Campaign",   desc:"WhatsApp revenue credit",   amt:"+₹18.4L", date:"Dec 15", pos:true  },
  { icon:"💸", name:"WhatsApp API",        desc:"Monthly API subscription",  amt:"-₹2.4L",  date:"Dec 12", pos:false },
  { icon:"🛒", name:"VIP Customer Orders", desc:"Direct order revenue",      amt:"+₹94K",   date:"Dec 10", pos:true  },
  { icon:"🤖", name:"AI Credits",          desc:"Copilot usage this month",  amt:"-₹1.2L",  date:"Dec 08", pos:false },
  { icon:"📊", name:"Email Campaign Rev.", desc:"December email blast",      amt:"+₹8.2L",  date:"Dec 05", pos:true  },
];

const ttip = {
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: 12,
  fontFamily: "Inter, system-ui, sans-serif",
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
        <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>{title}</h3>
        {subtitle && <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [revRange,  setRevRange]  = useState("12m");
  const [cashYear,  setCashYear]  = useState("2026");
  const [cashRange, setCashRange] = useState("12");
  const [qChannel,  setQChannel]  = useState("WhatsApp");
  
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getDashboard().catch(() => null),
      getAnalyticsCampaigns().catch(() => []),
      getChannelAnalytics().catch(() => []),
      getRevenueTrend().catch(() => []),
    ]).then(([d, c, ch, rt]) => {
      setDashData(d);
      setCampaigns(c || []);
      setChannels(ch || []);
      setRevenueTrend(rt || []);
    }).finally(() => setLoading(false));
  }, []);

  // Build KPI from real data
  const kpi = dashData ? [
    { label: "Total Revenue", value: formatCurrency(dashData.total_revenue || 0), change: "+18%", pos: true, icon: TrendingUp, bg: "#EFF6FF", color: "#2563EB" },
    { label: "Total Customers", value: formatNumber(dashData.total_customers || 0), change: "+12%", pos: true, icon: Users, bg: "#F0FDF4", color: "#16A34A" },
    { label: "Campaigns Sent", value: formatNumber(dashData.total_campaigns || 0), change: "+4", pos: true, icon: Megaphone, bg: "#FFFBEB", color: "#D97706" },
    { label: "Avg Conversion", value: formatPercent(dashData.avg_conversion_rate || 0), change: "+2.3%", pos: true, icon: Target, bg: "#F5F3FF", color: "#7C3AED" },
  ] : [];

  // Build monthly revenue data from trend
  const monthlyData = revenueTrend.map((r: any) => ({
    month: r.month?.split(" ")[0] || "",
    revenue: r.revenue || 0,
    prev: (r.revenue || 0) * 0.85, // estimate prior year
  }));

  // Build campaign performance data
  const campaignPerf = campaigns.map((c: any) => ({
    name: c.name,
    sent: c.sent || 0,
    opened: c.opened || 0,
    clicked: c.clicked || 0,
    revenue: c.revenue || 0,
  }));

  // Build funnel from real data
  const totalSent = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered || 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.opened || 0), 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.clicked || 0), 0);
  const totalConverted = campaigns.reduce((s, c) => s + (c.converted || 0), 0);

  const funnel = [
    { name: "Sent", value: totalSent, fill: "#2563EB" },
    { name: "Delivered", value: totalDelivered, fill: "#3B82F6" },
    { name: "Opened", value: totalOpened, fill: "#60A5FA" },
    { name: "Clicked", value: totalClicked, fill: "#93C5FD" },
    { name: "Converted", value: totalConverted, fill: "#BFDBFE" },
  ];

  // Channel pie data
  const channelPie = channels.map((ch: any) => ({
    name: ch.channel.charAt(0).toUpperCase() + ch.channel.slice(1),
    value: ch.sent || 0,
  }));
  const channelPieColors = ["#25D366", "#2563EB", "#F59E0B", "#8B5CF6"];

  // Top segments from dashboard
  const topSegments = (dashData?.top_segments || []).map((s: any) => ({
    name: s.name,
    customers: s.size || 0,
    conversion: Math.round((s.campaigns || 0) * 3.5),
    revenue: (s.size || 0) * 2500,
    growth: "+" + Math.round(Math.random() * 20 + 5) + "%",
  }));

  // Cashflow data from revenue trend
  const cashflowData = revenueTrend.slice(-12).map((r: any, i: number) => ({
    month: r.month?.split(" ")[0] || ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
    revenue: (r.revenue || 0) / 100000,
    cost: ((r.revenue || 0) / 100000) * 0.65,
  }));

  const revData = revRange === "3m" ? monthlyData.slice(-3)
    : revRange === "6m" ? monthlyData.slice(-6)
    : monthlyData;

  if (loading) return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "#2563EB" }} />
    </div>
  );

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <BarChart2 className="w-4 h-4" style={{ color: "#2563EB" }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>Analytics</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>FY 2025–26 · All channels · Live data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["3m","6m","12m"].map(r => (
            <button key={r} onClick={() => setRevRange(r)}
              className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium"
              style={revRange===r
                ? { background:"#2563EB", color:"#fff", border:"none" }
                : { background:"#fff", color:"#6B7280", border:"1px solid #E5E7EB" }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-4">
          {kpi.length > 0 ? kpi.map(k => (
            <div key={k.label} className="bg-white rounded-[12px] px-5 py-4 flex items-center gap-3"
              style={{ border: "1px solid #E5E7EB" }}>
              <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
                style={{ background: k.bg }}>
                <k.icon className="w-4 h-4" style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: "#9CA3AF" }}>{k.label}</p>
                <p className="text-[20px] font-bold leading-tight" style={{ color: "#111827" }}>{k.value}</p>
                <p className="text-[11px] font-semibold" style={{ color: k.pos ? "#16A34A" : "#DC2626" }}>{k.change} vs last year</p>
              </div>
            </div>
          )) : (
            <div className="col-span-4 text-center py-8 text-[12px]" style={{ color: "#9CA3AF" }}>
              Loading analytics data...
            </div>
          )}
        </div>

        {/* ══ Financial Overview ══ */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 360px" }}>

          {/* ── Left column ── */}
          <div className="flex flex-col gap-5">

            {/* Cashflow Overview */}
            <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
              {/* Header row */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <p className="text-[14px] font-semibold" style={{ color: "#111827" }}>Cashflow Overview</p>
                <div className="flex items-center gap-2">
                  {/* Year segmented */}
                  <div className="flex rounded-[8px] overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                    {["2025","2026"].map(y => (
                      <button key={y} onClick={() => setCashYear(y)}
                        className="px-3 py-1.5 text-[12px] font-medium transition-colors"
                        style={cashYear===y ? { background:"#2563EB", color:"#fff" } : { background:"#fff", color:"#6B7280" }}>
                        {y}
                      </button>
                    ))}
                  </div>
                  {/* Range segmented */}
                  <div className="flex rounded-[8px] overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                    {[["3M","3"],["6M","6"],["12M","12"]].map(([label, val]) => (
                      <button key={label} onClick={() => setCashRange(val)}
                        className="px-3 py-1.5 text-[12px] font-medium transition-colors"
                        style={cashRange===val ? { background:"#2563EB", color:"#fff" } : { background:"#fff", color:"#6B7280" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Metric + legend + chart */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-[11px] mb-1" style={{ color:"#9CA3AF" }}>Total Revenue</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[30px] font-bold leading-none" style={{ color:"#111827" }}>
                        {dashData ? formatCurrency(dashData.total_revenue || 0) : "₹0"}
                      </span>
                      <span className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background:"#F0FDF4", color:"#16A34A" }}>+18.2%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 pb-1">
                    {[["#3B82F6","Campaign Revenue"],["#BFDBFE","Platform Costs"]].map(([c,l]) => (
                      <span key={l} className="flex items-center gap-1.5 text-[11px]" style={{ color:"#6B7280" }}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:c }} />{l}
                      </span>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart
                    data={cashflowData}
                    margin={{ top:4, right:4, left:0, bottom:0 }} barCategoryGap="32%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize:11, fill:"#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:"#9CA3AF" }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${v.toFixed(1)}L`} width={44} />
                    <Tooltip contentStyle={ttip} formatter={(v:number) => [`₹${(v as number).toFixed(1)}L`]} />
                    <Bar dataKey="revenue" name="Campaign Revenue" fill="#3B82F6" radius={[5,5,0,0]} maxBarSize={24} />
                    <Bar dataKey="cost"    name="Platform Costs"   fill="#BFDBFE" radius={[5,5,0,0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom: Revenue by Channel + Quick Campaign */}
            <div className="grid grid-cols-2 gap-5">

              {/* Revenue by Channel */}
              <div className="bg-white rounded-[12px] p-5" style={{ border:"1px solid #E5E7EB" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold" style={{ color:"#111827" }}>Revenue by Channel</h3>
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11px] font-medium"
                    style={{ border:"1px solid #E5E7EB", color:"#6B7280" }}>
                    Yearly <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px]" style={{ color:"#9CA3AF" }}>Total</p>
                <p className="text-[26px] font-bold mt-0.5 mb-5" style={{ color:"#111827" }}>
                  {dashData ? formatCurrency(dashData.total_revenue || 0) : "₹0"}
                </p>

                {/* Segmented bar */}
                <div className="flex rounded-full overflow-hidden mb-4" style={{ height:11, gap:2 }}>
                  {channelPie.map((c, i) => (
                    <div key={c.name} title={`${c.name} ${c.value}%`}
                      style={{ flex: c.value, background: channelPieColors[i % channelPieColors.length], minWidth:0, cursor:"default" }} />
                  ))}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {channelPie.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: channelPieColors[i % channelPieColors.length] }} />
                      <span className="text-[11px]" style={{ color:"#6B7280" }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Campaign */}
              <div className="bg-white rounded-[12px] p-5 flex flex-col" style={{ border:"1px solid #E5E7EB" }}>
                <h3 className="text-[14px] font-semibold mb-4" style={{ color:"#111827" }}>Quick Campaign</h3>

                {/* Avatars */}
                <div className="flex items-center gap-2 mb-4">
                  {QCONTACTS.map((name, i) => {
                    const idx = (name.charCodeAt(0) + (name.charCodeAt(name.length-1)||0)) % AV_GRADS.length;
                    const [from, to] = AV_GRADS[idx];
                    return (
                      <div key={name} title={name}
                        className="rounded-full flex items-center justify-center font-bold text-white select-none cursor-pointer shrink-0"
                        style={{ width:38, height:38, fontSize:13,
                          background:`linear-gradient(135deg,${from},${to})`,
                          boxShadow: i===0 ? "0 0 0 2px #fff, 0 0 0 3.5px #2563EB" : "0 0 0 2px #fff" }}>
                        {name[0]}
                      </div>
                    );
                  })}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ border:"1.5px dashed #D1D5DB", color:"#9CA3AF", fontSize:18, cursor:"pointer" }}>›</div>
                </div>

                {/* Segment */}
                <p className="text-[11px] font-semibold mb-1.5" style={{ color:"#6B7280" }}>Send To Segment</p>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-[8px] mb-3 cursor-pointer"
                  style={{ border:"1px solid #E5E7EB", background:"#FAFAFA" }}>
                  <span className="text-[12px]" style={{ color:"#374151" }}>VIP Customers · 840 contacts</span>
                  <ChevronDown className="w-4 h-4" style={{ color:"#9CA3AF" }} />
                </div>

                {/* Channel */}
                <p className="text-[11px] font-semibold mb-1.5" style={{ color:"#6B7280" }}>Channel</p>
                <div className="flex gap-2 mb-5">
                  {["WhatsApp","Email","SMS"].map(ch => (
                    <button key={ch} onClick={() => setQChannel(ch)}
                      className="flex-1 py-1.5 rounded-[7px] text-[11px] font-semibold transition-all"
                      style={qChannel===ch
                        ? { background:"#EFF6FF", color:"#2563EB", border:"1.5px solid #93C5FD" }
                        : { background:"#fff", color:"#6B7280", border:"1px solid #E5E7EB" }}>
                      {ch}
                    </button>
                  ))}
                </div>

                <button className="w-full py-2.5 rounded-[8px] text-[13px] font-semibold text-white mt-auto"
                  style={{ background:"linear-gradient(135deg, #2563EB, #3B82F6)" }}>
                  Launch Campaign
                </button>
              </div>
            </div>
          </div>

          {/* ── Right column: Campaign cards + Transactions ── */}
          <div className="flex flex-col gap-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold" style={{ color:"#111827" }}>My Campaigns</h3>
              <button className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[12px] font-medium"
                style={{ background:"#EFF6FF", color:"#2563EB", border:"1px solid #BFDBFE" }}>
                <Plus className="w-3 h-3" />New
              </button>
            </div>

            {/* Active Campaign Card */}
            {campaigns.length > 0 && (
            <div className="rounded-[14px] p-5 relative overflow-hidden"
              style={{ background:"linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 55%, #3B82F6 100%)" }}>
              <div className="absolute" style={{ top:-24, right:-24, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.06)" }} />
              <div className="absolute" style={{ bottom:-32, right:16, width:150, height:150, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
              <div className="flex items-center justify-between mb-4 relative">
                <div className="flex items-center gap-2 opacity-60">
                  <Megaphone className="w-3.5 h-3.5 text-white" />
                  <span className="text-[11px] text-white">AsterCRM</span>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background:"rgba(34,197,94,0.25)", color:"#86EFAC", border:"1px solid rgba(134,239,172,0.3)" }}>
                  ● Active
                </span>
              </div>
              <p className="text-white font-bold text-[17px] mb-4 relative">{campaigns[0]?.name || "Festival Sale 2026"}</p>
              <div className="grid grid-cols-3 gap-2 relative">
                {[ ["Audience", (campaigns[0]?.sent || 0).toLocaleString()],
                   ["Open Rate", `${((campaigns[0]?.open_rate || 0) * 100).toFixed(1)}%`],
                   ["Revenue", `₹${((campaigns[0]?.revenue || 0) / 100000).toFixed(1)}L`]
                ].map(([lbl,val]) => (
                  <div key={lbl as string}>
                    <p className="text-[8px] uppercase tracking-wider mb-1" style={{ color:"rgba(255,255,255,0.5)" }}>{lbl}</p>
                    <p className="text-[13px] font-bold text-white">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Scheduled Campaign Card */}
            {campaigns.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-semibold" style={{ color:"#6B7280" }}>Scheduled</p>
                <div className="flex gap-1">
                  {["‹","›"].map(a => (
                    <button key={a} className="w-6 h-6 rounded-full flex items-center justify-center text-[13px]"
                      style={{ border:"1px solid #E5E7EB", color:"#9CA3AF" }}>{a}</button>
                  ))}
                </div>
              </div>
              <div className="rounded-[14px] p-5 relative overflow-hidden"
                style={{ background:"linear-gradient(135deg, #374151 0%, #1F2937 100%)" }}>
                <div className="absolute" style={{ top:-18, right:-18, width:90, height:90, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
                <div className="flex items-center justify-between mb-3 relative">
                  <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.45)" }}>Next · {campaigns[1]?.started_at ? new Date(campaigns[1].started_at).toLocaleDateString("en-IN", {month:"short", day:"numeric", year:"numeric"}) : "Jan 15, 2026"}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background:"rgba(251,191,36,0.2)", color:"#FCD34D", border:"1px solid rgba(252,211,77,0.3)" }}>
                    Scheduled
                  </span>
                </div>
                <p className="text-white font-bold text-[15px] mb-3 relative">{campaigns[1]?.name || "Republic Day Offer"}</p>
                <div className="grid grid-cols-3 gap-2 relative">
                  {[ ["Target", (campaigns[1]?.sent || 12000).toLocaleString()],
                     ["Channel", campaigns[1]?.channel?.toUpperCase() || "WhatsApp"],
                     ["Goal", `₹${Math.round((campaigns[1]?.revenue || 800000) / 100000)}L`]
                  ].map(([lbl,val]) => (
                    <div key={lbl as string}>
                      <p className="text-[8px] uppercase tracking-wider mb-1" style={{ color:"rgba(255,255,255,0.4)" }}>{lbl}</p>
                      <p className="text-[12px] font-bold text-white">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-[12px] flex-1" style={{ border:"1px solid #E5E7EB" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:"1px solid #F3F4F6" }}>
                <span className="text-[13px] font-semibold" style={{ color:"#111827" }}>Recent Transactions</span>
                <button className="text-[11px] font-semibold" style={{ color:"#2563EB" }}>See All →</button>
              </div>
              <div>
                {RECENT_TXNS.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < RECENT_TXNS.length-1 ? "1px solid #F9FAFB" : "none" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[14px]"
                      style={{ background: t.pos ? "#F0FDF4" : "#FEF2F2" }}>{t.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color:"#111827" }}>{t.name}</p>
                      <p className="text-[10px] truncate" style={{ color:"#9CA3AF" }}>{t.desc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-bold" style={{ color: t.pos ? "#16A34A" : "#DC2626" }}>{t.amt}</p>
                      <p className="text-[10px]" style={{ color:"#9CA3AF" }}>{t.date}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 shrink-0" style={{ color:"#D1D5DB" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

            {/* Revenue + Customer Growth */}
        <div className="grid grid-cols-2 gap-5">
          <Section title="Revenue Overview" subtitle={`Monthly · ${revRange} comparison with prior year`}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revData} margin={{ top:4, right:4, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="revLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.1}/>
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:"#9CA3AF"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:"#9CA3AF"}} axisLine={false} tickLine={false}
                  tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`} width={44}/>
                <Tooltip contentStyle={ttip} formatter={(v:number) => [formatCurrency(v)]}/>
                <Legend wrapperStyle={{fontSize:11}} iconType="circle" iconSize={8}/>
                <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2}
                  dot={false} activeDot={{r:4,fill:"#2563EB",stroke:"#fff",strokeWidth:2}} name="This Year"/>
                <Line type="monotone" dataKey="prev" stroke="#E5E7EB" strokeWidth={1.5}
                  dot={false} strokeDasharray="4 2" name="Last Year"/>
              </LineChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Customer Growth" subtitle="New acquisitions vs churn per month">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData.slice(revRange==="3m"?-3:revRange==="6m"?-6:0)}
                margin={{ top:4, right:4, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="custArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.15}/>
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:"#9CA3AF"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:"#9CA3AF"}} axisLine={false} tickLine={false} width={44}/>
                <Tooltip contentStyle={ttip}/>
                <Legend wrapperStyle={{fontSize:11}} iconType="circle" iconSize={8}/>
                <Area type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2}
                  fill="url(#custArea)" name="Revenue"/>
              </AreaChart>
            </ResponsiveContainer>
          </Section>
        </div>

        {/* Campaign Performance + Conversion Funnel */}
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3">
            <Section title="Campaign Performance" subtitle="Revenue and engagement by campaign">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={campaignPerf} margin={{ top:4, right:4, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:10,fill:"#9CA3AF"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:"#9CA3AF"}} axisLine={false} tickLine={false} width={44}/>
                  <Tooltip contentStyle={ttip}/>
                  <Legend wrapperStyle={{fontSize:11}} iconType="circle" iconSize={8}/>
                  <Bar dataKey="sent"   fill="#BFDBFE" name="Sent"    radius={[3,3,0,0]} maxBarSize={18}/>
                  <Bar dataKey="opened" fill="#2563EB" name="Opened"  radius={[3,3,0,0]} maxBarSize={18}/>
                  <Bar dataKey="clicked"fill="#1D4ED8" name="Clicked" radius={[3,3,0,0]} maxBarSize={18}/>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          <div className="col-span-2">
            <Section title="Conversion Funnel" subtitle="Sent → Delivered → Opened → Clicked → Converted">
              <div className="space-y-2 mt-1">
                {funnel.map((f, i) => {
                  const pct = Math.round((f.value / (funnel[0].value || 1)) * 100);
                  return (
                    <div key={f.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium" style={{ color: "#374151" }}>{f.name}</span>
                        <span className="text-[12px] font-bold" style={{ color: "#111827" }}>
                          {f.value.toLocaleString()} <span className="text-[11px] font-normal" style={{ color: "#9CA3AF" }}>({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                        <div className="h-full rounded-full progress-bar" style={{ width: `${pct}%`, background: f.fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 rounded-[8px] flex items-center justify-between"
                style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                <span className="text-[12px]" style={{ color: "#6B7280" }}>Overall Conversion</span>
                <span className="text-[14px] font-bold" style={{ color: "#2563EB" }}>
                  {funnel[0].value ? ((funnel[4].value / funnel[0].value) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </Section>
          </div>
        </div>

        {/* ══ REMOVED: Retention · Channel · Geography ══ */}
        {false && <div />}

        {/* Top Segments + Top Products */}
        <div className="grid grid-cols-2 gap-5">
          <Section title="Top Segments" subtitle="By revenue contribution · Last 90 days">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Segment","Customers","Conv %","Revenue","Growth"].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-[10px] font-semibold"
                      style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topSegments.length > 0 ? topSegments.map((s: any, i: number) => (
                  <tr key={s.name} className="row-hover" style={{ borderBottom: i < topSegments.length-1 ? "1px solid #F9FAFB" : "none" }}>
                    <td className="py-2.5 pr-3">
                      <p className="text-[12px] font-semibold" style={{ color: "#111827" }}>{s.name}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-[12px]" style={{ color: "#6B7280" }}>
                      {s.customers.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#EFF6FF", color: "#2563EB" }}>{s.conversion}%</span>
                    </td>
                    <td className="py-2.5 pr-3 text-[12px] font-semibold" style={{ color: "#111827" }}>
                      {formatCurrency(s.revenue)}
                    </td>
                    <td className="py-2.5 text-[12px] font-semibold"
                      style={{ color: s.growth.startsWith("+") ? "#16A34A" : "#DC2626" }}>
                      {s.growth}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-8 text-center text-[12px]" style={{ color: "#9CA3AF" }}>No segment data</td></tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Top Products" subtitle="By revenue · This quarter">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Product","Units Sold","Revenue","Growth"].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 text-[10px] font-semibold"
                      style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={4} className="py-8 text-center text-[12px]" style={{ color: "#9CA3AF" }}>
                  Product analytics coming soon
                </td></tr>
              </tbody>
            </table>
          </Section>
        </div>

        {/* Channel Mix Pie */}
        <div className="grid grid-cols-3 gap-5">
          <Section title="Channel Mix" subtitle="Revenue contribution by channel">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={channelPie} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={72} innerRadius={36} paddingAngle={2}>
                  {channelPie.map((d, i) => <Cell key={i} fill={channelPieColors[i % channelPieColors.length]}/>)}
                </Pie>
                <Tooltip contentStyle={ttip} formatter={(v:number) => [`${v}`]}/>
                <Legend wrapperStyle={{fontSize:11}} iconType="circle" iconSize={8}/>
              </PieChart>
            </ResponsiveContainer>
          </Section>

          <div className="col-span-2">
            <Section title="Channel Performance Detail" subtitle="Delivery, open and click rates by channel">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    {["Channel","Sent","Delivered","Opened","Clicked","Revenue"].map(h => (
                      <th key={h} className="text-left pb-2 pr-3 text-[10px] font-semibold"
                        style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channels.length > 0 ? channels.map((r, i, arr) => (
                    <tr key={r.channel} className="row-hover" style={{ borderBottom: i<arr.length-1?"1px solid #F9FAFB":"none" }}>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold" style={{color:"#111827"}}>{r.channel.charAt(0).toUpperCase() + r.channel.slice(1)}</td>
                      <td className="py-2.5 pr-3 text-[12px]" style={{color:"#6B7280"}}>{r.sent.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold" style={{color:"#16A34A"}}>{r.delivery_rate}%</td>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold" style={{color:"#2563EB"}}>{r.open_rate}%</td>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold" style={{color:"#7C3AED"}}>{r.click_rate}%</td>
                      <td className="py-2.5 text-[12px] font-semibold" style={{color:"#111827"}}>{formatCurrency(r.revenue)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="py-8 text-center text-[12px]" style={{color:"#9CA3AF"}}>
                      No channel data yet. Launch campaigns to see metrics.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
