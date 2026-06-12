"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Crosshair, Sparkles, Users, Megaphone, Target, BarChart3,
  ArrowRight, TrendingUp, Zap, Bell, Search,
  ShoppingBag, AlertCircle, CheckCircle, Clock
} from "lucide-react";

const QUICK_ACTIONS = [
  {
    icon: Target,
    label: "Build AI Segment",
    desc: "Create a precision audience using natural language",
    href: "/segments",
    color: "#635BFF", bg: "rgba(99,91,255,0.08)",
    tag: "AI-Powered",
  },
  {
    icon: Megaphone,
    label: "Launch Campaign",
    desc: "Generate and launch a campaign in seconds",
    href: "/campaigns",
    color: "#22C55E", bg: "rgba(34,197,94,0.08)",
    tag: "AI-Powered",
  },
  {
    icon: BarChart3,
    label: "View Analytics",
    desc: "Revenue intelligence and performance overview",
    href: "/analytics",
    color: "#F59E0B", bg: "rgba(245,158,11,0.08)",
    tag: "Live",
  },
  {
    icon: Sparkles,
    label: "Ask AI Copilot",
    desc: "Describe any CRM task in plain English",
    href: "/ai-copilot",
    color: "#8B5CF6", bg: "rgba(139,92,246,0.08)",
    tag: "Agentic",
  },
];

const SEARCH_SUGGESTIONS = [
  "Find high-value customers at risk of churn",
  "Show me campaign performance from last month",
  "Create a win-back segment for dormant buyers",
  "What is my predicted revenue for next 30 days?",
  "Which campaigns have the best open rate?",
  "Build a birthday campaign for loyal customers",
];

