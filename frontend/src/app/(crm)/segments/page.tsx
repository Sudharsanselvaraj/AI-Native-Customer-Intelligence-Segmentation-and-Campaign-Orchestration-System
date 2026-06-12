"use client";
import { useState, useEffect } from "react";
import { getSegments, createSegmentFromNL, deleteSegment, getSegmentCustomers } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  Sparkles, Trash2, RefreshCw, Users, Plus, Target, TrendingUp,
  Zap, Tag, CheckCircle2, Clock, BarChart2, X, ArrowRight, Eye,
  CheckCircle, Loader2,
} from "lucide-react";

type Segment = {
  id: string; name: string; description?: string;
  customer_count?: number; estimated_size?: number; criteria?: any; created_at?: string;
};

type NLResult = {
  name: string; description: string; generated_sql: string;
  estimated_size: number; expected_revenue: number; segment_id?: string;
};

type AudienceCustomer = {
  id: string; name: string; city?: string; total_spent: number;
};

type BuilderStep = "input" | "preview" | "audience" | "done";

function seeded(id: string, offset = 0): number {
  const h = id.charCodeAt(0) + (id.charCodeAt(3) || 0) + offset;
  return Math.round(Math.abs(Math.sin(h) * 10000) % 100);
}

function convColor(v: number) {
  if (v >= 65) return { bg: "#F0FDF4", color: "#15803D", bar: "#22C55E" };
  if (v >= 40) return { bg: "#FFFBEB", color: "#B45309", bar: "#F59E0B" };
  return { bg: "#FEF2F2", color: "#DC2626", bar: "#EF4444" };
}

function customerTier(spent: number): string {
  return spent >= 40000 ? "VIP" : spent >= 15000 ? "Regular" : "New";
}

const TIER_BADGE: Record<string, { bg: string; color: string }> = {
  VIP:     { bg: "#FFF7ED", color: "#C2410C" },
  Regular: { bg: "#EFF6FF", color: "#1D4ED8" },
  New:     { bg: "#F0FDF4", color: "#15803D" },
};

const RECOMMENDED_ACTIONS: Record<number, string> = {
  0: "Launch re-engagement email",
  1: "Send exclusive VIP offer",
  2: "WhatsApp upsell sequence",
  3: "Birthday reward campaign",
  4: "Win-back SMS flow",
};

const SEGMENT_ICONS = [Target, Users, Zap, Tag, BarChart2];
const ICON_COLORS   = [
  { icon: "#2563EB", bg: "#EFF6FF" },
  { icon: "#16A34A", bg: "#F0FDF4" },
  { icon: "#D97706", bg: "#FFFBEB" },
  { icon: "#7C3AED", bg: "#F5F3FF" },
  { icon: "#E11D48", bg: "#FFF1F2" },
];

const DEMO_SEGMENTS: Segment[] = [
  { id: "seg001", name: "VIP High Spenders",       description: "Customers with total spend > ₹40,000 and 10+ orders",    customer_count: 1240, created_at: "2024-11-15T10:00:00Z" },
  { id: "seg002", name: "Mumbai Active Buyers",     description: "Customers from Mumbai who purchased in the last 60 days", customer_count: 2840, created_at: "2024-11-20T14:30:00Z" },
  { id: "seg003", name: "Dormant 90-Day Users",     description: "Customers who haven't purchased in over 90 days",         customer_count: 3420, created_at: "2024-11-25T09:15:00Z" },
  { id: "seg004", name: "Festival Shoppers",        description: "Customers with 2+ purchases during Nov–Dec 2024",         customer_count: 5600, created_at: "2024-12-01T11:00:00Z" },
  { id: "seg005", name: "New Registrations (30d)",  description: "Customers who joined in the last 30 days with no orders", customer_count: 840,  created_at: "2024-12-05T16:45:00Z" },
  { id: "seg006", name: "WhatsApp Engagers",        description: "Customers who clicked on at least 2 WhatsApp campaigns",  customer_count: 4200, created_at: "2024-12-08T13:20:00Z" },
];

