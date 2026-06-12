"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCampaigns, getSegments, generateCampaign, createCampaign, launchCampaign } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  Megaphone, Plus, Sparkles, RefreshCw, Send, Eye,
  Target, Zap, Gift, ShoppingCart, Star, Heart,
  CheckCircle2, Clock, TrendingUp, BarChart2, Users, X
} from "lucide-react";

type Campaign = {
  id: string; name: string; status: string; channel: string;
  segment_id?: string; segment_name?: string;
  message?: string; sent_count?: number; delivered_count?: number;
  opened_count?: number; clicked_count?: number;
  scheduled_at?: string; created_at?: string;
};

type Segment = { id: string; name: string; customer_count: number };

function campaignStatus(s: string) {
  const m: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    active:    { label: "Active",    bg: "#F0FDF4", color: "#15803D", dot: "#22C55E" },
    launched:  { label: "Live",      bg: "#F0FDF4", color: "#15803D", dot: "#22C55E" },
    draft:     { label: "Draft",     bg: "#F9FAFB", color: "#6B7280", dot: "#9CA3AF" },
    scheduled: { label: "Scheduled", bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B" },
    completed: { label: "Completed", bg: "#EFF6FF", color: "#1D4ED8", dot: "#2563EB" },
    paused:    { label: "Paused",    bg: "#FEF2F2", color: "#DC2626", dot: "#EF4444" },
  };
  return m[s?.toLowerCase()] || m.draft;
}

const TEMPLATES = [
  {
    icon: Zap, bg: "#EFF6FF", color: "#2563EB",
    name: "Win-Back", desc: "Re-engage lapsed customers with a compelling offer",
    engagement: "38%", reach: "2,400", conversion: "12%",
    prompt: "Win-back campaign for customers inactive for 60+ days with 15% discount",
  },
  {
    icon: Star, bg: "#FFFBEB", color: "#D97706",
    name: "VIP Loyalty", desc: "Reward top spenders with exclusive benefits",
    engagement: "52%", reach: "840", conversion: "28%",
    prompt: "Exclusive VIP loyalty campaign for top 5% spenders with early access perks",
  },
  {
    icon: Gift, bg: "#F5F3FF", color: "#7C3AED",
    name: "Festival Sale", desc: "Seasonal campaign with urgency and discounts",
    engagement: "44%", reach: "12,000", conversion: "18%",
    prompt: "Festival sale campaign with 25% off for all registered customers",
  },
  {
    icon: ShoppingCart, bg: "#FEF2F2", color: "#DC2626",
    name: "Cart Recovery", desc: "Recover abandoned carts with personalized reminders",
    engagement: "61%", reach: "1,200", conversion: "22%",
    prompt: "Cart recovery campaign for customers who abandoned checkout in last 7 days",
  },
  {
    icon: TrendingUp, bg: "#F0FDF4", color: "#16A34A",
    name: "Product Launch", desc: "Announce new products to engaged audience",
    engagement: "40%", reach: "5,600", conversion: "15%",
    prompt: "New product launch announcement campaign for engaged customers last 90 days",
  },
  {
    icon: Heart, bg: "#FFF1F2", color: "#E11D48",
    name: "Birthday Rewards", desc: "Personalized birthday messages with special offers",
    engagement: "72%", reach: "340", conversion: "35%",
    prompt: "Birthday reward campaign with 20% off coupon for customers with birthdays this month",
  },
];

