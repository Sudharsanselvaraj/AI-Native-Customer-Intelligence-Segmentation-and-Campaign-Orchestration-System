"use client";
import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Users, DollarSign, Megaphone, Send, TrendingUp, MousePointer, RefreshCw } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const CHANNEL_COLORS = ["#6366f1", "#25D366", "#F59E0B", "#EF4444"];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
    </div>
  );

  if (!data) return <div className="p-8 text-slate-500">Failed to load dashboard</div>;

  return (
    <div className="pb-8">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your customer engagement platform"
      />

      <div className="px-8 grid grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Customers" value={formatNumber(data.total_customers)} icon={Users} color="brand" />
        <StatCard title="Total Revenue" value={formatCurrency(data.total_revenue)} icon={DollarSign} color="green" />
        <StatCard title="Campaigns" value={formatNumber(data.total_campaigns)} icon={Megaphone} color="amber" />
        <StatCard title="Messages Sent" value={formatNumber(data.total_messages_sent)} icon={Send} color="rose" />
      </div>

      <div className="px-8 grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Delivery Rate", value: formatPercent(data.avg_delivery_rate), color: "text-green-600" },
          { label: "Open Rate", value: formatPercent(data.avg_open_rate), color: "text-blue-600" },
          { label: "Click Rate", value: formatPercent(data.avg_ctr), color: "text-purple-600" },
          { label: "Conversion Rate", value: formatPercent(data.avg_conversion_rate), color: "text-amber-600" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{m.label}</p>
            <p className={`text-3xl font-bold mt-2 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="px-8 grid grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.revenue_trend}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Channel Distribution</h3>
          {data.channel_breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.channel_breakdown} dataKey="total" nameKey="channel" cx="50%" cy="50%" outerRadius={80} label>
                  {data.channel_breakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">
              No campaign data yet
            </div>
          )}
        </div>

        {/* Campaign Performance */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Campaign Performance</h3>
          {data.campaign_performance.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.campaign_performance} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="sent" fill="#6366f1" name="Sent" />
                <Bar dataKey="delivered" fill="#22c55e" name="Delivered" />
                <Bar dataKey="clicked" fill="#f59e0b" name="Clicked" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              Launch your first campaign to see performance data here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
