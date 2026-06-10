"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { getCampaigns, getCampaignAnalytics, getInsights } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { formatPercent, formatNumber, CHANNEL_COLORS } from "@/lib/utils";
import { RefreshCw, TrendingUp, Zap, Radio, Wifi, WifiOff, Lightbulb, AlertTriangle, CheckCircle, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

const BASE_WS = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace("http", "ws");

const INSIGHT_ICONS: Record<string, any> = {
  warning: AlertTriangle,
  opportunity: Zap,
  success: CheckCircle,
  info: Info,
};

const INSIGHT_COLORS: Record<string, string> = {
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  opportunity: "border-purple-200 bg-purple-50 text-purple-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [tab, setTab] = useState<"analytics" | "insights">("analytics");
  const [insights, setInsights] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    getCampaigns({ size: 100 })
      .then((d) => { setCampaigns(d.items || []); })
      .finally(() => setLoading(false));
  }, []);

  const connectWs = useCallback((campaignId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setLiveEvents([]);
    try {
      const ws = new WebSocket(`${BASE_WS}/ws/campaigns/${campaignId}`);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          setLiveEvents((prev) => [data, ...prev].slice(0, 20));
          // Refresh analytics on new event
          getCampaignAnalytics(campaignId).then(setAnalytics).catch(() => {});
        } catch {}
      };
    } catch {
      setWsConnected(false);
    }
  }, []);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  const selectCampaign = (id: string) => {
    setSelected(id);
    setAnalyticsLoading(true);
    setLiveEvents([]);
    getCampaignAnalytics(id)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
    connectWs(id);
  };

  const loadInsights = () => {
    setInsightsLoading(true);
    getInsights()
      .then((d) => setInsights(d.insights || []))
      .catch(() => setInsights([]))
      .finally(() => setInsightsLoading(false));
  };

  useEffect(() => {
    if (tab === "insights" && insights.length === 0) {
      loadInsights();
    }
  }, [tab]);

  const funnelData = analytics ? [
    { stage: "Sent", value: analytics.total_sent },
    { stage: "Delivered", value: analytics.total_delivered },
    { stage: "Opened", value: analytics.total_opened },
    { stage: "Read", value: analytics.total_read },
    { stage: "Clicked", value: analytics.total_clicked },
    { stage: "Converted", value: analytics.total_converted },
  ] : [];

  const radarData = analytics ? [
    { metric: "Delivery", value: Math.round(analytics.delivery_rate * 100) },
    { metric: "Open", value: Math.round(analytics.open_rate * 100) },
    { metric: "Click", value: Math.round(analytics.click_rate * 100) },
    { metric: "Conversion", value: Math.round(analytics.conversion_rate * 100) },
  ] : [];

  return (
    <div className="pb-8">
      <PageHeader title="Campaign Analytics" subtitle="Real-time campaign performance and AI insights" />

      <div className="px-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab("analytics")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === "analytics" ? "bg-white text-slate-900 shadow-sm font-medium" : "text-slate-500 hover:text-slate-700"}`}
          >
            Campaign Analytics
          </button>
          <button
            onClick={() => setTab("insights")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${tab === "insights" ? "bg-white text-slate-900 shadow-sm font-medium" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Lightbulb className="w-3.5 h-3.5" /> AI Insights
          </button>
        </div>

        {tab === "insights" ? (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Claude-powered insights from your current CRM analytics</p>
              <button
                onClick={loadInsights}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            {insightsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Generating insights...</span>
              </div>
            ) : insights.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
                No insights yet. Click Refresh to generate.
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((ins: any, i: number) => {
                  const Icon = INSIGHT_ICONS[ins.type] || Info;
                  const colorClass = INSIGHT_COLORS[ins.type] || INSIGHT_COLORS.info;
                  return (
                    <div key={i} className={`border rounded-xl p-4 ${colorClass}`}>
                      <div className="flex items-start gap-3">
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{ins.title}</p>
                          <p className="text-sm mt-0.5 opacity-80">{ins.description}</p>
                          {ins.action && (
                            <p className="text-xs mt-2 font-medium opacity-90">→ {ins.action}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
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
                  {/* Live status bar */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${wsConnected ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
                    {wsConnected ? (
                      <>
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        Live — streaming real-time events
                        {liveEvents.length > 0 && <span className="ml-auto">{liveEvents.length} events received</span>}
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5" />
                        Offline — connect WebSocket for live updates
                      </>
                    )}
                  </div>

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

                  {/* Raw counts + live event log */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">Raw Counts</h3>
                      <div className="grid grid-cols-4 gap-2">
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

                    {/* Live event feed */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Radio className={`w-3.5 h-3.5 ${wsConnected ? "text-green-500 animate-pulse" : "text-slate-300"}`} />
                        Live Event Feed
                      </h3>
                      {liveEvents.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">
                          {wsConnected ? "Waiting for events..." : "Launch a campaign to see live events"}
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {liveEvents.map((evt, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={`px-1.5 py-0.5 rounded text-white text-[10px] font-medium ${
                                evt.event_type === "CONVERTED" ? "bg-green-600" :
                                evt.event_type === "CLICKED" ? "bg-purple-600" :
                                evt.event_type === "OPENED" ? "bg-blue-600" :
                                evt.event_type === "DELIVERED" ? "bg-teal-600" :
                                evt.event_type === "FAILED" ? "bg-red-600" : "bg-slate-600"
                              }`}>{evt.event_type}</span>
                              <span className="text-slate-400 truncate">{evt.communication_id?.slice(0, 8)}...</span>
                            </div>
                          ))}
                        </div>
                      )}
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
        )}
      </div>
    </div>
  );
}