const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: "cmp001", name: "Summer Win-Back",        status: "completed", channel: "whatsapp",
    segment_name: "Dormant 90-Day Users",
    sent_count: 3420, delivered_count: 3147, opened_count: 2451, clicked_count: 752,
    created_at: "2024-11-10T09:00:00Z",
  },
  {
    id: "cmp002", name: "VIP Loyalty Reward",     status: "completed", channel: "email",
    segment_name: "VIP High Spenders",
    sent_count: 1240, delivered_count: 1092, opened_count: 568,  clicked_count: 186,
    created_at: "2024-11-18T14:00:00Z",
  },
  {
    id: "cmp003", name: "Diwali Festival Blast",  status: "completed", channel: "sms",
    segment_name: "Festival Shoppers",
    sent_count: 5600, delivered_count: 5320, opened_count: 4788, clicked_count: 448,
    created_at: "2024-11-28T08:00:00Z",
  },
  {
    id: "cmp004", name: "Mumbai Exclusive Offer", status: "running",   channel: "rcs",
    segment_name: "Mumbai Active Buyers",
    sent_count: 1840, delivered_count: 1564, opened_count: 938,  clicked_count: 0,
    created_at: "2024-12-08T10:30:00Z",
  },
  {
    id: "cmp005", name: "New User Onboarding",    status: "scheduled", channel: "email",
    segment_name: "New Registrations (30d)",
    sent_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0,
    scheduled_at: "2024-12-15T09:00:00Z",
    created_at: "2024-12-10T15:00:00Z",
  },
  {
    id: "cmp006", name: "Cart Recovery Flow",     status: "draft",     channel: "whatsapp",
    segment_name: "WhatsApp Engagers",
    sent_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0,
    created_at: "2024-12-11T11:00:00Z",
  },
];