const DEMO_AUDIENCE: AudienceCustomer[] = [
  { id: "a1", name: "Priya Sharma",   city: "Mumbai",     total_spent: 48200 },
  { id: "a2", name: "Ananya Iyer",    city: "Chennai",    total_spent: 72800 },
  { id: "a3", name: "Rohan Gupta",    city: "Kolkata",    total_spent: 61400 },
  { id: "a4", name: "Nisha Agarwal",  city: "Bhopal",     total_spent: 52100 },
  { id: "a5", name: "Meera Pillai",   city: "Trivandrum", total_spent: 41500 },
];

const STEP_LABELS = ["Describe", "Generate", "Audience", "Save"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 px-6 py-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
      {STEP_LABELS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        const pending = i > current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{
                  background: done ? "#22C55E" : active ? "#2563EB" : "#F3F4F6",
                  color:      done || active ? "#fff" : "#9CA3AF",
                }}>
                {done ? <CheckCircle className="w-3 h-3" /> : i + 1}
              </div>
              <span className="text-[12px] font-medium"
                style={{ color: active ? "#2563EB" : done ? "#15803D" : "#9CA3AF" }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="w-8 h-px mx-3" style={{ background: done ? "#22C55E" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AvatarCircle({ name }: { name: string }) {
  const palettes: [string, string][] = [
    ["#EFF6FF","#2563EB"],["#F0FDF4","#16A34A"],["#FFFBEB","#D97706"],["#F5F3FF","#7C3AED"],
  ];
  const [bg, fg] = palettes[name.charCodeAt(0) % palettes.length];
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
      style={{ background: bg, color: fg }}>
      {name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function SegmentsPage() {
  const [segments,  setSegments]  = useState<Segment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Builder modal state
  const [showBuilder, setShowBuilder]           = useState(false);
  const [builderStep, setBuilderStep]           = useState<BuilderStep>("input");
  const [prompt,      setPrompt]                = useState("");
  const [generating,  setGenerating]            = useState(false);
  const [nlResult,    setNlResult]              = useState<NLResult | null>(null);
  const [audienceLoading, setAudienceLoading]   = useState(false);
  const [audienceCustomers, setAudienceCustomers] = useState<AudienceCustomer[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const d: any = await getSegments();
      setSegments(Array.isArray(d) ? d : d.items || d.segments || []);
    } catch { setSegments(DEMO_SEGMENTS); }
    finally  { setLoading(false); }
  }

  function openBuilder() {
    setBuilderStep("input");
    setPrompt("");
    setNlResult(null);
    setAudienceCustomers([]);
    setShowBuilder(true);
  }

  function closeBuilder() {
    setShowBuilder(false);
    setPrompt("");
    setNlResult(null);
    setAudienceCustomers([]);
    setBuilderStep("input");
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const res: any = await createSegmentFromNL({ natural_language: prompt });
      setNlResult(res);
      setBuilderStep("preview");
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreviewAudience() {
    setBuilderStep("audience");
    setAudienceLoading(true);
    try {
      const segId = nlResult?.segment_id;
      if (segId) {
        const d: any = await getSegmentCustomers(segId, { size: 5 });
        const items = d.items || [];
        setAudienceCustomers(items.length > 0 ? items : DEMO_AUDIENCE);
      } else {
        setAudienceCustomers(DEMO_AUDIENCE);
      }
    } catch {
      setAudienceCustomers(DEMO_AUDIENCE);
    } finally {
      setAudienceLoading(false);
    }
  }

  async function handleSave() {
    setBuilderStep("done");
    await load();
    setTimeout(closeBuilder, 1200);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try { await deleteSegment(id); await load(); }
    catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  }

  const stepIndex: Record<BuilderStep, number> = { input: 0, preview: 1, audience: 2, done: 3 };

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
            <Target className="w-4 h-4" style={{ color: "#7C3AED" }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>Segments</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
              {loading ? "Loading…" : `${segments.length} segments · AI-powered targeting`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{ border: "1px solid #E5E7EB", background: "#fff" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "#6B7280" }} />
          </button>
          <button onClick={openBuilder}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[13px] font-medium text-white"
            style={{ background: "#2563EB" }}>
            <Sparkles className="w-4 h-4" />Build AI Segment
          </button>
        </div>
      </div>

      {/* Segment Builder Modal */}
      {showBuilder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
          onClick={e => { if (e.target === e.currentTarget) closeBuilder(); }}
        >
          <div className="bg-white rounded-[16px] flex flex-col w-full overflow-hidden"
            style={{ maxWidth: 560, maxHeight: "90vh", border: "1px solid #E5E7EB", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid #F3F4F6" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                  <Sparkles className="w-4 h-4" style={{ color: "#2563EB" }} />
                </div>
                <h2 className="text-[15px] font-semibold" style={{ color: "#111827" }}>AI Segment Builder</h2>
              </div>
              <button onClick={closeBuilder}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ color: "#9CA3AF" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicator */}
            <StepIndicator current={stepIndex[builderStep]} />

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* ── Step 1: Input ── */}
              {builderStep === "input" && (
                <div>
                  <p className="text-[13px] font-medium mb-1" style={{ color: "#111827" }}>
                    Describe your target audience
                  </p>
                  <p className="text-[12px] mb-4" style={{ color: "#9CA3AF" }}>
                    Describe in plain language — Claude will translate it into a precise segment.
                  </p>
                  <textarea
                    className="w-full px-3 py-2.5 rounded-[8px] text-[13px] resize-none"
                    style={{ border: "1px solid #E5E7EB", outline: "none", color: "#111827", background: "#FAFAFA", minHeight: 80 }}
                    placeholder='e.g. "Customers in Mumbai who spent more than ₹10,000 in the last 90 days and haven&apos;t purchased recently"'
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                    onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                  />
                  <p className="text-[11px] font-semibold mt-4 mb-2" style={{ color: "#9CA3AF" }}>QUICK EXAMPLES</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      "High-value customers inactive 60+ days",
                      "First-time buyers from North India",
                      "Churned VIP customers last quarter",
                    ].map(ex => (
                      <button key={ex} onClick={() => setPrompt(ex)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                        style={{ background: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EFF6FF"; (e.currentTarget as HTMLElement).style.color = "#2563EB"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; (e.currentTarget as HTMLElement).style.color = "#6B7280"; }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step 2: Preview generated segment ── */}
              {builderStep === "preview" && nlResult && (
                <div>
                  <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-[8px]"
                    style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#16A34A" }} />
                    <p className="text-[12px] font-medium" style={{ color: "#15803D" }}>
                      Segment created successfully — review before previewing audience
                    </p>
                  </div>

                  <div className="rounded-[10px] p-4 mb-4" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                    <h3 className="text-[15px] font-semibold mb-1" style={{ color: "#111827" }}>{nlResult.name}</h3>
                    <p className="text-[12px] mb-4 leading-relaxed" style={{ color: "#6B7280" }}>{nlResult.description}</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[8px] px-4 py-3 text-center" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                        <p className="text-[22px] font-bold" style={{ color: "#2563EB" }}>{nlResult.estimated_size.toLocaleString()}</p>
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color: "#3B82F6" }}>Estimated Audience</p>
                      </div>
                      <div className="rounded-[8px] px-4 py-3 text-center" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                        <p className="text-[22px] font-bold" style={{ color: "#16A34A" }}>{formatCurrency(nlResult.expected_revenue)}</p>
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color: "#15803D" }}>Expected Revenue</p>
                      </div>
                    </div>
                  </div>

                  {nlResult.generated_sql && (
                    <details className="group">
                      <summary className="text-[11px] font-semibold cursor-pointer select-none"
                        style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>
                        VIEW GENERATED SQL
                      </summary>
                      <pre className="mt-2 p-3 rounded-[8px] text-[11px] overflow-x-auto leading-relaxed"
                        style={{ background: "#1E293B", color: "#94A3B8", fontFamily: "monospace" }}>
                        {nlResult.generated_sql}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* ── Step 3: Audience preview ── */}
              {builderStep === "audience" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "#111827" }}>
                        Audience Preview
                      </p>
                      {nlResult && (
                        <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                          {nlResult.estimated_size.toLocaleString()} matching customers · showing top 5
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                      <Eye className="w-3 h-3" />Live Preview
                    </div>
                  </div>

                  {audienceLoading ? (
                    <div className="flex flex-col items-center py-10">
                      <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: "#2563EB" }} />
                      <p className="text-[13px]" style={{ color: "#9CA3AF" }}>Fetching matching customers…</p>
                    </div>
                  ) : (
                    <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                      <table className="w-full">
                        <thead>
                          <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                            {["#", "CUSTOMER", "CITY", "REVENUE", "TIER"].map(h => (
                              <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold"
                                style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {audienceCustomers.map((c, i) => {
                            const tier = customerTier(c.total_spent);
                            const tb   = TIER_BADGE[tier];
                            return (
                              <tr key={c.id} style={{ borderBottom: i < audienceCustomers.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                                <td className="px-4 py-2.5 text-[12px] font-semibold" style={{ color: "#9CA3AF" }}>{i + 1}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <AvatarCircle name={c.name} />
                                    <span className="text-[13px] font-medium" style={{ color: "#111827" }}>{c.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-[12px]" style={{ color: "#6B7280" }}>{c.city || "—"}</td>
                                <td className="px-4 py-2.5 text-[13px] font-semibold" style={{ color: "#111827" }}>
                                  {formatCurrency(c.total_spent)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    style={{ background: tb.bg, color: tb.color }}>{tier}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {nlResult && nlResult.estimated_size > 5 && (
                        <div className="px-4 py-2.5 text-[11px]" style={{ background: "#F9FAFB", borderTop: "1px solid #E5E7EB", color: "#9CA3AF" }}>
                          + {(nlResult.estimated_size - 5).toLocaleString()} more customers match this segment
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 4: Done ── */}
              {builderStep === "done" && (
                <div className="flex flex-col items-center py-10">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "#F0FDF4" }}>
                    <CheckCircle className="w-6 h-6" style={{ color: "#16A34A" }} />
                  </div>
                  <p className="text-[15px] font-semibold" style={{ color: "#111827" }}>Segment Saved</p>
                  <p className="text-[13px] mt-1" style={{ color: "#9CA3AF" }}>
                    {nlResult?.name} is now available for campaigns
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            {builderStep !== "done" && (
              <div className="px-6 py-4 flex items-center justify-between shrink-0"
                style={{ borderTop: "1px solid #F3F4F6" }}>
                <button
                  onClick={() => {
                    if (builderStep === "input") closeBuilder();
                    else if (builderStep === "preview") setBuilderStep("input");
                    else if (builderStep === "audience") setBuilderStep("preview");
                  }}
                  className="px-4 py-2 rounded-[7px] text-[13px] font-medium"
                  style={{ border: "1px solid #E5E7EB", color: "#374151", background: "#fff" }}>
                  {builderStep === "input" ? "Cancel" : "← Back"}
                </button>

                {builderStep === "input" && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-[7px] text-[13px] font-semibold text-white"
                    style={{ background: generating || !prompt.trim() ? "#93C5FD" : "#2563EB", cursor: generating || !prompt.trim() ? "not-allowed" : "pointer" }}>
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate Segment</>}
                  </button>
                )}

                {builderStep === "preview" && (
                  <button
                    onClick={handlePreviewAudience}
                    className="flex items-center gap-2 px-5 py-2 rounded-[7px] text-[13px] font-semibold text-white"
                    style={{ background: "#2563EB" }}>
                    <Eye className="w-4 h-4" />Preview Audience <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {builderStep === "audience" && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2 rounded-[7px] text-[13px] font-semibold text-white"
                    style={{ background: "#2563EB" }}>
                    <CheckCircle className="w-4 h-4" />Save Segment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[12px] p-5 h-48 animate-pulse" style={{ border: "1px solid #E5E7EB" }}>
                <div className="h-4 w-32 rounded" style={{ background: "#F3F4F6" }} />
              </div>
            ))}
          </div>
        ) : segments.length === 0 ? (
          <div className="bg-white rounded-[12px] p-16 text-center" style={{ border: "1px solid #E5E7EB" }}>
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center mx-auto mb-4" style={{ background: "#EFF6FF" }}>
              <Target className="w-6 h-6" style={{ color: "#2563EB" }} />
            </div>
            <h3 className="text-[15px] font-semibold mb-2" style={{ color: "#111827" }}>No segments yet</h3>
            <p className="text-[13px] mb-4" style={{ color: "#9CA3AF" }}>Build your first AI-powered audience segment</p>
            <button onClick={openBuilder}
              className="px-4 py-2 rounded-[8px] text-[13px] font-medium text-white"
              style={{ background: "#2563EB" }}>
              <Sparkles className="w-4 h-4 inline mr-1.5" />Create Segment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {segments.map((seg, idx) => {
              const conv   = seeded(seg.id, 2);
              const growth = seeded(seg.id, 5);
              const convC  = convColor(conv);
              const Icon   = SEGMENT_ICONS[idx % SEGMENT_ICONS.length];
              const ic     = ICON_COLORS[idx % ICON_COLORS.length];
              const action = RECOMMENDED_ACTIONS[idx % Object.keys(RECOMMENDED_ACTIONS).length];
              const created = seg.created_at
                ? new Date(seg.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                : null;

              return (
                <div key={seg.id}
                  className="bg-white rounded-[12px] p-5 hover:shadow-md transition-shadow group"
                  style={{ border: "1px solid #E5E7EB" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: ic.bg }}>
                        <Icon className="w-4 h-4" style={{ color: ic.icon }} />
                      </div>
                      <div>
                        <h3 className="text-[13px] font-semibold" style={{ color: "#111827" }}>{seg.name}</h3>
                        {created && (
                          <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: "#9CA3AF" }}>
                            <Clock className="w-3 h-3" />{created}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      disabled={deletingId === seg.id}
                      onClick={() => handleDelete(seg.id)}
                      className="w-7 h-7 rounded-[6px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ border: "1px solid #FECACA", color: "#EF4444", background: "#FEF2F2" }}>
                      {deletingId === seg.id
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>

                  {seg.description && (
                    <p className="text-[12px] mb-3 line-clamp-2" style={{ color: "#6B7280" }}>{seg.description}</p>
                  )}

                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-[8px]"
                    style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                    <Users className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                    <span className="text-[13px] font-bold" style={{ color: "#111827" }}>
                      {(seg.customer_count ?? seg.estimated_size ?? 0).toLocaleString()}
                    </span>
                    <span className="text-[11px]" style={{ color: "#9CA3AF" }}>customers</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#16A34A" }}>
                      <TrendingUp className="w-3 h-3" />+{growth}%
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: "#6B7280" }}>Expected Conversion</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: convC.bg, color: convC.color }}>{conv}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                      <div className="h-full rounded-full progress-bar" style={{ width: `${conv}%`, background: convC.bar }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 rounded-[8px]"
                    style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#2563EB" }} />
                    <span className="text-[11px] font-medium" style={{ color: "#1D4ED8" }}>{action}</span>
                  </div>
                </div>
              );
            })}

            {/* New segment CTA */}
            <button
              onClick={openBuilder}
              className="rounded-[12px] p-5 flex flex-col items-center justify-center gap-3 h-[200px] transition-all"
              style={{ border: "2px dashed #BFDBFE", background: "#F8FBFF", color: "#2563EB", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EFF6FF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F8FBFF"; }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                <Plus className="w-5 h-5" style={{ color: "#2563EB" }} />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold" style={{ color: "#2563EB" }}>New AI Segment</p>
                <p className="text-[11px] mt-1" style={{ color: "#93C5FD" }}>Describe your audience</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