const ALERTS = [
  { icon: TrendingUp,  color: "#22C55E", bg: "rgba(34,197,94,0.08)",  text: "Revenue up 18% vs last month", time: "Just now",  type: "positive" },
  { icon: AlertCircle, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", text: "340 customers haven't purchased in 90+ days", time: "2 hrs ago", type: "warning" },
  { icon: CheckCircle, color: "#635BFF", bg: "rgba(99,91,255,0.08)",  text: "Summer Sale campaign reached 12,442 users", time: "3 hrs ago", type: "info" },
  { icon: Zap,         color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", text: 'AI auto-updated segment "High Value Buyers"', time: "5 hrs ago", type: "info" },
  { icon: Clock,       color: "#EF4444", bg: "rgba(239,68,68,0.08)",  text: "Diwali Campaign scheduled to launch in 2 days", time: "Yesterday",type: "warning" },
];

const KPI_TILES = [
  { label: "Customers",       value: "24,381",   delta: "+18%",  positive: true,  icon: Users,      color: "#635BFF" },
  { label: "Active Campaigns",value: "7",         delta: "+2",    positive: true,  icon: Megaphone,  color: "#22C55E" },
  { label: "Orders Today",    value: "1,204",     delta: "+34%",  positive: true,  icon: ShoppingBag,color: "#F59E0B" },
  { label: "Churn Risk",      value: "4.2%",      delta: "-0.8%", positive: true,  icon: AlertCircle,color: "#EF4444" },
];

export default function MissionControlPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/ai-copilot?q=${encodeURIComponent(query)}`);
    }
  };

  const useSuggestion = (s: string) => {
    router.push(`/ai-copilot?q=${encodeURIComponent(s)}`);
  };

  return (
    <div className="pb-10" style={{ background: "var(--bg)" }}>
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-6 h-[56px] bg-white"
        style={{ borderBottom: "1px solid #E5E7EB" }}
      >
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4" style={{ color: "#6B7280" }} />
          <h1 className="text-[15px] font-semibold" style={{ color: "#111827" }}>Mission Control</h1>
        </div>
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "#F0FDF4", color: "#16A34A" }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" />
          Claude AI · Online
        </div>
      </div>

      {/* ── Command Search ── */}
      <div className="px-6 pt-5 pb-2">
        <form onSubmit={handleSearch} className="relative">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-white transition-all"
            style={{
              border: focused ? "1.5px solid #635BFF" : "1px solid #E5E7EB",
              boxShadow: focused ? "0 0 0 3px rgba(99,91,255,0.1)" : "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "#9CA3AF" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Ask anything — customers, campaigns, revenue, predictions…"
              className="flex-1 text-[14px] outline-none bg-transparent"
              style={{ color: "#111827" }}
            />
            <button
              type="submit"
              className="btn-primary px-3.5 py-1.5 rounded-[8px] text-[13px] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Ask AI
            </button>
          </div>

          {/* Suggestion dropdown */}
          {focused && (
            <div
              className="absolute top-full left-0 right-0 mt-1.5 rounded-[12px] overflow-hidden z-50"
              style={{ background: "#fff", border: "1px solid #E5E7EB", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}
            >
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "#9CA3AF" }}>Try asking</p>
              </div>
              {SEARCH_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => useSuggestion(s)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "#635BFF" }} />
                  <span className="text-[13px]" style={{ color: "#374151" }}>{s}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: "#9CA3AF" }} />
                </button>
              ))}
              <div className="px-4 py-2.5" style={{ borderTop: "1px solid #F3F4F6" }}>
                <p className="text-[11px]" style={{ color: "#9CA3AF" }}>Powered by Claude · Full agentic CRM intelligence</p>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ── KPI Strip ── */}
      <div className="px-6 pt-4 grid grid-cols-4 gap-4">
        {KPI_TILES.map((k) => (
          <div
            key={k.label}
            className="bg-white flex items-center gap-4 px-5 py-4 rounded-[12px] transition-shadow hover:shadow-md"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: `${k.color}14` }}
            >
              <k.icon className="w-5 h-5" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--t3)" }}>{k.label}</p>
              <p className="text-[20px] font-bold" style={{ color: "var(--t1)", letterSpacing: "-0.03em" }}>{k.value}</p>
              <span
                className="text-[11px] font-bold"
                style={{ color: k.positive ? "#22C55E" : "#EF4444" }}
              >
                {k.delta} vs last month
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions + Alert Feed ── */}
      <div className="px-6 pt-4 grid grid-cols-3 gap-4">
        {/* Quick Actions — 2/3 */}
        <div className="col-span-2">
          <h2 className="text-[11px] font-bold mb-3 uppercase tracking-[0.08em]" style={{ color: "#9CA3AF" }}>Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <a
                key={a.label}
                href={a.href}
                className="bg-white p-5 flex flex-col group rounded-[12px] transition-shadow hover:shadow-md"
                style={{ border: "1px solid #E5E7EB", textDecoration: "none" }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                    style={{ background: a.bg }}
                  >
                    <a.icon className="w-5 h-5" style={{ color: a.color }} />
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: a.bg, color: a.color }}
                  >
                    {a.tag}
                  </span>
                </div>
                <p className="text-[14px] font-bold" style={{ color: "var(--t1)", letterSpacing: "-0.015em" }}>{a.label}</p>
                <p className="text-[12px] mt-1 flex-1" style={{ color: "var(--t2)" }}>{a.desc}</p>
                <div className="flex items-center gap-1.5 mt-4 text-[12px] font-semibold" style={{ color: a.color }}>
                  Open <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Alert Feed — 1/3 */}
        <div className="bg-white p-5 rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold" style={{ color: "var(--t1)" }}>Live Alerts</h2>
            <div
              className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(34,197,94,0.08)", color: "#16A34A" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
          <div className="space-y-3">
            {ALERTS.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: a.bg }}
                >
                  <a.icon className="w-[14px] h-[14px]" style={{ color: a.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] leading-snug" style={{ color: "var(--t1)" }}>{a.text}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--t3)" }}>{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Intelligence Banner ── */}
      <div className="px-6 pt-4 pb-2">
        <div
          className="flex items-center gap-4 p-4 rounded-[12px]"
          style={{ background: "linear-gradient(135deg, #635BFF, #8B5CF6)", boxShadow: "0 4px 20px rgba(99,91,255,0.2)" }}
        >
          <div
            className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0"
            style={{ background: "rgba(99,91,255,0.15)" }}
          >
            <Sparkles className="w-6 h-6" style={{ color: "#C4B5FD" }} />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
              AI Copilot is ready to help
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              Describe any CRM task — build segments, create campaigns, run analytics, or plan workflows — all in plain English.
            </p>
          </div>
          <a
            href="/ai-copilot"
            className="btn-primary px-5 py-2.5 rounded-[12px] text-[13px] flex items-center gap-2 shrink-0"
            style={{ textDecoration: "none" }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Open Copilot
          </a>
        </div>
      </div>
    </div>
  );
}
