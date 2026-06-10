"use client";
import { useEffect, useState } from "react";
import { getCampaigns, getCampaignAnalytics } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { formatPercent, formatNumber, CHANNEL_COLORS } from "@/lib/utils";
import { RefreshCw, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    getCampaigns({ size: 100 })
      .then((d) => { setCampaigns(d.items || []); })
      .finally(() => setLoading(false));
  }, []);

  const selectCampaign = (id: string) => {
    setSelected(id);
    setAnalyticsLoading(true);
    getCampaignAnalytics(id)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  };

  const funnelData = analytics ? [
    { stage: "Sent", value: analytics.total_sent },
    { stage: "Delivered", value: analytics.total_delivered },
    { stage: "Opened", value: analytics.total_opened },
    { stage: "Read", value: analytics.total_read },
    { stage: "Clicked", value: analytics.total_clicked },
    { stage: "Converted", value: analytics.total_converted },
  ] : [];

  const radarData = analytics ? [
    { metric: "Delivery", value: analytics.delivery_rate * 100 },
    { metric: "Open", value: analytics.open_rate * 100 },
    { metric: "Click", value: analytics.click_rate * 100 },
    { metric: "Conversion", value: analytics.conversion_rate * 100 },
  ] : [];

  return (
    <div className="pb-8">
      <PageHeader title="Campaign Analytics" subtitle="Deep-dive into campaign performance" />

      <div className="px-8">
        <div className="flex gap-6">
          {/* Campaign list */}
          <div className="w-72 shrink-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Campaigns</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCampaign(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      selected === c.id
                        ? "border-brand-300 bg-brand-50 text-brand-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[c.channel] }} />
                      <span className="text-xs text-slate-400">{c.channel} · {c.status}</span>
                    </div>
                  </button>
                ))}
                {!campaigns.length && (
                  <p className="text-sm text-slate-400">No campaigns yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Analytics panel */}
          <div className="flex-1">
            {!selected ? (
              <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
                <div className="text-center text-slate-400">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Select a campaign to view analytics</p>
                </div>
              </div>
            ) : analyticsLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-5 h-5 animate-spin text-brand-500" />
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* KPI Row */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Delivery Rate", value: formatPercent(analytics.delivery_rate), color: "text-green-600" },
                    { label: "Open Rate", value: formatPercent(analytics.open_rate), color: "text-blue-600" },
                    { label: "Click Rate", value: formatPercent(analytics.click_rate), color: "text-purple-600" },
                    { label: "Conversion Rate", value: formatPercent(analytics.conversion_rate), color: "text-amber-600" },
                  ].map((m) => (
                    <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <p className="text-xs text-slate-500">{m.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Funnel + Radar */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Communication Funnel</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={funnelData} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="stage" type="category" width={70} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Performance Radar</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Raw counts */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Raw Counts</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {[
                      { label: "Sent", value: analytics.total_sent },
                      { label: "Delivered", value: analytics.total_delivered },
                      { label: "Failed", value: analytics.total_failed },
                      { label: "Opened", value: analytics.total_opened },
                      { label: "Read", value: analytics.total_read },
                      { label: "Clicked", value: analytics.total_clicked },
                      { label: "Converted", value: analytics.total_converted },
                    ].map((m) => (
                      <div key={m.label} className="text-center p-3 bg-slate-50 rounded-lg">
                        <div className="text-lg font-bold text-slate-900">{formatNumber(m.value)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                No analytics available. Launch this campaign to see data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