const DEMO_SEGS: Segment[] = [
  { id: "seg001", name: "VIP High Spenders",       customer_count: 1240 },
  { id: "seg002", name: "Mumbai Active Buyers",     customer_count: 2840 },
  { id: "seg003", name: "Dormant 90-Day Users",     customer_count: 3420 },
  { id: "seg004", name: "Festival Shoppers",        customer_count: 5600 },
  { id: "seg005", name: "New Registrations (30d)",  customer_count: 840  },
  { id: "seg006", name: "WhatsApp Engagers",        customer_count: 4200 },
];

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments]   = useState<Segment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt]       = useState("");
  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [generated, setGenerated] = useState<any>(null);
  const [selSeg, setSelSeg]       = useState("");

  useEffect(() => {
    Promise.all([
      getCampaigns()
        .then((d: any) => setCampaigns(Array.isArray(d) ? d : d.campaigns || []))
        .catch(() => setCampaigns(DEMO_CAMPAIGNS)),
      getSegments()
        .then((d: any) => setSegments(Array.isArray(d) ? d : d.segments || []))
        .catch(() => setSegments(DEMO_SEGS)),
    ]).finally(() => setLoading(false));
  }, []);

  const totals = {
    active:   campaigns.filter(c => ["active","launched"].includes(c.status?.toLowerCase())).length,
    revenue:  campaigns.reduce((s, c) => s + ((c.clicked_count || 0) * 420), 0),
    openRate: campaigns.length
      ? campaigns.reduce((s, c) => s + ((c.opened_count || 0) / Math.max(c.sent_count || 1, 1)), 0) / campaigns.length
      : 0.28,
    ctr: campaigns.length
      ? campaigns.reduce((s, c) => s + ((c.clicked_count || 0) / Math.max(c.sent_count || 1, 1)), 0) / campaigns.length
      : 0.054,
  };

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res: any = await generateCampaign({ prompt, segment_id: selSeg || undefined });
      setGenerated(res);
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  async function handleCreate() {
    if (!generated) return;
    setGenerating(true);
    try {
      await createCampaign({ ...generated, segment_id: selSeg || undefined });
      setShowModal(false); setGenerated(null); setPrompt("");
      const d: any = await getCampaigns();
      setCampaigns(Array.isArray(d) ? d : d.campaigns || []);
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  async function handleLaunch(id: string) {
    setLaunching(id);
    try {
      await launchCampaign(id);
      const d: any = await getCampaigns();
      setCampaigns(Array.isArray(d) ? d : d.campaigns || []);
    } catch (e) { console.error(e); }
    finally { setLaunching(null); }
  }

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <Megaphone className="w-4 h-4" style={{ color: "#D97706" }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>Campaigns</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
              {loading ? "Loading…" : `${campaigns.length} campaigns · AI-generated messaging`}
            </p>
          </div>
        </div>
        <button onClick={() => { setShowModal(true); setGenerated(null); setPrompt(""); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[13px] font-medium text-white"
          style={{ background: "#2563EB" }}>
          <Plus className="w-4 h-4" />New Campaign
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Active Campaigns", value: totals.active,                  icon: Megaphone, bg: "#F0FDF4", color: "#15803D", ibg: "#F0FDF4" },
            { label: "Est. Revenue",     value: formatCurrency(totals.revenue), icon: TrendingUp, bg: "#EFF6FF", color: "#1D4ED8", ibg: "#EFF6FF" },
            { label: "Avg Open Rate",    value: formatPercent(totals.openRate), icon: Eye,       bg: "#FFFBEB", color: "#B45309", ibg: "#FFFBEB" },
            { label: "Avg CTR",          value: formatPercent(totals.ctr),      icon: BarChart2, bg: "#F5F3FF", color: "#6D28D9", ibg: "#F5F3FF" },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-[12px] px-5 py-4 flex items-center gap-3"
              style={{ border: "1px solid #E5E7EB" }}>
              <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
                style={{ background: k.ibg }}>
                <k.icon className="w-4 h-4" style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: "#9CA3AF" }}>{k.label}</p>
                <p className="text-[20px] font-bold leading-tight" style={{ color: "#111827" }}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Campaign List or Templates */}
        {!loading && campaigns.length > 0 ? (
          <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>All Campaigns</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {["Campaign","Channel","Segment","Status","Sent","Open Rate","CTR",""].map(h => (
                    <th key={h} className="text-left py-3 pl-5 pr-4 text-[11px] font-semibold"
                      style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const st = campaignStatus(c.status);
                  const openRate = c.sent_count ? ((c.opened_count || 0) / c.sent_count) : 0;
                  const ctr      = c.sent_count ? ((c.clicked_count || 0) / c.sent_count) : 0;
                  const isDraft  = c.status?.toLowerCase() === "draft";
                  return (
                    <tr key={c.id} className="row-hover" style={{ borderBottom: "1px solid #F9FAFB", cursor: "pointer" }} onClick={() => router.push(`/campaigns/${c.id}`)}>
                      <td className="py-3 pl-5 pr-4">
                        <p className="text-[13px] font-semibold" style={{ color: "#111827" }}>{c.name}</p>
                        <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[11px] font-medium px-2 py-1 rounded-[5px]"
                          style={{ background: "#F9FAFB", color: "#6B7280", border: "1px solid #F3F4F6" }}>
                          {c.channel || "Email"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[12px]" style={{ color: "#6B7280" }}>
                        {c.segment_name || "All Customers"}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: st.bg, color: st.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }}/>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[12px] font-semibold" style={{ color: "#111827" }}>
                        {(c.sent_count || 0).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-[12px]" style={{ color: "#16A34A" }}>
                        {formatPercent(openRate)}
                      </td>
                      <td className="py-3 pr-4 text-[12px]" style={{ color: "#2563EB" }}>
                        {formatPercent(ctr)}
                      </td>
                      <td className="py-3 pr-5">
                        {isDraft && (
                          <button onClick={() => handleLaunch(c.id)}
                            disabled={launching === c.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-semibold text-white"
                            style={{ background: launching===c.id ? "#93C5FD" : "#2563EB", cursor: launching===c.id?"wait":"pointer" }}>
                            {launching===c.id ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                            {launching===c.id ? "…" : "Launch"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>Start with a Template</h3>
              <span className="text-[12px]" style={{ color: "#9CA3AF" }}>AI-powered · Ready to launch</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {TEMPLATES.map(t => (
                <div key={t.name}
                  className="bg-white rounded-[12px] p-5 hover:shadow-md transition-all lift cursor-pointer"
                  style={{ border: "1px solid #E5E7EB" }}
                  onClick={() => { setPrompt(t.prompt); setShowModal(true); setGenerated(null); }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                      style={{ background: t.bg }}>
                      <t.icon className="w-5 h-5" style={{ color: t.color }} />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-semibold" style={{ color: "#111827" }}>{t.name}</h4>
                    </div>
                  </div>
                  <p className="text-[12px] mb-4" style={{ color: "#6B7280" }}>{t.desc}</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Engagement", value: t.engagement },
                      { label: "Avg Reach",  value: t.reach },
                      { label: "Conversion", value: t.conversion },
                    ].map(m => (
                      <div key={m.label} className="text-center px-2 py-1.5 rounded-[6px]"
                        style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                        <p className="text-[13px] font-bold" style={{ color: "#111827" }}>{m.value}</p>
                        <p className="text-[10px]" style={{ color: "#9CA3AF" }}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-2 rounded-[7px] text-[12px] font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                    <Sparkles className="w-3.5 h-3.5" />Use Template →
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className="bg-white rounded-[12px] p-5 h-52 animate-pulse" style={{border:"1px solid #E5E7EB"}}/>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-[16px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid #F3F4F6" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[6px] flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                  <Sparkles className="w-4 h-4" style={{ color: "#2563EB" }} />
                </div>
                <h2 className="text-[15px] font-semibold" style={{ color: "#111827" }}>AI Campaign Studio</h2>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                style={{ border: "1px solid #E5E7EB", color: "#9CA3AF" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "#374151" }}>
                  Campaign Goal
                </label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-[8px] text-[13px] resize-none"
                  style={{ border: "1px solid #E5E7EB", outline: "none", color: "#111827", minHeight: 80, background: "#FAFAFA" }}
                  placeholder='e.g. "Win-back campaign for customers inactive for 60 days"'
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                  onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold block mb-1.5" style={{ color: "#374151" }}>
                  Target Segment (optional)
                </label>
                <select
                  className="w-full px-3 py-2.5 rounded-[8px] text-[13px]"
                  style={{ border: "1px solid #E5E7EB", outline: "none", color: "#111827", background: "#fff" }}
                  value={selSeg}
                  onChange={e => setSelSeg(e.target.value)}>
                  <option value="">All Customers</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.customer_count?.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              {!generated ? (
                <button disabled={generating || !prompt.trim()} onClick={handleGenerate}
                  className="w-full py-2.5 rounded-[8px] text-[13px] font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: generating || !prompt.trim() ? "#93C5FD" : "#2563EB", cursor: generating||!prompt.trim()?"not-allowed":"pointer" }}>
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generating…" : "Generate with AI"}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="px-4 py-3 rounded-[8px]" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: "#9CA3AF" }}>CAMPAIGN NAME</p>
                    <p className="text-[14px] font-semibold" style={{ color: "#111827" }}>{generated.name}</p>
                  </div>
                  <div className="px-4 py-3 rounded-[8px]" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: "#9CA3AF" }}>MESSAGE</p>
                    <p className="text-[13px]" style={{ color: "#374151" }}>{generated.message}</p>
                  </div>
                  {generated.channel && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-[8px]"
                      style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#2563EB" }} />
                      <span className="text-[12px] font-medium" style={{ color: "#1D4ED8" }}>Channel: {generated.channel}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleCreate} disabled={generating}
                      className="flex-1 py-2.5 rounded-[8px] text-[13px] font-semibold text-white flex items-center justify-center gap-2"
                      style={{ background: generating?"#93C5FD":"#2563EB" }}>
                      {generating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                      Save Campaign
                    </button>
                    <button onClick={() => setGenerated(null)}
                      className="px-4 py-2.5 rounded-[8px] text-[13px] font-medium"
                      style={{ border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280" }}>
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
